import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type App } from "./app.ts";
import type { TripAgentInput } from "./trip-agent.ts";
import type { GeneratedTripPlan } from "./trip-agent-types.ts";

let app: App;
let server: Server;
let base: string;
let dir: string;
let token: string;
let received: TripAgentInput | null = null;
let releaseGeneration: (() => void) | null = null;
let blockGeneration = false;
let generationFailure: Error | null = null;

const generated: GeneratedTripPlan = {
  title: "京都两日文化旅行",
  titleEn: "Two-day Kyoto Culture Trip",
  departLabel: "9.01",
  days: ["2026-09-01", "2026-09-02"].map((date, i) => ({
    date,
    dateLabel: `9.${i + 1}`,
    city: "京都",
    cityEn: "Kyoto",
    summary: i === 0 ? "东山步行与晚餐" : "岚山慢游",
    summaryEn: i === 0 ? "Higashiyama walk and dinner" : "A slower Arashiyama day",
    weatherSummary: "18–25°C,间歇阵雨",
    weatherSummaryEn: "18–25°C with intermittent showers",
    weatherRisk: "石板路湿滑,傍晚转凉",
    weatherRiskEn: "Slippery stone paths and a cooler evening",
    outfit: [
      { label: "速干上衣", labelEn: "Quick-dry top" },
      { label: "轻薄防水外套", labelEn: "Light waterproof shell" },
    ],
    equipment: [{ label: "折叠伞", labelEn: "Compact umbrella" }],
    stops: [
      ["spot", "清水寺", "Kiyomizu-dera", "09:00"],
      ["meal", "当地午餐", "Local lunch", "12:30"],
      ["spot", "祇园", "Gion", "15:00"],
    ].map(([kind, name, nameEn, startTime]) => ({
      kind: kind as "spot" | "meal",
      name,
      nameEn,
      startTime,
      duration: "90 min",
      note: "步行衔接,预留休息",
      noteEn: "Walkable connection with a rest buffer",
      photoQuery: `${nameEn} Kyoto`,
    })),
  })),
  packing: {
    summary: "两件核心单品覆盖两天,雨具随身。",
    summaryEn: "Two core pieces cover both days; keep rain gear at hand.",
    categories: [
      {
        id: "tops",
        title: "上衣",
        titleEn: "Tops",
        items: [
          {
            label: "速干上衣",
            labelEn: "Quick-dry top",
            quantity: 1,
            reuse: 2,
            priority: "core",
            daysUsed: [1, 2],
            wardrobeItemId: "",
          },
        ],
      },
      {
        id: "outerwear",
        title: "外套",
        titleEn: "Outerwear",
        items: [
          {
            label: "轻薄防水外套",
            labelEn: "Light waterproof shell",
            quantity: 1,
            reuse: 2,
            priority: "support",
            daysUsed: [1, 2],
            wardrobeItemId: "",
          },
        ],
      },
      {
        id: "shoes",
        title: "鞋履",
        titleEn: "Shoes",
        items: [
          {
            label: "防滑步行鞋",
            labelEn: "Grippy walking shoes",
            quantity: 1,
            reuse: 2,
            priority: "core",
            daysUsed: [1, 2],
            wardrobeItemId: "",
          },
        ],
      },
      {
        id: "accessories",
        title: "配饰",
        titleEn: "Accessories",
        items: [
          {
            label: "造型丝巾",
            labelEn: "Styling scarf",
            quantity: 1,
            reuse: 1,
            priority: "optional",
            daysUsed: [2],
            wardrobeItemId: "",
          },
        ],
      },
    ],
    essentials: [
      { label: "护照", labelEn: "Passport" },
      { label: "充电器", labelEn: "Charger" },
      { label: "常备药", labelEn: "Regular medication" },
      { label: "折叠伞", labelEn: "Compact umbrella" },
    ],
  },
};

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "smartpack-generation-"));
  app = createApp(join(dir, "test.db"), {
    generateTrip: async (input) => {
      received = input;
      if (blockGeneration) {
        await new Promise<void>((resolve) => {
          releaseGeneration = resolve;
        });
      }
      if (generationFailure) throw generationFailure;
      const result = structuredClone(generated);
      result.packing.summary = `${input.plan.placeName}专属物品清单`;
      result.packing.summaryEn = `Packing list for ${input.plan.placeName}`;
      return result;
    },
  });
  server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  base = `http://localhost:${address.port}`;
  const register = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "agent@example.com",
      password: "correct-horse",
      name: "Anna",
      gender: "female",
      age: 28,
      heightCm: 168,
      weightKg: 55,
      stylePrefs: ["business", "elegant"],
      wearFeel: ["runs-cold"],
      travelHabits: ["carry-on-only"],
    }),
  });
  token = (await register.json()).token;
});

