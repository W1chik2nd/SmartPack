import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { type IncomingMessage } from "node:http";
import {
  EMAIL_RE,
  hashPassword,
  publicUser,
  type AccountService,
  type UserRow,
} from "./account-routes.ts";
import {
  profileOptionsPayload,
  validateProfile,
  type ProfileValues,
} from "./profile.ts";
import { row, type PostgresPool } from "./postgres.ts";

function bearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

export function createPostgresAccountService(
  pool: PostgresPool
): AccountService {
  async function userForToken(token: string | undefined): Promise<UserRow | null> {
    if (!token) return null;
    return row<UserRow>(
      pool,
      `SELECT u.*
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = $1`,
      [token]
    );
  }

  async function createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO sessions (token, user_id) VALUES ($1, $2)`,
      [token, userId]
    );
    return token;
  }

  async function updateProfile(
    userId: string,
    values: ProfileValues
  ): Promise<ReturnType<typeof publicUser>> {
    const columns = Object.keys(values);
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    const updated = await row<UserRow>(
      pool,
      `UPDATE users SET ${assignments.join(", ")}
        WHERE id = $${columns.length + 1}
        RETURNING *`,
      [...columns.map((column) => values[column]), userId]
    );
    return publicUser(updated!);
  }

  return {
    async handle(req, res, url, json, readBody) {
      if (req.method === "POST" && url.pathname === "/api/check-email") {
        const { email } = await readBody(req);
        if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
          json(res, 400, { error: "Please enter a valid email address." });
          return true;
        }
        const existing = await row(
          pool,
          `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`,
          [email.trim()]
        );
        if (existing) {
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
        if (profile.ok === false) {
          json(res, 400, { error: profile.error });
          return true;
        }
        const exists = await row(
          pool,
          `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`,
          [email.trim()]
        );
        if (exists) {
          json(res, 409, { error: "An account with this email already exists." });
          return true;
        }
        const id = randomUUID();
        const salt = randomBytes(16).toString("hex");
        const hash = hashPassword(password, salt).toString("hex");
        const columns = Object.keys(profile.values);
        const values = [
          id,
          email.trim(),
          salt,
          hash,
          ...columns.map((column) => profile.values[column]),
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`);
        const user = await row<UserRow>(
          pool,
          `INSERT INTO users
             (id, email, pass_salt, pass_hash, ${columns.join(", ")})
           VALUES (${placeholders.join(", ")})
           RETURNING *`,
          values
        );
        json(res, 201, {
          token: await createSession(id),
          user: publicUser(user!),
        });
        return true;
      }

      if (req.method === "POST" && url.pathname === "/api/login") {
        const { email, password } = await readBody(req);
        if (typeof email !== "string" || typeof password !== "string") {
          json(res, 400, { error: "Email and password are required." });
          return true;
        }
        const user = await row<UserRow>(
          pool,
          `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
          [email.trim()]
        );
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
        json(res, 200, {
          token: await createSession(user.id),
          user: publicUser(user),
        });
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/me") {
        const user = await userForToken(bearerToken(req));
        if (!user) {
          json(res, 401, { error: "Not signed in." });
          return true;
        }
        json(res, 200, { user: publicUser(user) });
        return true;
      }

      if (req.method === "POST" && url.pathname === "/api/logout") {
        const token = bearerToken(req);
        if (token) await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
        json(res, 200, { ok: true });
        return true;
      }

      if (req.method === "PUT" && url.pathname === "/api/profile") {
        const user = await userForToken(bearerToken(req));
        if (!user) {
          json(res, 401, { error: "Not signed in." });
          return true;
        }
        const profile = validateProfile(await readBody(req));
        if (profile.ok === false) {
          json(res, 400, { error: profile.error });
          return true;
        }
        json(res, 200, { user: await updateProfile(user.id, profile.values) });
        return true;
      }

      return false;
    },
    userForRequest: (req) => userForToken(bearerToken(req)),
    userForToken,
    updateProfile,
  };
}
