import type { TripPlan } from "../travel-types";

// Only scenarios that represent a destination-based occasion belong in the
// home itinerary carousel. Commutes, workouts, and one-off formal dressing
// still receive Agent recommendations, but are not durable home trips.
const HOME_TRIP_SCENARIOS = new Set(["travel", "business", "date"]);

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
