// SmartPack auth API.
//
// Architecture note (AGENTS.md §3): all auth logic lives here on the server.
// Clients (web now, SwiftUI later) only call these endpoints and render the
// result — no business rules or validation logic beyond pure UI concerns.
//
// createApp() is separated from the listening entry point (index.ts) so tests
// can run the exact same handler against a throwaway database.
import { type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { handleUploadRoutes } from "./upload-routes.ts";
import { createWardrobeStore } from "./wardrobe.ts";
import { handleWardrobeRoutes } from "./wardrobe-routes.ts";
import { createTripPlanStore } from "./trip-plan.ts";
import { handleTripPlanRoutes } from "./trip-plan-routes.ts";
import { handleOutfitRoutes } from "./outfit-routes.ts";
import { createItineraryStore } from "./itinerary.ts";
import { handleItineraryRoutes } from "./itinerary-routes.ts";
import { createPackingPlanStore } from "./packing-store.ts";
import { handleTripGenerationRoutes } from "./trip-generation-routes.ts";
import { generateTrip, type GenerateTrip } from "./trip-agent.ts";
import { handleAssistantRoutes } from "./assistant-routes.ts";
import { assistantDataContext } from "./assistant-context.ts";
import { handleCatalogRoutes, SCENARIO_IDS } from "./catalog-routes.ts";
import { dirname, join } from "node:path";
import { buildGeneratedPackingPlan, buildPackingPlan } from "./packing.ts";
import { createAccountService, publicUser } from "./account-routes.ts";

export type App = {
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  close: () => void;
};

export function createApp(
  dbPath: string,
  dependencies: { generateTrip?: GenerateTrip } = {}
): App {
  const db = new DatabaseSync(dbPath);
  const accounts = createAccountService(db);

  // 照片存数据库同级的 photos/ 目录:测试用临时库时会自动隔离到临时目录。
  const wardrobe = createWardrobeStore(db, join(dirname(dbPath), "photos"));
  // 行程计划(目的地 + 日期区间)自带建表,见 trip-plan.ts。
  const tripPlans = createTripPlanStore(db);
  // 合法场景 id 来自 catalog-routes,保存行程时据此校验(场景目录只有一处)。
  const scenarioIds = SCENARIO_IDS;
  // 行程规划:trips / trip_days / trip_stops 三张表,建表在 store 里。
  const itinerary = createItineraryStore(db);
  const packingPlans = createPackingPlanStore(db);
  const runTripAgent = dependencies.generateTrip ?? generateTrip;

  function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    });
    res.end(JSON.stringify(body));
  }

  // Trust boundary (AGENTS.md §4): request bodies are external input, so this
  // is the one place we validate shape and size. Internal helpers below trust
  // their callers. maxBytes is per-route: image upload needs a higher cap.
  function readBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<any> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > maxBytes) reject(new Error("body too large"));
      });
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          reject(new Error("invalid JSON"));
        }
      });
      req.on("error", reject);
    });
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }

    if (await accounts.handle(req, res, url, json, readBody)) {
      return;
    }

    // 参考数据路由(场景目录 / 天气),见 catalog-routes.ts。
    if (
      await handleCatalogRoutes({
        req,
        res,
        url,
        json,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    // 助手路由(/api/chat),见 assistant-routes.ts。
    if (
      await handleAssistantRoutes({
        req,
        res,
        url,
        json,
        readBody,
        userFromHeader: () => accounts.userForRequest(req),
        actionContext: () => {
          const actor = accounts.userForRequest(req);
          if (!actor) return null;
          return {
            userId: actor.id,
            scenarioIds,
            wardrobe,
            tripPlans,
            promptContext: assistantDataContext(
              wardrobe.list(actor.id),
              tripPlans.list(actor.id)
            ),
            currentProfile: () =>
              publicUser(accounts.userForRequest(req) ?? actor),
            updateProfile: (values) => accounts.updateProfile(actor.id, values),
          };
        },
      })
    ) {
      return;
    }

    // 行程规划路由(行程列表/单个行程/景点配图),见 itinerary-routes.ts。
    if (
      await handleItineraryRoutes({
        req,
        res,
        url,
        itinerary,
        json,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    if (
      await handleTripGenerationRoutes({
        req,
        res,
        url,
        scenarioIds,
        tripPlans,
        itinerary,
        packingPlans,
        wardrobe,
        generateTrip: runTripAgent,
        json,
        readBody,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    // Packing plan. Session-gated because the plan is personal (and will draw
    // on the user's wardrobe + itinerary once those exist). `balance` is the
    // one query knob: 0 = pack lightest, 100 = most outfit variety (US 6.3).
    // Trust boundary (AGENTS.md §4): coerce and clamp here; buildPackingPlan
    // trusts its caller.
    if (req.method === "GET" && url.pathname === "/api/packing") {
      const user = accounts.userForRequest(req);
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const rawParam = url.searchParams.get("balance");
      const raw = rawParam === null ? NaN : Number(rawParam);
      const balance = Number.isFinite(raw) ? raw : 50;
      const tripPlanId = url.searchParams.get("tripPlanId");
      const generated = tripPlanId
        ? packingPlans.get(user.id, tripPlanId)
        : packingPlans.latest(
            user.id,
            url.searchParams.get("scenario") ?? undefined
          );
      if (tripPlanId && !generated) {
        json(res, 404, { error: "Packing plan not found for this trip." });
        return;
      }
      json(res, 200, {
        plan: generated
          ? buildGeneratedPackingPlan(
              generated.packing,
              balance,
              generated.tripDays
            )
          : buildPackingPlan(balance),
      });
      return;
    }

    // 穿搭方案由后端整合行程与衣橱，客户端只展示结果。
    if (
      await handleOutfitRoutes({
        req,
        res,
        url,
        wardrobe,
        tripPlans,
        json,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    // 衣柜路由(列表/编辑/删除/照片)拆到独立模块,见 wardrobe-routes.ts。
    if (
      await handleWardrobeRoutes({
        req,
        res,
        url,
        wardrobe,
        json,
        readBody,
        userFromHeader: () => accounts.userForRequest(req),
        userFromQuery: () =>
          accounts.userForToken(url.searchParams.get("token") ?? undefined),
      })
    ) {
      return;
    }

    // 行程计划路由(地点搜索/保存/列表)拆到独立模块,见 trip-plan-routes.ts。
    if (
      await handleTripPlanRoutes({
        req,
        res,
        url,
        tripPlans,
        scenarioIds,
        json,
        readBody,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    // 扫码上传路由(建会话/手机传图/电脑取图/关会话),见 upload-routes.ts。
    if (
      await handleUploadRoutes({
        req,
        res,
        url,
        json,
        readBody,
        userFromHeader: () => accounts.userForRequest(req),
      })
    ) {
      return;
    }

    json(res, 404, { error: "Not found." });
  }

  return {
    handle: (req, res) =>
      handle(req, res).catch((err) => {
        const message = err?.message ?? "Internal error.";
        // 请求体超限是用户能自己解决的问题(照片太大),之前被无差别转成 500,
        // 前端只看到看不懂的 "Request failed (500)"。给它专门的状态码和提示。
        if (message === "body too large") {
          json(res, 413, {
            error: "照片太大,请重新拍一张(或换张分辨率低一些的图片)。",
          });
          return;
        }
        if (message === "invalid JSON") {
          json(res, 400, { error: "请求格式错误。" });
          return;
        }
        json(res, 500, { error: message });
      }),
    close: () => db.close(),
  };
}
