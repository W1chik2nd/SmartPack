// Unit tests for the pure packing-plan generator. No server or DB needed —
// buildPackingPlan is deterministic, so we assert its shape and the slider's
// core trade-off directly (US 6.1–6.3, 7.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPackingPlan } from "./packing.ts";

test("plan is deterministic and clamps balance to 0..100", () => {
  assert.deepEqual(buildPackingPlan(50), buildPackingPlan(50));
  assert.equal(buildPackingPlan(-20).balance, 0);
  assert.equal(buildPackingPlan(999).balance, 100);
  // Non-numeric drift is the caller's job to guard; but rounding is ours.
  assert.equal(buildPackingPlan(49.6).balance, 50);
});

test("lean packing means fewer items but higher reuse than a varied plan", () => {
  const lean = buildPackingPlan(0);
  const varied = buildPackingPlan(100);

  const count = (p: ReturnType<typeof buildPackingPlan>) =>
    p.categories.reduce((n, c) => n + c.items.length, 0);

  assert.ok(count(lean) < count(varied), "more variety should pack more items");

  // Every category in the leanest plan holds exactly one piece.
  for (const cat of lean.categories) {
    assert.equal(cat.items.length, 1);
    assert.ok(cat.items[0].reuse >= 1);
  }

  // The lean plan's top core piece is reused at least as much as the varied one's.
  assert.ok(lean.corePieces[0].reuse >= varied.corePieces[0].reuse);
});

test("essentials always include ID and passport, in that order", () => {
  const plan = buildPackingPlan(50);
  assert.equal(plan.essentials[0].label, "身份证");
  assert.equal(plan.essentials[1].label, "护照");
  assert.ok(plan.essentials.length >= 5);
});

test("core pieces are the most-reused items, capped at four, sorted desc", () => {
  const plan = buildPackingPlan(20);
  assert.ok(plan.corePieces.length > 0 && plan.corePieces.length <= 4);
  for (let i = 1; i < plan.corePieces.length; i++) {
    assert.ok(plan.corePieces[i - 1].reuse >= plan.corePieces[i].reuse);
  }
});
