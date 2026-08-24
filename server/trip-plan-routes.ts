// 行程计划相关路由:地点搜索、保存行程、行程列表。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
//
// 这一层是信任边界(AGENTS.md §4):外部输入在这里校验一次,
// 之后 trip-plan.ts / geocode.ts 都信任调用方,不重复校验。
import { type IncomingMessage, type ServerResponse } from "node:http";
import { searchPlaces } from "./geocode.ts";
import type { TripPlanStore } from "./trip-plan.ts";
import {
  estimateTripGeneration,
  parseTripInput,
  tripDayCount,
} from "./trip-input.ts";
export {
  estimateTripGeneration,
  isIsoDate,
  tripDayCount,
  MAX_TRIP_DAYS,
} from "./trip-input.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  tripPlans: TripPlanStore;
  /** 合法场景 id 集合,由 app.ts 从 SCENARIOS 传入。 */
  scenarioIds: ReadonlySet<string>;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  userFromHeader: () => { id: string } | null;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleTripPlanRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, tripPlans, scenarioIds, json, readBody } = ctx;
  const method = req.method;
  const path = url.pathname;

  const itemMatch = path.match(/^\/api\/trip-plans\/([^/]+)$/);
  if (method === "GET" && itemMatch) {
    const user = ctx.userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const plan = tripPlans.get(user.id, itemMatch[1]);
    if (!plan) {
      json(res, 404, { error: "Trip not found." });
      return true;
    }
    json(res, 200, {
      plan,
      estimate: estimateTripGeneration(
        tripDayCount(plan.startDate, plan.endDate)
      ),
    });
    return true;
  }

  if (method === "DELETE" && itemMatch) {
    const user = ctx.userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    if (!tripPlans.remove(user.id, itemMatch[1])) {
      json(res, 404, { error: "Trip not found." });
      return true;
    }
    json(res, 200, { ok: true });
    return true;
  }

  // 地点搜索(线框图里地图下方那个搜索框)。
  // 要登录态:这个接口会代我们向 Nominatim 发请求,开放给匿名用户等于把它变成
  // 公开代理,既会拖累第三方额度,也让我们的 User-Agent 承担滥用后果。
  if (method === "GET" && path === "/api/places") {
    const user = ctx.userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const query = (url.searchParams.get("q") ?? "").trim();
    if (!query) {
      json(res, 400, { error: "q is required." });
      return true;
    }
    // 200 字够任何地名了;更长的只会白占第三方额度。
    if (query.length > 200) {
      json(res, 400, { error: "q is too long." });
      return true;
    }
    const lang = url.searchParams.get("lang") === "zh" ? "zh" : "en";
    try {
      json(res, 200, { places: await searchPlaces(query, lang) });
    } catch (err: any) {
      // 第三方挂了不是我们的 bug,用 502 说清是上游问题。
      json(res, 502, { error: `地点搜索失败:${err?.message ?? "unknown"}` });
    }
    return true;
  }

  // 保存行程:场景 + 目的地 + 日期区间。
  if (method === "POST" && path === "/api/trip-plans") {
    const user = ctx.userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const body = await readBody(req);

    const parsed = parseTripInput(body, scenarioIds);
    if (!parsed.ok) {
      json(res, 400, { error: parsed.error });
      return true;
    }
    json(res, 201, { plan: tripPlans.save(user.id, parsed.plan) });
    return true;
  }

  // 行程列表(仪表盘「最近日程」和行程页回显都会用到)。
  if (method === "GET" && path === "/api/trip-plans") {
    const user = ctx.userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    json(res, 200, { plans: tripPlans.list(user.id) });
    return true;
  }

  return false;
}
