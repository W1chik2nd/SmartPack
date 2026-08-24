// 行程规划路由:行程列表 / 单个行程 / 景点配图。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
import { type IncomingMessage, type ServerResponse } from "node:http";
import type { ItineraryStore } from "./itinerary.ts";
import { findPhotoForSubject, photoProvider } from "./photos.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  itinerary: ItineraryStore;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  /** 从 Authorization 头解析用户;未登录返回 null。 */
  userFromHeader: () => { id: string } | null;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleItineraryRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, itinerary, json, userFromHeader } = ctx;
  const method = req.method;
  const path = url.pathname;

  // 行程列表:只读 AI 已生成的数据;没有时返回空数组,不伪造演示行程。
  if (method === "GET" && path === "/api/itinerary/trips") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const scenario = url.searchParams.get("scenario");
    const trips = itinerary
      .list(user.id)
      .filter((trip) => !scenario || trip.scenario === scenario);
    json(res, 200, { trips, photoProvider: photoProvider() });
    return true;
  }

  // 单个行程(左侧总行程图 + 右侧每天行程都从这一份数据渲染)。
  if (method === "GET" && path.startsWith("/api/itinerary/trips/")) {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    const trip = itinerary.get(user.id, id);
    if (!trip) {
      json(res, 404, { error: "行程不存在。" });
      return true;
    }
    json(res, 200, { trip, photoProvider: photoProvider() });
    return true;
  }

  // 景点配图:第一次按关键词去图库查,查到就写回库里,之后直接命中缓存。
  // 单独一个端点(而不是在行程接口里一次性查完)是为了让行程页秒开:
  // 卡片挂载后各自补图,图库慢或限流都不拖累整页。
  if (method === "GET" && path.startsWith("/api/itinerary/photo/")) {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const stopId = decodeURIComponent(path.split("/").pop() ?? "");
    const stop = itinerary.stop(user.id, stopId);
    if (!stop) {
      json(res, 404, { error: "停靠点不存在。" });
      return true;
    }
    // 已经查过就直接给,省一次外部请求。
    if (stop.photoUrl) {
      json(res, 200, {
        photo: {
          imageUrl: stop.photoUrl,
          credit: stop.photoCredit ?? "",
          sourceUrl: stop.photoSourceUrl ?? "",
        },
        cached: true,
      });
      return true;
    }
    // 关键词不需要人工逐个填:photoQueries() 从名称/城市/类型推导候选词,
    // 逐个试到出图为止。photoQuery 只是可选的人工覆盖。
    try {
      const found = await findPhotoForSubject({
        name: stop.name,
        nameEn: stop.nameEn,
        city: stop.city,
        cityEn: stop.cityEn,
        kind: stop.kind,
        photoQuery: stop.photoQuery,
      });
      if (!found) {
        json(res, 200, { photo: null });
        return true;
      }
      const { photo, query } = found;
      itinerary.setStopPhoto(user.id, stopId, {
        photoUrl: photo.imageUrl,
        photoCredit: photo.credit,
        photoSourceUrl: photo.sourceUrl,
      });
      json(res, 200, {
        photo: {
          imageUrl: photo.imageUrl,
          credit: photo.credit,
          sourceUrl: photo.sourceUrl,
        },
        cached: false,
        // 命中靠的是哪个候选词,便于日后调关键词策略时排查。
        query,
      });
    } catch (err: any) {
      // 图库整体故障:配图缺失不是错误状态,卡片显示占位块即可。
      json(res, 200, { photo: null, error: err?.message ?? "photo lookup failed" });
    }
    return true;
  }

  return false;
}
