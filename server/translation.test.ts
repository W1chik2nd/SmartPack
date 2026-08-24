import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";

const profile = { name: "Translator", gender: "female", age: 30, heightCm: 168, weightKg: 58 };

test("authenticated translation route returns provider translations", async () => {
  const provider = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: '["通勤"]' } }] }));
  });
  await new Promise<void>((resolve) => provider.listen(0, resolve));
  const providerAddress = provider.address();
  if (!providerAddress || typeof providerAddress === "string") throw new Error("provider unavailable");
  const dir = mkdtempSync(join(tmpdir(), "wearroute-translate-"));
  const app = createApp(join(dir, "test.db"));
  const server: Server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const appAddress = server.address();
  if (!appAddress || typeof appAddress === "string") throw new Error("app unavailable");
  const previous = { key: process.env.AI_API_KEY, url: process.env.AI_BASE_URL, model: process.env.AI_MODEL };
  process.env.AI_API_KEY = "test-key";
  process.env.AI_BASE_URL = `http://localhost:${providerAddress.port}/v1`;
  process.env.AI_MODEL = "test-model";
  try {
    const registered = await fetch(`http://localhost:${appAddress.port}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "translate@example.com", password: "long-enough", ...profile }),
    });
    const { token } = await registered.json() as { token: string };
    const response = await fetch(`http://localhost:${appAddress.port}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ target: "zh", texts: ["Commute"] }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).translations, ["通勤"]);
  } finally {
    server.close();
    app.close();
    provider.close();
    rmSync(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key === "key" ? "AI_API_KEY" : key === "url" ? "AI_BASE_URL" : "AI_MODEL"];
      else process.env[key === "key" ? "AI_API_KEY" : key === "url" ? "AI_BASE_URL" : "AI_MODEL"] = value;
    }
  }
});
