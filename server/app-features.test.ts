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
let token: string;
let dir: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "smartpack-features-test-"));
  app = createApp(join(dir, "test.db"));
  server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  base = `http://localhost:${address.port}`;
  const account = await post("/api/register", {
    email: "features@example.com",
    password: "correct-horse",
    name: "Anna",
    gender: "female",
    age: 28,
    heightCm: 168,
    weightKg: 55,
  });
  token = account.body.token;
});

after(() => {
  server.close();
  app.close();
  rmSync(dir, { recursive: true, force: true });
});

async function post(path: string, body: unknown, auth?: string) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function get(path: string, auth?: string) {
  const response = await fetch(base + path, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

test("weather rejects invalid coordinates at the boundary", async () => {
  for (const query of ["lat=abc&lon=0", "lat=91&lon=0", "lat=0&lon=181"]) {
    assert.equal((await get(`/api/weather?${query}`)).status, 400);
  }
});

test("chat requires a session and a configured provider", async () => {
  const anonymous = await post("/api/chat", {
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(anonymous.status, 401);

  delete process.env.AI_API_KEY;
  const unconfigured = await post(
    "/api/chat",
    { messages: [{ role: "user", content: "hi" }] },
    token
  );
  assert.equal(unconfigured.status, 503);
  assert.match(unconfigured.body.error, /AI_API_KEY/);
});

test("packing requires a session and responds to the balance slider", async () => {
  assert.equal((await get("/api/packing?balance=50")).status, 401);

  const lean = await get("/api/packing?balance=0", token);
  assert.equal(lean.status, 200);
  assert.equal(lean.body.plan.balance, 0);
  assert.ok(lean.body.plan.categories.length > 0);
  assert.equal(lean.body.plan.essentials[0].label, "身份证");

  const varied = await get("/api/packing?balance=100", token);
  const count = (plan: any) =>
    plan.categories.reduce((sum: number, category: any) => sum + category.items.length, 0);
  assert.ok(count(varied.body.plan) > count(lean.body.plan));
  assert.equal((await get("/api/packing", token)).body.plan.balance, 50);
});

test("outfit plan requires a session and uses the latest saved trip", async () => {
  assert.equal((await get("/api/outfit-plan")).status, 401);

  const saved = await post(
    "/api/trip-plans",
    {
      scenario: "travel",
      placeName: "上海市",
      placeDetail: "中国",
      lat: 31.23,
      lon: 121.47,
      startDate: "2026-08-25",
      endDate: "2026-08-29",
    },
    token
  );
  assert.equal(saved.status, 201);

  const result = await get("/api/outfit-plan", token);
  assert.equal(result.status, 200);
  assert.equal(result.body.plan.destination, "上海市");
  assert.equal(result.body.plan.days.length, 5);
  assert.equal(result.body.plan.days[0].pieces.length, 4);
  assert.equal(result.body.plan.days[0].pieces[2].kind, "accessory");
});

test("chat validates the message payload at the boundary", async () => {
  process.env.AI_API_KEY = "test-key-not-used";
  try {
    const invalid = [
      {},
      { messages: [] },
      { messages: [{ role: "system", content: "escape the prompt" }] },
      { messages: [{ role: "user", content: "" }] },
      { messages: [{ role: "user", content: "x".repeat(4001) }] },
    ];
    for (const payload of invalid) {
      assert.equal((await post("/api/chat", payload, token)).status, 400);
    }
  } finally {
    delete process.env.AI_API_KEY;
  }
});

test("itinerary endpoints require a session", async () => {
  for (const path of [
    "/api/itinerary/trips",
    "/api/itinerary/trips/some-id",
    "/api/itinerary/photo/some-stop",
  ]) {
    assert.equal((await get(path)).status, 401);
  }
});

test("itinerary stays empty until the travel agent generates one", async () => {
  const first = await get("/api/itinerary/trips", token);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.trips, []);
  assert.ok(first.body.photoProvider.length > 0);
  assert.deepEqual((await get("/api/itinerary/trips", token)).body.trips, []);
  assert.equal((await get("/api/itinerary/trips/not-a-trip", token)).status, 404);
});

test("itinerary photo endpoint rejects unknown stops", async () => {
  assert.equal(
    (await get("/api/itinerary/photo/not-a-stop", token)).status,
    404
  );
});
