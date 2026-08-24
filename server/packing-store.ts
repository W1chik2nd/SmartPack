import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { GeneratedPacking } from "./trip-agent-types.ts";
import type { StoredGeneratedPacking } from "./packing.ts";

export type GeneratedPackingRecord = {
  tripPlanId: string;
  tripDays: number;
  packing: StoredGeneratedPacking;
};

export type PackingPlanStore = {
  save: (
    userId: string,
    tripPlanId: string,
    tripDays: number,
    packing: GeneratedPacking
  ) => GeneratedPackingRecord;
  latest: (userId: string, scenario?: string) => GeneratedPackingRecord | null;
};

export function createPackingPlanStore(db: DatabaseSync): PackingPlanStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_packing_plans (
      trip_plan_id TEXT PRIMARY KEY REFERENCES trip_plans(id),
      user_id      TEXT NOT NULL REFERENCES users(id),
      trip_days    INTEGER NOT NULL,
      plan_json    TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_generated_packing_user
      ON generated_packing_plans(user_id, created_at);
  `);

  function stored(packing: GeneratedPacking): StoredGeneratedPacking {
    return {
      summary: packing.summary,
      summaryEn: packing.summaryEn,
      categories: packing.categories.map((category) => ({
        id: category.id,
        title: category.title,
        titleEn: category.titleEn,
        items: category.items.map((item) => ({
          id: randomUUID(),
          ...item,
        })),
      })),
      essentials: packing.essentials.map((item) => ({
        id: randomUUID(),
        ...item,
      })),
    };
  }

  function toRecord(row: {
    trip_plan_id: string;
    trip_days: number;
    plan_json: string;
  }): GeneratedPackingRecord {
    return {
      tripPlanId: row.trip_plan_id,
      tripDays: row.trip_days,
      packing: JSON.parse(row.plan_json) as StoredGeneratedPacking,
    };
  }

  return {
    save(userId, tripPlanId, tripDays, packing) {
      const plan = stored(packing);
      db.prepare(
        `INSERT INTO generated_packing_plans
           (trip_plan_id, user_id, trip_days, plan_json)
         VALUES (?, ?, ?, ?)`
      ).run(tripPlanId, userId, tripDays, JSON.stringify(plan));
      return { tripPlanId, tripDays, packing: plan };
    },

    latest(userId, scenario) {
      const scenarioClause = scenario ? "AND t.scenario = ?" : "";
      const params = scenario ? [userId, scenario] : [userId];
      const row = db
        .prepare(
          `SELECT p.trip_plan_id, p.trip_days, p.plan_json
             FROM generated_packing_plans p
             JOIN trip_plans t ON t.id = p.trip_plan_id
            WHERE p.user_id = ? ${scenarioClause}
            ORDER BY p.created_at DESC, p.rowid DESC
            LIMIT 1`
        )
        .get(...params) as
        | { trip_plan_id: string; trip_days: number; plan_json: string }
        | undefined;
      return row ? toRecord(row) : null;
    },
  };
}
