import assert from "node:assert/strict";
import test from "node:test";
import { filterWardrobeItems } from "../src/lib/wardrobe-filter.ts";
import { DEMO_WARDROBE_ITEMS } from "../../server/demo-wardrobe.ts";

const items = [
  { id: "tee", title: "白色纯棉T恤", category: "上衣", subtype: "T恤" },
  { id: "coat", title: "藏蓝轻薄夹克", category: "上衣", subtype: "夹克" },
  { id: "pants", title: "黑色直筒西裤", category: "下装", subtype: "长裤" },
  { id: "skirt", title: "米白色A字半裙", category: "下装", subtype: "半裙" },
  { id: "shoes", title: "白色复古运动鞋", category: "鞋履", subtype: "运动鞋" },
  { id: "scarf", title: "灰色轻薄围巾", category: "配饰", subtype: "围巾" },
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

test("通用下装按具体款式分流，半裙不会混进裤装", () => {
  assert.deepEqual(
    filterWardrobeItems(items, "pants").map((item) => item.id),
    ["pants"]
  );
  assert.deepEqual(
    filterWardrobeItems(items, "skirts").map((item) => item.id),
    ["skirt"]
  );
});

test("30 件演示衣橱在每个筛选项下都有正确数量", () => {
  assert.deepEqual(
    Object.fromEntries(
      (["tops", "pants", "skirts", "shoes", "accessories"] as const).map(
        (filter) => [filter, filterWardrobeItems(DEMO_WARDROBE_ITEMS, filter).length]
      )
    ),
    { tops: 8, pants: 7, skirts: 1, shoes: 5, accessories: 9 }
  );
});
