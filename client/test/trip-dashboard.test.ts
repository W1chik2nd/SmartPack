import test from "node:test";
import assert from "node:assert/strict";
import {
  adjacentTripId,
  dashboardTrips,
  tripAfterDeletionId,
} from "../src/lib/trip-dashboard.ts";
import type { TripPlan } from "../src/travel-types.ts";

function plan(
  id: string,
  generationStatus: TripPlan["generationStatus"],
  itineraryId: string | null = null,
  scenario = "travel"
): TripPlan {
  return {
    id,
    scenario,
    placeName: id,
    placeDetail: "",
    lat: 0,
    lon: 0,
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    notes: "",
    itineraryId,
    generationStatus,
    generationError: null,
    createdAt: "2026-08-24 10:00:00",
  };
}

test("dashboard keeps generated, processing, and failed travel plans", () => {
  const visible = dashboardTrips([
    plan("complete", "completed", "trip-1"),
    plan("working", "processing"),
    plan("failed", "failed"),
    plan("manual", "pending"),
    plan("business", "completed", "trip-2", "business"),
  ]);
  assert.deepEqual(
    visible.map((trip) => trip.id),
    ["complete", "working", "failed"]
  );
});

test("trip arrows cycle in both directions", () => {
  const trips = [plan("a", "completed", "1"), plan("b", "completed", "2")];
  assert.equal(adjacentTripId(trips, "a", 1), "b");
  assert.equal(adjacentTripId(trips, "b", 1), "a");
  assert.equal(adjacentTripId(trips, "a", -1), "b");
  assert.equal(adjacentTripId([], null, 1), null);
});

test("deleting a trip selects the following trip", () => {
  const trips = [
    plan("a", "completed", "1"),
    plan("b", "completed", "2"),
    plan("c", "completed", "3"),
  ];
  assert.equal(tripAfterDeletionId(trips, "b"), "c");
  assert.equal(tripAfterDeletionId(trips, "c"), "a");
  assert.equal(tripAfterDeletionId([trips[0]], "a"), null);
});
