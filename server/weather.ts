// Weather adapter — Open-Meteo (https://open-meteo.com), free and keyless,
// so the dashboard works with zero configuration. Lives on the server
// (AGENTS.md §3) so the future iOS client gets weather from our API, not
// from a vendor SDK.

export type Weather = {
  tempC: number;
  condition: string;
};

export type ForecastDay = {
  date: string;
  condition: string;
  minTempC: number;
  maxTempC: number;
  precipitationProbability: number;
  uvIndex: number;
  maxWindKph: number;
};

export type TripForecast = {
  source: "Open-Meteo";
  available: boolean;
  note: string;
  days: ForecastDay[];
};

export type TripWeather = {
  trip: {
    id: string;
    destination: string;
    destinationDetail: string;
    startDate: string;
    endDate: string;
    dayCount: number;
  };
  forecast: TripForecast;
};

// Fallback when the browser denies geolocation: the team's home base.
export const DEFAULT_COORDS = { lat: 53.8008, lon: -1.5491 }; // Leeds, UK

// WMO weather interpretation codes → short labels.
function describe(code: number): string {
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

export async function currentWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather service failed (${res.status})`);
  }
  // Third-party response = untrusted external data: check the shape we use.
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Weather service returned no data.");
  }
  return {
    tempC: current.temperature_2m,
    condition: describe(current.weather_code ?? -1),
  };
}

/** Destination forecast for the selected dates; unavailable beats fake data. */
export async function destinationForecast(
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

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) {
      return {
        source: "Open-Meteo",
        available: false,
        note: "Selected dates are outside the reliable forecast window.",
        days: [],
      };
    }
    const data = (await res.json()) as {
      daily?: Record<string, unknown>;
    };
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
      !time.every((v) => typeof v === "string") ||
      ![codes, max, min, rain, uv, wind].every(
        (values) =>
          values.length === time.length && values.every((v) => typeof v === "number")
      )
    ) {
      return {
        source: "Open-Meteo",
        available: false,
        note: "The weather provider returned incomplete forecast data.",
        days: [],
      };
    }

    return {
      source: "Open-Meteo",
      available: true,
      note: "Destination-local daily forecast supplied by Open-Meteo.",
      days: time.map((date, i) => ({
        date,
        condition: describe(codes[i]),
        minTempC: min[i],
        maxTempC: max[i],
        precipitationProbability: rain[i],
        uvIndex: uv[i],
        maxWindKph: wind[i],
      })),
    };
  } catch {
    return {
      source: "Open-Meteo",
      available: false,
      note: "The destination forecast service is temporarily unavailable.",
      days: [],
    };
  }
}

/**
 * Assemble the client-ready weather view from one saved trip. Keeping the
 * inclusive day count and provider call here gives web and iOS one contract.
 */
export async function weatherForTrip(plan: {
  id: string;
  placeName: string;
  placeDetail: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
}): Promise<TripWeather> {
  const forecast = await destinationForecast(
    plan.lat,
    plan.lon,
    plan.startDate,
    plan.endDate
  );
  const start = Date.parse(`${plan.startDate}T00:00:00Z`);
  const end = Date.parse(`${plan.endDate}T00:00:00Z`);

  return {
    trip: {
      id: plan.id,
      destination: plan.placeName,
      destinationDetail: plan.placeDetail,
      startDate: plan.startDate,
      endDate: plan.endDate,
      dayCount: Math.round((end - start) / 86_400_000) + 1,
    },
    forecast,
  };
}
