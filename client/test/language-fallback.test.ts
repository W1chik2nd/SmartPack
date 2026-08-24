import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/dashboard.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useTranslatedText.ts", import.meta.url), "utf8");
const packing = readFileSync(new URL("../src/pages/PackingListView.tsx", import.meta.url), "utf8");

test("outfit proportions keep tops larger than trousers", () => {
  assert.match(css, /dress-piece-top\.is-compact \{[\s\S]*width: 124px/);
  assert.match(css, /dress-piece-bottom\.is-compact \{[\s\S]*width: 58px/);
});

test("database text has an authenticated AI translation fallback", () => {
  assert.match(api, /export function translateTexts/);
  assert.match(hook, /translateTexts\(indexes\.map/);
  assert.match(packing, /useLocalizedValues/);
});
