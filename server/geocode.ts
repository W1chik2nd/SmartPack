// 地点搜索 —— OpenStreetMap Nominatim(开源、免密钥)。
//
// 放在服务端(AGENTS.md §3):未来 iOS 端同样调我们的 /api/places,不各自去接
// 第三方 SDK。前端只发一个关键词,拿回一组候选地点。
//
// Nominatim 使用条款要求:
//   1. 带能识别应用身份的 User-Agent —— 否则会被封;
//   2. 每秒最多 1 次请求。
// 第 2 条由 throttle() 保证,它是外部服务的硬性约束,不是防御性代码。
// 生产环境的正确做法是自建 Nominatim 或换付费额度,见 README 部署说明。

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const UA = "SmartPack/0.1 (https://github.com/W1chik2nd/SmartPack)";

/** 一个候选地点。lat/lon 供地图定位,name/detail 供列表展示。 */
export type Place = {
  /** 稳定标识,来自 OSM 的 type:id,用于前端列表 key。 */
  id: string;
  /** 主名称,如“京都市”。 */
  name: string;
  /** 补充信息,如“日本 京都府”。可能为空。 */
  detail: string;
  lat: number;
  lon: number;
};

/** Nominatim 返回的单条结果里我们用到的字段。 */
type RawPlace = {
  osm_type?: unknown;
  osm_id?: unknown;
  place_id?: unknown;
  name?: unknown;
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
};

/**
 * 把 Nominatim 的原始响应转成我们的 Place[]。
 *
 * 第三方响应属于不可信外部数据(AGENTS.md §11):坐标解析不出数字、或缺少名称的
 * 条目直接丢掉,而不是抛错——一条脏数据不该让整次搜索失败。
 * 导出是为了能脱离网络单测。
 */
export function normalizePlaces(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return [];
  const places: Place[] = [];
  for (const entry of raw as RawPlace[]) {
    if (!entry || typeof entry !== "object") continue;
    const lat = Number(entry.lat);
    const lon = Number(entry.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const display =
      typeof entry.display_name === "string" ? entry.display_name : "";
    const named = typeof entry.name === "string" && entry.name.length > 0;
    // Nominatim 有时不给 name,只给 display_name。退化成取 display_name 的首段。
    const name = named ? (entry.name as string) : display.split(",")[0]?.trim();
    if (!name) continue;

    // display_name 的首段就是 name,去掉它剩下的才是"补充信息"。
    const detail = display.startsWith(name)
      ? display.slice(name.length).replace(/^,\s*/, "")
      : display;

    const osmType = typeof entry.osm_type === "string" ? entry.osm_type : "osm";
    const osmId =
      entry.osm_id === undefined || entry.osm_id === null
        ? String(entry.place_id ?? `${lat},${lon}`)
        : String(entry.osm_id);

    places.push({ id: `${osmType}:${osmId}`, name, detail, lat, lon });
  }
  return places;
}

// Nominatim 限速 1 req/s。串行排队,保证两次外发请求之间至少隔 1 秒。
let lastCall = 0;
let queue: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  queue = queue.then(async () => {
    const wait = 1000 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  });
  return queue;
}

/**
 * 按关键词搜地点。`lang` 决定返回名称的语言(zh 会优先给中文名)。
 * 调用方负责保证 query 非空(路由层已在信任边界校验过)。
 */
export async function searchPlaces(
  query: string,
  lang: "en" | "zh" = "en"
): Promise<Place[]> {
  await throttle();

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&limit=8&accept-language=${lang === "zh" ? "zh-CN" : "en"}`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`Place search failed (${res.status})`);
  }
  return normalizePlaces(await res.json());
}
