// SmartPack auth API.
//
// Architecture note (AGENTS.md §3): all auth logic lives here on the server.
// Clients (web now, SwiftUI later) only call these endpoints and render the
// result — no business rules or validation logic beyond pure UI concerns.
//
// createApp() is separated from the listening entry point (index.ts) so tests
// can run the exact same handler against a throwaway database.
import { type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import {
  recognizeClothing,
  searchKeyword,
  visionConfigured,
  NotClothingError,
} from "./vision.ts";
import { searchProducts, ecommerceProvider } from "./ecommerce.ts";
import {
  createUploadSession,
  getUploadSession,
  attachImage,
  consumeImage,
  endUploadSession,
} from "./upload-session.ts";
import { createWardrobeStore } from "./wardrobe.ts";
import { handleWardrobeRoutes } from "./wardrobe-routes.ts";
import { dirname, join } from "node:path";
import { aiConfigured, chatCompletion, type ChatMessage } from "./ai.ts";
import { buildSystemPrompt } from "./prompts.ts";
import { currentWeather, DEFAULT_COORDS } from "./weather.ts";
import {
  PROFILE_COLUMNS,
  profileOptionsPayload,
  validateProfile,
} from "./profile.ts";

// Password hashing (AGENTS.md §5): passwords require a password-specific KDF,
// not a general-purpose hash like SHA256. We use scrypt because it is a
// memory-hard password KDF that ships with Node — bcrypt/argon2 would add a
// native dependency for no gain at this stage (switching later only means
// re-hashing on next login, since hashes are per-user salted anyway).
function hashPassword(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 64);
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  pass_salt: string;
  pass_hash: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  body_type: string | null;
  season_color_type: string | null;
  /** JSON array of style option ids. */
  style_prefs: string | null;
  /** JSON array of wear-comfort option ids. */
  wear_feel: string | null;
  /** JSON array of travel-habit option ids. */
  travel_habits: string | null;
  /** Pre-questionnaire single choice; still read as a fallback. */
  style: string | null;
};

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Scenario catalog (AGENTS.md §3): the set of packing scenarios lives on the
// server, not the client. Both web and the future iOS client render whatever
// this returns, so the list — and later the packing rules keyed off each id —
// stay in one place. `image` points at a client-served asset; a missing file
// degrades to the card's placeholder, so new scenarios need no code change.
const SCENARIOS = [
  { id: "commute", label: "通勤", image: "/scenarios/commute.jpg" },
  { id: "travel", label: "旅行", image: "/scenarios/travel.jpg" },
  { id: "business", label: "出差", image: "/scenarios/business.jpg" },
  { id: "date", label: "约会", image: "/scenarios/date.jpg" },
  { id: "sport", label: "运动", image: "/scenarios/sport.jpg" },
  { id: "formal", label: "正式场合", image: "/scenarios/formal.jpg" },
] as const;

export type App = {
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  close: () => void;
};

