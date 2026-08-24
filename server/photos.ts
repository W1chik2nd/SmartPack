// 景点配图适配器 —— 按关键词找一张图,给行程卡片当封面。
//
// 三家可选,按 key 配置自动选:
//   unsplash  质量最好,需要免费 Access Key(每小时 50 次)
//   pexels    备选,同样免费申请
//   openverse 免 key 兜底(CC 开放许可图库),没配任何 key 时用它
//
// 为什么放后端(AGENTS.md §3):API key 不能进前端;而且换供应商时
// iOS 端不用改一行代码。前端只拿到一个可直接 <img src> 的 URL。
//
// 图片 URL 直接指向供应商 CDN(Unsplash/Pexels 的许可都允许热链),
// 所以不做反向代理,也不落盘缓存图片本体 —— 只把解析结果存进行程表。

export type PhotoProvider = "unsplash" | "pexels" | "openverse";

export type Photo = {
  /** 卡片用的图,横图优先。 */
  imageUrl: string;
  /** 小图(列表/缩略图用);供应商没给就回落成 imageUrl。 */
  thumbUrl: string;
  /** 署名文本,如 "Photo by X on Unsplash"。Unsplash 许可要求署名。 */
  credit: string;
  /** 图片来源页,署名要可点回原页。 */
  sourceUrl: string;
  provider: PhotoProvider;
};

/** 当前生效的供应商。openverse 免 key,所以永远有兜底,不会返回 null。 */
export function photoProvider(): PhotoProvider {
  const prefer = process.env.PHOTO_PROVIDER;
  const unsplashReady = Boolean(process.env.UNSPLASH_ACCESS_KEY);
  const pexelsReady = Boolean(process.env.PEXELS_API_KEY);

  if (prefer === "unsplash" && unsplashReady) return "unsplash";
  if (prefer === "pexels" && pexelsReady) return "pexels";
  if (prefer === "openverse") return "openverse";
  if (unsplashReady) return "unsplash";
  if (pexelsReady) return "pexels";
  return "openverse";
}

async function searchUnsplash(query: string): Promise<Photo | null> {
  const url =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  });
  if (!res.ok) throw new Error(`unsplash ${res.status}`);

  // 信任边界:第三方响应当不可信数据,只取用到的字段并检查类型。
  const body = (await res.json()) as any;
  const hit = body?.results?.[0];
  const imageUrl: unknown = hit?.urls?.regular;
  if (typeof imageUrl !== "string") return null;
  const author = String(hit?.user?.name ?? "Unsplash");
  return {
    imageUrl,
    thumbUrl: String(hit?.urls?.small ?? imageUrl),
    credit: `Photo by ${author} on Unsplash`,
    sourceUrl: String(hit?.links?.html ?? "https://unsplash.com"),
    provider: "unsplash",
  };
}

