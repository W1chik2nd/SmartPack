import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  PROFILE_COLUMNS,
  profileOptionsPayload,
  validateProfile,
} from "./profile.ts";

export type UserRow = {
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
  style_prefs: string | null;
  wear_feel: string | null;
  wear_feel_other: string | null;
  travel_habits: string | null;
  travel_habits_other: string | null;
  style: string | null;
};

type Json = (res: ServerResponse, status: number, body: unknown) => void;
type ReadBody = (req: IncomingMessage, maxBytes?: number) => Promise<any>;

export type AccountService = {
  handle: (
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    json: Json,
    readBody: ReadBody
  ) => Promise<boolean>;
  userForRequest: (req: IncomingMessage) => UserRow | null;
  userForToken: (token: string | undefined) => UserRow | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64);

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

export function createAccountService(db: DatabaseSync): AccountService {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL,
      age INTEGER, height_cm REAL, weight_kg REAL, style TEXT, gender TEXT,
      bust_cm REAL, waist_cm REAL, hip_cm REAL, body_type TEXT,
      season_color_type TEXT, style_prefs TEXT, wear_feel TEXT,
      wear_feel_other TEXT, travel_habits TEXT, travel_habits_other TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(
      (column) => column.name
    )
  );
  for (const [column, type] of PROFILE_COLUMNS) {
    if (!existing.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
  }

  function bearerToken(req: IncomingMessage): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  }

  function userForToken(token: string | undefined): UserRow | null {
    if (!token) return null;
    return (
      (db
        .prepare(
          `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
        )
        .get(token) as UserRow | undefined) ?? null
    );
  }

  function createSession(userId: string): string {
    const token = randomBytes(32).toString("hex");
    db.prepare(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`).run(token, userId);
    return token;
  }

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    json: Json,
    readBody: ReadBody
  ): Promise<boolean> {
    if (req.method === "POST" && url.pathname === "/api/check-email") {
      const { email } = await readBody(req);
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        json(res, 400, { error: "Please enter a valid email address." });
        return true;
      }
      if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email.trim())) {
        json(res, 409, { error: "An account with this email already exists." });
        return true;
      }
      json(res, 200, { ok: true });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/profile-options") {
      json(res, 200, profileOptionsPayload());
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readBody(req);
      const { email, password } = body;
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        json(res, 400, { error: "Please enter a valid email address." });
        return true;
      }
      if (typeof password !== "string" || password.length < 8) {
        json(res, 400, { error: "Password must be at least 8 characters." });
        return true;
      }
      const profile = validateProfile(body);
      if (!profile.ok) {
        json(res, 400, { error: profile.error });
        return true;
      }
      if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email.trim())) {
        json(res, 409, { error: "An account with this email already exists." });
        return true;
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
        ...columns.map((column) => profile.values[column])
      );
      const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow;
      json(res, 201, { token: createSession(id), user: publicUser(user) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const { email, password } = await readBody(req);
      if (typeof email !== "string" || typeof password !== "string") {
        json(res, 400, { error: "Email and password are required." });
        return true;
      }
      const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.trim()) as
        | UserRow
        | undefined;
      if (!user) {
        json(res, 401, { error: "Incorrect email or password." });
        return true;
      }
      const expected = Buffer.from(user.pass_hash, "hex");
      const actual = hashPassword(password, user.pass_salt);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        json(res, 401, { error: "Incorrect email or password." });
        return true;
      }
      json(res, 200, { token: createSession(user.id), user: publicUser(user) });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return true;
      }
      json(res, 200, { user: publicUser(user) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const token = bearerToken(req);
      if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
      json(res, 200, { ok: true });
      return true;
    }

    if (req.method === "PUT" && url.pathname === "/api/profile") {
      const user = userForToken(bearerToken(req));
      if (!user) {
        json(res, 401, { error: "Not signed in." });
        return true;
      }
      const profile = validateProfile(await readBody(req));
      if (!profile.ok) {
        json(res, 400, { error: profile.error });
        return true;
      }
      const columns = Object.keys(profile.values);
      db.prepare(
        `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(", ")}
          WHERE id = ?`
      ).run(...columns.map((column) => profile.values[column]), user.id);
      const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as UserRow;
      json(res, 200, { user: publicUser(updated) });
      return true;
    }

    return false;
  }

  return {
    handle,
    userForRequest: (req) => userForToken(bearerToken(req)),
    userForToken,
  };
}
