import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/auth.css", import.meta.url), "utf8");

test("questionnaire option columns can shrink inside the form border", () => {
  assert.match(
    css,
    /\.quiz-page \.style-options\s*\{[^}]*min-width:\s*0;[^}]*repeat\(6, minmax\(0, 1fr\)\)/s
  );
  assert.match(css, /\.style-options\s*\{[^}]*min-inline-size:\s*0;/s);
  assert.match(css, /\.style-option\s*\{[^}]*min-width:\s*0;/s);
});
