import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";

test("registration profile is returned from SQLite and remains editable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wearroute-profile-api-"));
  const app = createApp(join(dir, "test.db"));
  const server = createServer(app.handle);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    const base = `http://localhost:${address.port}`;

    const register = await fetch(`${base}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "profile@example.com",
        password: "correct-horse",
        name: "Anna",
        gender: "female",
        age: 28,
        heightCm: 168,
        weightKg: 55,
        bustCm: 86,
        waistCm: 68,
        hipCm: 92,
        bodyType: "hourglass",
        seasonColorType: "winter",
        stylePrefs: ["business", "elegant"],
        wearFeel: ["runs-cold", "prefers-fitted"],
        travelHabits: ["carry-on-only", "frequent-business"],
      }),
    });
    assert.equal(register.status, 201);
    const registered = await register.json();
    const auth = { Authorization: `Bearer ${registered.token}` };

    assert.deepEqual(
      {
        name: registered.user.name,
        gender: registered.user.gender,
        age: registered.user.age,
        bustCm: registered.user.bustCm,
        seasonColorType: registered.user.seasonColorType,
        stylePrefs: registered.user.stylePrefs,
        wearFeel: registered.user.wearFeel,
        travelHabits: registered.user.travelHabits,
      },
      {
        name: "Anna",
        gender: "female",
        age: 28,
        bustCm: 86,
        seasonColorType: "winter",
        stylePrefs: ["business", "elegant"],
        wearFeel: ["runs-cold", "prefers-fitted"],
        travelHabits: ["carry-on-only", "frequent-business"],
      }
    );

    const me = await fetch(`${base}/api/me`, { headers: auth });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).user, registered.user);

    const update = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        name: "Anna Updated",
        gender: "male",
        age: 29,
        heightCm: 169,
        weightKg: 56,
        bustCm: 88,
        waistCm: 69,
        hipCm: 93,
        bodyType: "h-shape",
        seasonColorType: "autumn",
        stylePrefs: ["minimalist"],
        wearFeel: ["prefers-loose"],
        travelHabits: ["packs-light"],
      }),
    });
    assert.equal(update.status, 200);
    const updated = (await update.json()).user;
    assert.equal(updated.name, "Anna Updated");
    assert.equal(updated.gender, "male");
    assert.deepEqual(updated.stylePrefs, ["minimalist"]);

    const persisted = await fetch(`${base}/api/me`, { headers: auth });
    assert.equal(persisted.status, 200);
    assert.deepEqual((await persisted.json()).user, updated);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
    app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
