import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const profile = readFileSync(new URL("../src/pages/Profile.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/profile.css", import.meta.url), "utf8");
const avatar = new URL("../public/profile-neutral.png", import.meta.url);

test("neutral profile states use the uploaded neutral avatar", () => {
  assert.match(profile, /type Avatar = "woman" \| "man" \| "neutral"/);
  assert.match(profile, /return "neutral"/);
  assert.match(profile, /\/profile-neutral\.png/);
  assert.match(css, /profile-avatar-image\[src="\/profile-neutral\.png"\]/);
  assert.ok(statSync(avatar).size > 0);
});

test("male and female profile avatar assets remain selected unchanged", () => {
  assert.match(profile, /\/profile-male\.jpg/);
  assert.match(profile, /\/profile-female\.jpg/);
});
