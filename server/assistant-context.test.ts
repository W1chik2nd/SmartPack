import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantDataContext } from "./assistant-context.ts";

test("assistant context exposes real wardrobe and trip ids without photo data", () => {
  const context = assistantDataContext([
    {
      id: "item-1",
      title: "Black blazer",
      category: "outerwear",
      subtype: "blazer",
      count: 1,
      colors: ["black"],
      fit: "tailored",
      material: "wool",
      seasons: ["spring", "autumn"],
      styleTags: ["business"],
      details: "single breasted",
      hasPhoto: true,
      createdAt: "2026-01-01",
    },
  ], [{
    id: "trip-1",
    scenario: "business",
    placeName: "Paris",
    placeDetail: "France",
    lat: 48.8566,
    lon: 2.3522,
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    createdAt: "2026-01-01",
  }]);
  assert.match(context, /"id":"item-1"/);
  assert.match(context, /"id":"trip-1"/);
  assert.match(context, /"placeName":"Paris"/);
  assert.doesNotMatch(context, /hasPhoto|createdAt|"lat"|"lon"/);
});
