// 参考数据路由:场景目录(/api/scenarios)+ 实时天气(/api/weather)。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
//
// 两条都是只读查询,没有自己的表:场景目录是服务端常量,天气来自 Open-Meteo。
import { type IncomingMessage, type ServerResponse } from "node:http";
import { currentWeather, DEFAULT_COORDS } from "./weather.ts";

// 场景目录(AGENTS.md §3):打包场景的集合放服务端,不放客户端。
// web 和将来的 iOS 端都只渲染这里返回的内容,所以这份列表 —— 以及之后按
// 每个 id 挂上去的打包规则 —— 只有一处。`image` 指向前端托管的静态图,
// 缺图会退化成卡片占位块,新增场景不需要改任何代码。
const SCENARIOS = [
  { id: "commute", label: "通勤", image: "/scenarios/commute.jpg" },
  { id: "travel", label: "旅行", image: "/scenarios/travel.jpg" },
  { id: "business", label: "出差", image: "/scenarios/business.jpg" },
  { id: "date", label: "约会", image: "/scenarios/date.jpg" },
  { id: "sport", label: "运动", image: "/scenarios/sport.jpg" },
  { id: "formal", label: "正式场合", image: "/scenarios/formal.jpg" },
] as const;

// 合法场景 id 集合。行程保存(trip-plan-routes)要据此校验前端传来的 scenario,
// 所以从这里导出,让场景目录仍然只有一处定义(AGENTS.md §3)。
export const SCENARIO_IDS: ReadonlySet<string> = new Set(
  SCENARIOS.map((s) => s.id)
);

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  /** 从 Authorization 头解析用户;未登录返回 null。 */
  userFromHeader: () => { id: string } | null;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleCatalogRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, json, userFromHeader } = ctx;

  // 仪表盘的实时天气。坐标是可选查询参数;没给就回落到默认城市,
  // 而不是让这张卡直接失败。
  if (req.method === "GET" && url.pathname === "/api/weather") {
    const lat = Number(url.searchParams.get("lat") ?? DEFAULT_COORDS.lat);
    const lon = Number(url.searchParams.get("lon") ?? DEFAULT_COORDS.lon);
    // 信任边界:查询参数是外部输入,这里校验范围。
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      json(res, 400, { error: "Invalid coordinates." });
      return true;
    }
    json(res, 200, await currentWeather(lat, lon));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/scenarios") {
    // 仅登录可见:场景选择是登录后的第一屏。目录本身不是秘密,但一起挡在
    // 同一道检查后面,免得留一个以后还要收紧的匿名入口。
    if (!userFromHeader()) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    json(res, 200, { scenarios: SCENARIOS });
    return true;
  }

  return false;
}
