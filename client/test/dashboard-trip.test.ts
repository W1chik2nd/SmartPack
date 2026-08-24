import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const sky = readFileSync(new URL("../src/components/DashboardSky.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const dashboardCss = ["dashboard.css", "dashboard-sky.css", "dashboard-nav.css"]
  .map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"))
  .join("\n");

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

test("dashboard greeting uses time-aware contrast without the clock line", () => {
  assert.match(home, /isDashboardDaytime\(now\.getHours\(\)\)/);
  assert.match(home, /isDaytime \? "is-day" : "is-night"/);
  assert.match(home, /<DashboardSky \/>/);
  assert.match(sky, /className="dash-day-art"/);
  assert.equal((sky.match(/<line /g) ?? []).length, 10);
  assert.match(sky, /className="dash-night-stars"/);
  assert.doesNotMatch(home, /\{dateLong\} · \{timeShort\}/);
  assert.match(dashboardCss, /\.dash-greeting\.is-night \{[\s\S]*color: var\(--white\)[\s\S]*background: var\(--blue\)/);
  assert.match(dashboardCss, /\.dash-sun circle \{[\s\S]*fill: var\(--yellow\)/);
  assert.match(dashboardCss, /\.dash-flower circle \{[\s\S]*stroke: var\(--black\)/);
  assert.match(dashboardCss, /\.dash-night-stars i/);
  assert.match(dashboardCss, /\.dash-moon::after/);
});

test("dashboard card chevrons are comfortably visible", () => {
  assert.equal((home.match(/className="card-arrow"/g) ?? []).length, 4);
  assert.match(dashboardCss, /\.card-arrow \{[\s\S]*font-size: 34px/);
  assert.match(dashboardCss, /\.today-dates > span \{[\s\S]*font-size: 20px/);
});

test("dashboard weather shows its icon beside the temperature", () => {
  assert.match(home, /src=\{weatherIconPath\(wx\.condition\)\}/);
  assert.match(home, /alt=\{wx\.condition\}/);
  assert.doesNotMatch(home, /className="weather-cond"/);
  assert.match(dashboardCss, /\.weather-reading \{[\s\S]*display: flex[\s\S]*align-items: center/);
  assert.match(dashboardCss, /\.weather-icon \{[\s\S]*mix-blend-mode: multiply/);
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

test("itinerary uses the selected language for day labels", () => {
  const itinerary = readFileSync(new URL("../src/pages/Itinerary.tsx", import.meta.url), "utf8");
  const spine = readFileSync(new URL("../src/components/TripSpine.tsx", import.meta.url), "utf8");
  const dayPlan = readFileSync(new URL("../src/components/DayPlan.tsx", import.meta.url), "utf8");
  assert.match(itinerary, /const dayWord = lang === "zh"/);
  assert.match(spine, /const dayLabel = \(day:/);
  assert.match(dayPlan, /const dayLabel = lang === "zh"/);
  assert.match(itinerary, /\{trip\.days\.length\} × \{dayWord\}/);
});

test("one shell-level chat widget survives in-memory route changes", () => {
  assert.equal((app.match(/<ChatWidget/g) ?? []).length, 1);
  assert.match(app, /\{user && <ChatWidget onActions=\{handleAssistantActions\} \/>\}/);
});
