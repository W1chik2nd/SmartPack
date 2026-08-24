// 行程计划路由:鉴权门槛 + 信任边界校验 + 存取往返。
// 走真实 handler 和临时 SQLite 库,和 app.test.ts 同一套做法。
//
// 不测 /api/places 的成功路径:那会真的打 Nominatim。只测它的校验分支,
// 外部服务的响应解析由 trip-plan.test.ts 里的 normalizePlaces 覆盖。
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
let dir: string;
let token: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "smartpack-triproutes-"));
  app = createApp(join(dir, "test.db"));
  server = createServer(app.handle);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://localhost:${addr.port}`;

  const res = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "trip@example.com",
      password: "correct-horse",
      name: "Trip",
      age: 30,
      heightCm: 170,
      weightKg: 60,
      style: "Casual",
    }),
  });
  token = (await res.json()).token;
});

after(() => {
  server.close();
  app.close();
  rmSync(dir, { recursive: true, force: true });
});

function req(path: string, init: RequestInit = {}, withAuth = true) {
  return fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  });
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

function save(body: unknown, withAuth = true) {
  return req("/api/trip-plans", { method: "POST", body: JSON.stringify(body) }, withAuth);
}

test("三个接口都要登录态", async () => {
  // /api/places 也要:它代我们向第三方发请求,开放给匿名等于做公开代理。
  for (const res of [
    await req("/api/places?q=kyoto", {}, false),
    await req("/api/trip-plans", {}, false),
    await save(KYOTO, false),
  ]) {
    assert.equal(res.status, 401);
  }
});

test("保存后能取回,字段原样往返", async () => {
  const res = await save(KYOTO);
  assert.equal(res.status, 201);
  const { plan } = await res.json();
  assert.ok(plan.id);
  assert.equal(plan.placeName, "京都市");
  assert.equal(plan.lat, 35.0116);
  assert.equal(plan.startDate, "2026-04-01");

  const list = await (await req("/api/trip-plans")).json();
  assert.ok(
    list.plans.some((p: { id: string }) => p.id === plan.id),
    "列表里应当有刚保存的行程"
  );
});

test("场景 id 必须是后端认识的那几个", async () => {
  // 前端只发 id,不认识的 id 说明前后端对不上,不能默默存下去。
  const res = await save({ ...KYOTO, scenario: "nonexistent" });
  assert.equal(res.status, 400);
});

test("目的地名称不能为空", async () => {
  for (const placeName of ["", "   ", undefined]) {
    const res = await save({ ...KYOTO, placeName });
    assert.equal(res.status, 400, `placeName=${JSON.stringify(placeName)}`);
  }
});

test("坐标越界或不是数字都拒掉", async () => {
  for (const bad of [
    { lat: 91, lon: 0 },
    { lat: -91, lon: 0 },
    { lat: 0, lon: 181 },
    { lat: 0, lon: -181 },
    { lat: "abc", lon: 0 },
    // 下面这些经 Number() 强转都会变成 0 —— 也就是大西洋上一个真实存在的坐标。
    // 必须按"没传坐标"拒掉,不能静默存成 0°。
    { lat: null, lon: 0 },
    { lat: undefined, lon: 0 },
    { lat: "", lon: 0 },
    { lat: false, lon: 0 },
    { lat: [], lon: 0 },
    { lat: 0, lon: null },
    { lat: "35.0116", lon: 135.7681 }, // 数字字符串也不收,类型要对
  ]) {
    const res = await save({ ...KYOTO, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test("日期必须是真实存在的 ISO 日期", async () => {
  for (const bad of [
    { startDate: "2026-02-31", endDate: "2026-03-02" }, // 格式对但不存在
    { startDate: "2026-4-1", endDate: "2026-04-05" }, // 没零填充
    { startDate: "04/01/2026", endDate: "2026-04-05" },
    { startDate: "2026-04-01", endDate: "" },
  ]) {
    const res = await save({ ...KYOTO, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test("结束日期不能早于开始日期", async () => {
  const res = await save({
    ...KYOTO,
    startDate: "2026-04-05",
    endDate: "2026-04-01",
  });
  assert.equal(res.status, 400);
});

test("当天往返(起止同日)是合法的", async () => {
  const res = await save({
    ...KYOTO,
    startDate: "2026-04-01",
    endDate: "2026-04-01",
  });
  assert.equal(res.status, 201);
});

test("正好 30 天(含首尾)可以保存", async () => {
  // 4/1 → 4/30 = 30 天,是允许的上限。
  const res = await save({
    ...KYOTO,
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });
  assert.equal(res.status, 201);
});

test("超过 30 天的行程被拒", async () => {
  // 4/1 → 5/1 = 31 天,超上限。
  const res = await save({
    ...KYOTO,
    startDate: "2026-04-01",
    endDate: "2026-05-01",
  });
  assert.equal(res.status, 400);
});

test("/api/places 的 q 参数校验", async () => {
  assert.equal((await req("/api/places")).status, 400, "缺 q");
  assert.equal((await req("/api/places?q=")).status, 400, "q 为空");
  assert.equal((await req("/api/places?q=%20%20")).status, 400, "q 全是空格");
  // 200 字以上只会白占第三方额度,提前挡掉,不外发请求。
  const long = "a".repeat(201);
  assert.equal((await req(`/api/places?q=${long}`)).status, 400, "q 过长");
});

test("行程只能看到自己的", async () => {
  const res = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "other@example.com",
      password: "correct-horse",
      name: "Other",
      age: 30,
      heightCm: 170,
      weightKg: 60,
      style: "Casual",
    }),
  });
  const otherToken = (await res.json()).token;

  const mine = await (await req("/api/trip-plans")).json();
  assert.ok(mine.plans.length > 0, "本人应当有行程");

  const theirs = await (
    await fetch(`${base}/api/trip-plans`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    })
  ).json();
  assert.equal(theirs.plans.length, 0, "新用户不该看到别人的行程");
});
