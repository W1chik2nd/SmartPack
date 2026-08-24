import { randomUUID } from "node:crypto";
import type { GeneratedPacking } from "./trip-agent-types.ts";
import type { StoredGeneratedPacking } from "./packing.ts";
import type {
  GeneratedPackingRecord,
  PackingPlanStore,
} from "./packing-store.ts";
import { row, type PostgresPool } from "./postgres.ts";

function stored(packing: GeneratedPacking): StoredGeneratedPacking {
  return {
    summary: packing.summary,
    summaryEn: packing.summaryEn,
    categories: packing.categories.map((category) => ({
      id: category.id,
      title: category.title,
      titleEn: category.titleEn,
      items: category.items.map((item) => ({ id: randomUUID(), ...item })),
    })),
    essentials: packing.essentials.map((item) => ({
      id: randomUUID(),
      ...item,
    })),
  };
}

function toRecord(value: {
  trip_plan_id: string;
  trip_days: number;
  plan_json: string;
}): GeneratedPackingRecord {
  return {
    tripPlanId: value.trip_plan_id,
    tripDays: value.trip_days,
    packing: JSON.parse(value.plan_json) as StoredGeneratedPacking,
  };
}

export function createPostgresPackingPlanStore(
  pool: PostgresPool
): PackingPlanStore {
  return {
    async save(userId, tripPlanId, tripDays, packing) {
      const plan = stored(packing);
      await pool.query(
        `INSERT INTO generated_packing_plans
           (trip_plan_id, user_id, trip_days, plan_json)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (trip_plan_id) DO UPDATE
           SET trip_days = EXCLUDED.trip_days,
               plan_json = EXCLUDED.plan_json,
               created_at = NOW()`,
        [tripPlanId, userId, tripDays, JSON.stringify(plan)]
      );
      return { tripPlanId, tripDays, packing: plan };
    },

    async get(userId, tripPlanId) {
      const value = await row<{
        trip_plan_id: string;
        trip_days: number;
        plan_json: string;
      }>(
        pool,
        `SELECT trip_plan_id, trip_days, plan_json
           FROM generated_packing_plans
          WHERE user_id = $1 AND trip_plan_id = $2`,
        [userId, tripPlanId]
      );
      return value ? toRecord(value) : null;
    },

    async latest(userId, scenario) {
      const values: unknown[] = [userId];
      const scenarioClause = scenario ? `AND t.scenario = $2` : "";
      if (scenario) values.push(scenario);
      const value = await row<{
        trip_plan_id: string;
        trip_days: number;
        plan_json: string;
      }>(
        pool,
        `SELECT p.trip_plan_id, p.trip_days, p.plan_json
           FROM generated_packing_plans p
           JOIN trip_plans t ON t.id = p.trip_plan_id
          WHERE p.user_id = $1 ${scenarioClause}
          ORDER BY p.created_at DESC, p.trip_plan_id DESC
          LIMIT 1`,
        values
      );
      return value ? toRecord(value) : null;
    },
  };
}
