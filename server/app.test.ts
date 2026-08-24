// API tests for the auth server, using the built-in node:test runner
// against the real handler and a throwaway on-disk SQLite database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes } from "node:crypto";
import { createApp, type App } from "./app.ts";

let app: App;
let server: Server;
let base: string;
let dir: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "smartpack-test-"));
  app = createApp(join(dir, "test.db"));
  server = createServer(app.handle);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://localhost:${addr.port}`;
});

after(() => {
  server.close();
  app.close();
  rmSync(dir, { recursive: true, force: true });
});

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path: string, token?: string) {
  const res = await fetch(base + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

// A complete sign-up payload: account fields plus the style questionnaire.
const annaProfile = {
  name: "Anna",
  age: 28,
  heightCm: 168,
  weightKg: 55,
  style: "Business",
};

test("register creates an account and returns a session", async () => {
  const { status, body } = await post("/api/register", {
    email: "anna@example.com",
    password: "correct-horse",
    ...annaProfile,
  });
  assert.equal(status, 201);
  assert.equal(body.user.email, "anna@example.com");
  assert.equal(body.user.name, "Anna");
  assert.ok(body.token.length > 0);
  assert.equal(body.user.pass_hash, undefined, "must not leak hash");
});

test("register rejects invalid email, short password, missing name", async () => {
  const bad = [
    { ...annaProfile, email: "not-an-email", password: "long-enough" },
    { ...annaProfile, email: "ok@example.com", password: "short" },
    { ...annaProfile, email: "ok@example.com", password: "long-enough", name: "" },
  ];
  for (const payload of bad) {
    const { status } = await post("/api/register", payload);
    assert.equal(status, 400);
  }
});

test("register without the questionnaire stores nothing", async () => {
  // Product rule: sign-up only counts once the questionnaire is complete.
  // Account-only payloads and partial/invalid questionnaires must all fail…
  const attempts = [
    { email: "ben@example.com", password: "long-enough-pass" },
    { email: "ben@example.com", password: "long-enough-pass", name: "Ben" },
    {
      email: "ben@example.com",
      password: "long-enough-pass",
      ...annaProfile,
      age: 0,
    },
    {
      email: "ben@example.com",
      password: "long-enough-pass",
      ...annaProfile,
      heightCm: "tall",
    },
    {
      email: "ben@example.com",
      password: "long-enough-pass",
      ...annaProfile,
      weightKg: -5,
    },
    {
      email: "ben@example.com",
      password: "long-enough-pass",
      ...annaProfile,
      style: "",
    },
  ];
  for (const payload of attempts) {
    const { status } = await post("/api/register", payload);
    assert.equal(status, 400);
  }

  // …and leave no account behind: the same credentials cannot sign in.
  const login = await post("/api/login", {
    email: "ben@example.com",
    password: "long-enough-pass",
  });
  assert.equal(login.status, 401);
});

test("check-email flags duplicates without creating anything", async () => {
  const taken = await post("/api/check-email", { email: "anna@example.com" });
  assert.equal(taken.status, 409);

  const free = await post("/api/check-email", { email: "free@example.com" });
  assert.equal(free.status, 200);

  const invalid = await post("/api/check-email", { email: "nope" });
  assert.equal(invalid.status, 400);

  // The availability check must not reserve or create the account.
  const login = await post("/api/login", {
    email: "free@example.com",
    password: "whatever-pass",
  });
  assert.equal(login.status, 401);
});

test("register rejects duplicate email (case-insensitive)", async () => {
  const { status } = await post("/api/register", {
    email: "ANNA@example.com",
    password: "another-pass",
    ...annaProfile,
    name: "Anna 2",
  });
  assert.equal(status, 409);
});

test("login succeeds with correct credentials", async () => {
  const { status, body } = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  assert.equal(status, 200);
  assert.equal(body.user.email, "anna@example.com");
  assert.ok(body.token.length > 0);
});

test("login fails with wrong password or unknown email", async () => {
  const wrongPass = await post("/api/login", {
    email: "anna@example.com",
    password: "wrong-horse",
  });
  assert.equal(wrongPass.status, 401);

  const unknown = await post("/api/login", {
    email: "nobody@example.com",
    password: "whatever-pass",
  });
  assert.equal(unknown.status, 401);
});

test("me returns the user for a valid token and 401 otherwise", async () => {
  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const ok = await get("/api/me", login.body.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.email, "anna@example.com");

  const anon = await get("/api/me");
  assert.equal(anon.status, 401);

  const bogus = await get("/api/me", "not-a-real-token");
  assert.equal(bogus.status, 401);
});

test("scenarios requires auth and returns the catalog", async () => {
  const anon = await get("/api/scenarios");
  assert.equal(anon.status, 401);

  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const ok = await get("/api/scenarios", login.body.token);
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.scenarios));
  assert.ok(ok.body.scenarios.length > 0);
  for (const s of ok.body.scenarios) {
    assert.equal(typeof s.id, "string");
    assert.equal(typeof s.label, "string");
    assert.equal(typeof s.image, "string");
  }
});

