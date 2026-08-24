import { randomUUID } from "node:crypto";
import type { NewTripPlan, TripPlan, TripPlanStore } from "./trip-plan.ts";
import {
  inTransaction,
  row,
  rows,
  type PostgresPool,
} from "./postgres.ts";

type TripPlanRow = {
  id: string;
  scenario: string;
  place_name: string;
  place_detail: string;
  lat: number;
  lon: number;
  start_date: string;
  end_date: string;
  notes: string;
  itinerary_id: string | null;
  generation_status: TripPlan["generationStatus"];
  generation_error: string | null;
  created_at: Date | string;
};

function toPlan(value: TripPlanRow): TripPlan {
  return {
    id: value.id,
    scenario: value.scenario,
    placeName: value.place_name,
    placeDetail: value.place_detail,
    lat: value.lat,
    lon: value.lon,
    startDate: value.start_date,
    endDate: value.end_date,
    notes: value.notes,
    itineraryId: value.itinerary_id,
    generationStatus: value.generation_status,
    generationError: value.generation_error,
    createdAt:
      value.created_at instanceof Date
        ? value.created_at.toISOString()
        : value.created_at,
  };
}

export async function createPostgresTripPlanStore(
  pool: PostgresPool
): Promise<TripPlanStore> {
  await pool.query(`
    UPDATE trip_plans
       SET generation_status = 'completed'
     WHERE itinerary_id IS NOT NULL AND generation_status = 'pending';
    UPDATE trip_plans
       SET generation_status = 'failed',
           generation_error = 'Generation was interrupted. Please try again.'
     WHERE generation_status = 'processing';
  `);

  return {
    async save(userId, plan: NewTripPlan) {
      const saved = await row<TripPlanRow>(
        pool,
        `INSERT INTO trip_plans
           (id, user_id, scenario, place_name, place_detail,
            lat, lon, start_date, end_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          randomUUID(),
          userId,
          plan.scenario,
          plan.placeName,
          plan.placeDetail,
          plan.lat,
          plan.lon,
          plan.startDate,
          plan.endDate,
          plan.notes ?? "",
        ]
      );
      return toPlan(saved!);
    },

    async get(userId, planId) {
      const value = await row<TripPlanRow>(
        pool,
        `SELECT * FROM trip_plans WHERE id = $1 AND user_id = $2`,
        [planId, userId]
      );
      return value ? toPlan(value) : null;
    },

    async list(userId) {
      return (
        await rows<TripPlanRow>(
          pool,
          `SELECT * FROM trip_plans
            WHERE user_id = $1
            ORDER BY created_at DESC, id DESC`,
          [userId]
        )
      ).map(toPlan);
    },

    async markGenerating(userId, planId) {
      await pool.query(
        `UPDATE trip_plans
            SET generation_status = 'processing', generation_error = NULL
          WHERE id = $1 AND user_id = $2`,
        [planId, userId]
      );
    },

    async markFailed(userId, planId, error) {
      await pool.query(
        `UPDATE trip_plans
            SET generation_status = 'failed', generation_error = $1
          WHERE id = $2 AND user_id = $3`,
        [error, planId, userId]
      );
    },

    async attachItinerary(userId, planId, itineraryId) {
      await pool.query(
        `UPDATE trip_plans
            SET itinerary_id = $1, generation_status = 'completed',
                generation_error = NULL
          WHERE id = $2 AND user_id = $3`,
        [itineraryId, planId, userId]
      );
    },

    async remove(userId, planId) {
      return inTransaction(pool, async (client) => {
        await client.query(
          `DELETE FROM trips WHERE source_plan_id = $1 AND user_id = $2`,
          [planId, userId]
        );
        const result = await client.query(
          `DELETE FROM trip_plans WHERE id = $1 AND user_id = $2`,
          [planId, userId]
        );
        return (result.rowCount ?? 0) > 0;
      });
    },
  };
}
