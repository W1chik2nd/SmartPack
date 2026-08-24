// Weather adapter. Open-Meteo remains the primary source; MET Norway keeps
// production usable when a shared hosting egress IP is throttled upstream.

import type {
  ForecastDay,
  TripForecast,
  Weather,
} from "../shared/weather-types.ts";

export const DEFAULT_COORDS = { lat: 53.8008, lon: -1.5491 }; // Leeds, UK

const CURRENT_TTL_MS = 10 * 60 * 1_000;
const FORECAST_TTL_MS = 30 * 60 * 1_000;
const STALE_TTL_MS = 6 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRY_DELAY_MS = 1_000;
const WEATHER_USER_AGENT =
  "WearRoute/1.0 https://github.com/W1chik2nd/WearRoute";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

function describeWmo(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "—";
}

function describeMet(symbol: string): string {
  const value = symbol.toLowerCase();
  if (value.includes("thunder")) return "Thunderstorm";
  if (value.includes("snowshowers")) return "Snow showers";
  if (value.includes("snow") || value.includes("sleet")) return "Snow";
  if (value.includes("rainshowers")) return "Showers";
  if (value.includes("rain")) return "Rain";
  if (value.includes("fog")) return "Fog";
  if (value.includes("fair") || value.includes("partlycloudy")) {
    return "Partly cloudy";
  }
  if (value.includes("cloudy")) return "Overcast";
  if (value.includes("clearsky")) return "Clear";
  return "—";
}

function retryDelay(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}

async function providerFetch(
  url: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  let response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status !== 429 && response.status < 500) return response;

  const delay = retryDelay(response);
  if (delay === null || delay > MAX_RETRY_DELAY_MS) return response;
  await new Promise((resolve) => setTimeout(resolve, delay));
  response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response;
}

async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;

  try {
    const value = await load();
    cache.set(key, {
      value,
      expiresAt: now + ttlMs,
      staleUntil: now + STALE_TTL_MS,
    });
    return value;
  } catch (error) {
    if (existing && existing.staleUntil > now) return existing.value;
    throw error;
  }
}

function openMeteoUrl(params: URLSearchParams): string {
  const key = process.env.OPEN_METEO_API_KEY?.trim();
  if (key) params.set("apikey", key);
  const host = key ? "customer-api.open-meteo.com" : "api.open-meteo.com";
  return `https://${host}/v1/forecast?${params}`;
}

async function openMeteoCurrent(lat: number, lon: number): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,weather_code",
  });
  const response = await providerFetch(openMeteoUrl(params), {
    "User-Agent": WEATHER_USER_AGENT,
  });
  if (!response.ok) throw new Error(`Open-Meteo failed (${response.status})`);

  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Open-Meteo returned no current weather.");
  }
  return {
    tempC: current.temperature_2m,
    condition: describeWmo(current.weather_code ?? -1),
  };
}

type MetTimeseries = {
  time?: string;
  data?: {
    instant?: {
      details?: {
        air_temperature?: number;
        wind_speed?: number;
        ultraviolet_index_clear_sky?: number;
      };
    };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
    next_12_hours?: MetPeriod;
  };
};

type MetPeriod = {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number };
};

async function metNorwayTimeseries(
  lat: number,
  lon: number
): Promise<MetTimeseries[]> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const response = await providerFetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/complete?${params}`,
    { "User-Agent": WEATHER_USER_AGENT }
  );
  if (!response.ok) throw new Error(`MET Norway failed (${response.status})`);
  const data = (await response.json()) as {
    properties?: { timeseries?: MetTimeseries[] };
  };
  const timeseries = data.properties?.timeseries;
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error("MET Norway returned no weather data.");
  }
  return timeseries;
}

function metPeriod(entry: MetTimeseries): MetPeriod | undefined {
  return (
    entry.data?.next_1_hours ??
    entry.data?.next_6_hours ??
    entry.data?.next_12_hours
  );
}

async function metNorwayCurrent(lat: number, lon: number): Promise<Weather> {
  const first = (await metNorwayTimeseries(lat, lon))[0];
  const temperature = first.data?.instant?.details?.air_temperature;
  if (typeof temperature !== "number") {
    throw new Error("MET Norway returned no current temperature.");
  }
  return {
    tempC: temperature,
    condition: describeMet(metPeriod(first)?.summary?.symbol_code ?? ""),
  };
}

export async function loadCurrentWeather(lat: number, lon: number): Promise<Weather> {
  const key = `current:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return cached(key, CURRENT_TTL_MS, async () => {
    try {
      return await openMeteoCurrent(lat, lon);
    } catch (error) {
      console.warn(`[weather] ${String(error)}; falling back to MET Norway`);
      return metNorwayCurrent(lat, lon);
    }
  });
}

