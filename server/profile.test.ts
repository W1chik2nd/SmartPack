// Questionnaire catalog + validation, tested directly (no HTTP layer).
// The route-level behaviour lives in app.test.ts; this file covers the rules
// themselves and the prompt's style_prefs → style fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_COLUMNS,
  PROFILE_FIELDS,
  optionLabels,
  profileOptionsPayload,
  validateProfile,
} from "./profile.ts";
import { buildSystemPrompt } from "./prompts.ts";

const required = { name: "Anna", age: 28, heightCm: 168, weightKg: 55 };

function ok(body: Record<string, unknown>) {
  const result = validateProfile(body);
  assert.equal(result.ok, true, `expected valid: ${JSON.stringify(body)}`);
  return result.ok ? result.values : {};
}

test("only name/age/height/weight are required", () => {
  const requiredKeys = PROFILE_FIELDS.filter((f) => f.required).map((f) => f.key);
  assert.deepEqual(requiredKeys, ["name", "age", "heightCm", "weightKg"]);
});

test("a required-only profile validates and leaves optional columns NULL", () => {
  const values = ok(required);
  assert.equal(values.name, "Anna");
  assert.equal(values.age, 28);
  assert.equal(values.height_cm, 168);
  assert.equal(values.weight_kg, 55);
  for (const field of PROFILE_FIELDS.filter((f) => !f.required)) {
    assert.equal(values[field.column], null, `${field.column} must be NULL`);
  }
});

test("missing or out-of-range required answers fail with a named message", () => {
  const bad: Record<string, unknown>[] = [
    { ...required, name: "   " },
    { ...required, age: undefined },
    { ...required, age: 0 },
    { ...required, age: 121 },
    { ...required, age: 28.5 },
    { ...required, heightCm: "168" },
    { ...required, heightCm: 4 },
    { ...required, weightKg: -5 },
    { ...required, weightKg: Number.NaN },
  ];
  for (const body of bad) {
    const result = validateProfile(body);
    assert.equal(result.ok, false, `expected invalid: ${JSON.stringify(body)}`);
    if (!result.ok) assert.match(result.error, /^Please enter a valid /);
  }
});

test("blank optional answers are stored as NULL, not empty values", () => {
  // "" / null / [] all mean "the user skipped it" — one representation, so
  // downstream code only checks for NULL.
  const values = ok({
    ...required,
    bustCm: null,
    bodyType: "",
    stylePrefs: [],
    wearFeel: undefined,
  });
  assert.equal(values.bust_cm, null);
  assert.equal(values.body_type, null);
  assert.equal(values.style_prefs, null);
  assert.equal(values.wear_feel, null);
});

test("multi-select answers are stored as a JSON array", () => {
  const values = ok({ ...required, stylePrefs: ["business", "elegant"] });
  assert.equal(values.style_prefs, '["business","elegant"]');
});

test("optional answers outside the catalog are rejected", () => {
  const bad: Record<string, unknown>[] = [
    { bodyType: "banana" },
    { seasonColorType: "monsoon" },
    { stylePrefs: "business" },
    { stylePrefs: ["business", "nope"] },
    { stylePrefs: ["business", "business"] },
    { wearFeel: [7] },
    { travelHabits: { id: "packs-light" } },
    { hipCm: 900 },
  ];
  for (const patch of bad) {
    const result = validateProfile({ ...required, ...patch });
    assert.equal(result.ok, false, `expected invalid: ${JSON.stringify(patch)}`);
  }
});

test("text answers are trimmed and length-capped", () => {
  assert.equal(ok({ ...required, name: "  Anna  " }).name, "Anna");
  assert.equal(validateProfile({ ...required, name: "x".repeat(61) }).ok, false);
});

test("the migration column list covers every field plus the legacy style column", () => {
  const columns = PROFILE_COLUMNS.map(([col]) => col);
  for (const field of PROFILE_FIELDS) {
    if (field.column === "name") continue; // part of the original table
    assert.ok(columns.includes(field.column), `missing ${field.column}`);
  }
  // Old rows keep their single style choice; prompts.ts still reads it.
  assert.ok(columns.includes("style"));
  // Multi-select columns hold JSON text.
  const types = new Map(PROFILE_COLUMNS);
  assert.equal(types.get("style_prefs"), "TEXT");
  assert.equal(types.get("bust_cm"), "REAL");
});

test("the published catalog hides server internals", () => {
  const payload = profileOptionsPayload();
  assert.equal(payload.fields.length, PROFILE_FIELDS.length);
  for (const field of payload.fields) {
    assert.equal("column" in field, false, "column names are server-internal");
    assert.equal("label" in field, false, "server error labels are not UI copy");
  }
});

test("optionLabels maps ids to English labels and passes unknown ids through", () => {
  assert.deepEqual(optionLabels("stylePrefs", ["business", "elegant"]), [
    "Business",
    "Elegant",
  ]);
  assert.deepEqual(optionLabels("stylePrefs", ["retired-option"]), [
    "retired-option",
  ]);
});

const baseProfile = {
  name: "Anna",
  age: 28,
  height_cm: 168,
  weight_kg: 55,
  style: null,
};

test("the prompt prefers style_prefs over the legacy style column", () => {
  const prompt = buildSystemPrompt({
    ...baseProfile,
    style: "Streetwear",
    style_prefs: '["business","elegant"]',
  });
  assert.match(prompt, /- Preferred styles: Business, Elegant/);
  assert.ok(!prompt.includes("Streetwear"), "legacy value must not also appear");
});

test("the prompt falls back to the legacy style column", () => {
  // Pre-questionnaire rows, plus the defensive cases of empty and corrupt
  // JSON: all three must still yield the old single-style line.
  for (const style_prefs of [null, undefined, "[]", "not json"]) {
    const prompt = buildSystemPrompt({
      ...baseProfile,
      style: "Streetwear",
      style_prefs,
    });
    assert.match(prompt, /- Preferred style: Streetwear/);
  }
});

test("the prompt lists optional profile details and omits missing ones", () => {
  const full = buildSystemPrompt({
    ...baseProfile,
    bust_cm: 86,
    waist_cm: 68,
    hip_cm: 92,
    body_type: "hourglass",
    season_color_type: "winter",
    style_prefs: '["business"]',
    wear_feel: '["runs-cold"]',
    travel_habits: '["carry-on-only"]',
  });
  assert.match(full, /- Measurements: bust 86 cm, waist 68 cm, hip 92 cm/);
  assert.match(full, /- Body type: Hourglass/);
  assert.match(full, /- Seasonal color type: Winter \(cool, deep\)/);
  assert.match(full, /- Comfort preferences: Feels cold easily/);
  assert.match(full, /- Travel and packing habits: Carry-on only/);

  const minimal = buildSystemPrompt(baseProfile);
  assert.match(minimal, /- Name: Anna/);
  for (const heading of [
    "Measurements",
    "Body type",
    "Seasonal color type",
    "Preferred style",
    "Comfort preferences",
    "Travel and packing habits",
  ]) {
    assert.ok(!minimal.includes(`- ${heading}`), `${heading} must be omitted`);
  }
});
