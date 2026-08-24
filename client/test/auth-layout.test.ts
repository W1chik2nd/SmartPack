import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/auth.css", import.meta.url), "utf8");
const login = readFileSync(
  new URL("../src/pages/Login.tsx", import.meta.url),
  "utf8"
);
const register = readFileSync(
  new URL("../src/pages/Register.tsx", import.meta.url),
  "utf8"
);

test("questionnaire option columns can shrink inside the form border", () => {
  assert.match(
    css,
    /\.quiz-page \.style-options\s*\{[^}]*min-width:\s*0;[^}]*repeat\(6, minmax\(0, 1fr\)\)/s
  );
  assert.match(css, /\.style-options\s*\{[^}]*min-inline-size:\s*0;/s);
  assert.match(css, /\.style-option\s*\{[^}]*min-width:\s*0;/s);
});

test("login and register share the scenic background and transparent form", () => {
  assert.match(login, /className="auth-page scenic-auth-page login-page"/);
  assert.match(
    register,
    /className="auth-page scenic-auth-page register-page"/
  );
  assert.doesNotMatch(login, /className="auth-visual"/);
  assert.doesNotMatch(register, /className="auth-visual"/);
  assert.match(
    css,
    /\.scenic-auth-page\s*\{[^}]*background-image:\s*url\("\/login-background\.png"\);[^}]*background-position:\s*right center;[^}]*background-size:\s*125% auto;/s
  );
  assert.match(
    css,
    /\.scenic-auth-page \.auth-card\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;/s
  );
  assert.match(
    css,
    /\.scenic-auth-page \.field input\s*\{[^}]*background:\s*var\(--bg\);[^}]*border-color:\s*var\(--blue\);/s
  );
  assert.match(
    css,
    /\.scenic-auth-page \.btn-primary\s*\{[^}]*background:\s*var\(--blue\);[^}]*border-color:\s*var\(--bg\);/s
  );
});