async function openMeteoForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<TripForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "auto",
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "uv_index_max",
      "wind_speed_10m_max",
    ].join(","),
  });
  const response = await providerFetch(openMeteoUrl(params), {
    "User-Agent": WEATHER_USER_AGENT,
  });
  if (!response.ok) throw new Error(`Open-Meteo failed (${response.status})`);

  const data = (await response.json()) as { daily?: Record<string, unknown> };
  const daily = data.daily;
  const time = daily?.time;
  const codes = daily?.weather_code;
  const max = daily?.temperature_2m_max;
  const min = daily?.temperature_2m_min;
  const rain = daily?.precipitation_probability_max;
  const uv = daily?.uv_index_max;
  const wind = daily?.wind_speed_10m_max;
  if (
    !Array.isArray(time) ||
    !Array.isArray(codes) ||
    !Array.isArray(max) ||
    !Array.isArray(min) ||
    !Array.isArray(rain) ||
    !Array.isArray(uv) ||
    !Array.isArray(wind) ||
    !time.every((value) => typeof value === "string") ||
    ![codes, max, min, rain, uv, wind].every(
      (values) =>
        values.length === time.length &&
        values.every((value) => typeof value === "number")
    )
  ) {
    throw new Error("Open-Meteo returned incomplete forecast data.");
  }

  return {
    source: "Open-Meteo",
    available: true,
    note: "Destination-local daily forecast supplied by Open-Meteo.",
    days: time.map((date, index) => ({
      date,
      condition: describeWmo(codes[index]),
      minTempC: min[index],
      maxTempC: max[index],
      precipitationProbability: rain[index],
      uvIndex: uv[index],
      maxWindKph: wind[index],
    })),
  };
}

function estimatedRainRisk(symbol: string, amountMm: number): number {
  const value = symbol.toLowerCase();
  if (value.includes("thunder") || value.includes("heavyrain")) return 95;
  if (value.includes("rain") || value.includes("sleet")) return 80;
  if (value.includes("snow")) return 70;
  if (amountMm >= 5) return 90;
  if (amountMm >= 1) return 70;
  if (amountMm > 0) return 40;
  return 0;
}

async function metNorwayForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<TripForecast> {
  const entries = await metNorwayTimeseries(lat, lon);
  const grouped = new Map<string, MetTimeseries[]>();
  for (const entry of entries) {
    const date = entry.time?.slice(0, 10);
    if (!date || date < startDate || date > endDate) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), entry]);
  }

  const days: ForecastDay[] = [];
  for (const [date, values] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const temperatures = values
      .map((value) => value.data?.instant?.details?.air_temperature)
      .filter((value): value is number => typeof value === "number");
    if (temperatures.length === 0) continue;
    const weather = values
      .map((value) => ({
        symbol: metPeriod(value)?.summary?.symbol_code ?? "",
        amount: metPeriod(value)?.details?.precipitation_amount ?? 0,
      }))
      .sort((a, b) => estimatedRainRisk(b.symbol, b.amount) - estimatedRainRisk(a.symbol, a.amount))[0];
    const uv = values
      .map((value) => value.data?.instant?.details?.ultraviolet_index_clear_sky)
      .filter((value): value is number => typeof value === "number");
    const wind = values
      .map((value) => value.data?.instant?.details?.wind_speed)
      .filter((value): value is number => typeof value === "number");
    days.push({
      date,
      condition: describeMet(weather.symbol),
      minTempC: Math.min(...temperatures),
      maxTempC: Math.max(...temperatures),
      precipitationProbability: estimatedRainRisk(weather.symbol, weather.amount),
      uvIndex: uv.length ? Math.max(...uv) : 0,
      maxWindKph: wind.length ? Math.max(...wind) * 3.6 : 0,
    });
  }

  if (days.length === 0) {
    throw new Error("MET Norway has no forecast for the selected dates.");
  }
  return {
    source: "MET Norway",
    available: true,
    note: "Backup forecast; rain percentage is estimated from precipitation amount and symbols.",
    days,
  };
}

/** Destination forecast for the selected dates; unavailable beats fake data. */
export async function loadDestinationForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<TripForecast> {
  const key = `forecast:${lat.toFixed(3)},${lon.toFixed(3)}:${startDate}:${endDate}`;
  try {
    return await cached(key, FORECAST_TTL_MS, async () => {
      try {
        return await openMeteoForecast(lat, lon, startDate, endDate);
      } catch (primaryError) {
        console.warn(`[weather] ${String(primaryError)}; falling back to MET Norway`);
        return metNorwayForecast(lat, lon, startDate, endDate);
      }
    });
  } catch (error) {
    console.warn(`[weather] ${String(error)}`);
    return {
      source: "Open-Meteo",
      available: false,
      note: "Weather providers are temporarily unavailable or the dates are outside their forecast windows.",
      days: [],
    };
  }
}
