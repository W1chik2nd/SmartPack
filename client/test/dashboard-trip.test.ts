import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

// Regression coverage for the empty dashboard state: no saved plan must be an
// obvious creation affordance, while an existing plan keeps the itinerary path.
test("empty trip card shows a plus and opens the trip planner", () => {
  assert.match(home, /onClick=\{latestTrip \? onOpenItinerary : onOpenTrips\}/);
  assert.match(home, /trips === null \? "" : "\+"/);
  assert.match(home, /latestTrip \? \(/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
