import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("empty dashboard rectangle shows only a plus and opens the trip planner", () => {
  assert.match(home, /className="today-body today-empty-state"/);
  assert.match(home, /onClick=\{onOpenTrips\}/);
  assert.match(home, /<span className="trip-empty" aria-hidden="true">\+<\/span>/);
  assert.match(home, /selectedTrip \?/);
});

test("dashboard keeps trip switching and selected-trip weather", () => {
  assert.match(home, /<TripSwitcher/);
  assert.match(home, /selectedTrip\?\.placeName/);
  assert.match(home, /weather\(selectedTrip\.lat, selectedTrip\.lon\)/);
  assert.match(home, /onOpenItinerary\(selectedTrip\.itineraryId\)/);
  assert.doesNotMatch(home, /<select[\s\S]*today-location/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
