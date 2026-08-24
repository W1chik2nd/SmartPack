// 扫码上传路由:电脑端建会话 → 手机端传照片 → 电脑端取回 → 关闭会话。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
//
// 注意手机端那条(POST /photo)故意不要求登录态:uploadToken 本身就是
// 一次性凭证,这正是免去手机重新登录的关键。别"顺手"给它加鉴权。
import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  createUploadSession,
  getUploadSession,
  attachImage,
  consumeImage,
  endUploadSession,
} from "./upload-session.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  /** 从 Authorization 头解析用户;未登录返回 null。 */
  userFromHeader: () => { id: string } | null;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleUploadRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, json, readBody, userFromHeader } = ctx;
  const method = req.method;
  const path = url.pathname;

  // 电脑端(已登录)创建扫码上传会话,token 会被编进二维码。
  if (method === "POST" && path === "/api/upload-session") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const session = createUploadSession(user.id);
    json(res, 201, { uploadToken: session.token });
    return true;
  }

  // 手机端凭 uploadToken 直传照片 —— 见文件头说明,这里不要求登录态。
  if (method === "POST" && path === "/api/upload-session/photo") {
    const { uploadToken, image } = await readBody(req, 8_000_000);
    if (typeof uploadToken !== "string" || typeof image !== "string") {
      json(res, 400, { error: "uploadToken and image are required." });
      return true;
    }
    if (!image.startsWith("data:image/")) {
      json(res, 400, { error: "image must be a data:image/* URL." });
      return true;
    }
    if (!attachImage(uploadToken, image)) {
      json(res, 404, { error: "上传链接已失效,请在电脑上重新生成二维码。" });
      return true;
    }
    json(res, 200, { ok: true });
    return true;
  }

  // 电脑端轮询:照片到了就取回(取回即销毁会话)。
  if (method === "GET" && path === "/api/upload-session/photo") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const uploadToken = url.searchParams.get("uploadToken") ?? "";
    const session = getUploadSession(uploadToken);
    if (!session) {
      json(res, 404, { error: "上传链接已失效。" });
      return true;
    }
    // 只能取自己创建的会话,防止拿别人的 token 捞照片。
    if (session.userId !== user.id) {
      json(res, 403, { error: "Forbidden." });
      return true;
    }
    json(res, 200, { image: consumeImage(uploadToken) });
    return true;
  }

  // 电脑关闭二维码弹窗:显式结束会话,不必等 TTL 过期。
  if (method === "DELETE" && path === "/api/upload-session") {
    const user = userFromHeader();
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return true;
    }
    const uploadToken = url.searchParams.get("uploadToken") ?? "";
    const session = getUploadSession(uploadToken);
    // 只能结束自己的会话。已不存在也算成功(幂等)。
    if (session && session.userId === user.id) {
      endUploadSession(uploadToken);
    }
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}
