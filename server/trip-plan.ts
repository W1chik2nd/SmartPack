// 行程计划持久化 —— 目的地 + 日期区间存 SQLite。
//
// 表名用 trip_plans 而不是 trips:origin/feature/itinerary-planner 分支上已经
// 有一张 trips 表(存每日安排和景点),字段和用途都不同。用不同表名,避免那个
// 分支将来合进来时撞车。
//
// 这里只做存取,不做业务判断(AGENTS.md §3、§4):校验在路由层的信任边界做一次,
// 内部函数信任调用方。
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { AsyncValue } from "./async-value.ts";

/** 一条行程计划:去哪、什么时候、什么场景。 */
export type TripPlan = {
  id: string;
  /** 场景 id,对应 app.ts 里的 SCENARIOS(commute/travel/business/…)。 */
  scenario: string;
  /** 目的地名称,如“京都市”。 */
  placeName: string;
  /** 目的地补充信息,如“日本 京都府”。可能为空。 */
  placeDetail: string;
  lat: number;
  lon: number;
  /** ISO 日期(YYYY-MM-DD)。单日行程时与 endDate 相同。 */
  startDate: string;
  endDate: string;
  /** User-entered commitments, occasions, pace, and luggage constraints. */
  notes: string;
  /** Generated itinerary record; null for legacy/manual-only plans. */
  itineraryId: string | null;
  generationStatus: "pending" | "processing" | "completed" | "failed";
  generationError: string | null;
  createdAt: string;
};

/** 新建时的入参:id 和 createdAt 由存储层/数据库生成。 */
export type NewTripPlan = Omit<
  TripPlan,
  | "id"
  | "createdAt"
  | "itineraryId"
  | "generationStatus"
  | "generationError"
  | "notes"
> & { notes?: string };

export type TripPlanStore = {
  save: (userId: string, plan: NewTripPlan) => AsyncValue<TripPlan>;
  get: (userId: string, planId: string) => AsyncValue<TripPlan | null>;
  list: (userId: string) => AsyncValue<TripPlan[]>;
  markGenerating: (userId: string, planId: string) => AsyncValue<void>;
  markFailed: (userId: string, planId: string, error: string) => AsyncValue<void>;
  attachItinerary: (userId: string, planId: string, itineraryId: string) => AsyncValue<void>;
  remove: (userId: string, planId: string) => AsyncValue<boolean>;
};

export type SyncTripPlanStore = {
  save: (userId: string, plan: NewTripPlan) => TripPlan;
  get: (userId: string, planId: string) => TripPlan | null;
  list: (userId: string) => TripPlan[];
  markGenerating: (userId: string, planId: string) => void;
  markFailed: (userId: string, planId: string, error: string) => void;
  attachItinerary: (userId: string, planId: string, itineraryId: string) => void;
  remove: (userId: string, planId: string) => boolean;
};

type Row = {
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
  created_at: string;
};

function toPlan(row: Row): TripPlan {
  return {
    id: row.id,
    scenario: row.scenario,
    placeName: row.place_name,
    placeDetail: row.place_detail,
    lat: row.lat,
    lon: row.lon,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    itineraryId: row.itinerary_id,
    generationStatus: row.generation_status,
    generationError: row.generation_error,
    createdAt: row.created_at,
  };
}

