// 电商“搜同款” — 京东联盟 / 淘宝客(淘宝联盟)关键词搜商品。
//
// 两家平台都不开放“以图搜图”给普通第三方,这里按可行性分析采用
// “识别结果 → 关键词搜索”的替代路线,顺带产出带佣金的推广链接(README 变现模式)。
//
// 关于 MD5(AGENTS.md §5 说明):京东宙斯与淘宝 TOP 开放平台的签名算法
// 由平台协议强制规定为 MD5(secret + 排序参数拼接 + secret) 大写,
// 这是对接要求,不是自选的哈希用途。
import { createHash } from "node:crypto";

export type Product = {
  title: string;
  imageUrl: string;
  price: string;
  url: string;
};

export type EcommerceProvider = "jd" | "taobao";

export function ecommerceProvider(): EcommerceProvider | null {
  const prefer = process.env.ECOMMERCE_PROVIDER;
  const jdReady = Boolean(
    process.env.JD_UNION_APP_KEY && process.env.JD_UNION_APP_SECRET
  );
  const tbReady = Boolean(
    process.env.TAOBAO_APP_KEY &&
      process.env.TAOBAO_APP_SECRET &&
      process.env.TAOBAO_ADZONE_ID
  );
  if (prefer === "jd" && jdReady) return "jd";
  if (prefer === "taobao" && tbReady) return "taobao";
  if (jdReady) return "jd";
  if (tbReady) return "taobao";
  return null;
}

/** 平台规定的时间戳格式:GMT+8 的 yyyy-MM-dd HH:mm:ss。 */
export function gmt8Timestamp(now = Date.now()): string {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 19).replace("T", " ");
}

/** 平台规定的签名:MD5(secret + key1value1key2value2... + secret) 大写。 */
export function topSign(params: Record<string, string>, secret: string): string {
  const joined = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("");
  return createHash("md5").update(secret + joined + secret, "utf8").digest("hex").toUpperCase();
}

function ensureHttps(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

async function searchJd(keyword: string): Promise<Product[]> {
  const params: Record<string, string> = {
    method: "jd.union.open.goods.query",
    app_key: process.env.JD_UNION_APP_KEY!,
    timestamp: gmt8Timestamp(),
    format: "json",
    v: "1.0",
    sign_method: "md5",
    "360buy_param_json": JSON.stringify({
      goodsReqDTO: { keyword, pageSize: 3 },
    }),
  };
  params.sign = topSign(params, process.env.JD_UNION_APP_SECRET!);

  const res = await fetch("https://api.jd.com/routerjson", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`jd api ${res.status}`);

  // 信任边界:第三方响应,防御性取值。京东把业务结果再包一层 JSON 字符串。
  const outer = (await res.json()) as any;
  const raw = outer?.jd_union_open_goods_query_responce?.result;
  const result = typeof raw === "string" ? JSON.parse(raw) : raw;
  const list: any[] = result?.data ?? [];
  return list.slice(0, 3).map((g) => ({
    title: String(g?.skuName ?? ""),
    imageUrl: ensureHttps(String(g?.imageInfo?.imageList?.[0]?.url ?? "")),
    price: String(g?.priceInfo?.price ?? ""),
    url: ensureHttps(String(g?.materialUrl ?? "")),
  }));
}

async function searchTaobao(keyword: string): Promise<Product[]> {
  const params: Record<string, string> = {
    method: "taobao.tbk.dg.material.optional",
    app_key: process.env.TAOBAO_APP_KEY!,
    timestamp: gmt8Timestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    q: keyword,
    adzone_id: process.env.TAOBAO_ADZONE_ID!,
    page_size: "3",
  };
  params.sign = topSign(params, process.env.TAOBAO_APP_SECRET!);

  const res = await fetch("https://gw.api.taobao.com/router/rest", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`taobao api ${res.status}`);

  const body = (await res.json()) as any;
  if (body?.error_response) {
    throw new Error(`taobao api: ${body.error_response.sub_msg ?? body.error_response.msg}`);
  }
  const list: any[] =
    body?.tbk_dg_material_optional_response?.result_list?.map_data ?? [];
  return list.slice(0, 3).map((g) => ({
    title: String(g?.title ?? ""),
    imageUrl: ensureHttps(String(g?.pict_url ?? "")),
    price: String(g?.zk_final_price ?? ""),
    url: ensureHttps(String(g?.coupon_share_url ?? g?.item_url ?? "")),
  }));
}

export function searchProducts(keyword: string): Promise<Product[]> {
  const provider = ecommerceProvider();
  if (provider === "jd") return searchJd(keyword);
  if (provider === "taobao") return searchTaobao(keyword);
  return Promise.resolve([]);
}
