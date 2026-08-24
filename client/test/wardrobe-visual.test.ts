import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const wardrobe = readFileSync(
  new URL("../src/pages/Wardrobe.tsx", import.meta.url),
  "utf8"
);
const wardrobeCss = readFileSync(
  new URL("../src/pages/Wardrobe.css", import.meta.url),
  "utf8"
);
const garmentCss = readFileSync(
  new URL("../src/outfit-garments.css", import.meta.url),
  "utf8"
);
const accessoryCss = readFileSync(
  new URL("../src/outfit-accessories.css", import.meta.url),
  "utf8"
);

test("wardrobe cards always render the server-derived pixel visual", () => {
  assert.match(wardrobe, /<OutfitPieceVisual piece=\{item\.visual\} wardrobe \/>/);
  assert.doesNotMatch(wardrobe, /item\.hasPhoto/);
  assert.doesNotMatch(wardrobe, /wardrobePhotoUrl/);
  assert.match(wardrobeCss, /\.wardrobe-pixel-visual/);
  assert.match(wardrobeCss, /drop-shadow\(2px 0 0 var\(--black\)\)/);
  assert.match(garmentCss, /\.garment-jacket/);
  assert.match(garmentCss, /\.garment-hoodie/);
  assert.match(garmentCss, /\.garment-shorts/);
  assert.match(garmentCss, /\.garment-boots/);
  assert.match(accessoryCss, /\.accessory-waistbag/);
  assert.match(accessoryCss, /\.accessory-belt/);
});
