import { useEffect, useState } from "react";
import {
  weather,
  listTripPlans,
  type User,
  type Weather,
  type TripPlan,
} from "../api";
import ChatWidget from "../components/ChatWidget";
import { useLang } from "../i18n/useLang";
import { SCENARIO_LABELS } from "../i18n/strings";
import { CITIES, storedCity, storeCity, type City } from "../i18n/cities";

type Props = {
  user: User;
  onOpenTrips: () => void;
  onOpenWardrobe: () => void;
  onOpenPacking: () => void;
};

// Placeholder navigation targets. Wire real routes here as the pages land.
// TODO: replace with real navigation once the profile/detail pages exist.
const TODO_LINKS = {
  weather: () => {},
  dates: () => {},
  outfit: () => {},
  profile: () => {},
};

export default function Home({
  user,
  onOpenTrips,
  onOpenWardrobe,
  onOpenPacking,
}: Props) {
  const { lang, t } = useLang();
  const [now, setNow] = useState(new Date());
  const [city, setCity] = useState<City>(storedCity);
  const [wx, setWx] = useState<Weather | null>(null);
  const [wxError, setWxError] = useState(false);
  // 已保存的行程,最新在前;进主页时拉一次,保存后跳回来会重新挂载再拉。
  const [trips, setTrips] = useState<TripPlan[] | null>(null);

  // Live clock: half-minute ticks keep date, time, and greeting current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // 拉取行程列表。失败(如未登录)就当作空,主页不因此报错。
  useEffect(() => {
    listTripPlans()
      .then(({ plans }) => setTrips(plans))
      .catch(() => setTrips([]));
  }, []);

  // Weather follows the picked city; the choice persists across sessions.
  useEffect(() => {
    setWx(null);
    setWxError(false);
    weather(city.lat, city.lon)
      .then(setWx)
      .catch(() => setWxError(true));
  }, [city]);

  function greeting(): string {
    const hour = now.getHours();
    if (hour < 5) return t("goodNight");
    if (hour < 12) return t("goodMorning");
    if (hour < 18) return t("goodAfternoon");
    return t("goodEvening");
  }

  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const dateLong = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeShort = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 最新一条行程(列表已按新→旧排序),用于"行程"卡片。
  const latestTrip = trips && trips.length > 0 ? trips[0] : null;

  // 一条行程的日期区间显示。按本地年月日解析,不走 UTC,免得跨时区错一天。
  function tripDates(trip: TripPlan): string {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      });
    };
    const nights = Math.round(
      (new Date(`${trip.endDate}T00:00:00Z`).getTime() -
        new Date(`${trip.startDate}T00:00:00Z`).getTime()) /
        86_400_000
    );
    if (nights <= 0) return `${fmt(trip.startDate)} · ${t("tripSameDay")}`;
    return `${fmt(trip.startDate)} – ${fmt(trip.endDate)} · ${nights} ${t("tripNights")}`;
  }

  return (
    <div className="home dashboard">
      <ChatWidget />

      {/* Greeting bar */}
      <header className="dash-greeting">
        <h1>
          {greeting()}, {user.name}.
        </h1>
        <p>
          {dateLong} · {timeShort}
        </p>
      </header>

      <div className="dash-layout">
        {/* Left: today card, laid out after the wireframe */}
        <section className="today-card" aria-label="Today">
          <div className="today-header">
            <button className="today-dates" onClick={TODO_LINKS.dates}>
              {t("upcoming")} · {dateLong} <span aria-hidden="true">›</span>
            </button>
            <label className="today-location">
              <span className="visually-hidden">{t("cityLabel")}</span>
              <select
                value={city.id}
                onChange={(e) => {
                  const next = CITIES.find((c) => c.id === e.target.value);
                  if (next) {
                    storeCity(next.id);
                    setCity(next);
                  }
                }}
              >
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === "zh" ? c.zh : c.en}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="today-body">
            <div className="today-left">
              <button className="today-weather" onClick={TODO_LINKS.weather}>
                <h2>{t("todaysWeather")}</h2>
                {wx ? (
                  <p className="weather-reading">
                    {Math.round(wx.tempC)}°C
                    <span className="weather-cond">{wx.condition}</span>
                  </p>
                ) : (
                  <p className="weather-reading weather-pending">
                    {wxError ? t("weatherUnavailable") : t("weatherLoading")}
                  </p>
                )}
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>

              <button className="today-checklist" onClick={onOpenPacking}>
                <h2>{t("checklist")}</h2>
                <span className="check-mark" aria-hidden="true" />
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            <button className="today-outfit" onClick={TODO_LINKS.outfit}>
              <h2>{t("todaysOutfit")}</h2>
              {/* Geometric garment drawing (shirt + trousers), CSS only */}
              <span className="outfit-figure" aria-hidden="true">
                <span className="outfit-shirt" />
                <span className="outfit-trousers" />
              </span>
              <span className="card-arrow" aria-hidden="true">›</span>
            </button>

            <button className="today-itinerary" onClick={onOpenTrips}>
              <h2>{t("itinerary")}</h2>
              {latestTrip ? (
                <span className="trip-summary">
                  <span className="trip-place">
                    {latestTrip.placeName}
                    <span className="trip-scenario">
                      {SCENARIO_LABELS[latestTrip.scenario]?.[lang] ??
                        latestTrip.scenario}
                    </span>
                  </span>
                  <span className="trip-dates">{tripDates(latestTrip)}</span>
                </span>
              ) : (
                <span className="trip-empty">
                  {trips === null ? "" : t("noTripYet")}
                </span>
              )}
              <span className="card-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        {/* Right: primary navigation tiles */}
        <nav className="dash-nav" aria-label="Sections">
          <button onClick={onOpenWardrobe}>
            <span className="nav-tile-mark red" aria-hidden="true" />
            {t("digitalWardrobe")}
          </button>
          <button onClick={onOpenTrips}>
            <span className="nav-tile-mark yellow" aria-hidden="true" />
            {t("tripPlanner")}
          </button>
          <button onClick={TODO_LINKS.profile}>
            <span className="nav-tile-mark blue" aria-hidden="true" />
            {t("myProfile")}
          </button>
        </nav>
      </div>
    </div>
  );
}