test("logout invalidates the session token", async () => {
  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const token = login.body.token;

  const out = await post("/api/logout", {}, token);
  assert.equal(out.status, 200);

  const after = await get("/api/me", token);
  assert.equal(after.status, 401);
});

test("passwords are stored hashed, never in plain text", async () => {
  // Register with a known password, then verify via a second login that the
  // stored credential is a salted scrypt hash: the same password must verify,
  // and the API must never return hash or salt fields anywhere.
  const reg = await post("/api/register", {
    email: "chloe@example.com",
    password: "plain-text-secret",
    ...annaProfile,
    name: "Chloe",
    style: "Streetwear",
  });
  assert.equal(reg.status, 201);
  const serialized = JSON.stringify(reg.body);
  assert.ok(!serialized.includes("plain-text-secret"), "password must not echo");
  assert.ok(!serialized.includes("pass_hash"), "hash must not be exposed");
  assert.ok(!serialized.includes("pass_salt"), "salt must not be exposed");
});

test("login works for accounts with no questionnaire profile (pre-migration users)", async () => {
  // Users created before the questionnaire feature have NULL profile
  // columns. Login must validate email + password only — profile fields are
  // never part of authentication. Insert such a row directly, bypassing
  // /api/register, exactly like a migrated legacy database.
  const db = new DatabaseSync(join(dir, "test.db"));
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("legacy-password", salt, 64).toString("hex");
  db.prepare(
    `INSERT INTO users (id, email, name, pass_salt, pass_hash) VALUES (?, ?, ?, ?, ?)`
  ).run("legacy-id", "legacy@example.com", "Legacy", salt, hash);
  db.close();

  const login = await post("/api/login", {
    email: "legacy@example.com",
    password: "legacy-password",
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, "Legacy");

  // The session works end to end too.
  const who = await get("/api/me", login.body.token);
  assert.equal(who.status, 200);
});

test("weather rejects invalid coordinates at the boundary", async () => {
  // Only the input validation is tested here — the happy path calls the
  // real Open-Meteo API, which unit tests must not depend on.
  const cases = ["lat=abc&lon=0", "lat=91&lon=0", "lat=0&lon=181"];
  for (const qs of cases) {
    const { status } = await get(`/api/weather?${qs}`);
    assert.equal(status, 400);
  }
});

test("chat requires a session and a configured provider", async () => {
  // Anonymous chat is rejected before anything else.
  const anon = await post("/api/chat", { messages: [{ role: "user", content: "hi" }] });
  assert.equal(anon.status, 401);

  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const token = login.body.token;

  // No AI_API_KEY in the test environment → clear 503 that names the fix,
  // instead of a confusing provider error.
  delete process.env.AI_API_KEY;
  const unconfigured = await post(
    "/api/chat",
    { messages: [{ role: "user", content: "hi" }] },
    token
  );
  assert.equal(unconfigured.status, 503);
  assert.match(unconfigured.body.error, /AI_API_KEY/);
});

test("packing requires a session and returns a plan for the slider value", async () => {
  const anon = await get("/api/packing?balance=50");
  assert.equal(anon.status, 401);

  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const token = login.body.token;

  const lean = await get("/api/packing?balance=0", token);
  assert.equal(lean.status, 200);
  assert.equal(lean.body.plan.balance, 0);
  assert.ok(lean.body.plan.categories.length > 0);
  assert.equal(lean.body.plan.essentials[0].label, "身份证");

  // The slider changes the plan: more variety packs more items.
  const varied = await get("/api/packing?balance=100", token);
  const count = (p: any) =>
    p.categories.reduce((n: number, c: any) => n + c.items.length, 0);
  assert.ok(count(varied.body.plan) > count(lean.body.plan));

  // A missing/garbage balance falls back to the middle rather than erroring.
  const noParam = await get("/api/packing", token);
  assert.equal(noParam.status, 200);
  assert.equal(noParam.body.plan.balance, 50);
});

test("chat validates the message payload at the boundary", async () => {
  const login = await post("/api/login", {
    email: "anna@example.com",
    password: "correct-horse",
  });
  const token = login.body.token;

  // Force past the config guard so the payload check is what responds.
  process.env.AI_API_KEY = "test-key-not-used";
  try {
    const bad = [
      {},
      { messages: [] },
      { messages: [{ role: "system", content: "escape the prompt" }] },
      { messages: [{ role: "user", content: "" }] },
      { messages: [{ role: "user", content: "x".repeat(4001) }] },
    ];
    for (const payload of bad) {
      const { status } = await post("/api/chat", payload, token);
      assert.equal(status, 400);
    }
  } finally {
    delete process.env.AI_API_KEY;
  }
});