async function searchPexels(query: string): Promise<Photo | null> {
  const url =
    `https://api.pexels.com/v1/search` +
    `?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY! },
  });
  if (!res.ok) throw new Error(`pexels ${res.status}`);

  const body = (await res.json()) as any;
  const hit = body?.photos?.[0];
  const imageUrl: unknown = hit?.src?.large;
  if (typeof imageUrl !== "string") return null;
  const author = String(hit?.photographer ?? "Pexels");
  return {
    imageUrl,
    thumbUrl: String(hit?.src?.medium ?? imageUrl),
    credit: `Photo by ${author} on Pexels`,
    sourceUrl: String(hit?.url ?? "https://pexels.com"),
    provider: "pexels",
  };
}

async function searchOpenverse(query: string): Promise<Photo | null> {
  // Openverse(Creative Commons 官方搜索 API)免 key 可用,匿名有速率限制。
  const url =
    `https://api.openverse.org/v1/images/` +
    `?q=${encodeURIComponent(query)}&page_size=1&mature=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SmartPack/0.1 (dev)" },
  });
  if (!res.ok) throw new Error(`openverse ${res.status}`);

  const body = (await res.json()) as any;
  const hit = body?.results?.[0];
  const imageUrl: unknown = hit?.url;
  if (typeof imageUrl !== "string") return null;
  const author = String(hit?.creator ?? "unknown");
  const license = String(hit?.license ?? "CC").toUpperCase();
  return {
    imageUrl,
    thumbUrl: String(hit?.thumbnail ?? imageUrl),
    credit: `${author} / ${license}`,
    sourceUrl: String(hit?.foreign_landing_url ?? imageUrl),
    provider: "openverse",
  };
}

/**
 * 按关键词取一张配图。找不到返回 null(调用方显示占位块,不当错误处理)。
 * 供应商故障会抛出,由调用方降级 —— 配图缺失不该让整个行程页失败。
 */
export function findPhoto(query: string): Promise<Photo | null> {
  const provider = photoProvider();
  if (provider === "unsplash") return searchUnsplash(query);
  if (provider === "pexels") return searchPexels(query);
  return searchOpenverse(query);
}

/** 生成候选关键词要用到的停靠点信息。 */
export type PhotoSubject = {
  name: string;
  nameEn: string;
  city: string;
  cityEn: string;
  kind: "spot" | "transit" | "meal" | "hotel";
  /** 人工指定的关键词;留空则全靠推导。 */
  photoQuery?: string;
};

// 餐饮/住宿/交通的兜底词:图库里不会有"某家店"的照片,但一定有同类氛围图。
// 实测(scripts/photo-hitrate-probe.mjs):指名到店 1/5,换通用词 5/5。
const GENERIC_BY_KIND: Record<PhotoSubject["kind"], string> = {
  spot: "landmark",
  transit: "railway station platform",
  meal: "restaurant interior",
  hotel: "hotel room interior",
};

/**
 * 按优先级给出候选关键词,调用方逐个试到出图为止。
 *
 * 为什么需要它:photoQuery 原先必须逐个手写,换城市就得给每个新景点补关键词,
 * 漏一个那张卡片就永远空着。这里从名称/城市/类型推导,photoQuery 退化成
 * 可选的人工覆盖。
 *
 * 顺序依据实测命中率,不是猜的:中文名反而最准(图库里的原始标题多是中文),
 * 所以中文优先;英文名次之;最后用"城市 + 类别"兜底,宁可给同类氛围图也不空着。
 */
// 一个停靠点最多打几次图库。候选词逐个串行试,不设上限的话最坏要 7 次请求,
// 免 key 的 Openverse 匿名额度很快就被打满(实测:一整天的停靠点连着查会
// 触发限流,连本该命中的词也一起失败)。4 次是权衡:够走完"具体名 → 兜底",
// 又不会为一张卡片把额度耗光。
const MAX_CANDIDATES = 4;

export function photoQueries(subject: PhotoSubject): string[] {
  const { name, nameEn, city, cityEn, kind } = subject;
  const generic = GENERIC_BY_KIND[kind];

  // 具体到名字的候选,按实测命中率排序。
  const specific = [
    subject.photoQuery,
    name && city ? `${name} ${city}` : "",
    name,
    nameEn && cityEn ? `${nameEn} ${cityEn}` : "",
    nameEn,
  ];
  // 兜底:具体店名查不到时退到"城市 + 类别"的氛围图。餐饮/住宿全靠它,
  // 所以它必须留在列表里,不能被截断掉 —— 截断只发生在 specific 部分。
  const fallback = cityEn ? `${cityEn} ${generic}` : city ? `${city} ${generic}` : generic;

  const seen = new Set<string>();
  const dedupe = (list: string[]) =>
    list
      .map((c) => (c ?? "").trim())
      .filter((c) => c.length > 0 && !seen.has(c) && seen.add(c));

  const head = dedupe(specific).slice(0, MAX_CANDIDATES - 1);
  return [...head, ...dedupe([fallback])];
}

/**
 * 逐个试候选词直到出图。单个候选词失败(没结果或供应商报错)就换下一个,
 * 全部落空才返回 null —— 一个词打不中不该让卡片空着。
 */
export async function findPhotoForSubject(
  subject: PhotoSubject
): Promise<{ photo: Photo; query: string } | null> {
  for (const query of photoQueries(subject)) {
    try {
      const photo = await findPhoto(query);
      if (photo) return { photo, query };
    } catch {
      // 限流/网络故障:换下一个候选词继续试。
    }
  }
  return null;
}
