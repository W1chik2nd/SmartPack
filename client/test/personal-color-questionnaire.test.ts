import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const questionnaire = readFileSync(
  new URL("../src/pages/Questionnaire.tsx", import.meta.url),
  "utf8"
);
const profile = readFileSync(
  new URL("../src/pages/Profile.tsx", import.meta.url),
  "utf8"
);
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const colorGuide = readFileSync(
  new URL("../src/components/PersonalColorGuide.tsx", import.meta.url),
  "utf8"
);

test("sign-up questionnaire keeps the personal-colour helper and season autofill", () => {
  assert.match(questionnaire, /PersonalColorGuide/);
  assert.match(questionnaire, /seasonColorType: \[season\]/);
  assert.match(questionnaire, /不知道自己的四季型/);
});

test("AI report auto-selects the detected season after a short delay", () => {
  assert.match(colorGuide, /AUTO_CHOICE_DELAY_MS = 3_000/);
  assert.match(colorGuide, /onSeasonDetectedRef\.current\(lastSeason\.current!/);
  assert.match(colorGuide, /将在 \{countdown\} 秒后自动选择/);
});

test("profile editing keeps the same helper and persisted season field", () => {
  assert.match(profile, /PersonalColorGuide/);
  assert.match(profile, /update\("seasonColorType", season\)/);
  assert.match(api, /\/api\/personal-color\/analyze/);
});
