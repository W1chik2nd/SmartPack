import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { GeneratedTripPlan } from "./trip-agent-types.ts";

/** Insert one agent result into the normalized itinerary tables. */
export function insertGeneratedItinerary(
  db: DatabaseSync,
  userId: string,
  sourcePlanId: string,
  scenario: string,
  generated: GeneratedTripPlan
): string {
  const tripId = randomUUID();
  db.prepare(
    `INSERT INTO trips
       (id, user_id, title, title_en, scenario, depart_label, source_plan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    tripId,
    userId,
    generated.title,
    generated.titleEn,
    scenario,
    generated.departLabel,
    sourcePlanId
  );

  const insertDay = db.prepare(
    `INSERT INTO trip_days
       (id, trip_id, day_number, date_label, city, city_en, summary, summary_en,
        weather_summary, weather_summary_en, weather_risk, weather_risk_en,
        outfit_json, equipment_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertStop = db.prepare(
    `INSERT INTO trip_stops
       (id, day_id, position, kind, name, name_en, start_time, duration,
        note, note_en, photo_query)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  generated.days.forEach((day, dayIndex) => {
    const dayId = randomUUID();
    insertDay.run(
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
      JSON.stringify(day.equipment)
    );
    day.stops.forEach((stop, position) => {
      insertStop.run(
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
        stop.photoQuery
      );
    });
  });
  return tripId;
}
