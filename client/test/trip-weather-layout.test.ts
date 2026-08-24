import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL("../src/pages/TripWeather.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../src/trip-weather.css", import.meta.url),
  "utf8"
);

test("trip weather heading matches the itinerary title scale without an eyebrow", () => {
  assert.doesNotMatch(page, /tripWeatherEyebrow/);
  assert.match(page, /<h1>\{t\("tripWeatherTitle"\)\}<\/h1>/);
  assert.match(css, /\.trip-weather-heading h1 \{[\s\S]*font-size: 40px/);
});

test("trip forecast cards share the all-condition icon mapping and hide white PNG mats", () => {
  assert.match(page, /src=\{weatherIconPath\(condition\)\}/);
  assert.match(css, /\.trip-weather-mark \{[\s\S]*mix-blend-mode: multiply/);
});
