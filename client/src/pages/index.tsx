import { useEffect, useState } from "react";
import {
  weather,
  listTripPlans,
  type User,
  type Weather,
  type TripPlan,
} from "../api";
import { useLang } from "../i18n/useLang";
import { SCENARIO_LABELS } from "../i18n/strings";

type Props = {
  user: User;
  onOpenTrips: () => void;
  onOpenWardrobe: () => void;
  onOpenItinerary: () => void;
  onOpenPacking: () => void;
  onOpenProfile: () => void;
  onOpenOutfit: () => void;
};

// Placeholder navigation targets. Wire real routes here as the pages land.
// TODO: replace with real navigation once the profile/detail pages exist.
const TODO_LINKS = {
  weather: () => {},
  dates: () => {},
};

export default function Home({
  user,
  onOpenTrips,
  onOpenWardrobe,
  onOpenItinerary,
  onOpenPacking,
  onOpenProfile,
  onOpenOutfit,
}: Props) {
  const { lang, t } = useLang();
  const [now, setNow] = useState(new Date());
  const [city, setCity] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [wx, setWx] = useState<Weather | null>(null);
  const [wxError, setWxError] = useState(false);
  // 已保存的行程,最新在前;进主页时拉一次,保存后跳回来会重新挂载再拉。
  const [trips, setTrips] = useState<TripPlan[] | null>(null);
  const [tripError, setTripError] = useState(false);

  // Live clock: half-minute ticks keep date, time, and greeting current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // The dashboard destination is owned by the latest saved trip. There is no
  // second, unrelated city preference to get out of sync with Trip Planner.
  useEffect(() => {
    listTripPlans()
      .then(({ plans }) => {
        setTrips(plans);
        setTripError(false);
        const latest = plans[0];
        setCity(latest ? { name: latest.placeName, lat: latest.lat, lon: latest.lon } : null);
      })
      .catch(() => {
        setTrips([]);
        setCity(null);
        setTripError(true);
      });
  }, []);

  // Weather follows the destination selected in the saved trip plan.
  useEffect(() => {
    if (!city) {
      setWx(null);
      setWxError(false);
      return;
    }
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
            <div className="today-location" aria-live="polite">
              {city?.name ?? "—"}
            </div>
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
                    {wxError
                      ? t("weatherUnavailable")
                      : city
                        ? t("weatherLoading")
                        : t("weatherNoDestination")}
                  </p>
                )}
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>

              <button className="today-checklist" onClick={onOpenPacking}>
                <h2>{t("checklist")}</h2>
                <img
                  className="checklist-bag"
                  src="/checklist-bag.png"
                  alt=""
                  aria-hidden="true"
                />
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            <button className="today-outfit" onClick={onOpenOutfit}>
              <h2>{t("todaysOutfit")}</h2>
              {/* Geometric garment drawing (shirt + trousers), CSS only */}
              <span className="outfit-figure" aria-hidden="true">
                <span className="outfit-shirt pixel-garment" />
                <span className="outfit-trousers pixel-garment" />
              </span>
              <span className="card-arrow" aria-hidden="true">›</span>
            </button>

            {latestTrip ? (
              <button
                className="today-itinerary"
                onClick={onOpenItinerary}
                aria-label={t("itinerary")}
              >
                <h2>{t("itinerary")}</h2>
                <span className="trip-summary">
                  <span className="trip-place">
                    {latestTrip.placeName}
                    <span className="trip-scenario">
                      {SCENARIO_LABELS[latestTrip.scenario]?.[lang] ??
                        latestTrip.scenario}
                    </span>
                  </span>
                  {latestTrip.placeDetail && (
                    <span className="trip-detail">{latestTrip.placeDetail}</span>
                  )}
                  <span className="trip-dates">{tripDates(latestTrip)}</span>
                </span>
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>
            ) : (
              <button
                className="today-itinerary today-itinerary-empty"
                onClick={onOpenTrips}
                aria-label={t("tripPlanner")}
              >
                <span className="trip-empty" aria-hidden="true">+</span>
                <span className="visually-hidden">
                  {trips === null
                    ? t("tripLoading")
                    : tripError
                      ? t("savedTripLoadFailed")
                      : t("noSavedTrips")}
                </span>
              </button>
            )}
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
          <button onClick={onOpenProfile}>
            <span className="nav-tile-mark blue" aria-hidden="true" />
            {t("myProfile")}
          </button>
        </nav>
      </div>
    </div>
  );
}
