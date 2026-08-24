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
  assert.match(home, /className="today-outfit" onClick=\{onOpenOutfit\}/);
  assert.match(app, /onOpenOutfit=\{\(\) => setRoute\("outfit"\)\}/);
  assert.match(app, /route === "outfit"/);
  assert.match(app, /<OutfitOverview onBack=\{\(\) => setRoute\("home"\)\} \/>/);
  assert.match(dashboardCss, /\.today-outfit \{[\s\S]*background: var\(--bg\) !important;/);
});

test("generated garments and wardrobe photos share the pixel-art treatment", () => {
  assert.match(outfit, /pixel-garment dress-piece-photo/);
  assert.match(outfit, /is-accessory-photo/);
  assert.match(outfit, /pixel-garment dress-piece-\$\{piece\.kind\}/);
  assert.match(outfitCss, /image-rendering: pixelated/);
  assert.match(outfitCss, /background: var\(--bg\)/);
  assert.match(outfitCss, /width: 48px;\s+height: 36px;/);
  assert.match(outfitCss, /--pixel-outline/);
  assert.match(outfitCss, /dress-piece-shoes::before/);
  assert.match(outfit, /piece\.kind === "accessory"/);
  assert.match(outfit, /dress-mini-clothes/);
  assert.match(outfit, /dress-featured-accessory/);
  assert.match(outfit, /garment-\$\{piece\.garmentStyle\}/);
});

test("outfit pieces use the white pixel line-art reference style", () => {
  assert.match(outfitCss, /--detail-color/);
  assert.match(outfitCss, /\.dress-piece-top \{[\s\S]*background: var\(--white\)/);
  assert.match(outfitCss, /\.dress-piece-bottom \{[\s\S]*background: var\(--white\)/);
  assert.match(garmentCss, /\.garment-sneakers::before/);
  assert.match(garmentCss, /inset 0 -6px 0 var\(--black\)/);
  assert.match(outfitCss, /后鞋退到左上、前鞋压在右下/);
  assert.match(outfitCss, /\.dress-piece-shoes::before \{[\s\S]*z-index: 1/);
  assert.match(outfitCss, /\.dress-piece-shoes::after \{[\s\S]*z-index: 2/);
  assert.match(accessoryCss, /\.accessory-glasses::before,[\s\S]*border: 6px solid var\(--black\)/);
  assert.match(accessoryCss, /\.accessory-watch::after/);
});
