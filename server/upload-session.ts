// 扫码上传会话:让手机把照片传回电脑当前页面。
//
// 为什么需要:手机扫码打开的是独立浏览器会话,没有电脑上的登录态。
// 与其让用户在手机上重新登录,不如由电脑(已登录)先创建一个短时效会话,
// 把 token 编进二维码;手机凭 token 直传照片,电脑轮询取回。
//
// token 用 randomBytes 生成(AGENTS.md §5:随机凭证不用哈希拼)。
// 会话放内存即可:生命周期只有几分钟,重启丢掉无所谓,不值得进数据库。
import { randomBytes } from "node:crypto";

export type UploadSession = {
  token: string;
  userId: string;
  createdAt: number;
  /** 手机上传的图片(data URL);未上传时为 undefined。 */
  image?: string;
};

const TTL_MS = 10 * 60 * 1000; // 10 分钟够拍一张

const sessions = new Map<string, UploadSession>();

/** 顺手清掉过期会话,避免内存里越积越多。 */
function sweep(now: number): void {
  for (const [token, s] of sessions) {
    if (now - s.createdAt > TTL_MS) sessions.delete(token);
  }
}

export function createUploadSession(userId: string): UploadSession {
  const now = Date.now();
  sweep(now);
  const session: UploadSession = {
    token: randomBytes(24).toString("hex"),
    userId,
    createdAt: now,
  };
  sessions.set(session.token, session);
  return session;
}

export function getUploadSession(token: string): UploadSession | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return s;
}

/** 手机上传照片。token 有效即可,不要求登录态。 */
export function attachImage(token: string, image: string): boolean {
  const s = getUploadSession(token);
  if (!s) return false;
  s.image = image;
  return true;
}

/**
 * 电脑取回照片。取走后只清空图片槽位,会话本身保留,
 * 这样手机上那一页可以连续拍多张(之前取一次就销毁会话,
 * 拍第二张会报“上传链接已失效”)。会话由 TTL 自然过期。
 */
export function consumeImage(token: string): string | null {
  const s = getUploadSession(token);
  if (!s?.image) return null;
  const image = s.image;
  s.image = undefined;
  // 续期:用户还在连续拍,不该因为最初的 10 分钟到点而中断。
  s.createdAt = Date.now();
  return image;
}

/** 电脑关闭二维码弹窗时显式结束会话。 */
export function endUploadSession(token: string): void {
  sessions.delete(token);
}
