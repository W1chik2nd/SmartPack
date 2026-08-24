import { useEffect, useRef, useState } from "react";
import {
  getTripWeather,
  type ForecastDay,
  type TripWeather as TripWeatherData,
} from "../api";
import { useLang } from "../i18n/useLang";
import { WEATHER_CONDITION_LABELS } from "../i18n/dynamic-strings";

type Props = {
  tripPlanId: string;
  onBack: () => void;
};

const WEATHER_ICONS: Record<string, string> = {
  Clear: "/weather/clear.png",
  "Partly cloudy": "/weather/partly-cloudy.png",
  Overcast: "/weather/overcast.png",
  Fog: "/weather/fog.png",
  Drizzle: "/weather/drizzle.png",
  Rain: "/weather/rain.png",
  Snow: "/weather/snow.png",
  Showers: "/weather/showers.png",
  "Snow showers": "/weather/snow-showers.png",
  Thunderstorm: "/weather/thunderstorm.png",
};

function WeatherMark({ condition }: { condition: string }) {
  return (
    <img
      className="trip-weather-mark"
      src={WEATHER_ICONS[condition] ?? WEATHER_ICONS.Overcast}
      alt=""
      aria-hidden="true"
    />
  );
}

export default function TripWeather({ tripPlanId, onBack }: Props) {
  const { lang, t } = useLang();
  const [data, setData] = useState<TripWeatherData | null>(null);
  const [failed, setFailed] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const forecastTrack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    getTripWeather(tripPlanId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [tripPlanId, requestVersion]);

  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const formatDate = (iso: string, weekday = false) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      ...(weekday ? { weekday: "short" } : {}),
    });
  };

  if (!data) {
    return (
      <main className="trip-weather-page trip-weather-state">
        <button type="button" className="trip-weather-back" onClick={onBack}>
          ‹ {t("backToHome")}
        </button>
        {failed ? (
          <section className="trip-weather-message" role="alert">
            <p>{t("tripWeatherLoadFailed")}</p>
            <button type="button" onClick={() => setRequestVersion((v) => v + 1)}>
              {t("tripWeatherRetry")}
            </button>
          </section>
        ) : (
          <p className="trip-weather-loading">{t("weatherLoading")}</p>
        )}
      </main>
    );
  }

  const { trip, forecast } = data;
  const slideForecast = (direction: -1 | 1) => {
    const track = forecastTrack.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth,
      behavior: "smooth",
    });
  };

  return (
    <main className="trip-weather-page">
      <header className="trip-weather-heading">
        <div>
          <button type="button" className="trip-weather-back" onClick={onBack}>
            ‹ {t("backToHome")}
          </button>
          <p>{t("tripWeatherEyebrow")}</p>
          <h1>{t("tripWeatherTitle")}</h1>
        </div>
        <div className="trip-weather-count" aria-label={`${t("tripWeatherDays")}: ${trip.dayCount}`}>
          <strong>{trip.dayCount}</strong>
          <span>{t("tripWeatherDayUnit")}</span>
        </div>
      </header>

      <section className="trip-weather-summary" aria-label={t("tripWeatherDates")}>
        <div className="trip-weather-destination">
          <span>{t("destination")}</span>
          <strong>{trip.destination}</strong>
          {trip.destinationDetail && <small>{trip.destinationDetail}</small>}
        </div>
        <div className="trip-weather-dates">
          <span>{t("tripWeatherDates")}</span>
          <strong>
            {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
          </strong>
        </div>
        <div className="trip-weather-source">
          <span>{t("tripWeatherSource")}</span>
          <strong>{forecast.source}</strong>
        </div>
      </section>

      <section className="trip-weather-forecast">
        <header>
          <h2>{t("tripWeatherDaily")}</h2>
          <div className="trip-weather-forecast-actions">
            <span>{forecast.days.length} / {trip.dayCount}</span>
            {forecast.days.length > 3 && (
              <div className="trip-weather-slide-buttons">
                <button
                  type="button"
                  onClick={() => slideForecast(-1)}
                  aria-label={t("tripWeatherPreviousDays")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => slideForecast(1)}
                  aria-label={t("tripWeatherNextDays")}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </header>

        {forecast.available ? (
          <div
            className="trip-weather-grid"
            ref={forecastTrack}
            tabIndex={forecast.days.length > 3 ? 0 : undefined}
            aria-label={t("tripWeatherDaily")}
          >
            {forecast.days.map((day, index) => (
              <ForecastCard
                key={day.date}
                day={day}
                index={index}
                locale={locale}
                lang={lang}
              />
            ))}
          </div>
        ) : (
          <div className="trip-weather-unavailable">
            <span aria-hidden="true">!</span>
            <p>{t("tripWeatherOutsideWindow")}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ForecastCard({
  day,
  index,
  locale,
  lang,
}: {
  day: ForecastDay;
  index: number;
  locale: string;
  lang: "en" | "zh";
}) {
  const { t } = useLang();
  const [year, month, date] = day.date.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  const condition = WEATHER_CONDITION_LABELS[day.condition]?.[lang] ?? day.condition;

  return (
    <article className="trip-weather-card">
      <header>
        <span>
          {lang === "zh"
            ? `${t("tripWeatherDay")}${index + 1}${t("tripWeatherDayUnit")}`
            : `${t("tripWeatherDay")} ${index + 1}`}
        </span>
        <time dateTime={day.date}>{dateLabel}</time>
      </header>
      <div className="trip-weather-main">
        <WeatherMark condition={day.condition} />
        <div>
          <strong>{Math.round(day.maxTempC)}°</strong>
          <span>{condition}</span>
        </div>
      </div>
      <dl>
        <div><dt>{t("tripWeatherHigh")}</dt><dd>{Math.round(day.maxTempC)}°C</dd></div>
        <div><dt>{t("tripWeatherLow")}</dt><dd>{Math.round(day.minTempC)}°C</dd></div>
        <div><dt>{t("tripWeatherRain")}</dt><dd>{Math.round(day.precipitationProbability)}%</dd></div>
        <div><dt>{t("tripWeatherUv")}</dt><dd>{day.uvIndex.toFixed(1)}</dd></div>
        <div className="trip-weather-wind"><dt>{t("tripWeatherWind")}</dt><dd>{Math.round(day.maxWindKph)} km/h</dd></div>
      </dl>
    </article>
  );
}
