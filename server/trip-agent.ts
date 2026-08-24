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
function hasBlankRequiredText(value: unknown, key = ""): boolean {
  if (typeof value === "string") {
    return key !== "wardrobeItemId" && value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasBlankRequiredText(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(([childKey, child]) =>
      hasBlankRequiredText(child, childKey)
    );
  }
  return false;
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
  if (hasBlankRequiredText(raw)) {
    throw new Error("AI trip planner returned an empty required text field.");
  }
  if (
    raw.days.length !== dates.length ||
    raw.days.some((day, i) => day.date !== dates[i])
  ) {
    throw new Error("AI trip planner returned the wrong travel dates.");
  }

  const owned = new Set(wardrobe.map((item) => item.id));
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
