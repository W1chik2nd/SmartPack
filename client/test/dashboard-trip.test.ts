import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

// Regression coverage for the empty dashboard state: no saved plan must be an
// obvious creation affordance, while an existing plan keeps the itinerary path.
test("empty trip rectangle shows only a plus and opens the trip planner", () => {
  assert.match(home, /className="today-itinerary today-itinerary-empty"/);
  assert.match(home, /onClick=\{onOpenTrips\}/);
  assert.match(home, /<span className="trip-empty" aria-hidden="true">\+<\/span>/);
  assert.match(home, /latestTrip \? \(/);
});

test("dashboard destination and weather use the saved trip coordinates", () => {
  assert.match(home, /setCity\(latest \? \{ name: latest\.placeName, lat: latest\.lat, lon: latest\.lon \} : null\)/);
  assert.match(home, /weather\(city\.lat, city\.lon\)/);
  assert.doesNotMatch(home, /<select[\s\S]*today-location/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
