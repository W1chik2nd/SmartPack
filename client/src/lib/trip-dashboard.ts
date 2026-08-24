import type { TripPlan } from "../travel-types";
import type { StringKey } from "../i18n/strings";
import { tripDaysInclusive } from "../../../shared/trip-constraints.ts";

// Every saved scenario with a generated or active plan is useful on Home:
// commute and other agenda-based plans still have an upcoming date and Agent
// recommendations, so hiding them makes the dashboard disagree with the user.
const HOME_TRIP_SCENARIOS = new Set([
  "travel",
  "business",
  "date",
  "commute",
  "sport",
  "formal",
]);

/** Agent-backed destination plans worth showing on the home dashboard. */
export function dashboardTrips(plans: TripPlan[]): TripPlan[] {
  return plans.filter(
    (plan) =>
      HOME_TRIP_SCENARIOS.has(plan.scenario) &&
      (Boolean(plan.itineraryId) ||
        plan.generationStatus === "processing" ||
        plan.generationStatus === "failed")
  );
}

/** Cycle through saved trips without coupling selection to list order changes. */
export function adjacentTripId(
  trips: TripPlan[],
  selectedId: string | null,
  direction: -1 | 1
): string | null {
  if (trips.length === 0) return null;
  const found = trips.findIndex((trip) => trip.id === selectedId);
  const current = found < 0 ? 0 : found;
  return trips[(current + direction + trips.length) % trips.length].id;
}

/** Prefer the following trip after deletion, wrapping to the first one. */
export function tripAfterDeletionId(
  trips: TripPlan[],
  deletedId: string
): string | null {
  if (trips.length <= 1) return null;
  const index = trips.findIndex((trip) => trip.id === deletedId);
  if (index < 0) return trips[0].id;
  return trips[(index + 1) % trips.length].id;
}

export function greetingKey(hour: number): StringKey {
  if (hour < 5) return "goodNight";
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export function formatDashboardClock(now: Date, lang: "en" | "zh") {
  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  return {
    locale,
    dateLong: now.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    timeShort: now.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function formatTripDates(
  trip: TripPlan,
  locale: string,
  sameDayLabel: string,
  nightsLabel: string
): string {
  const format = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  };
  const nights = tripDaysInclusive(trip.startDate, trip.endDate) - 1;
  if (nights <= 0) return `${format(trip.startDate)} · ${sameDayLabel}`;
  return `${format(trip.startDate)} – ${format(trip.endDate)} · ${nights} ${nightsLabel}`;
}
