// Unit tests for the pure packing-plan generator. No server or DB needed —
// buildPackingPlan is deterministic, so we assert its shape and the slider's
// core trade-off directly (US 6.1–6.3, 7.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGeneratedPackingPlan,
  buildPackingPlan,
  type StoredGeneratedPacking,
} from "./packing.ts";

// Every human-readable field ships both languages so the client can render the
// plan in whichever language the user picked. `label` stays Chinese for
// backward-compatibility; the *En variants back the English UI.
function assertBilingual(p: ReturnType<typeof buildPackingPlan>) {
  assert.ok(p.summary && p.summaryEn, "summary + summaryEn non-empty");
  for (const cat of p.categories) {
    assert.ok(cat.title && cat.titleEn, `category ${cat.id} bilingual`);
    for (const item of cat.items) {
      assert.ok(item.label && item.labelEn, `item ${item.id} bilingual`);
    }
  }
  for (const e of p.essentials) {
    assert.ok(e.label && e.labelEn, `essential ${e.id} bilingual`);
  }
  for (const c of p.corePieces) {
    assert.ok(c.label && c.labelEn, `core piece ${c.id} bilingual`);
  }
}

test("plan is deterministic and clamps balance to 0..100", () => {
  assert.deepEqual(buildPackingPlan(50), buildPackingPlan(50));
  assert.equal(buildPackingPlan(-20).balance, 0);
  assert.equal(buildPackingPlan(999).balance, 100);
  // Non-numeric drift is the caller's job to guard; but rounding is ours.
  assert.equal(buildPackingPlan(49.6).balance, 50);
});

test("every label ships a non-empty English variant", () => {
  assertBilingual(buildPackingPlan(0));
  assertBilingual(buildPackingPlan(50));
  assertBilingual(buildPackingPlan(100));
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

// 装备类(充电宝、转换插头之类)压根不来自衣橱,空的 wardrobeItemId 只
// 说明它不是衣服。之前客户端拿 `wardrobeItemId === ""` 当缺口判据,导致
// 每一条装备都挂着「衣橱缺口」红标。判据现在由服务端给。
function gearFixture(): StoredGeneratedPacking {
  const item = (id: string, wardrobeItemId: string) => ({
    id,
    label: id,
    labelEn: id,
    reuse: 1,
    quantity: 1,
    daysUsed: [1],
    wardrobeItemId,
    priority: "core" as const,
  });
  return {
    summary: "s",
    summaryEn: "s",
    categories: [
      {
        id: "tops",
        title: "上衣",
        titleEn: "Tops",
        items: [item("owned-tee", "w-1"), item("missing-shirt", "")],
      },
      {
        id: "equipment",
        title: "装备",
        titleEn: "Equipment",
        items: [item("power-bank", ""), item("uk-adapter", "")],
      },
    ],
    essentials: [],
  };
}

test("gear never counts as a wardrobe gap, missing clothes still do", () => {
  const plan = buildGeneratedPackingPlan(gearFixture(), 50, 2);
  const byId = new Map(
    plan.categories.flatMap((c) => c.items).map((i) => [i.id, i])
  );

  assert.equal(byId.get("power-bank")?.wardrobeGap, false);
  assert.equal(byId.get("uk-adapter")?.wardrobeGap, false);
  assert.equal(byId.get("missing-shirt")?.wardrobeGap, true);
  assert.equal(byId.get("owned-tee")?.wardrobeGap, false);
});
