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
import { aiConfigured, chatCompletion, type ChatMessage } from "./ai.ts";
import { buildSystemPrompt } from "./prompts.ts";
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
};

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name };
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
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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
  ] as const) {
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
  // their callers.
  function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > 1_000_000) reject(new Error("body too large"));
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

    json(res, 404, { error: "Not found." });
  }

  return {
    handle: (req, res) =>
      handle(req, res).catch((err) => {
        json(res, 500, { error: err?.message ?? "Internal error." });
      }),
    close: () => db.close(),
  };
}
