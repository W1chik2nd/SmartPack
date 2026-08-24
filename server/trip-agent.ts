import { structuredResponse } from "./ai.ts";
import { buildProfileFacts, type ProfileForPrompt } from "./prompts.ts";
import { destinationForecast } from "./weather.ts";
import type { WardrobeItem } from "./wardrobe.ts";
import type { NewTripPlan } from "./trip-plan.ts";
import { TRIP_AGENT_PROMPT, tripPlanSchema } from "./trip-agent-prompt.ts";
import type { GeneratedTripPlan } from "./trip-agent-types.ts";

export type TripAgentInput = {
  user: ProfileForPrompt & { id: string };
  plan: NewTripPlan;
  wardrobe: WardrobeItem[];
};

export type GenerateTrip = (input: TripAgentInput) => Promise<GeneratedTripPlan>;

/** `wardrobeItemId` may be blank to mark a genuine wardrobe gap. */
function blankRequiredTextPath(
  value: unknown,
  key = "",
  path = "$"
): string | null {
  if (typeof value === "string") {
    return key !== "wardrobeItemId" && value.trim().length === 0 ? path : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const blank = blankRequiredTextPath(value[index], "", `${path}[${index}]`);
      if (blank) return blank;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      const blank = blankRequiredTextPath(child, childKey, `${path}.${childKey}`);
      if (blank) return blank;
    }
  }
  return null;
}

function present(value: string, fallback: string): string {
  return value.trim() || fallback;
}

/**
 * Empty text is valid JSON Schema but not useful UI. Repair only fields with a
 * truthful deterministic fallback; critical itinerary content remains strict.
 */
function repairDerivableText(raw: GeneratedTripPlan): void {
  raw.departLabel = present(raw.departLabel, raw.days[0]?.date.slice(5) ?? "Trip");
  for (const day of raw.days) {
    day.dateLabel = present(day.dateLabel, day.date.slice(5));
    day.weatherRisk = present(
      day.weatherRisk,
      "未提供具体天气风险，请在出发前核对实时天气。"
    );
    day.weatherRiskEn = present(
      day.weatherRiskEn,
      "No specific weather risk was provided; check live conditions before departure."
    );
    for (const stop of day.stops) {
      stop.note = present(stop.note, "按计划前往，抵达前确认现场信息。");
      stop.noteEn = present(
        stop.noteEn,
        "Continue as planned and confirm local details before arrival."
      );
      stop.photoQuery = present(
        stop.photoQuery,
        `${stop.nameEn || stop.name} ${day.cityEn || day.city}`.trim()
      );
    }
  }
}

/** Inclusive ISO date sequence; the route already validated both endpoints. */
export function tripDates(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`).getTime();
  while (cursor.getTime() <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

/**
 * Structured Outputs guarantees schema shape; these checks enforce business
 * invariants the schema cannot express (exact dates and real wardrobe IDs).
 */
export function normalizeGeneratedTrip(
  raw: GeneratedTripPlan,
  dates: string[],
  wardrobe: WardrobeItem[]
): GeneratedTripPlan {
  if (!raw || !Array.isArray(raw.days) || !raw.packing?.categories) {
    throw new Error("AI trip planner returned an incomplete plan.");
  }
  repairDerivableText(raw);
  const blankPath = blankRequiredTextPath(raw);
  if (blankPath) {
    throw new Error(
      `AI trip planner returned an empty required text field at ${blankPath}.`
    );
  }
  if (
    raw.days.length !== dates.length ||
    raw.days.some((day, i) => day.date !== dates[i])
  ) {
    throw new Error("AI trip planner returned the wrong travel dates.");
  }

  const ownedItems = new Map(wardrobe.map((item) => [item.id, item]));
  const owned = new Set(ownedItems.keys());
  const packedWardrobeIds = new Set(
    raw.packing.categories.flatMap((category) =>
      category.items
        .map((item) => item.wardrobeItemId)
        .filter((id): id is string => Boolean(id))
    )
  );
  for (const day of raw.days) {
    day.outfit = day.outfit.map((item) => {
      if (
        !item.wardrobeItemId ||
        !owned.has(item.wardrobeItemId) ||
        !packedWardrobeIds.has(item.wardrobeItemId)
      ) {
        return { ...item, wardrobeItemId: "", hasPhoto: false };
      }
      const wardrobeItem = ownedItems.get(item.wardrobeItemId)!;
      return {
        ...item,
        label: wardrobeItem.title,
        labelEn: item.labelEn || wardrobeItem.title,
        hasPhoto: wardrobeItem.hasPhoto,
      };
    });
  }
  for (const category of raw.packing.categories) {
    for (const item of category.items) {
      item.daysUsed = [...new Set(item.daysUsed)]
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= dates.length)
        .sort((a, b) => a - b);
      if (item.daysUsed.length === 0) item.daysUsed = [1];
      item.reuse = item.daysUsed.length;
      if (item.wardrobeItemId && !owned.has(item.wardrobeItemId)) {
        item.wardrobeItemId = "";
      }
    }
  }
  return raw;
}

export const generateTrip: GenerateTrip = async ({ user, plan, wardrobe }) => {
  const dates = tripDates(plan.startDate, plan.endDate);
  const forecast = await destinationForecast(
    plan.lat,
    plan.lon,
    plan.startDate,
    plan.endDate
  );
  const generated = await structuredResponse<GeneratedTripPlan>({
    instructions: TRIP_AGENT_PROMPT,
    safetyIdentifier: user.id,
    schema: tripPlanSchema(dates.length),
    input: {
      profile: buildProfileFacts(user),
      wardrobe: wardrobe.map((item) => ({
        wardrobeItemId: item.id,
        title: item.title,
        category: item.category,
        subtype: item.subtype,
        count: item.count,
        colors: item.colors,
        fit: item.fit,
        material: item.material,
        seasons: item.seasons,
        styleTags: item.styleTags,
        details: item.details,
      })),
      trip: {
        scenario: plan.scenario,
        destination: plan.placeName,
        destinationDetail: plan.placeDetail,
        dates,
        userAgenda: plan.notes,
      },
      weather: forecast,
    },
  });
  return normalizeGeneratedTrip(generated, dates, wardrobe);
};
