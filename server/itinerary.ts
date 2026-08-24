// 行程规划持久化:规范化存 trips / trip_days / trip_stops。
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  DEMO_DAYS,
  DEMO_DEPART_LABEL,
  DEMO_TITLE,
  DEMO_TITLE_EN,
} from "./itinerary-demo.ts";
import { insertGeneratedItinerary } from "./itinerary-generation.ts";
import type { BilingualItem, GeneratedTripPlan } from "./trip-agent-types.ts";

/** 停靠点类型:景点 / 交通 / 餐饮 / 住宿。右侧时间轴按类型换图标。 */
export type StopKind = "spot" | "transit" | "meal" | "hotel";

export type TripStop = {
  id: string;
  position: number;
  kind: StopKind;
  name: string;
  /** 英文名,供语言切换用;API 保持语言中立(AGENTS.md §3)。 */
  nameEn: string;
  startTime: string;
  duration: string;
  note: string;
  noteEn: string;
  photoQuery: string;
  /** 已解析的配图;null 表示还没查过或查不到。 */
  photoUrl: string | null;
  photoCredit: string | null;
  photoSourceUrl: string | null;
};

export type TripDay = {
  id: string;
  /** 第几天,从 1 开始。 */
  dayNumber: number;
  /** 手绘图里的 "x.xx" —— 显示用日期文本,如 "3.14"。 */
  dateLabel: string;
  city: string;
  cityEn: string;
  /** 当天主题一句话。 */
  summary: string;
  summaryEn: string;
  weatherSummary: string;
  weatherSummaryEn: string;
  weatherRisk: string;
  weatherRiskEn: string;
  outfit: BilingualItem[];
  equipment: BilingualItem[];
  stops: TripStop[];
};

export type Trip = {
  id: string;
  title: string;
  titleEn: string;
  /** 对应场景 id(commute/travel/business…),来自场景选择页。 */
  scenario: string;
  /** 出发日期文本,手绘图左上角的 "x.xx 出发"。 */
  departLabel: string;
  createdAt: string;
  sourcePlanId: string | null;
  days: TripDay[];
};

/** 配图解析结果,来自 photos.ts。 */
export type PhotoPatch = {
  photoUrl: string;
  photoCredit: string;
  photoSourceUrl: string;
};

/**
 * 停靠点 + 它所在那天的城市。配图关键词要用城市来消歧
 * (「宽窄巷子」加上「成都」命中率明显更高),所以配图路由取的是这个类型。
 */
export type StopWithCity = TripStop & { city: string; cityEn: string };

export type ItineraryStore = {
  /** 某用户的全部行程(含天与停靠点)。 */
  list: (userId: string) => Trip[];
  get: (userId: string, tripId: string) => Trip | null;
  /** 造一份演示行程并返回。UI 阶段用,接入 AI 生成后废弃。 */
  seedDemoTrip: (userId: string, scenario: string) => Trip;
  saveGenerated: (
    userId: string,
    sourcePlanId: string,
    scenario: string,
    generated: GeneratedTripPlan
  ) => Trip;
  /** 把查到的配图写回停靠点,下次不用再查供应商。 */
  setStopPhoto: (userId: string, stopId: string, photo: PhotoPatch) => void;
  /** 取停靠点(带用户校验、带所在城市),供配图路由用。 */
  stop: (userId: string, stopId: string) => StopWithCity | null;
};

type TripRow = {
  id: string;
  title: string;
  title_en: string;
  scenario: string;
  depart_label: string;
  created_at: string;
  source_plan_id: string | null;
};

type DayRow = {
  id: string;
  day_number: number;
  date_label: string;
  city: string;
  city_en: string;
  summary: string;
  summary_en: string;
  weather_summary: string;
  weather_summary_en: string;
  weather_risk: string;
  weather_risk_en: string;
  outfit_json: string;
  equipment_json: string;
};

type StopRow = {
  id: string;
  position: number;
  kind: string;
  name: string;
  name_en: string;
  start_time: string;
  duration: string;
  note: string;
  note_en: string;
  photo_query: string;
  photo_url: string | null;
  photo_credit: string | null;
  photo_source_url: string | null;
};

const STOP_KINDS = new Set<StopKind>(["spot", "transit", "meal", "hotel"]);

