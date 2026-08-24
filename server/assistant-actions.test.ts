import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeAssistantActions,
  parseAssistantEnvelope,
  type AssistantActionContext,
} from "./assistant-actions.ts";

function context(): AssistantActionContext & { savedTrips: unknown[]; addedItems: unknown[] } {
  const savedTrips: unknown[] = [];
  const addedItems: unknown[] = [];
  return {
    userId: "user-1",
    scenarioIds: new Set(["travel", "business"]),
    savedTrips,
    addedItems,
    promptContext: "",
    wardrobe: {
      list: () => [],
      add: (_userId, item) => {
        addedItems.push(item);
        return { id: "item-1", title: item.title, category: item.category, subtype: "", count: 1, colors: [], fit: "", material: "", seasons: [], styleTags: [], details: "", hasPhoto: false, createdAt: "now" };
      },
      update: (_userId, id, patch) => id === "item-1"
        ? { id, title: String(patch.title ?? "Black tee"), category: "top", subtype: "", count: 1, colors: [], fit: "", material: "", seasons: [], styleTags: [], details: "", hasPhoto: false, createdAt: "now" }
        : null,
      remove: (_userId, id) => id === "item-1",
      photoPath: () => null,
    },
    tripPlans: {
      save: (_userId, plan) => {
        savedTrips.push(plan);
        return { id: "trip-1", createdAt: "now", ...plan };
      },
      list: () => [],
    },
    updateProfile: () => ({ id: "user-1" }),
    currentProfile: () => ({
      name: "Anna",
      gender: "female",
      age: 28,
      heightCm: 168,
      weightKg: 55,
      stylePrefs: [],
      wearFeel: [],
      travelHabits: [],
    }),
  };
}

test("assistant envelope accepts allow-listed navigation and rejects unknown actions", () => {
  const parsed = parseAssistantEnvelope(JSON.stringify({
    reply: "Opening your wardrobe.",
    actions: [
      { type: "navigate", page: "wardrobe" },
      { type: "navigate", page: "admin" },
      { type: "runSql", query: "DROP TABLE users" },
    ],
  }));
  assert.equal(parsed.reply, "Opening your wardrobe.");
  assert.deepEqual(parsed.actions, [{ type: "navigate", page: "wardrobe" }]);
});

test("plain provider text stays a recommendation with no side effects", () => {
  assert.deepEqual(parseAssistantEnvelope("Take a rain jacket."), {
    reply: "Take a rain jacket.",
    actions: [],
  });
});

test("assistant actions add wardrobe items and valid trip plans", () => {
  const ctx = context();
  const result = executeAssistantActions([
    { type: "addWardrobeItem", item: { title: "Black tee", category: "top" } },
    {
      type: "createTripPlan",
      plan: {
        scenario: "travel",
        placeName: "Kyoto",
        lat: 35.0116,
        lon: 135.7681,
        startDate: "2026-09-10",
        endDate: "2026-09-13",
      },
    },
  ], ctx);
  assert.equal(ctx.addedItems.length, 1);
  assert.equal(ctx.savedTrips.length, 1);
  assert.deepEqual(result.actions, [
    { type: "wardrobeChanged" },
    { type: "tripCreated" },
    { type: "navigate", page: "home" },
  ]);
  assert.deepEqual(result.errors, []);
});

test("assistant can edit a known wardrobe item", () => {
  const ctx = context();
  const parsed = parseAssistantEnvelope(JSON.stringify({
    reply: "Updating it.",
    actions: [{ type: "updateWardrobeItem", id: "item-1", patch: { title: "White tee" } }],
  }));
  const result = executeAssistantActions(parsed.actions, ctx);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.actions, [{ type: "wardrobeChanged" }]);
});

test("assistant merges a requested profile change with existing required fields", () => {
  const ctx = context();
  const result = executeAssistantActions([
    { type: "updateProfile", profile: { weightKg: 57 } },
  ], ctx);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.actions, [{ type: "profileUpdated", user: { id: "user-1" } }]);
});

test("assistant can control packing checklist state", () => {
  const ctx = context();
  const parsed = parseAssistantEnvelope(JSON.stringify({
    reply: "Marking it packed.",
    actions: [{ type: "packingChecklist", checked: ["passport"], balance: 20 }],
  }));
  const result = executeAssistantActions(parsed.actions, ctx);
  assert.deepEqual(result.actions, [{
    type: "packingChanged",
    checked: ["passport"],
    balance: 20,
  }]);
});

test("assistant refuses invalid trip mutations", () => {
  const ctx = context();
  const result = executeAssistantActions([{
    type: "createTripPlan",
    plan: {
      scenario: "unknown",
      placeName: "Nowhere",
      lat: 200,
      lon: 0,
      startDate: "2026-02-31",
      endDate: "2026-01-01",
    },
  }], ctx);
  assert.equal(ctx.savedTrips.length, 0);
  assert.deepEqual(result.actions, []);
  assert.equal(result.errors.length, 1);
});
