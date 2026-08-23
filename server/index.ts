// SmartPack auth server — zero-dependency Node + TypeScript + SQLite (node:sqlite)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, "smartpack.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name        TEXT NOT NULL,
    pass_salt   TEXT NOT NULL,
    pass_hash   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const PORT = Number(process.env.PORT ?? 4177);

// ---------- helpers ----------

function hashPassword(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 64);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
}

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

type UserRow = {
  id: string;
  email: string;
  name: string;
  pass_salt: string;
  pass_hash: string;
};

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name };
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- routes ----------

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const { email, name, password } = await readBody(req);
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      json(res, 400, { error: "Please enter a valid email address." });
      return;
    }
    if (typeof name !== "string" || name.trim().length < 1) {
      json(res, 400, { error: "Please enter your name." });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      json(res, 400, { error: "Password must be at least 8 characters." });
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
      `INSERT INTO users (id, email, name, pass_salt, pass_hash) VALUES (?, ?, ?, ?, ?)`
    ).run(id, email.trim(), name.trim(), salt, hash);

    const token = randomBytes(32).toString("hex");
    db.prepare(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`).run(token, id);
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow;
    json(res, 201, { token, user: publicUser(user) });
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
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      json(res, 401, { error: "Incorrect email or password." });
      return;
    }
    const token = randomBytes(32).toString("hex");
    db.prepare(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`).run(
      token,
      user.id
    );
    json(res, 200, { token, user: publicUser(user) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    const user = userForToken(token);
    if (!user) {
      json(res, 401, { error: "Not signed in." });
      return;
    }
    json(res, 200, { user: publicUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "Not found." });
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    json(res, 500, { error: err?.message ?? "Internal error." });
  });
}).listen(PORT, () => {
  console.log(`SmartPack auth server listening on http://localhost:${PORT}`);
});