export function createTripPlanStore(db: DatabaseSync): SyncTripPlanStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_plans (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id),
      scenario     TEXT NOT NULL,
      place_name   TEXT NOT NULL,
      place_detail TEXT NOT NULL DEFAULT '',
      lat          REAL NOT NULL,
      lon          REAL NOT NULL,
      start_date   TEXT NOT NULL,
      end_date     TEXT NOT NULL,
      notes        TEXT NOT NULL DEFAULT '',
      itinerary_id TEXT,
      generation_status TEXT NOT NULL DEFAULT 'pending',
      generation_error TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Existing development databases predate AI generation linkage.
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(trip_plans)`).all() as { name: string }[]).map(
      (column) => column.name
    )
  );
  if (!existing.has("notes")) {
    db.exec(`ALTER TABLE trip_plans ADD COLUMN notes TEXT NOT NULL DEFAULT ''`);
  }
  if (!existing.has("itinerary_id")) {
    db.exec(`ALTER TABLE trip_plans ADD COLUMN itinerary_id TEXT`);
  }
  if (!existing.has("generation_status")) {
    db.exec(
      `ALTER TABLE trip_plans ADD COLUMN generation_status TEXT NOT NULL DEFAULT 'pending'`
    );
  }
  if (!existing.has("generation_error")) {
    db.exec(`ALTER TABLE trip_plans ADD COLUMN generation_error TEXT`);
  }
  db.exec(
    `UPDATE trip_plans SET generation_status = 'completed'
       WHERE itinerary_id IS NOT NULL AND generation_status = 'pending'`
  );
  // An in-process background call cannot survive a server restart. Surface
  // that interruption instead of leaving a trip stuck on "processing".
  db.exec(
    `UPDATE trip_plans
        SET generation_status = 'failed',
            generation_error = 'Generation was interrupted. Please try again.'
      WHERE generation_status = 'processing'`
  );

  return {
    save(userId, plan) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO trip_plans
           (id, user_id, scenario, place_name, place_detail,
            lat, lon, start_date, end_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        userId,
        plan.scenario,
        plan.placeName,
        plan.placeDetail,
        plan.lat,
        plan.lon,
        plan.startDate,
        plan.endDate,
        plan.notes ?? ""
      );
      // 回读一次,让 created_at 来自数据库而不是应用进程,时间基准只有一个。
      const row = db.prepare(`SELECT * FROM trip_plans WHERE id = ?`).get(id) as Row;
      return toPlan(row);
    },

    get(userId, planId) {
      const row = db
        .prepare(`SELECT * FROM trip_plans WHERE id = ? AND user_id = ?`)
        .get(planId, userId) as Row | undefined;
      return row ? toPlan(row) : null;
    },

    list(userId) {
      // rowid 兜底:同一秒内存的多条 created_at 相同,靠插入顺序稳定排序。
      const rows = db
        .prepare(
          `SELECT * FROM trip_plans
             WHERE user_id = ?
             ORDER BY created_at DESC, rowid DESC`
        )
        .all(userId) as Row[];
      return rows.map(toPlan);
    },

    markGenerating(userId, planId) {
      db.prepare(
        `UPDATE trip_plans
            SET generation_status = 'processing', generation_error = NULL
          WHERE id = ? AND user_id = ?`
      ).run(planId, userId);
    },

    markFailed(userId, planId, error) {
      db.prepare(
        `UPDATE trip_plans
            SET generation_status = 'failed', generation_error = ?
          WHERE id = ? AND user_id = ?`
      ).run(error, planId, userId);
    },

    attachItinerary(userId, planId, itineraryId) {
      db.prepare(
        `UPDATE trip_plans
            SET itinerary_id = ?, generation_status = 'completed',
                generation_error = NULL
          WHERE id = ? AND user_id = ?`
      ).run(itineraryId, planId, userId);
    },

    remove(userId, planId) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          `DELETE FROM trip_stops WHERE day_id IN (
             SELECT d.id FROM trip_days d
               JOIN trips t ON t.id = d.trip_id
              WHERE t.source_plan_id = ? AND t.user_id = ?
           )`
        ).run(planId, userId);
        db.prepare(
          `DELETE FROM trip_days WHERE trip_id IN (
             SELECT id FROM trips WHERE source_plan_id = ? AND user_id = ?
           )`
        ).run(planId, userId);
        db.prepare(
          `DELETE FROM trips WHERE source_plan_id = ? AND user_id = ?`
        ).run(planId, userId);
        db.prepare(
          `DELETE FROM generated_packing_plans
            WHERE trip_plan_id = ? AND user_id = ?`
        ).run(planId, userId);
        const result = db
          .prepare(`DELETE FROM trip_plans WHERE id = ? AND user_id = ?`)
          .run(planId, userId);
        db.exec("COMMIT");
        return result.changes > 0;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
