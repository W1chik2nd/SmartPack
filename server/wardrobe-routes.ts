// 衣柜相关路由:列表、编辑、删除、照片。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
import { type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import type { WardrobeStore, ItemPatch } from "./wardrobe.ts";

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

