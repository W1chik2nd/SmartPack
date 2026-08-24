import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../src/dashboard.css", import.meta.url), "utf8");

test("no-plan dashboard becomes one centered plus card", () => {
  assert.match(home, /className="today-card today-empty-card"/);
  assert.match(home, /onClick=\{onOpenTrips\}/);
  assert.match(home, /<span className="trip-empty" aria-hidden="true">\+<\/span>/);
  assert.match(home, /selectedTrip \?/);
});

test("planned dashboard keeps switching and shows the selected plan", () => {
  assert.match(home, /<TripSwitcher/);
  assert.match(home, /selectedTrip\.placeName/);
  assert.match(home, /weather\(selectedTrip\.lat, selectedTrip\.lon\)/);
  assert.match(home, /onOpenWeather\(selectedTrip\.id\)/);
  assert.match(app, /setRoute\("weather"\)/);
  assert.match(home, /onOpenItinerary\(selectedTrip\.itineraryId\)/);
  assert.match(home, /className="today-itinerary"/);
  assert.doesNotMatch(home, /<select[\s\S]*today-location/);
});

test("dashboard outfit remains bounded inside the original grid", () => {
  assert.match(home, /<DashboardOutfit/);
  assert.match(dashboardCss, /\.dash-layout \{[\s\S]*min-width: 0/);
  assert.match(dashboardCss, /\.today-outfit \{[\s\S]*min-width: 0[\s\S]*overflow: hidden/);
  assert.match(dashboardCss, /\.dashboard-outfit-stack \{[\s\S]*max-width: 180px/);
  assert.match(dashboardCss, /\.dash-nav \{[\s\S]*grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("failed dashboard plans open the prefilled retry flow", () => {
  assert.match(home, /selectedTrip\.generationStatus === "failed"/);
  assert.match(home, /onRetryTrip\(selectedTrip\)/);
  assert.match(app, /retryPlan=\{retryPlan\}/);
  assert.match(app, /setScenario\(plan\.scenario\)/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
