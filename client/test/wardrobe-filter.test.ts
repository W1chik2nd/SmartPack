import assert from "node:assert/strict";
import test from "node:test";
import { filterWardrobeItems } from "../src/lib/wardrobe-filter.ts";

const items = [
  { id: "tee", category: "T恤" },
  { id: "coat", category: "外套" },
  { id: "pants", category: "裤装" },
  { id: "skirt", category: "裙装" },
  { id: "shoes", category: "鞋履" },
  { id: "scarf", category: "配饰" },
];

test("全部品类保留原有顺序", () => {
  assert.deepEqual(filterWardrobeItems(items, "all"), items);
});

test("上装筛选覆盖模型返回的各类上装", () => {
  assert.deepEqual(
    filterWardrobeItems(items, "tops").map((item) => item.id),
    ["tee", "coat"]
  );
});

test("裤装、裙装、鞋履和配饰各自独立筛选", () => {
  assert.equal(filterWardrobeItems(items, "pants")[0]?.id, "pants");
  assert.equal(filterWardrobeItems(items, "skirts")[0]?.id, "skirt");
  assert.equal(filterWardrobeItems(items, "shoes")[0]?.id, "shoes");
  assert.equal(filterWardrobeItems(items, "accessories")[0]?.id, "scarf");
});