after(() => {
  server.close();
  app.close();
  rmSync(dir, { recursive: true, force: true });
});

function request(path: string, init: RequestInit = {}) {
  return fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });
}

async function waitForPlan(
  planId: string,
  status: "completed" | "failed"
): Promise<any> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const body = await (await request("/api/trip-plans")).json();
    const plan = body.plans.find((candidate: any) => candidate.id === planId);
    if (plan?.generationStatus === status) return plan;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`plan ${planId} did not become ${status}`);
}

test("generation requires a configured server-side API key", async () => {
  delete process.env.AI_API_KEY;
  const response = await request("/api/trip-plans/generate", {
    method: "POST",
    body: JSON.stringify({
      scenario: "travel",
      placeName: "京都",
      placeDetail: "日本",
      lat: 35.0116,
      lon: 135.7681,
      startDate: "2026-09-01",
      endDate: "2026-09-02",
      notes: "第二天节奏慢一点",
    }),
  });
  assert.equal(response.status, 503);
});

test("one agent run synchronizes trip, itinerary, outfits, equipment, and packing", async () => {
  process.env.AI_API_KEY = "test-key-not-used";
  blockGeneration = true;
  try {
    const response = await request("/api/trip-plans/generate", {
      method: "POST",
      body: JSON.stringify({
        scenario: "travel",
        placeName: "京都",
        placeDetail: "日本",
        lat: 35.0116,
        lon: 135.7681,
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        notes: "第二天节奏慢一点,只带登机箱",
      }),
    });
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.plan.itineraryId, null);
    assert.equal(body.plan.generationStatus, "processing");
    assert.deepEqual(body.estimate, { minSeconds: 180, maxSeconds: 480 });

    const queued = await (await request("/api/trip-plans")).json();
    const queuedPlan = queued.plans.find((plan: any) => plan.id === body.plan.id);
    assert.equal(queuedPlan.generationStatus, "processing");
    assert.equal(queuedPlan.itineraryId, null);

    releaseGeneration?.();
    const completed = await waitForPlan(body.plan.id, "completed");
    assert.ok(completed.itineraryId);
    assert.equal(received?.user.name, "Anna");
    assert.match(received?.user.style_prefs ?? "", /business/);
    assert.match(received?.plan.notes ?? "", /登机箱/);

    const homeTrips = await (await request("/api/trip-plans")).json();
    const homeTrip = homeTrips.plans.find((plan: any) => plan.id === body.plan.id);
    assert.equal(homeTrip.scenario, "travel");
    assert.equal(homeTrip.itineraryId, completed.itineraryId);

    const itinerary = await (
      await request(`/api/itinerary/trips/${completed.itineraryId}`)
    ).json();
    assert.equal(itinerary.trip.days.length, 2);
    assert.match(itinerary.trip.days[0].weatherRisk, /湿滑/);
    assert.equal(itinerary.trip.days[0].outfit[0].label, "速干上衣");
    assert.equal(itinerary.trip.days[0].equipment[0].label, "折叠伞");

    const lean = await (
      await request("/api/packing?balance=0&scenario=travel")
    ).json();
    const varied = await (
      await request("/api/packing?balance=100&scenario=travel")
    ).json();
    const count = (plan: any) =>
      plan.categories.reduce((n: number, category: any) => n + category.items.length, 0);
    assert.ok(count(varied.plan) > count(lean.plan));
    assert.ok(varied.plan.essentials.some((item: any) => item.label === "折叠伞"));

    // A newer scenario must not replace the packing list selected from an
    // older home card: the client addresses generated packing by plan id.
    blockGeneration = false;
    const dateResponse = await request("/api/trip-plans/generate", {
      method: "POST",
      body: JSON.stringify({
        scenario: "date",
        placeName: "上海",
        placeDetail: "中国",
        lat: 31.2304,
        lon: 121.4737,
        startDate: "2026-09-03",
        endDate: "2026-09-04",
        notes: "晚餐和散步",
      }),
    });
    const dateBody = await dateResponse.json();
    assert.equal(dateResponse.status, 202);
    await waitForPlan(dateBody.plan.id, "completed");

    const travelPacking = await (
      await request(
        `/api/packing?balance=50&tripPlanId=${encodeURIComponent(body.plan.id)}`
      )
    ).json();
    const datePacking = await (
      await request(
        `/api/packing?balance=50&tripPlanId=${encodeURIComponent(dateBody.plan.id)}`
      )
    ).json();
    assert.match(travelPacking.plan.summary, /京都/);
    assert.match(datePacking.plan.summary, /上海/);
    assert.equal(
      (await request("/api/packing?balance=50&tripPlanId=missing")).status,
      404
    );

    const removed = await request(`/api/trip-plans/${body.plan.id}`, {
      method: "DELETE",
    });
    assert.equal(removed.status, 200);
    const afterDelete = await (await request("/api/trip-plans")).json();
    assert.ok(!afterDelete.plans.some((plan: any) => plan.id === body.plan.id));
    assert.equal(
      (await request(`/api/itinerary/trips/${completed.itineraryId}`)).status,
      404
    );
    assert.equal(
      (
        await request(`/api/trip-plans/${dateBody.plan.id}`, {
          method: "DELETE",
        })
      ).status,
      200
    );
  } finally {
    blockGeneration = false;
    releaseGeneration = null;
    delete process.env.AI_API_KEY;
  }
});

