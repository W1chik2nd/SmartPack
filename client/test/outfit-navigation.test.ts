import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../src/dashboard.css", import.meta.url), "utf8");
const outfit = readFileSync(new URL("../src/pages/OutfitOverview.tsx", import.meta.url), "utf8");
const outfitCss = readFileSync(new URL("../src/outfit.css", import.meta.url), "utf8");
const garmentCss = readFileSync(new URL("../src/outfit-garments.css", import.meta.url), "utf8");
const accessoryCss = readFileSync(new URL("../src/outfit-accessories.css", import.meta.url), "utf8");

test("today outfit tile opens the outfit overview route", () => {
  assert.match(home, /className="today-outfit"/);
  assert.match(home, /onClick=\{\(\) => onOpenOutfit\(selectedTrip\.id\)\}/);
  assert.match(home, /getOutfitPlan\(selectedTrip\.id\)/);
  assert.match(app, /onOpenOutfit=\{\(tripPlanId\) =>/);
  assert.match(app, /route === "outfit"/);
  assert.match(app, /tripPlanId=\{outfitTripPlanId\}/);
  assert.match(dashboardCss, /\.today-outfit \{[\s\S]*background: var\(--white\) !important;/);
});

test("generated garments and wardrobe photos share the pixel-art treatment", () => {
  const visual = readFileSync(new URL("../src/components/OutfitPieceVisual.tsx", import.meta.url), "utf8");
  assert.match(visual, /pixel-garment dress-piece-photo/);
  assert.match(visual, /is-accessory-photo/);
  assert.match(visual, /pixel-garment dress-piece-\$\{piece\.kind\}/);
  assert.match(outfitCss, /image-rendering: pixelated/);
  assert.match(outfitCss, /background: var\(--bg\)/);
  assert.match(outfitCss, /width: 48px;\s+height: 36px;/);
  assert.match(outfitCss, /--pixel-outline/);
  assert.match(outfitCss, /dress-piece-shoes::before/);
  assert.match(visual, /piece\.kind === "accessory"/);
  assert.match(outfit, /dress-mini-clothes/);
  assert.match(outfit, /dress-featured-accessory/);
  assert.match(visual, /garment-\$\{piece\.garmentStyle\}/);
});

test("outfit pieces use the white pixel line-art reference style", () => {
  assert.match(outfitCss, /--detail-color/);
  assert.match(outfitCss, /\.dress-piece-top \{[\s\S]*background: var\(--piece-color\)/);
  assert.match(outfitCss, /\.dress-piece-bottom \{[\s\S]*background: var\(--piece-color\)/);
  assert.match(outfitCss, /\.tone-green/);
  assert.match(outfitCss, /\.tone-brown/);
  assert.match(outfitCss, /\.fit-relaxed/);
  assert.match(garmentCss, /\.garment-sneakers::before/);
  assert.match(garmentCss, /inset 0 -6px 0 var\(--black\)/);
  assert.match(outfitCss, /后鞋退到左上、前鞋压在右下/);
  assert.match(outfitCss, /\.dress-piece-shoes::before \{[\s\S]*z-index: 1/);
  assert.match(outfitCss, /\.dress-piece-shoes::after \{[\s\S]*z-index: 2/);
  assert.match(accessoryCss, /\.accessory-glasses::before,[\s\S]*border: 6px solid var\(--black\)/);
  assert.match(accessoryCss, /\.accessory-watch::after/);
});
