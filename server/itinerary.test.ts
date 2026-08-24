// 行程规划持久化测试 —— 用临时 SQLite 库跑真实的 store。
// 图库调用需要外部网络/真实 key,不在单测范围;这里只测我们自己的逻辑:
// 建表、装配(天/停靠点排序)、归属校验、配图写回。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createItineraryStore, type ItineraryStore } from "./itinerary.ts";
import { photoProvider, photoQueries } from "./photos.ts";

let db: DatabaseSync;
let store: ItineraryStore;
let dir: string;

const ANNA = "user-anna";
const BEN = "user-ben";

before(() => {
  dir = mkdtempSync(join(tmpdir(), "wearroute-itin-"));
  db = new DatabaseSync(join(dir, "test.db"));
  // trips.user_id 外键指向 users,建一张最小的 users 表满足引用。
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);
    INSERT INTO users (id, email, name) VALUES
      ('${ANNA}', 'anna@example.com', 'Anna'),
      ('${BEN}', 'ben@example.com', 'Ben');
  `);
  store = createItineraryStore(db);
});

after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("seedDemoTrip builds a trip with days and stops in order", () => {
  const trip = store.seedDemoTrip(ANNA, "travel");
  assert.equal(trip.scenario, "travel");
  assert.ok(trip.departLabel.length > 0, "left panel needs a depart label");
  assert.ok(trip.days.length >= 3, "demo trip should cover several days");

  // 天按 day_number 升序,停靠点按 position 升序 —— 两栏渲染都依赖这个顺序。
  const numbers = trip.days.map((d) => d.dayNumber);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  for (const day of trip.days) {
    assert.ok(day.stops.length > 0, `day ${day.dayNumber} needs stops`);
    const positions = day.stops.map((s) => s.position);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    // 每个停靠点都要有配图关键词,否则右侧卡片永远是占位块。
    for (const stop of day.stops) {
      assert.ok(stop.photoQuery.length > 0, `${stop.name} needs a photoQuery`);
      assert.ok(stop.nameEn.length > 0, `${stop.name} needs an English name`);
      assert.equal(stop.photoUrl, null, "photos resolve lazily, not at seed time");
    }
  }
});

test("list and get only return the owner's trips", () => {
  const anna = store.seedDemoTrip(ANNA, "business");
  assert.ok(store.list(ANNA).some((t) => t.id === anna.id));

  // 别人的行程既不出现在列表里,也不能按 id 直接取。
  assert.equal(store.list(BEN).length, 0);
  assert.equal(store.get(BEN, anna.id), null);
  assert.ok(store.get(ANNA, anna.id));
});

test("get returns null for an unknown trip id", () => {
  assert.equal(store.get(ANNA, "no-such-trip"), null);
});

test("stop() resolves a stop for its owner and refuses everyone else", () => {
  const trip = store.seedDemoTrip(ANNA, "travel");
  const first = trip.days[0].stops[0];

  const mine = store.stop(ANNA, first.id);
  assert.ok(mine);
  assert.equal(mine.name, first.name);

  // 拿到别人的 stop id 也读不出内容 —— 配图端点靠这一层挡住越权。
  assert.equal(store.stop(BEN, first.id), null);
  assert.equal(store.stop(ANNA, "no-such-stop"), null);
});

test("setStopPhoto caches the lookup and never crosses users", () => {
  const trip = store.seedDemoTrip(ANNA, "travel");
  const stop = trip.days[0].stops[0];
  const photo = {
    photoUrl: "https://images.example.com/panda.jpg",
    photoCredit: "Photo by Someone on Unsplash",
    photoSourceUrl: "https://unsplash.com/photos/abc",
  };

  store.setStopPhoto(ANNA, stop.id, photo);
  const cached = store.stop(ANNA, stop.id);
  assert.equal(cached?.photoUrl, photo.photoUrl);
  assert.equal(cached?.photoCredit, photo.photoCredit);
  assert.equal(cached?.photoSourceUrl, photo.photoSourceUrl);

  // 装配后的行程也带上缓存,页面第二次打开就不用再查图库。
  const reloaded = store.get(ANNA, trip.id);
  const reloadedStop = reloaded?.days[0].stops.find((s) => s.id === stop.id);
  assert.equal(reloadedStop?.photoUrl, photo.photoUrl);

  // 换个用户写同一个 stop:必须无效,原值不动。
  store.setStopPhoto(BEN, stop.id, {
    photoUrl: "https://evil.example.com/x.jpg",
    photoCredit: "nope",
    photoSourceUrl: "nope",
  });
  assert.equal(store.stop(ANNA, stop.id)?.photoUrl, photo.photoUrl);
});

test("photoProvider falls back to keyless Openverse and honours explicit choice", () => {
  const saved = { ...process.env };
  try {
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
    delete process.env.PHOTO_PROVIDER;
    // 没有任何 key 也要能出图:兜底是免 key 的 Openverse。
    assert.equal(photoProvider(), "openverse");

    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    assert.equal(photoProvider(), "unsplash");

    process.env.PEXELS_API_KEY = "test-key";
    process.env.PHOTO_PROVIDER = "pexels";
    assert.equal(photoProvider(), "pexels");

    // 指定了没配 key 的供应商时不能哑掉,继续走兜底。
    process.env.PHOTO_PROVIDER = "unsplash";
    delete process.env.UNSPLASH_ACCESS_KEY;
    assert.equal(photoProvider(), "pexels");
  } finally {
    process.env = saved;
  }
});

test("photoQueries derives candidates so new stops need no hand-written keyword", () => {
  // 换城市的新景点:没人填 photoQuery,也必须给出可用候选词。
  const spot = photoQueries({
    name: "兵马俑",
    nameEn: "Terracotta Army",
    city: "西安",
    cityEn: "Xian",
    kind: "spot",
  });
  // 中文名 + 城市实测命中率最高(图库原始标题多为中文),所以排最前。
  assert.equal(spot[0], "兵马俑 西安");
  assert.ok(spot.includes("Terracotta Army Xian"));
  // 兜底一定存在:前面全落空也不该让卡片空着。
  assert.ok(spot.some((q) => q.includes("landmark")));

  // 人工指定的关键词优先于所有推导结果。
  const overridden = photoQueries({
    name: "兵马俑",
    nameEn: "Terracotta Army",
    city: "西安",
    cityEn: "Xian",
    kind: "spot",
    photoQuery: "Terracotta Army museum pit one",
  });
  assert.equal(overridden[0], "Terracotta Army museum pit one");

  // 餐饮/住宿:图库没有"某家店",兜底必须换成同类氛围图。
  const meal = photoQueries({
    name: "龙抄手",
    nameEn: "Long Chaoshou",
    city: "成都",
    cityEn: "Chengdu",
    kind: "meal",
  });
  assert.ok(meal.some((q) => q.includes("restaurant")));
  const hotel = photoQueries({
    name: "太古里附近酒店",
    nameEn: "Hotel near Taikoo Li",
    city: "成都",
    cityEn: "Chengdu",
    kind: "hotel",
  });
  assert.ok(hotel.some((q) => q.includes("hotel")));
});

test("photoQueries caps requests per stop but always keeps the generic fallback", () => {
  // 候选词是串行打图库的,不设上限时一张卡片最坏 7 次请求,免 key 的
  // Openverse 额度很快被打满。上限必须生效,但兜底词不能被截断掉 ——
  // 餐饮/住宿完全依赖它出图。
  const kinds = ["spot", "transit", "meal", "hotel"] as const;
  for (const kind of kinds) {
    const queries = photoQueries({
      name: "某个很长的中文停靠点名字",
      nameEn: "Some Very Long English Stop Name",
      city: "西安",
      cityEn: "Xian",
      kind,
    });
    assert.ok(queries.length <= 4, `${kind}: ${queries.length} candidates exceeds the cap`);
    assert.ok(
      queries.some((q) => /landmark|restaurant|hotel|railway/.test(q)),
      `${kind}: generic fallback was truncated away`
    );
  }
});

test("photoQueries deduplicates and tolerates missing fields", () => {
  // photoQuery 与推导结果重复时不该产生重复请求。
  const queries = photoQueries({
    name: "锦里",
    nameEn: "Jinli",
    city: "成都",
    cityEn: "Chengdu",
    kind: "spot",
    photoQuery: "锦里 成都",
  });
  assert.equal(new Set(queries).size, queries.length, "no duplicate candidates");

  // 缺城市/缺英文名(AI 生成的行程完全可能这样)也要给出候选,不能返回空数组。
  const sparse = photoQueries({
    name: "某个景点",
    nameEn: "",
    city: "",
    cityEn: "",
    kind: "spot",
  });
  assert.ok(sparse.length > 0);
  assert.ok(sparse.every((q) => q.trim().length > 0));
});
