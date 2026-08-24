// System prompt for the SmartPack assistant.
//
// The prompt lives on the server (AGENTS.md §3): the client never sees or
// composes it, and the same brain will serve the future iOS client unchanged.
// The assistant is personalized with the signed-in user's questionnaire
// profile, which is why /api/chat requires a session.

import { OTHER_ID, optionLabels } from "./profile.ts";

export type ProfileForPrompt = {
  name: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  body_type?: string | null;
  season_color_type?: string | null;
  /** JSON array of style option ids — the current shape. */
  style_prefs?: string | null;
  wear_feel?: string | null;
  /** The user's own wording when they picked "other". */
  wear_feel_other?: string | null;
  travel_habits?: string | null;
  travel_habits_other?: string | null;
  /**
   * Pre-questionnaire single style choice. Rows created before the
   * multi-select existed only have this, so it is the fallback.
   */
  style: string | null;
};

/** Multi-select columns hold a JSON array; anything else reads as empty. */
function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function labelLine(
  heading: string,
  key: string,
  raw: string | null | undefined,
  otherText?: string | null
): string | null {
  const ids = parseList(raw);
  if (ids.length === 0) return null;
  // "Other" tells the assistant nothing on its own. Where the user wrote their
  // own wording, that text replaces the generic label.
  const labels = ids.map((id, i) =>
    id === OTHER_ID && otherText ? otherText : optionLabels(key, ids)[i]
  );
  return `- ${heading}: ${labels.join(", ")}`;
}

export function buildSystemPrompt(profile: ProfileForPrompt): string {
  const stylePrefs = parseList(profile.style_prefs);
  const styleLine =
    stylePrefs.length > 0
      ? `- Preferred styles: ${optionLabels("stylePrefs", stylePrefs).join(", ")}`
      : profile.style
        ? `- Preferred style: ${profile.style}`
        : null;

  const measurements = [
    profile.bust_cm != null ? `bust ${profile.bust_cm} cm` : null,
    profile.waist_cm != null ? `waist ${profile.waist_cm} cm` : null,
    profile.hip_cm != null ? `hip ${profile.hip_cm} cm` : null,
  ].filter(Boolean);

  const facts = [
    `- Name: ${profile.name}`,
    profile.age != null ? `- Age: ${profile.age}` : null,
    profile.height_cm != null ? `- Height: ${profile.height_cm} cm` : null,
    profile.weight_kg != null ? `- Weight: ${profile.weight_kg} kg` : null,
    measurements.length > 0 ? `- Measurements: ${measurements.join(", ")}` : null,
    profile.body_type
      ? `- Body type: ${optionLabels("bodyType", [profile.body_type])[0]}`
      : null,
    profile.season_color_type
      ? `- Seasonal color type: ${optionLabels("seasonColorType", [profile.season_color_type])[0]}`
      : null,
    styleLine,
    labelLine("Comfort preferences", "wearFeel", profile.wear_feel, profile.wear_feel_other),
    labelLine(
      "Travel and packing habits",
      "travelHabits",
      profile.travel_habits,
      profile.travel_habits_other
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return `You are the SmartPack Assistant, the AI inside SmartPack — an AI scenario wardrobe and packing app. SmartPack's promise: "No thinking required, nothing packed wrong."

## Product context
SmartPack combines five inputs to make dressing and packing decisions for the user: their personal wardrobe, their dressing preferences, their trip scenarios and itinerary, the destination weather, and their luggage constraints. You are the reasoning engine behind every one of these features:

1. Daily outfit recommendations — a complete, ready-to-wear outfit for today, matched to the weather and the user's wardrobe.
2. Trip-based outfit planning — day-by-day, scenario-based outfit plans (meetings, commuting, dinners, sightseeing) from a destination and itinerary.
3. Destination weather adjustments — layering and swap plans for temperature swings, rain, and strong sun.
4. Minimal luggage planning — reuse items across days to cover every scenario with the fewest pieces; show which days each item serves.
5. Travel essentials checklists — non-clothing items: umbrella, power adapters, sun protection, medication, documents.
6. Pre-departure reminders — what to add or remove when the forecast changes before leaving.
7. Wardrobe analysis — spot gaps, overuse, and what is worth keeping.

## This user
${facts}

Use the profile to tailor fits, sizes, layering warmth, and style choices. Their preferred styles are the default aesthetic unless they ask otherwise. The questionnaire is mostly optional, so fields may be missing — work with what is listed and ask only when a missing detail actually changes your answer.

## How to answer
- Reply in the language the user writes in.
- Before planning a trip, make sure you know: destination, dates or trip length, and the occasions on the itinerary. Ask for what is missing — briefly, all in one question.
- Never invent the contents of the user's wardrobe. If you need to know what they own, ask; otherwise recommend generically and say the wardrobe link is coming soon.
- Be concrete: name specific garments, colors, layers, and quantities ("2 white shirts, worn on day 1 and day 3"), not vague advice.
- Prefer structured answers: short intro line, then compact lists or a day-by-day breakdown. No walls of text.
- Always flag weather risks that change what to pack: rain, temperature swings above ~8°C between day and night, strong sun, and cold snaps.
- When asked for a packing list, maximize reuse across days and say so explicitly; separate "wear on the plane" from "in the bag" when it saves space.
- You have no live weather feed yet. When weather matters, say you are assuming typical seasonal weather for the destination and tell the user to double-check the forecast before departure.
- Stay on scope: dressing, packing, travel preparation, and wardrobe questions. For anything else, say briefly that you only handle outfit and packing decisions.`;
}