function toStop(r: StopRow): TripStop {
  return {
    id: r.id,
    position: r.position,
    kind: STOP_KINDS.has(r.kind as StopKind) ? (r.kind as StopKind) : "spot",
    name: r.name,
    nameEn: r.name_en,
    startTime: r.start_time,
    duration: r.duration,
    note: r.note,
    noteEn: r.note_en,
    photoQuery: r.photo_query,
    photoUrl: r.photo_url,
    photoCredit: r.photo_credit,
    photoSourceUrl: r.photo_source_url,
  };
}

export function createItineraryStore(db: DatabaseSync): ItineraryStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      title         TEXT NOT NULL,
      title_en      TEXT NOT NULL DEFAULT '',
      scenario      TEXT NOT NULL DEFAULT 'travel',
      depart_label  TEXT NOT NULL DEFAULT '',
      source_plan_id TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS trip_days (
      id          TEXT PRIMARY KEY,
      trip_id     TEXT NOT NULL REFERENCES trips(id),
      day_number  INTEGER NOT NULL,
      date_label  TEXT NOT NULL DEFAULT '',
      city        TEXT NOT NULL DEFAULT '',
      city_en     TEXT NOT NULL DEFAULT '',
      summary     TEXT NOT NULL DEFAULT '',
      summary_en  TEXT NOT NULL DEFAULT ''
      ,weather_summary TEXT NOT NULL DEFAULT ''
      ,weather_summary_en TEXT NOT NULL DEFAULT ''
      ,weather_risk TEXT NOT NULL DEFAULT ''
      ,weather_risk_en TEXT NOT NULL DEFAULT ''
      ,outfit_json TEXT NOT NULL DEFAULT '[]'
      ,equipment_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS trip_stops (
      id                TEXT PRIMARY KEY,
      day_id            TEXT NOT NULL REFERENCES trip_days(id),
      position          INTEGER NOT NULL,
      kind              TEXT NOT NULL DEFAULT 'spot',
      name              TEXT NOT NULL,
      name_en           TEXT NOT NULL DEFAULT '',
      start_time        TEXT NOT NULL DEFAULT '',
      duration          TEXT NOT NULL DEFAULT '',
      note              TEXT NOT NULL DEFAULT '',
      note_en           TEXT NOT NULL DEFAULT '',
      photo_query       TEXT NOT NULL DEFAULT '',
      photo_url         TEXT,
      photo_credit      TEXT,
      photo_source_url  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days(trip_id, day_number);
    CREATE INDEX IF NOT EXISTS idx_trip_stops_day ON trip_stops(day_id, position);
  `);
  const columns = (table: string) =>
    new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
        (column) => column.name
      )
    );
  const tripColumns = columns("trips");
  if (!tripColumns.has("source_plan_id")) {
    db.exec(`ALTER TABLE trips ADD COLUMN source_plan_id TEXT`);
  }
  const dayColumns = columns("trip_days");
  for (const [name, type] of [
    ["weather_summary", "TEXT NOT NULL DEFAULT ''"],
    ["weather_summary_en", "TEXT NOT NULL DEFAULT ''"],
    ["weather_risk", "TEXT NOT NULL DEFAULT ''"],
    ["weather_risk_en", "TEXT NOT NULL DEFAULT ''"],
    ["outfit_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["equipment_json", "TEXT NOT NULL DEFAULT '[]'"],
  ]) {
    if (!dayColumns.has(name)) {
      db.exec(`ALTER TABLE trip_days ADD COLUMN ${name} ${type}`);
    }
  }

  /** 装配一趟行程:天按 day_number 排,停靠点按 position 排。 */
  function hydrate(row: TripRow): Trip {
    const dayRows = db
      .prepare(
        `SELECT id, day_number, date_label, city, city_en, summary, summary_en,
                weather_summary, weather_summary_en, weather_risk, weather_risk_en,
                outfit_json, equipment_json
           FROM trip_days WHERE trip_id = ? ORDER BY day_number`
      )
      .all(row.id) as DayRow[];

    const stopsFor = db.prepare(
      `SELECT id, position, kind, name, name_en, start_time, duration, note,
              note_en, photo_query, photo_url, photo_credit, photo_source_url
         FROM trip_stops WHERE day_id = ? ORDER BY position`
    );

    return {
      id: row.id,
      title: row.title,
      titleEn: row.title_en,
      scenario: row.scenario,
      departLabel: row.depart_label,
      createdAt: row.created_at,
      sourcePlanId: row.source_plan_id,
      days: dayRows.map((d) => ({
        id: d.id,
        dayNumber: d.day_number,
        dateLabel: d.date_label,
        city: d.city,
        cityEn: d.city_en,
        summary: d.summary,
        summaryEn: d.summary_en,
        weatherSummary: d.weather_summary,
        weatherSummaryEn: d.weather_summary_en,
        weatherRisk: d.weather_risk,
        weatherRiskEn: d.weather_risk_en,
        outfit: JSON.parse(d.outfit_json) as BilingualItem[],
        equipment: JSON.parse(d.equipment_json) as BilingualItem[],
        stops: (stopsFor.all(d.id) as StopRow[]).map(toStop),
      })),
    };
  }

  function findTrip(userId: string, tripId: string): TripRow | undefined {
    return db
      .prepare(`SELECT * FROM trips WHERE id = ? AND user_id = ?`)
      .get(tripId, userId) as TripRow | undefined;
  }

  return {
    list(userId) {
      const rows = db
        .prepare(`SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC`)
        .all(userId) as TripRow[];
      return rows.map(hydrate);
    },

    get(userId, tripId) {
      const row = findTrip(userId, tripId);
      return row ? hydrate(row) : null;
    },

    seedDemoTrip(userId, scenario) {
      const tripId = randomUUID();
      db.prepare(
        `INSERT INTO trips (id, user_id, title, title_en, scenario, depart_label)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        tripId,
        userId,
        DEMO_TITLE,
        DEMO_TITLE_EN,
        scenario,
        DEMO_DEPART_LABEL
      );

      const insertDay = db.prepare(
        `INSERT INTO trip_days
           (id, trip_id, day_number, date_label, city, city_en, summary, summary_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertStop = db.prepare(
        `INSERT INTO trip_stops
           (id, day_id, position, kind, name, name_en, start_time, duration,
            note, note_en, photo_query)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const day of DEMO_DAYS) {
        const dayId = randomUUID();
        insertDay.run(
          dayId,
          tripId,
          day.dayNumber,
          day.dateLabel,
          day.city,
          day.cityEn,
          day.summary,
          day.summaryEn
        );
        for (const stop of day.stops) {
          insertStop.run(
            randomUUID(),
            dayId,
            stop.position,
            stop.kind,
            stop.name,
            stop.nameEn,
            stop.startTime,
            stop.duration,
            stop.note,
            stop.noteEn,
            stop.photoQuery
          );
        }
      }
      return hydrate(findTrip(userId, tripId)!);
    },

    saveGenerated(userId, sourcePlanId, scenario, generated) {
      const id = insertGeneratedItinerary(
        db,
        userId,
        sourcePlanId,
        scenario,
        generated
      );
      return hydrate(findTrip(userId, id)!);
    },

    stop(userId, stopId) {
      // 连表回到 trips 校验归属:不能凭 stop id 读到别人行程里的点。
      // 顺带把那天的城市带出来:配图关键词要用它消歧。
      const row = db
        .prepare(
          `SELECT s.id, s.position, s.kind, s.name, s.name_en, s.start_time,
                  s.duration, s.note, s.note_en, s.photo_query, s.photo_url,
                  s.photo_credit, s.photo_source_url,
                  d.city AS city, d.city_en AS city_en
             FROM trip_stops s
             JOIN trip_days d ON d.id = s.day_id
             JOIN trips t     ON t.id = d.trip_id
            WHERE s.id = ? AND t.user_id = ?`
        )
        .get(stopId, userId) as (StopRow & { city: string; city_en: string }) | undefined;
      if (!row) return null;
      return { ...toStop(row), city: row.city, cityEn: row.city_en };
    },

    setStopPhoto(userId, stopId, photo) {
      db.prepare(
        `UPDATE trip_stops
            SET photo_url = ?, photo_credit = ?, photo_source_url = ?
          WHERE id = ? AND day_id IN (
            SELECT d.id FROM trip_days d
              JOIN trips t ON t.id = d.trip_id
             WHERE t.user_id = ?
          )`
      ).run(
        photo.photoUrl,
        photo.photoCredit,
        photo.photoSourceUrl,
        stopId,
        userId
      );
    },
  };
}
