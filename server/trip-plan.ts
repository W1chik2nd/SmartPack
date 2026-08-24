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
  createdAt: string;
};

/** 新建时的入参:id 和 createdAt 由存储层/数据库生成。 */
export type NewTripPlan = Omit<TripPlan, "id" | "createdAt">;

export type TripPlanStore = {
  save: (userId: string, plan: NewTripPlan) => TripPlan;
  list: (userId: string) => TripPlan[];
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
    createdAt: row.created_at,
  };
}

export function createTripPlanStore(db: DatabaseSync): TripPlanStore {
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
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return {
    save(userId, plan) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO trip_plans
           (id, user_id, scenario, place_name, place_detail,
            lat, lon, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        userId,
        plan.scenario,
        plan.placeName,
        plan.placeDetail,
        plan.lat,
        plan.lon,
        plan.startDate,
        plan.endDate
      );
      // 回读一次,让 created_at 来自数据库而不是应用进程,时间基准只有一个。
      const row = db.prepare(`SELECT * FROM trip_plans WHERE id = ?`).get(id) as Row;
      return toPlan(row);
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
  };
}
