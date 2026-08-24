// 衣柜相关路由:拍照识别、列表、编辑、删除、照片。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
import { type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import type { WardrobeStore, ItemPatch } from "./wardrobe.ts";
import {
  recognizeClothing,
  searchKeyword,
  visionConfigured,
  NotClothingError,
} from "./vision.ts";
import { searchProducts, ecommerceProvider } from "./ecommerce.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  wardrobe: WardrobeStore;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  /** 从 Authorization 头解析用户;未登录返回 null。 */
  userFromHeader: () => { id: string } | null;
  /** 从 ?token= 解析用户,供 <img> 这类发不出请求头的场景使用。 */
  userFromQuery: () => { id: string } | null;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleWardrobeRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, wardrobe, json, readBody, userFromHeader } = ctx;
  const method = req.method;
  const path = url.pathname;

  // 拍照识别 →(可选)电商搜同款。识别是硬依赖,搜同款未配置时优雅降级。
  if (method === "POST" && path === "/api/wardrobe/recognize") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    if (!visionConfigured()) {
      json(res, 503, {
        error:
          "识别服务未配置:请在 server/.env 填入 VISION_API_KEY(见 .env.example)。",
      });
      return true;
    }
    const { image } = await readBody(req, 8_000_000);
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      json(res, 400, { error: "image must be a data:image/* URL." });
      return true;
    }
    let item;
    try {
      item = await recognizeClothing(image);
    } catch (err: any) {
      // 不是衣物 / 认不出衣物:这是用户操作问题(拍错了),不是服务故障。
      // 用 422 区分开,前端据此提示重拍且不把这张加进衣柜。
      if (err instanceof NotClothingError) {
        json(res, 422, { error: err.message, notClothing: true });
        return true;
      }
      json(res, 502, { error: `识别失败:${err?.message ?? "unknown"}` });
      return true;
    }
    const provider = ecommerceProvider();
    let products: Awaited<ReturnType<typeof searchProducts>> = [];
    let productsError: string | undefined;
    if (provider) {
      try {
        products = await searchProducts(searchKeyword(item));
      } catch (err: any) {
        // 搜同款失败不拖垮识别结果,报告但不报错。
        productsError = err?.message ?? "unknown";
      }
    }
    // 识别结果连同细节字段一起落库,这些细节是后续穿搭推荐要分析的原料。
    const saved = wardrobe.add(user.id, {
      title: item.title,
      category: item.category,
      subtype: item.subtype,
      colors: item.colors,
      fit: item.fit,
      material: item.material,
      seasons: item.seasons,
      styleTags: item.styleTags,
      details: item.details,
      photoDataUrl: image,
    });
    json(res, 201, { item: saved, provider, products, productsError });
    return true;
  }

  // 衣柜列表
  if (method === "GET" && path === "/api/wardrobe/items") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    json(res, 200, { items: wardrobe.list(user.id) });
    return true;
  }

  // 删除单品(卡片上的删除按钮)
  if (method === "DELETE" && path.startsWith("/api/wardrobe/items/")) {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    if (!wardrobe.remove(user.id, id)) {
      json(res, 404, { error: "单品不存在。" });
      return true;
    }
    json(res, 200, { ok: true });
    return true;
  }

  // 编辑单品字段
  if (method === "PATCH" && path.startsWith("/api/wardrobe/items/")) {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    const body = await readBody(req);
    // 信任边界:只接受白名单字段,并做基本类型校验。
    const patch: ItemPatch = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.category === "string") patch.category = body.category.trim();
    if (typeof body.subtype === "string") patch.subtype = body.subtype.trim();
    if (typeof body.count === "number" && body.count > 0) patch.count = body.count;
    if (typeof body.fit === "string") patch.fit = body.fit.trim();
    if (typeof body.material === "string") patch.material = body.material.trim();
    if (typeof body.details === "string") patch.details = body.details.trim();

    const updated = wardrobe.update(user.id, id, patch);
    if (!updated) {
      json(res, 404, { error: "单品不存在。" });
      return true;
    }
    json(res, 200, { item: updated });
    return true;
  }

  // 照片:库里只存文件名,图片本体从磁盘按 id 取。
  if (method === "GET" && path.startsWith("/api/wardrobe/photo/")) {
    // <img> 标签发不出 Authorization 头,所以这里也接受 ?token=。
    const user = userFromHeader() ?? ctx.userFromQuery();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const id = decodeURIComponent(path.split("/").pop() ?? "");
    const file = wardrobe.photoPath(user.id, id);
    if (!file) {
      json(res, 404, { error: "照片不存在。" });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    });
    createReadStream(file).pipe(res);
    return true;
  }

  return false;
}

