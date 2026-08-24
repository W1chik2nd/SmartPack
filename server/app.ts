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
import { createItineraryStore } from "./itinerary.ts";
import { handleItineraryRoutes } from "./itinerary-routes.ts";
import { handleAssistantRoutes } from "./assistant-routes.ts";
import { handleCatalogRoutes } from "./catalog-routes.ts";
import { dirname, join } from "node:path";
// ai / prompts / weather 的 import 已随路由拆分挪进 assistant-routes.ts
// 和 catalog-routes.ts,这里只留 packing 还在本文件处理的那一个。
import { buildPackingPlan } from "./packing.ts";
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
  style: string | null;
  gender: string | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  body_type: string | null;
  season_type: string | null;
  style_preferences: string | null;
  temperature: string | null;
  packing_habits: string | null;
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
    chestCm: u.chest_cm,
    waistCm: u.waist_cm,
    hipsCm: u.hips_cm,
    bodyType: u.body_type,
    season: u.season_type,
    stylePreferences: u.style_preferences ? JSON.parse(u.style_preferences) : [],
    temperature: u.temperature,
    packingHabits: u.packing_habits ? JSON.parse(u.packing_habits) : [],
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
      chest_cm    REAL,
      waist_cm    REAL,
      hips_cm     REAL,
      body_type   TEXT,
      season_type TEXT,
      style_preferences TEXT NOT NULL DEFAULT '[]',
      temperature TEXT,
      packing_habits TEXT NOT NULL DEFAULT '[]',
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
  // 行程规划:trips / trip_days / trip_stops 三张表,建表在 store 里。
  const itinerary = createItineraryStore(db);

  // Dev databases created before the questionnaire existed lack the profile
  // columns; CREATE TABLE IF NOT EXISTS won't add them, so patch in place.
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );
  for (const [col, type] of [
    ["age", "INTEGER"],
    ["height_cm", "REAL"],
    ["weight_kg", "REAL"],
    ["style", "TEXT"],
    ["gender", "TEXT"],
    ["chest_cm", "REAL"],
    ["waist_cm", "REAL"],
    ["hips_cm", "REAL"],
    ["body_type", "TEXT"],
    ["season_type", "TEXT"],
    ["style_preferences", "TEXT NOT NULL DEFAULT '[]'"],
    ["temperature", "TEXT"],
    ["packing_habits", "TEXT NOT NULL DEFAULT '[]'"],
  ] as const) {
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

    if (req.method === "POST" && url.pathname === "/api/register") {
      // Registration is a single atomic call: account fields AND the style
      // questionnaire together. The client collects them across two screens,
      // but nothing touches the database until the questionnaire is done —
      // an abandoned sign-up leaves no trace (product rule, enforced here).
      const { email, password, name, age, heightCm, weightKg, style } =
        await readBody(req);
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        json(res, 400, { error: "Please enter a valid email address." });
        return;
      }
      if (typeof password !== "string" || password.length < 8) {
        json(res, 400, { error: "Password must be at least 8 characters." });
        return;
      }
      if (typeof name !== "string" || name.trim().length < 1) {
        json(res, 400, { error: "Please enter your name." });
        return;
      }
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        json(res, 400, { error: "Please enter a valid age." });
        return;
      }
      if (!Number.isFinite(heightCm) || heightCm <= 0) {
        json(res, 400, { error: "Please enter a valid height in cm." });
        return;
      }
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        json(res, 400, { error: "Please enter a valid weight in kg." });
        return;
      }
      if (typeof style !== "string" || style.trim().length < 1) {
        json(res, 400, { error: "Please choose a preferred style." });
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
      db.prepare(
        `INSERT INTO users (id, email, name, pass_salt, pass_hash, age, height_cm, weight_kg, style)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        email.trim(),
        name.trim(),
        salt,
        hash,
        age,
        heightCm,
        weightKg,
        style.trim()
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
      const values = {
        name: typeof body.name === "string" ? body.name.trim() : user.name,
        gender: typeof body.gender === "string" ? body.gender : "",
        heightCm: body.heightCm == null ? null : Number(body.heightCm),
        weightKg: body.weightKg == null ? null : Number(body.weightKg),
        chestCm: body.chestCm == null ? null : Number(body.chestCm),
        waistCm: body.waistCm == null ? null : Number(body.waistCm),
        hipsCm: body.hipsCm == null ? null : Number(body.hipsCm),
        bodyType: typeof body.bodyType === "string" ? body.bodyType : "",
        season: typeof body.season === "string" ? body.season : "",
        stylePreferences: Array.isArray(body.stylePreferences) ? body.stylePreferences : [],
        temperature: typeof body.temperature === "string" ? body.temperature : "",
        packingHabits: Array.isArray(body.packingHabits) ? body.packingHabits : [],
      };
      if (!values.name) {
        json(res, 400, { error: "Name is required." });
        return;
      }
      db.prepare(`
        UPDATE users SET name = ?, gender = ?, height_cm = ?, weight_kg = ?,
          chest_cm = ?, waist_cm = ?, hips_cm = ?, body_type = ?, season_type = ?,
          style_preferences = ?, temperature = ?, packing_habits = ? WHERE id = ?
      `).run(
        values.name, values.gender, values.heightCm, values.weightKg,
        values.chestCm, values.waistCm, values.hipsCm, values.bodyType, values.season,
        JSON.stringify(values.stylePreferences), values.temperature,
        JSON.stringify(values.packingHabits), user.id
      );
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
