import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";

const requiredProfile = {
  name: "Assistant User",
  gender: "female",
  age: 30,
  heightCm: 168,
  weightKg: 58,
};

async function withMockProvider(
  answer: unknown,
  run: (base: string, token: string) => Promise<void>
) {
  const provider = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  });
  await new Promise<void>((resolve) => provider.listen(0, resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("no provider port");

  const dir = mkdtempSync(join(tmpdir(), "smartpack-assistant-routes-"));
  const app = createApp(join(dir, "test.db"));
  const server: Server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const appAddress = server.address();
  if (!appAddress || typeof appAddress === "string") throw new Error("no app port");
  const base = `http://localhost:${appAddress.port}`;
  const previous = {
    key: process.env.AI_API_KEY,
    url: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  };
  process.env.AI_API_KEY = "test-key";
  process.env.AI_BASE_URL = `http://localhost:${address.port}/v1`;
  process.env.AI_MODEL = "test-model";
  try {
    const registered = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "assistant@example.com", password: "long-enough", ...requiredProfile }),
    });
    const { token } = await registered.json() as { token: string };
    await run(base, token);
  } finally {
    server.close();
    app.close();
    provider.close();
    rmSync(dir, { recursive: true, force: true });
    if (previous.key === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previous.key;
    if (previous.url === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = previous.url;
    if (previous.model === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = previous.model;
  }
}

test("chat navigation action reaches the authenticated client response", async () => {
  await withMockProvider(
    { reply: "Opening your wardrobe.", actions: [{ type: "navigate", page: "wardrobe" }] },
    async (base, token) => {
      const response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: "Open my wardrobe" }] }),
      });
      const body = await response.json() as any;
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.match(body.reply, /Action completed successfully/);
      assert.deepEqual(body.actions, [{ type: "navigate", page: "wardrobe" }]);
    }
  );
});

test("chat wardrobe action writes to SQLite and reports completion", async () => {
  await withMockProvider(
    {
      reply: "Adding the item.",
      actions: [{ type: "addWardrobeItem", item: { title: "Black tee", category: "top" } }],
    },
    async (base, token) => {
      const chat = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: "Add a black tee" }] }),
      });
      const chatBody = await chat.json() as any;
      assert.equal(chat.status, 200, JSON.stringify(chatBody));
      assert.match(chatBody.reply, /Action completed successfully/);
      assert.deepEqual(chatBody.actions, [{ type: "wardrobeChanged" }]);
      const wardrobe = await fetch(`${base}/api/wardrobe/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { items } = await wardrobe.json() as any;
      assert.equal(items[0].title, "Black tee");
    }
  );
});
