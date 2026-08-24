import { test } from "node:test";
import assert from "node:assert/strict";
import { postgresPoolConfig } from "./postgres.ts";

test("Neon pool connections set search_path after startup", async () => {
  const calls: unknown[][] = [];
  const config = postgresPoolConfig("postgresql://example.invalid/db", "wearroute");
  const client = {
    query(...args: unknown[]) {
      calls.push(args);
      return Promise.resolve({ rows: [] });
    },
  };

  assert.equal(config.options, undefined);
  await config.onConnect?.(client as never);
  assert.deepEqual(calls, [
    ["SELECT set_config('search_path', $1, false)", ["wearroute,public"]],
  ]);
});

test("database schema names stay safe to interpolate", () => {
  assert.throws(
    () => postgresPoolConfig("postgresql://example.invalid/db", "wearroute;DROP SCHEMA public"),
    /lowercase PostgreSQL identifier/
  );
});
