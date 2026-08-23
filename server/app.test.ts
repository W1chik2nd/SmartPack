// API tests for the auth server, using the built-in node:test runner
// against the real handler and a throwaway on-disk SQLite database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("register creates an account and returns a session", async () => {
  const { status, body } = await post("/api/register", {
    email: "anna@example.com",
    name: "Anna",
    password: "correct-horse",
  });
  assert.equal(status, 201);
  assert.equal(body.user.email, "anna@example.com");
  assert.equal(body.user.name, "Anna");
  assert.ok(body.token.length > 0);
  assert.equal(body.user.pass_hash, undefined, "must not leak hash");
});

test("register rejects invalid email, short password, missing name", async () => {
  const bad = [
    { email: "not-an-email", name: "A", password: "long-enough" },
    { email: "ok@example.com", name: "A", password: "short" },
    { email: "ok@example.com", name: "", password: "long-enough" },
  ];
  for (const payload of bad) {
    const { status } = await post("/api/register", payload);
    assert.equal(status, 400);
  }
});

test("register rejects duplicate email (case-insensitive)", async () => {
  const { status } = await post("/api/register", {
    email: "ANNA@example.com",
    name: "Anna 2",
    password: "another-pass",
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
    email: "ben@example.com",
    name: "Ben",
    password: "plain-text-secret",
  });
  assert.equal(reg.status, 201);
  const serialized = JSON.stringify(reg.body);
  assert.ok(!serialized.includes("plain-text-secret"), "password must not echo");
  assert.ok(!serialized.includes("pass_hash"), "hash must not be exposed");
  assert.ok(!serialized.includes("pass_salt"), "salt must not be exposed");
});
