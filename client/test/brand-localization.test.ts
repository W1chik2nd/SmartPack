import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STRINGS } from "../src/i18n/strings.ts";

test("the brand follows the active language", () => {
  assert.equal(STRINGS.brandName.en, "WearRoute");
  assert.equal(STRINGS.brandName.zh, "行装");
  assert.match(STRINGS.loginTitle.en, /WearRoute/);
  assert.match(STRINGS.loginTitle.zh, /行装/);
});

test("the shell and landing page render the localized brand key", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const landing = readFileSync(
    new URL("../src/pages/Landing.tsx", import.meta.url),
    "utf8"
  );
  const styles = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8"
  );
  assert.match(app, /t\("brandName"\)/);
  assert.match(landing, /t\("brandName"\)/);
  const brandRule = styles.match(/\.nav-brand\s*\{[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(brandRule, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /\.nav-brand\s*\{[^}]*font-size:\s*0/);
});
