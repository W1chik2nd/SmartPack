import { useEffect, useRef, useState } from "react";
import {
  deleteTripPlan,
  weather,
  listTripPlans,
  type User,
  type Weather,
  type TripPlan,
} from "../api";
import TripSwitcher from "../components/TripSwitcher";
import { useLang } from "../i18n/useLang";
import { SCENARIO_LABELS } from "../i18n/strings";
import { dashboardTrips, tripAfterDeletionId } from "../lib/trip-dashboard";

type Props = {
  user: User;
  onOpenTrips: () => void;
  onOpenWardrobe: () => void;
  onOpenItinerary: (itineraryId: string) => void;
  onOpenPacking: (tripPlanId: string) => void;
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
  const [wx, setWx] = useState<Weather | null>(null);
  const [wxError, setWxError] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripPlan[] | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [switchDirection, setSwitchDirection] = useState<-1 | 1>(1);
  const deletedTripIds = useRef(new Set<string>());
  const travelTrips = dashboardTrips(trips ?? []);
  const selectedTrip =
    travelTrips.find((trip) => trip.id === selectedTripId) ??
    travelTrips[0] ??
    null;
  const selectedTripIndex = Math.max(
    0,
    travelTrips.findIndex((trip) => trip.id === selectedTrip?.id)
  );

  // Live clock: half-minute ticks keep date, time, and greeting current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Generation happens on the server. Poll only while a saved trip is still
  // processing, then stop once the durable SQLite status changes.
  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;
    async function refresh() {
      try {
        const { plans } = await listTripPlans();
        if (cancelled) return;
        setTrips(plans.filter((plan) => !deletedTripIds.current.has(plan.id)));
        if (plans.some((plan) => plan.generationStatus === "processing")) {
          poll = window.setTimeout(refresh, 2_000);
        }
      } catch {
        if (!cancelled) setTrips([]);
      }
    }
    void refresh();
    return () => {
      cancelled = true;
      if (poll !== undefined) window.clearTimeout(poll);
    };
  }, []);

  // Keep selection stable as background status updates replace the trip list.
  useEffect(() => {
    if (selectedTrip && selectedTrip.id !== selectedTripId) {
      setSelectedTripId(selectedTrip.id);
    } else if (!selectedTrip && selectedTripId) {
      setSelectedTripId(null);
    }
  }, [selectedTrip?.id, selectedTripId]);

  useEffect(() => {
    setDeleteConfirmId(null);
    setDeleteError(false);
  }, [selectedTrip?.id]);

  // Weather always follows the destination selected by the trip switcher.
  useEffect(() => {
    setWx(null);
    setWxError(false);
    if (!selectedTrip) return;
    let active = true;
    weather(selectedTrip.lat, selectedTrip.lon)
      .then((result) => {
        if (active) setWx(result);
      })
      .catch(() => {
        if (active) setWxError(true);
      });
    return () => {
      active = false;
    };
  }, [selectedTrip?.id, selectedTrip?.lat, selectedTrip?.lon]);

  function greeting(): string {
    const hour = now.getHours();
    if (hour < 5) return t("goodNight");
    if (hour < 12) return t("goodMorning");
    if (hour < 18) return t("goodAfternoon");
    return t("goodEvening");
  }

  async function removeSelectedTrip() {
    if (!selectedTrip) return;
    const id = selectedTrip.id;
    const nextId = tripAfterDeletionId(travelTrips, id);
    setDeletingTripId(id);
    setDeleteError(false);
    try {
      await deleteTripPlan(id);
      deletedTripIds.current.add(id);
      setTrips((current) => current?.filter((trip) => trip.id !== id) ?? []);
      setSelectedTripId((current) => (current === id ? nextId : current));
      setDeleteConfirmId(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeletingTripId(null);
    }
  }

  function selectTrip(id: string, direction: -1 | 1) {
    setSwitchDirection(direction);
    setWx(null);
    setSelectedTripId(id);
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
        <div className="today-card-shell">
          <TripSwitcher
            trips={travelTrips}
            selectedId={selectedTrip?.id ?? null}
            onSelect={selectTrip}
          />
          <section
            key={selectedTrip?.id ?? "empty-trip"}
            className={`today-card trip-card-enter-${switchDirection === 1 ? "right" : "left"}`}
            aria-label="Today"
          >
          <div className="today-header">
            <button className="today-dates" onClick={TODO_LINKS.dates}>
              {t("upcoming")} · {dateLong} <span aria-hidden="true">›</span>
            </button>
            <div className="trip-switch-copy" aria-live="polite">
              <span>{t("destination")}</span>
              <strong title={selectedTrip?.placeName}>
                {selectedTrip?.placeName ?? t("noDestination")}
              </strong>
              {travelTrips.length > 0 && (
                <small>
                  {selectedTripIndex + 1}/{travelTrips.length}
                </small>
              )}
            </div>
          </div>

          {selectedTrip ? (
          <div className="today-body">
            <div className="today-left">
              <button className="today-weather" onClick={TODO_LINKS.weather}>
                <h2>{t("destinationWeatherToday")}</h2>
                {selectedTrip && wx ? (
                  <p className="weather-reading">
                    {Math.round(wx.tempC)}°C
                    <span className="weather-cond">{wx.condition}</span>
                  </p>
                ) : (
                  <p className="weather-reading weather-pending">
                    {!selectedTrip
                      ? t("noDestination")
                      : wxError
                        ? t("weatherUnavailable")
                        : t("weatherLoading")}
                  </p>
                )}
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>

              <button
                className="today-checklist"
                onClick={() => selectedTrip && onOpenPacking(selectedTrip.id)}
                disabled={!selectedTrip?.itineraryId}
              >
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

            <div className="today-itinerary">
              <button
                type="button"
                className="trip-open"
                onClick={() =>
                  selectedTrip?.itineraryId
                    ? onOpenItinerary(selectedTrip.itineraryId)
                    : onOpenTrips()
                }
              >
                <h2>{t("itinerary")}</h2>
                {selectedTrip ? (
                  <span className="trip-summary">
                    <span className="trip-place">
                      {selectedTrip.placeName}
                      <span className="trip-scenario">
                        {SCENARIO_LABELS[selectedTrip.scenario]?.[lang] ??
                          selectedTrip.scenario}
                      </span>
                    </span>
                    <span className="trip-dates">{tripDates(selectedTrip)}</span>
                    {selectedTrip.generationStatus === "processing" && (
                      <span className="trip-generation-status is-processing">
                        {t("tripGeneratingHome")}
                      </span>
                    )}
                    {selectedTrip.generationStatus === "failed" && (
                      <span className="trip-generation-status is-failed">
                        {t("tripGenerationFailedHome")}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="trip-empty">
                    {trips === null ? "" : t("noTripYet")}
                  </span>
                )}
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>

              {selectedTrip &&
                deletingTripId === null &&
                deleteConfirmId !== selectedTrip.id && (
                <button
                  type="button"
                  className="trip-delete-trigger"
                  onClick={() => setDeleteConfirmId(selectedTrip.id)}
                >
                  {t("deleteTrip")}
                </button>
              )}

              {selectedTrip && deleteConfirmId === selectedTrip.id && (
                <div
                  className="trip-delete-confirm"
                  role="group"
                  aria-label={t("deleteTrip")}
                >
                  <strong>{selectedTrip.placeName}</strong>
                  <p>{t("deleteTripWarning")}</p>
                  {deleteError && (
                    <p className="trip-delete-error" role="alert">
                      {t("deleteTripFailed")}
                    </p>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={deletingTripId === selectedTrip.id}
                    >
                      {t("cancelDelete")}
                    </button>
                    <button
                      type="button"
                      className="trip-delete-danger"
                      onClick={removeSelectedTrip}
                      disabled={deletingTripId === selectedTrip.id}
                    >
                      {deletingTripId === selectedTrip.id
                        ? t("deletingTrip")
                        : t("confirmDeleteTrip")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          ) : (
            <button
              type="button"
              className="today-body today-empty-state"
              onClick={onOpenTrips}
              aria-label={t("tripPlanner")}
            >
              <span className="trip-empty" aria-hidden="true">+</span>
              <span className="visually-hidden">{t("noTripYet")}</span>
            </button>
          )}
          </section>
        </div>

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
