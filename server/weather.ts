// Client-facing weather contract. Provider selection, caching, retry, and
// failover stay behind this module so web and iOS share identical behaviour.

import { tripDaysInclusive } from "../shared/trip-constraints.ts";
import type {
  TripForecast,
  TripWeather,
  Weather,
} from "../shared/weather-types.ts";
import {
  loadCurrentWeather,
  loadDestinationForecast,
} from "./weather-providers.ts";

export type {
  ForecastDay,
  TripForecast,
  TripWeather,
  Weather,
} from "../shared/weather-types.ts";
export { DEFAULT_COORDS } from "./weather-providers.ts";

export function currentWeather(lat: number, lon: number): Promise<Weather> {
  return loadCurrentWeather(lat, lon);
}

export function destinationForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<TripForecast> {
  return loadDestinationForecast(lat, lon, startDate, endDate);
}

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
  return {
    trip: {
      id: plan.id,
      destination: plan.placeName,
      destinationDetail: plan.placeDetail,
      startDate: plan.startDate,
      endDate: plan.endDate,
      dayCount: tripDaysInclusive(plan.startDate, plan.endDate),
    },
    forecast,
  };
}
