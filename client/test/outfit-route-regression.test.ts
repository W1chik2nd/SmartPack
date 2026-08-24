import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../src/pages/OutfitOverview.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");

test("Today Outfit uses a stable shell callback and selected plan id", () => {
  assert.match(home, /onClick=\{\(\) => onOpenOutfit\(selectedTrip\.id\)\}/);
  assert.match(app, /const openOutfit = \(tripPlanId\?: string\)/);
  assert.match(app, /setOutfitTripPlanId\(tripPlanId\)/);
  assert.match(app, /setRoute\("outfit"\)/);
  assert.match(app, /<OutfitOverview[\s\S]*tripPlanId=\{outfitTripPlanId\}/);
});

test("switching outfit trip ids resets the previous overview state", () => {
  assert.match(overview, /setPlan\(null\);/);
  assert.match(overview, /setActiveIndex\(0\);/);
  assert.match(overview, /getOutfitPlan\(tripPlanId\)/);
  assert.match(overview, /\}, \[tripPlanId\]\);/);
});

test("outfit overview keeps localization hooks stable while the plan loads", () => {
  const loadingReturn = overview.indexOf('if (!plan)');
  const localizedValues = overview.indexOf('const garmentLabels = useLocalizedValues(');
  const translatedPlaces = overview.indexOf('const places = useTranslatedText(');

  assert.ok(localizedValues > 0 && localizedValues < loadingReturn);
  assert.ok(translatedPlaces > 0 && translatedPlaces < loadingReturn);
  assert.doesNotMatch(
    overview,
    /activeAccessory\s*\?\s*useLocalizedValues/,
    "hooks must not be called conditionally"
  );
});
