import type { NewTripPlan } from "./trip-plan.ts";

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const MAX_TRIP_DAYS = 30;

export function tripDayCount(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export type ParsedTrip =
  | { ok: true; plan: NewTripPlan }
  | { ok: false; error: string };

/** Validate the external trip form once, before any storage or AI call. */
export function parseTripInput(
  body: any,
  scenarioIds: ReadonlySet<string>
): ParsedTrip {
  if (!scenarioIds.has(body?.scenario)) {
    return { ok: false, error: "Unknown scenario." };
  }
  const placeName =
    typeof body.placeName === "string" ? body.placeName.trim() : "";
  if (!placeName) return { ok: false, error: "placeName is required." };

  const { lat, lon } = body;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return { ok: false, error: "lat/lon must be numbers in range." };
  }
  if (!isIsoDate(body.startDate) || !isIsoDate(body.endDate)) {
    return { ok: false, error: "startDate/endDate must be YYYY-MM-DD." };
  }
  if (body.endDate < body.startDate) {
    return { ok: false, error: "endDate must not precede startDate." };
  }
  if (tripDayCount(body.startDate, body.endDate) > MAX_TRIP_DAYS) {
    return { ok: false, error: `Trip must not exceed ${MAX_TRIP_DAYS} days.` };
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 1200) {
    return { ok: false, error: "Trip agenda must not exceed 1200 characters." };
  }

  return {
    ok: true,
    plan: {
      scenario: body.scenario,
      placeName,
      placeDetail:
        typeof body.placeDetail === "string" ? body.placeDetail.trim() : "",
      lat,
      lon,
      startDate: body.startDate,
      endDate: body.endDate,
      notes,
    },
  };
}
