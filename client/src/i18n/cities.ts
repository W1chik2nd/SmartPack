// Major cities for the dashboard weather picker. Coordinates only — weather
// interpretation stays on the server (/api/weather). The chosen city id is
// persisted in localStorage so it survives refreshes and redirects.

export type City = {
  id: string;
  en: string;
  zh: string;
  lat: number;
  lon: number;
};

export const CITIES: City[] = [
  { id: "chengdu", en: "Chengdu", zh: "成都", lat: 30.5728, lon: 104.0668 },
  { id: "leeds", en: "Leeds", zh: "利兹", lat: 53.8008, lon: -1.5491 },
  { id: "london", en: "London", zh: "伦敦", lat: 51.5074, lon: -0.1278 },
  { id: "beijing", en: "Beijing", zh: "北京", lat: 39.9042, lon: 116.4074 },
  { id: "shanghai", en: "Shanghai", zh: "上海", lat: 31.2304, lon: 121.4737 },
  { id: "shenzhen", en: "Shenzhen", zh: "深圳", lat: 22.5431, lon: 114.0579 },
  { id: "hongkong", en: "Hong Kong", zh: "香港", lat: 22.3193, lon: 114.1694 },
  { id: "tokyo", en: "Tokyo", zh: "东京", lat: 35.6762, lon: 139.6503 },
  { id: "seoul", en: "Seoul", zh: "首尔", lat: 37.5665, lon: 126.978 },
  { id: "singapore", en: "Singapore", zh: "新加坡", lat: 1.3521, lon: 103.8198 },
  { id: "sydney", en: "Sydney", zh: "悉尼", lat: -33.8688, lon: 151.2093 },
  { id: "paris", en: "Paris", zh: "巴黎", lat: 48.8566, lon: 2.3522 },
  { id: "berlin", en: "Berlin", zh: "柏林", lat: 52.52, lon: 13.405 },
  { id: "newyork", en: "New York", zh: "纽约", lat: 40.7128, lon: -74.006 },
  { id: "losangeles", en: "Los Angeles", zh: "洛杉矶", lat: 34.0522, lon: -118.2437 },
  { id: "dubai", en: "Dubai", zh: "迪拜", lat: 25.2048, lon: 55.2708 },
];

const CITY_KEY = "smartpack_city";

export function storedCity(): City {
  const id = localStorage.getItem(CITY_KEY);
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

export function storeCity(id: string): void {
  localStorage.setItem(CITY_KEY, id);
}
