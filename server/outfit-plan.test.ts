import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutfitPlan, wardrobeItemVisual } from "./outfit-plan.ts";
import type { TripPlan } from "./trip-plan.ts";
import type { WardrobeItem } from "./wardrobe.ts";
import { DEMO_WARDROBE_ITEMS } from "./demo-wardrobe.ts";

const trip: TripPlan = {
  id: "trip-1",
  scenario: "business",
  placeName: "上海市",
  placeDetail: "中国",
  lat: 31.23,
  lon: 121.47,
  startDate: "2026-08-25",
  endDate: "2026-08-28",
  createdAt: "2026-08-24T00:00:00Z",
};

const wardrobe: WardrobeItem[] = [
  {
    id: "shirt-1",
    title: "蓝色衬衫",
    category: "上衣",
    subtype: "衬衫",
    count: 1,
    colors: ["蓝色"],
    fit: "",
    material: "",
    seasons: [],
    styleTags: [],
    details: "",
    hasPhoto: true,
    createdAt: "2026-08-20T00:00:00Z",
  },
  {
    id: "glasses-1",
    title: "红色太阳镜",
    category: "配饰",
    subtype: "眼镜",
    count: 1,
    colors: ["红色"],
    fit: "",
    material: "",
    seasons: [],
    styleTags: [],
    details: "",
    hasPhoto: false,
    createdAt: "2026-08-21T00:00:00Z",
  },
];

test("trip outfit plan covers every trip day and preserves trip context", () => {
  const plan = buildOutfitPlan(trip, wardrobe);
  assert.equal(plan.days.length, 4);
  assert.equal(plan.destination, "上海市");
  assert.equal(plan.scenario, "business");
  assert.equal(plan.days[3].date, "2026-08-28");
});

test("real wardrobe items use descriptions without exposing their photos", () => {
  const plan = buildOutfitPlan(trip, wardrobe);
  const [top, bottom, accessory, shoes] = plan.days[0].pieces;
  assert.equal(top.wardrobeItemId, "shirt-1");
  assert.equal(top.label, "蓝色衬衫");
  assert.equal(top.tone, "blue");
  assert.equal("hasPhoto" in top, false);
  assert.equal(top.garmentStyle, "shirt");
  assert.equal(bottom.wardrobeItemId, null);
  assert.equal(shoes.wardrobeItemId, null);
  assert.equal(accessory.wardrobeItemId, "glasses-1");
  assert.equal(accessory.kind, "accessory");
  assert.equal(accessory.accessoryStyle, "glasses");
  assert.equal(plan.usesWardrobe, true);
});

test("the title color and concrete garment description win over conflicting metadata", () => {
  const describedWardrobe: WardrobeItem[] = [
    {
      ...wardrobe[0],
      id: "orange-shirt",
      title: "橙色格纹长袖衬衫",
      subtype: "长袖衬衫",
      colors: ["绿色"],
      styleTags: ["格纹"],
      details: "灰色内衬",
    },
    {
      ...wardrobe[0],
      id: "white-tee",
      title: "白色纯棉基础短袖T恤",
      subtype: "T恤",
      colors: ["灰色"],
      details: "绿色缝线",
    },
  ];
  const plan = buildOutfitPlan(trip, describedWardrobe);
  const orange = plan.days[0].pieces[0];
  const white = plan.days[1].pieces[0];

  assert.equal(orange.tone, "orange");
  assert.equal(orange.garmentStyle, "shirt");
  assert.equal(orange.pattern, "plaid");
  assert.equal(orange.sleeve, "long");
  assert.equal(white.tone, "white");
  assert.equal(white.garmentStyle, "tee");
  assert.equal(white.pattern, "solid");
  assert.equal(white.sleeve, "short");
});

test("the 30-item demo wardrobe has unique description-derived pixel visuals", () => {
  assert.equal(DEMO_WARDROBE_ITEMS.length, 30);
  assert.equal(
    new Set(DEMO_WARDROBE_ITEMS.map((item) => item.title)).size,
    30,
    "seed titles must stay unique"
  );
  const visuals = DEMO_WARDROBE_ITEMS.map((item, index) =>
    wardrobeItemVisual({
      ...item,
      id: `demo-${index}`,
      subtype: item.subtype ?? "",
      count: item.count ?? 1,
      colors: item.colors ?? [],
      fit: item.fit ?? "",
      material: item.material ?? "",
      seasons: item.seasons ?? [],
      styleTags: item.styleTags ?? [],
      details: item.details ?? "",
      hasPhoto: false,
      createdAt: "2026-08-25T00:00:00Z",
    })
  );

  assert.equal(visuals.length, 30);
  assert.ok(visuals.every((visual) => visual.label && visual.wardrobeItemId));
  assert.ok(
    new Set(
      visuals.map((visual) => visual.garmentStyle ?? visual.accessoryStyle)
    ).size >= 18,
    "the varied wardrobe should exercise recognisably different silhouettes"
  );
  const visualFor = (title: string) =>
    visuals[DEMO_WARDROBE_ITEMS.findIndex((item) => item.title === title)];
  assert.equal(visualFor("白色纯棉T恤").tone, "white");
  assert.equal(visualFor("藏蓝轻薄夹克").garmentStyle, "jacket");
  assert.equal(visualFor("黄色连帽卫衣").garmentStyle, "hoodie");
  assert.equal(visualFor("深灰运动短裤").garmentStyle, "shorts");
  assert.equal(visualFor("黑色短靴").garmentStyle, "boots");
  assert.equal(visualFor("绿色防水腰包").accessoryStyle, "waistbag");
  assert.equal(visualFor("棕色皮带").accessoryStyle, "belt");
});

test("AI-suggested wardrobe gaps derive their appearance from the recommendation", () => {
  const plan = buildOutfitPlan(trip, [], undefined, [
    {
      date: trip.startDate,
      place: "香港",
      scene: "travel",
      outfit: [
        {
          label: "橙色格纹长袖衬衫",
          labelEn: "Orange plaid long-sleeve shirt",
          kind: "top",
        },
      ],
    },
  ]);
  const suggested = plan.days[0].pieces[0];

  assert.equal(suggested.tone, "orange");
  assert.equal(suggested.pattern, "plaid");
  assert.equal(suggested.sleeve, "long");
  assert.equal(suggested.wardrobeItemId, null);
});

test("jewellery keeps a recognisable accessory style", () => {
  const watch: WardrobeItem[] = [
    {
      ...wardrobe[1],
      id: "watch-1",
      title: "方形腕表",
      subtype: "手表",
    },
  ];
  const plan = buildOutfitPlan(null, watch, new Date("2026-08-24T08:00:00Z"));
  const accessory = plan.days[0].pieces.find((item) => item.kind === "accessory");

  assert.equal(accessory?.accessoryStyle, "watch");
  assert.equal(accessory?.wardrobeItemId, "watch-1");
});

test("without a trip the plan becomes a one-day commute suggestion", () => {
  const plan = buildOutfitPlan(null, [], new Date("2026-08-24T12:00:00Z"));
  assert.equal(plan.startDate, "2026-08-24");
  assert.equal(plan.endDate, "2026-08-24");
  assert.equal(plan.scenario, "commute");
  assert.equal(plan.days.length, 1);
  assert.equal(plan.days[0].pieces.length, 4);
  assert.equal(plan.days[0].pieces[2].accessoryStyle, "bag");
  assert.equal(plan.days[0].pieces[0].garmentStyle, "tee");
  assert.equal(plan.usesWardrobe, false);
});