export function createApp(dbPath: string): App {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name        TEXT NOT NULL,
      pass_salt   TEXT NOT NULL,
      pass_hash   TEXT NOT NULL,
      age         INTEGER,
      height_cm   REAL,
      weight_kg   REAL,
      style       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 照片存数据库同级的 photos/ 目录:测试用临时库时会自动隔离到临时目录。
  const wardrobe = createWardrobeStore(db, join(dirname(dbPath), "photos"));

  // Dev databases created before the questionnaire existed lack the profile
  // columns; CREATE TABLE IF NOT EXISTS won't add them, so patch in place.
  // The column list comes from profile.ts, so adding a questionnaire field
  // there migrates existing databases without touching this loop.
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );
  for (const [col, type] of PROFILE_COLUMNS) {
    if (!existing.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
  }

  function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end(JSON.stringify(body));
  }

  // Trust boundary (AGENTS.md §4): request bodies are external input, so this
  // is the one place we validate shape and size. Internal helpers below trust
  // their callers. maxBytes is per-route: image upload needs a higher cap.
  function readBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<any> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > maxBytes) reject(new Error("body too large"));
      });
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          reject(new Error("invalid JSON"));
        }
      });
      req.on("error", reject);
    });
  }

  function bearerToken(req: IncomingMessage): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  }

  function userForToken(token: string | undefined): UserRow | null {
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
      )
      .get(token) as UserRow | undefined;
    return row ?? null;
  }

  function createSession(userId: string): string {
    const token = randomBytes(32).toString("hex");
    db.prepare(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`).run(
      token,
      userId
    );
    return token;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }

    // Pre-check for step 1 of sign-up: lets the client reject a duplicate
    // email before the questionnaire, without creating anything.
    if (req.method === "POST" && url.pathname === "/api/check-email") {
      const { email } = await readBody(req);
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        json(res, 400, { error: "Please enter a valid email address." });
        return;
      }
      const exists = db
        .prepare(`SELECT 1 FROM users WHERE email = ?`)
        .get(email.trim());
      if (exists) {
        json(res, 409, { error: "An account with this email already exists." });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }

    // The questionnaire catalog. Deliberately unauthenticated: it is asked for
    // during sign-up step 2, before any account or session exists. It carries
    // no user data — only the option lists and their validation bounds — so
    // there is nothing here to protect.
    if (req.method === "GET" && url.pathname === "/api/profile-options") {
      json(res, 200, profileOptionsPayload());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      // Registration is a single atomic call: account fields AND the
      // questionnaire together. The client collects them across two screens,
      // but nothing touches the database until the questionnaire is done —
      // an abandoned sign-up leaves no trace (product rule, enforced here).
      // Only name/age/height/weight are mandatory; the rest may be null.
      const body = await readBody(req);
      const { email, password } = body;
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        json(res, 400, { error: "Please enter a valid email address." });
        return;
      }
      if (typeof password !== "string" || password.length < 8) {
        json(res, 400, { error: "Password must be at least 8 characters." });
        return;
      }
      const profile = validateProfile(body);
      if (!profile.ok) {
        json(res, 400, { error: profile.error });
        return;
      }
      const exists = db
        .prepare(`SELECT 1 FROM users WHERE email = ?`)
        .get(email.trim());
      if (exists) {
        json(res, 409, { error: "An account with this email already exists." });
        return;
      }
      const id = randomUUID();
      const salt = randomBytes(16).toString("hex");
      const hash = hashPassword(password, salt).toString("hex");
      const columns = Object.keys(profile.values);
      db.prepare(
        `INSERT INTO users (id, email, pass_salt, pass_hash, ${columns.join(", ")})
         VALUES (?, ?, ?, ?, ${columns.map(() => "?").join(", ")})`
      ).run(
        id,
        email.trim(),
        salt,
        hash,
        ...columns.map((c) => profile.values[c])
      );

      const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow;
      json(res, 201, { token: createSession(id), user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const { email, password } = await readBody(req);
      if (typeof email !== "string" || typeof password !== "string") {
        json(res, 400, { error: "Email and password are required." });
        return;
      }
      const user = db
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .get(email.trim()) as UserRow | undefined;
      if (!user) {
        json(res, 401, { error: "Incorrect email or password." });
        return;
      }
      const expected = Buffer.from(user.pass_hash, "hex");
      const actual = hashPassword(password, user.pass_salt);
      // timingSafeEqual: comparing secrets with === would leak match length
      // through timing; not paranoia — this is the standard for credentials.
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        json(res, 401, { error: "Incorrect email or password." });
        return;
      }
      json(res, 200, { token: createSession(user.id), user: publicUser(user) });
      return;
    }

    // Live weather for the dashboard. Coordinates are optional query params;
    // without them we fall back to the default city rather than failing the card.
    if (req.method === "GET" && url.pathname === "/api/weather") {
      const lat = Number(url.searchParams.get("lat") ?? DEFAULT_COORDS.lat);
      const lon = Number(url.searchParams.get("lon") ?? DEFAULT_COORDS.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        json(res, 400, { error: "Invalid coordinates." });
        return;
      }
      const weather = await currentWeather(lat, lon);
      json(res, 200, weather);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/scenarios") {
      // Signed-in only: the picker is the first screen after auth. The catalog
      // itself is not secret, but gating it keeps every post-auth screen behind
      // the same check and avoids an anonymous surface we would only tighten later.
      if (!userForToken(bearerToken(req))) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      json(res, 200, { scenarios: SCENARIOS });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      json(res, 200, { user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const token = bearerToken(req);
      if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
      json(res, 200, { ok: true });
      return;
    }

    // SmartPack Assistant. Session-gated: the system prompt embeds the
    // user's questionnaire profile, so anonymous chat has nothing to
    // personalize with. The client sends the visible conversation each turn;
    // the prompt itself never leaves the server.
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      if (!aiConfigured()) {
        json(res, 503, {
          error:
            "AI is not configured. Set AI_API_KEY in server/.env (see server/.env.example).",
        });
        return;
      }
      const { messages } = await readBody(req);
      const valid =
        Array.isArray(messages) &&
        messages.length > 0 &&
        messages.length <= 40 &&
        messages.every(
          (m: ChatMessage) =>
            (m?.role === "user" || m?.role === "assistant") &&
            typeof m?.content === "string" &&
            m.content.length > 0 &&
            m.content.length <= 4000
        );
      if (!valid) {
        json(res, 400, { error: "Invalid messages." });
        return;
      }
      const systemPrompt = buildSystemPrompt(user);
      const reply = await chatCompletion(systemPrompt, messages);
      json(res, 200, { reply });
      return;
    }

    // 拍照识别 → (可选)电商搜同款。识别是硬依赖,搜同款未配置时优雅降级。
    if (req.method === "POST" && url.pathname === "/api/wardrobe/recognize") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      if (!visionConfigured()) {
        json(res, 503, {
          error:
            "识别服务未配置:请在 server/.env 填入 VISION_API_KEY(见 .env.example)。",
        });
        return;
      }
      const { image } = await readBody(req, 8_000_000);
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        json(res, 400, { error: "image must be a data:image/* URL." });
        return;
      }
      let item;
      try {
        item = await recognizeClothing(image);
      } catch (err: any) {
        // 不是衣物 / 认不出衣物:这是用户操作问题(拍错了),不是服务故障。
        // 用 422 区分开,前端据此提示重拍且不把这张加进衣柜。
        if (err instanceof NotClothingError) {
          json(res, 422, { error: err.message, notClothing: true });
          return;
        }
        json(res, 502, { error: `识别失败:${err?.message ?? "unknown"}` });
        return;
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
      return;
    }

    // 衣柜路由(列表/编辑/删除/照片)拆到独立模块,见 wardrobe-routes.ts。
    if (
      await handleWardrobeRoutes({
        req,
        res,
        url,
        wardrobe,
        json,
        readBody,
        userFromHeader: () => userForToken(bearerToken(req)),
        userFromQuery: () =>
          userForToken(url.searchParams.get("token") ?? undefined),
      })
    ) {
      return;
    }

    // 电脑端(已登录)创建扫码上传会话,token 会被编进二维码。
    if (req.method === "POST" && url.pathname === "/api/upload-session") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const session = createUploadSession(user.id);
      json(res, 201, { uploadToken: session.token });
      return;
    }

    // 手机端凭 uploadToken 直传照片 —— 故意不要求登录态:
    // token 本身就是一次性凭证,这正是免去手机重新登录的关键。
    if (req.method === "POST" && url.pathname === "/api/upload-session/photo") {
      const { uploadToken, image } = await readBody(req, 8_000_000);
      if (typeof uploadToken !== "string" || typeof image !== "string") {
        json(res, 400, { error: "uploadToken and image are required." });
        return;
      }
      if (!image.startsWith("data:image/")) {
        json(res, 400, { error: "image must be a data:image/* URL." });
        return;
      }
      if (!attachImage(uploadToken, image)) {
        json(res, 404, { error: "上传链接已失效,请在电脑上重新生成二维码。" });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }

    // 电脑端轮询:照片到了就取回(取回即销毁会话)。
    if (req.method === "GET" && url.pathname === "/api/upload-session/photo") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const uploadToken = url.searchParams.get("uploadToken") ?? "";
      const session = getUploadSession(uploadToken);
      if (!session) {
        json(res, 404, { error: "上传链接已失效。" });
        return;
      }
      // 只能取自己创建的会话,防止拿别人的 token 捞照片。
      if (session.userId !== user.id) {
        json(res, 403, { error: "Forbidden." });
        return;
      }
      json(res, 200, { image: consumeImage(uploadToken) });
      return;
    }

    // 电脑关闭二维码弹窗:显式结束会话,不必等 TTL 过期。
    if (req.method === "DELETE" && url.pathname === "/api/upload-session") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const uploadToken = url.searchParams.get("uploadToken") ?? "";
      const session = getUploadSession(uploadToken);
      // 只能结束自己的会话。已不存在也算成功(幂等)。
      if (session && session.userId === user.id) {
        endUploadSession(uploadToken);
      }
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { error: "Not found." });
  }

  return {
    handle: (req, res) =>
      handle(req, res).catch((err) => {
        const message = err?.message ?? "Internal error.";
        // 请求体超限是用户能自己解决的问题(照片太大),之前被无差别转成 500,
        // 前端只看到看不懂的 "Request failed (500)"。给它专门的状态码和提示。
        if (message === "body too large") {
          json(res, 413, {
            error: "照片太大,请重新拍一张(或换张分辨率低一些的图片)。",
          });
          return;
        }
        if (message === "invalid JSON") {
          json(res, 400, { error: "请求格式错误。" });
          return;
        }
        json(res, 500, { error: message });
      }),
    close: () => db.close(),
  };
}
