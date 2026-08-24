import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("empty itinerary card opens the trip planner", () => {
  assert.match(home, /selectedTrip\?\.itineraryId/);
  assert.match(home, /: onOpenTrips\(\)/);
  assert.match(home, /t\("noTripYet"\)/);
});

test("dashboard destination and weather follow the selected trip", () => {
  assert.match(home, /<TripSwitcher/);
  assert.match(home, /selectedTrip\?\.placeName/);
  assert.match(home, /weather\(selectedTrip\.lat, selectedTrip\.lon\)/);
  assert.doesNotMatch(home, /<select[\s\S]*today-location/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
