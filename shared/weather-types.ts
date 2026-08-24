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
  source: "Open-Meteo" | "MET Norway";
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
