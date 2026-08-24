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
 * 供应商故障会抛出,由路由层降级 —— 配图缺失不该让整个行程页失败。
 */
export function findPhoto(query: string): Promise<Photo | null> {
  const provider = photoProvider();
  if (provider === "unsplash") return searchUnsplash(query);
  if (provider === "pexels") return searchPexels(query);
  return searchOpenverse(query);
}
