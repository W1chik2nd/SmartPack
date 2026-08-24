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
import { handleUploadRoutes } from "./upload-routes.ts";
import { createWardrobeStore } from "./wardrobe.ts";
import { handleWardrobeRoutes } from "./wardrobe-routes.ts";
import { createTripPlanStore } from "./trip-plan.ts";
import { handleTripPlanRoutes } from "./trip-plan-routes.ts";
import { createItineraryStore } from "./itinerary.ts";
import { handleItineraryRoutes } from "./itinerary-routes.ts";
import { handleAssistantRoutes } from "./assistant-routes.ts";
import { handleCatalogRoutes, SCENARIO_IDS } from "./catalog-routes.ts";
import { dirname, join } from "node:path";
import {
  PROFILE_COLUMNS,
  profileOptionsPayload,
  validateProfile,
} from "./profile.ts";
// ai / prompts / weather 的 import 已随路由拆分挪进 assistant-routes.ts
// 和 catalog-routes.ts,这里只留 packing 还在本文件处理的那一个。
import { buildPackingPlan } from "./packing.ts";
import { analyzePersonalColor, visionConfigured } from "./vision.ts";
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
  gender: string | null;
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
  /** The user's own wording when they picked "other". */
  wear_feel_other: string | null;
  /** JSON array of travel-habit option ids. */
  travel_habits: string | null;
  travel_habits_other: string | null;
  /** Pre-questionnaire single choice; still read as a fallback. */
  style: string | null;
};

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    age: u.age,
    heightCm: u.height_cm,
    weightKg: u.weight_kg,
    style: u.style,
    gender: u.gender,
    bustCm: u.bust_cm,
    waistCm: u.waist_cm,
    hipCm: u.hip_cm,
    bodyType: u.body_type,
    seasonColorType: u.season_color_type,
    stylePrefs: u.style_prefs ? JSON.parse(u.style_prefs) : [],
    wearFeel: u.wear_feel ? JSON.parse(u.wear_feel) : [],
    wearFeelOther: u.wear_feel_other,
    travelHabits: u.travel_habits ? JSON.parse(u.travel_habits) : [],
    travelHabitsOther: u.travel_habits_other,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      gender      TEXT,
      bust_cm     REAL,
      waist_cm    REAL,
      hip_cm      REAL,
      body_type   TEXT,
      season_color_type TEXT,
      style_prefs TEXT,
      wear_feel TEXT,
      wear_feel_other TEXT,
      travel_habits TEXT,
      travel_habits_other TEXT,
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
  // 行程计划(目的地 + 日期区间)自带建表,见 trip-plan.ts。
  const tripPlans = createTripPlanStore(db);
  // 合法场景 id 来自 catalog-routes,保存行程时据此校验(场景目录只有一处)。
  const scenarioIds = SCENARIO_IDS;
  // 行程规划:trips / trip_days / trip_stops 三张表,建表在 store 里。
  const itinerary = createItineraryStore(db);

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
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

    if (req.method === "POST" && url.pathname === "/api/personal-color/analyze") {
      if (!visionConfigured()) {
        json(res, 503, { error: "图片分析服务尚未配置，请设置 VISION_API_KEY。" });
        return;
      }
      const { image } = await readBody(req, 8_000_000);
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        json(res, 400, { error: "请上传有效的真人照片。" });
        return;
      }
      try {
        const result = await analyzePersonalColor(image);
        json(res, 200, result);
      } catch (err) {
        const detail = err instanceof Error
          ? `${err.name}: ${err.message}${err.cause instanceof Error ? ` (原因: ${err.cause.name}: ${err.cause.message})` : ""}`
          : String(err);
        console.error(`[personal-color] ${detail}`);
        json(res, 502, { error: `个人色彩分析请求失败：${detail}` });
      }
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
      // Only the fields marked required by the current questionnaire gate
      // account creation; every optional answer may remain null.
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

    // 参考数据路由(场景目录 / 天气),见 catalog-routes.ts。
    if (
      await handleCatalogRoutes({
        req,
        res,
        url,
        json,
        userFromHeader: () => userForToken(bearerToken(req)),
      })
    ) {
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

    if (req.method === "PUT" && url.pathname === "/api/profile") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const body = await readBody(req);
      const profile = validateProfile(body);
      if (!profile.ok) {
        json(res, 400, { error: profile.error });
        return;
      }
      const columns = Object.keys(profile.values);
      db.prepare(
        `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`
      ).run(...columns.map((column) => profile.values[column]), user.id);
      const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as UserRow;
      json(res, 200, { user: publicUser(updated) });
      return;
    }

    // 助手路由(/api/chat),见 assistant-routes.ts。
    if (
      await handleAssistantRoutes({
        req,
        res,
        url,
        json,
        readBody,
        userFromHeader: () => userForToken(bearerToken(req)),
      })
    ) {
      return;
    }

    // 行程规划路由(行程列表/单个行程/景点配图),见 itinerary-routes.ts。
    if (
      await handleItineraryRoutes({
        req,
        res,
        url,
        itinerary,
        json,
        userFromHeader: () => userForToken(bearerToken(req)),
      })
    ) {
      return;
    }

    // Packing plan. Session-gated because the plan is personal (and will draw
    // on the user's wardrobe + itinerary once those exist). `balance` is the
    // one query knob: 0 = pack lightest, 100 = most outfit variety (US 6.3).
    // Trust boundary (AGENTS.md §4): coerce and clamp here; buildPackingPlan
    // trusts its caller.
    if (req.method === "GET" && url.pathname === "/api/packing") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return;
      }
      const rawParam = url.searchParams.get("balance");
      const raw = rawParam === null ? NaN : Number(rawParam);
      const balance = Number.isFinite(raw) ? raw : 50;
      json(res, 200, { plan: buildPackingPlan(balance) });
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

    // 行程计划路由(地点搜索/保存/列表)拆到独立模块,见 trip-plan-routes.ts。
    if (
      await handleTripPlanRoutes({
        req,
        res,
        url,
        tripPlans,
        scenarioIds,
        json,
        readBody,
        userFromHeader: () => userForToken(bearerToken(req)),
      })
    ) {
      return;
    }

    // 扫码上传路由(建会话/手机传图/电脑取图/关会话),见 upload-routes.ts。
    if (
      await handleUploadRoutes({
        req,
        res,
        url,
        json,
        readBody,
        userFromHeader: () => userForToken(bearerToken(req)),
      })
    ) {
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
