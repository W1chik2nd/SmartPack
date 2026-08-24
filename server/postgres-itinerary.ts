import { randomUUID } from "node:crypto";
import {
  DEMO_DAYS,
  DEMO_DEPART_LABEL,
  DEMO_TITLE,
  DEMO_TITLE_EN,
} from "./itinerary-demo.ts";
import type {
  ItineraryStore,
  PhotoPatch,
  StopKind,
  StopWithCity,
  Trip,
  TripStop,
} from "./itinerary.ts";
import type { BilingualItem, GeneratedTripPlan } from "./trip-agent-types.ts";
import {
  inTransaction,
  row,
  rows,
  type PostgresPool,
  type PostgresQueryable,
} from "./postgres.ts";

type TripRow = {
  id: string;
  title: string;
  title_en: string;
  scenario: string;
  depart_label: string;
  created_at: Date | string;
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
  day_id: string;
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

function toStop(value: StopRow): TripStop {
  return {
    id: value.id,
    position: value.position,
    kind: STOP_KINDS.has(value.kind as StopKind)
      ? (value.kind as StopKind)
      : "spot",
    name: value.name,
    nameEn: value.name_en,
    startTime: value.start_time,
    duration: value.duration,
    note: value.note,
    noteEn: value.note_en,
    photoQuery: value.photo_query,
    photoUrl: value.photo_url,
    photoCredit: value.photo_credit,
    photoSourceUrl: value.photo_source_url,
  };
}

function jsonItems(value: string): BilingualItem[] {
  return JSON.parse(value) as BilingualItem[];
}

async function insertGenerated(
  db: PostgresQueryable,
  userId: string,
  sourcePlanId: string,
  scenario: string,
  generated: GeneratedTripPlan
): Promise<string> {
  const tripId = randomUUID();
  await db.query(
    `INSERT INTO trips
       (id, user_id, title, title_en, scenario, depart_label, source_plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      tripId,
      userId,
      generated.title,
      generated.titleEn,
      scenario,
      generated.departLabel,
      sourcePlanId,
    ]
  );
  for (const [dayIndex, day] of generated.days.entries()) {
    const dayId = randomUUID();
    await db.query(
      `INSERT INTO trip_days
         (id, trip_id, day_number, date_label, city, city_en, summary, summary_en,
          weather_summary, weather_summary_en, weather_risk, weather_risk_en,
          outfit_json, equipment_json)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        dayId,
        tripId,
        dayIndex + 1,
        day.dateLabel,
        day.city,
        day.cityEn,
        day.summary,
        day.summaryEn,
        day.weatherSummary,
        day.weatherSummaryEn,
        day.weatherRisk,
        day.weatherRiskEn,
        JSON.stringify(day.outfit),
        JSON.stringify(day.equipment),
      ]
    );
    for (const [position, stop] of day.stops.entries()) {
      await db.query(
        `INSERT INTO trip_stops
           (id, day_id, position, kind, name, name_en, start_time, duration,
            note, note_en, photo_query)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          dayId,
          position,
          stop.kind,
          stop.name,
          stop.nameEn,
          stop.startTime,
          stop.duration,
          stop.note,
          stop.noteEn,
          stop.photoQuery,
        ]
      );
    }
  }
  return tripId;
}

export function createPostgresItineraryStore(
  pool: PostgresPool
): ItineraryStore {
  async function findTrip(userId: string, tripId: string): Promise<TripRow | null> {
    return row<TripRow>(
      pool,
      `SELECT * FROM trips WHERE id = $1 AND user_id = $2`,
      [tripId, userId]
    );
  }

  async function hydrate(value: TripRow): Promise<Trip> {
    const dayRows = await rows<DayRow>(
      pool,
      `SELECT id, day_number, date_label, city, city_en, summary, summary_en,
              weather_summary, weather_summary_en, weather_risk, weather_risk_en,
              outfit_json, equipment_json
         FROM trip_days WHERE trip_id = $1 ORDER BY day_number`,
      [value.id]
    );
    const stopRows = await rows<StopRow>(
      pool,
      `SELECT s.*
         FROM trip_stops s
         JOIN trip_days d ON d.id = s.day_id
        WHERE d.trip_id = $1
        ORDER BY s.day_id, s.position`,
      [value.id]
    );
    const stopsByDay = new Map<string, StopRow[]>();
    for (const stop of stopRows) {
      const values = stopsByDay.get(stop.day_id) ?? [];
      values.push(stop);
      stopsByDay.set(stop.day_id, values);
    }
    return {
      id: value.id,
      title: value.title,
      titleEn: value.title_en,
      scenario: value.scenario,
      departLabel: value.depart_label,
      createdAt:
        value.created_at instanceof Date
          ? value.created_at.toISOString()
          : value.created_at,
      sourcePlanId: value.source_plan_id,
      days: dayRows.map((day) => ({
        id: day.id,
        dayNumber: day.day_number,
        dateLabel: day.date_label,
        city: day.city,
        cityEn: day.city_en,
        summary: day.summary,
        summaryEn: day.summary_en,
        weatherSummary: day.weather_summary,
        weatherSummaryEn: day.weather_summary_en,
        weatherRisk: day.weather_risk,
        weatherRiskEn: day.weather_risk_en,
        outfit: jsonItems(day.outfit_json),
        equipment: jsonItems(day.equipment_json),
        stops: (stopsByDay.get(day.id) ?? []).map(toStop),
      })),
    };
  }

  return {
    async list(userId) {
      const values = await rows<TripRow>(
        pool,
        `SELECT * FROM trips
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC`,
        [userId]
      );
      return Promise.all(values.map(hydrate));
    },

    async get(userId, tripId) {
      const value = await findTrip(userId, tripId);
      return value ? hydrate(value) : null;
    },

    async seedDemoTrip(userId, scenario) {
      const tripId = await inTransaction(pool, async (client) => {
        const id = randomUUID();
        await client.query(
          `INSERT INTO trips
             (id, user_id, title, title_en, scenario, depart_label)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, userId, DEMO_TITLE, DEMO_TITLE_EN, scenario, DEMO_DEPART_LABEL]
        );
        for (const day of DEMO_DAYS) {
          const dayId = randomUUID();
          await client.query(
            `INSERT INTO trip_days
               (id, trip_id, day_number, date_label, city, city_en, summary, summary_en)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              dayId,
              id,
              day.dayNumber,
              day.dateLabel,
              day.city,
              day.cityEn,
              day.summary,
              day.summaryEn,
            ]
          );
          for (const stop of day.stops) {
            await client.query(
              `INSERT INTO trip_stops
                 (id, day_id, position, kind, name, name_en, start_time,
                  duration, note, note_en, photo_query)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
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
                stop.photoQuery,
              ]
            );
          }
        }
        return id;
      });
      return hydrate((await findTrip(userId, tripId))!);
    },

    async saveGenerated(userId, sourcePlanId, scenario, generated) {
      const tripId = await inTransaction(pool, (client) =>
        insertGenerated(client, userId, sourcePlanId, scenario, generated)
      );
      return hydrate((await findTrip(userId, tripId))!);
    },

    async stop(userId, stopId) {
      const value = await row<StopRow & { city: string; city_en: string }>(
        pool,
        `SELECT s.*, d.city, d.city_en
           FROM trip_stops s
           JOIN trip_days d ON d.id = s.day_id
           JOIN trips t ON t.id = d.trip_id
          WHERE s.id = $1 AND t.user_id = $2`,
        [stopId, userId]
      );
      return value
        ? ({ ...toStop(value), city: value.city, cityEn: value.city_en } as StopWithCity)
        : null;
    },

    async setStopPhoto(userId, stopId, photo: PhotoPatch) {
      await pool.query(
        `UPDATE trip_stops
            SET photo_url = $1, photo_credit = $2, photo_source_url = $3
          WHERE id = $4 AND day_id IN (
            SELECT d.id FROM trip_days d
              JOIN trips t ON t.id = d.trip_id
             WHERE t.user_id = $5
          )`,
        [
          photo.photoUrl,
          photo.photoCredit,
          photo.photoSourceUrl,
          stopId,
          userId,
        ]
      );
    },
  };
}