test("deleting a processing trip discards the later Agent response", async () => {
  process.env.AI_API_KEY = "test-key-not-used";
  blockGeneration = true;
  try {
    const response = await request("/api/trip-plans/generate", {
      method: "POST",
      body: JSON.stringify({
        scenario: "travel",
        placeName: "伦敦",
        placeDetail: "英国",
        lat: 51.5074,
        lon: -0.1278,
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        notes: "步行与晚餐",
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(
      (await request(`/api/trip-plans/${body.plan.id}`, { method: "DELETE" })).status,
      200
    );
    releaseGeneration?.();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const plans = await (await request("/api/trip-plans")).json();
    assert.ok(!plans.plans.some((plan: any) => plan.id === body.plan.id));
    const trips = await (await request("/api/itinerary/trips")).json();
    assert.ok(!trips.trips.some((trip: any) => trip.sourcePlanId === body.plan.id));
  } finally {
    blockGeneration = false;
    releaseGeneration = null;
    delete process.env.AI_API_KEY;
  }
});

test("background generation failures remain visible on the saved trip", async () => {
  process.env.AI_API_KEY = "test-key-not-used";
  generationFailure = new Error("provider unavailable");
  try {
    const response = await request("/api/trip-plans/generate", {
      method: "POST",
      body: JSON.stringify({
        scenario: "travel",
        placeName: "巴黎",
        placeDetail: "法国",
        lat: 48.8566,
        lon: 2.3522,
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        notes: "博物馆与步行",
      }),
    });
    assert.equal(response.status, 202);
    const body = await response.json();
    const failed = await waitForPlan(body.plan.id, "failed");
    assert.equal(failed.itineraryId, null);
    assert.equal(failed.generationError, "provider unavailable");
  } finally {
    generationFailure = null;
    delete process.env.AI_API_KEY;
  }
});
