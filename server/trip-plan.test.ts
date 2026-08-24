// 行程计划:存储层 + 路由校验 + Nominatim 响应归一化。
// 不碰网络:normalizePlaces 单独测,搜索路由只测校验分支(不配置也不外发)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createTripPlanStore } from "./trip-plan.ts";
import {
  estimateTripGeneration,
  isIsoDate,
  tripDayCount,
  MAX_TRIP_DAYS,
} from "./trip-plan-routes.ts";
import { normalizePlaces } from "./geocode.ts";

/** 一个带 users 表的临时库 —— trip_plans.user_id 有外键指过去。 */
function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), "wearroute-trip-"));
  const db = new DatabaseSync(join(dir, "test.db"));
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);
    INSERT INTO users (id, email, name) VALUES ('u1', 'a@b.c', 'A');
    INSERT INTO users (id, email, name) VALUES ('u2', 'd@e.f', 'D');
  `);
  return db;
}

const KYOTO = {
  scenario: "travel",
  placeName: "京都市",
  placeDetail: "日本 京都府",
  lat: 35.0116,
  lon: 135.7681,
  startDate: "2026-04-01",
  endDate: "2026-04-05",
};

test("save 存下行程并回填 id 和 createdAt", () => {
  const store = createTripPlanStore(freshDb());
  const saved = store.save("u1", KYOTO);

  assert.ok(saved.id, "应当生成 id");
  assert.ok(saved.createdAt, "createdAt 应当来自数据库");
  assert.equal(saved.placeName, "京都市");
  assert.equal(saved.startDate, "2026-04-01");
  assert.equal(saved.endDate, "2026-04-05");
  assert.equal(saved.generationStatus, "pending");
  // 坐标要原样存取,不能被取整或转成字符串。
  assert.equal(saved.lat, 35.0116);
  assert.equal(saved.lon, 135.7681);
});

test("重启时把中断的后台任务标成失败", () => {
  const db = freshDb();
  const store = createTripPlanStore(db);
  const saved = store.save("u1", KYOTO);
  store.markGenerating("u1", saved.id);
  assert.equal(store.list("u1")[0].generationStatus, "processing");

  const reopened = createTripPlanStore(db);
  const interrupted = reopened.list("u1")[0];
  assert.equal(interrupted.generationStatus, "failed");
  assert.match(interrupted.generationError ?? "", /interrupted/);
});

test("list 只返回本人的行程,且最新在前", () => {
  const store = createTripPlanStore(freshDb());
  store.save("u1", { ...KYOTO, placeName: "第一个" });
  store.save("u1", { ...KYOTO, placeName: "第二个" });
  store.save("u2", { ...KYOTO, placeName: "别人的" });

  const mine = store.list("u1");
  assert.equal(mine.length, 2);
  // 同一秒内插入,靠 rowid 兜底排序,后存的在前。
  assert.equal(mine[0].placeName, "第二个");
  assert.equal(mine[1].placeName, "第一个");
  assert.ok(
    !mine.some((p) => p.placeName === "别人的"),
    "不能看到别人的行程"
  );
});

test("单日行程:起止同一天是合法的", () => {
  const store = createTripPlanStore(freshDb());
  const saved = store.save("u1", {
    ...KYOTO,
    startDate: "2026-04-01",
    endDate: "2026-04-01",
  });
  assert.equal(saved.startDate, saved.endDate);
});

test("isIsoDate 挡掉格式对但不存在的日期", () => {
  assert.ok(isIsoDate("2026-04-01"));
  assert.ok(isIsoDate("2024-02-29"), "闰年 2 月 29 是真日期");

  assert.ok(!isIsoDate("2026-02-31"), "2 月没有 31 号");
  assert.ok(!isIsoDate("2025-02-29"), "非闰年没有 2 月 29");
  assert.ok(!isIsoDate("2026-13-01"), "没有 13 月");
  assert.ok(!isIsoDate("2026-4-1"), "必须零填充");
  assert.ok(!isIsoDate("04/01/2026"));
  assert.ok(!isIsoDate(""));
  assert.ok(!isIsoDate(undefined));
  assert.ok(!isIsoDate(20260401));
});

test("tripDayCount 含首尾计天数,30 天上限的边界", () => {
  assert.equal(tripDayCount("2026-04-01", "2026-04-01"), 1, "同日 = 1 天");
  assert.equal(tripDayCount("2026-04-01", "2026-04-02"), 2);
  assert.equal(tripDayCount("2026-04-01", "2026-04-30"), 30, "正好上限");
  assert.equal(tripDayCount("2026-04-01", "2026-05-01"), 31, "超上限一天");
  // 跨月边界也要对(4 月 30 天)。
  assert.equal(tripDayCount("2026-04-15", "2026-05-14"), 30);
  assert.equal(MAX_TRIP_DAYS, 30);
});

test("生成预计时间随行程复杂度分档", () => {
  assert.deepEqual(estimateTripGeneration(1), {
    minSeconds: 180,
    maxSeconds: 480,
  });
  assert.deepEqual(estimateTripGeneration(7), {
    minSeconds: 300,
    maxSeconds: 720,
  });
  assert.deepEqual(estimateTripGeneration(30), {
    minSeconds: 720,
    maxSeconds: 1_800,
  });
});

test("normalizePlaces 提取名称、补充信息和坐标", () => {
  const places = normalizePlaces([
    {
      osm_type: "relation",
      osm_id: 123,
      name: "京都市",
      display_name: "京都市, 京都府, 日本",
      lat: "35.0116",
      lon: "135.7681",
    },
  ]);

  assert.equal(places.length, 1);
  assert.equal(places[0].id, "relation:123");
  assert.equal(places[0].name, "京都市");
  // display_name 去掉首段(就是 name)后剩下的才是补充信息。
  assert.equal(places[0].detail, "京都府, 日本");
  assert.equal(places[0].lat, 35.0116);
  assert.equal(places[0].lon, 135.7681);
});

test("normalizePlaces 丢掉坐标坏掉或没名字的条目,不整体失败", () => {
  const places = normalizePlaces([
    { name: "好的", display_name: "好的, X", lat: "1", lon: "2" },
    { name: "坐标不是数字", display_name: "x", lat: "abc", lon: "2" },
    { name: "纬度越界", display_name: "x", lat: "91", lon: "2" },
    { name: "经度越界", display_name: "x", lat: "1", lon: "181" },
    { display_name: "", lat: "1", lon: "2" },
    null,
    "不是对象",
  ]);

  assert.equal(places.length, 1);
  assert.equal(places[0].name, "好的");
});

test("normalizePlaces 缺 name 时退化取 display_name 首段", () => {
  const places = normalizePlaces([
    { display_name: "Leeds, West Yorkshire, England", lat: "53.8", lon: "-1.55" },
  ]);

  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Leeds");
  assert.equal(places[0].detail, "West Yorkshire, England");
});

test("normalizePlaces 面对非数组输入返回空数组", () => {
  // 第三方响应属于不可信外部数据:格式不对就当没结果,不抛错。
  assert.deepEqual(normalizePlaces(null), []);
  assert.deepEqual(normalizePlaces({ error: "rate limited" }), []);
  assert.deepEqual(normalizePlaces("nope"), []);
});
