// Structured actions for the SmartPack assistant. Model output is untrusted:
// only this allow-list can reach database-backed operations.
import { isIsoDate, tripDayCount, MAX_TRIP_DAYS } from "./trip-input.ts";
import type { TripPlanStore } from "./trip-plan.ts";
import type { WardrobeStore, NewItem, ItemPatch } from "./wardrobe.ts";
import { validateProfile, type ProfileValues } from "./profile.ts";

export const ASSISTANT_PAGES = [
  "home", "trips", "tripSetup", "itinerary", "wardrobe", "profile", "packing",
] as const;
export type AssistantPage = (typeof ASSISTANT_PAGES)[number];

export type AssistantAction =
  | { type: "navigate"; page: AssistantPage; scenario?: string }
  | { type: "updateProfile"; profile: Record<string, unknown> }
  | { type: "addWardrobeItem"; item: NewItem }
  | { type: "updateWardrobeItem"; id: string; patch: ItemPatch }
  | { type: "deleteWardrobeItem"; id: string }
  | { type: "packingChecklist"; checked?: string[]; unchecked?: string[]; balance?: number }
  | {
      type: "createTripPlan";
      plan: {
        scenario: string;
        placeName: string;
        placeDetail?: string;
        lat: number;
        lon: number;
        startDate: string;
        endDate: string;
      };
    };

export type ClientAssistantAction =
  | { type: "navigate"; page: AssistantPage; scenario?: string }
  | { type: "profileUpdated"; user: unknown }
  | { type: "wardrobeChanged" }
  | { type: "tripCreated" }
  | { type: "packingChanged"; balance?: number; checked?: string[]; unchecked?: string[] };

export type AssistantEnvelope = { reply: string; actions: AssistantAction[] };
export type AssistantActionContext = {
  userId: string;
  scenarioIds: ReadonlySet<string>;
  wardrobe: WardrobeStore;
  tripPlans: TripPlanStore;
  updateProfile: (values: ProfileValues) => unknown;
  currentProfile: () => Record<string, unknown>;
};

export type AssistantDataContext = AssistantActionContext & {
  promptContext: string;
};

const PAGE_SET = new Set<string>(ASSISTANT_PAGES);
const clean = (value: string, max: number) => value.trim().slice(0, max);

function strings(value: unknown, maxItems = 12): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return;
  return value.slice(0, maxItems).map((item) => clean(item, 80));
}

function wardrobeItem(raw: Record<string, unknown>): NewItem | null {
  if (typeof raw.title !== "string" || typeof raw.category !== "string") return null;
  const title = clean(raw.title, 120);
  const category = clean(raw.category, 80);
  if (!title || !category) return null;
  const count = typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count > 0
    ? Math.min(raw.count, 99) : undefined;
  return {
    title,
    category,
    ...(typeof raw.subtype === "string" ? { subtype: clean(raw.subtype, 80) } : {}),
    ...(count ? { count } : {}),
    ...(strings(raw.colors) ? { colors: strings(raw.colors) } : {}),
    ...(typeof raw.fit === "string" ? { fit: clean(raw.fit, 80) } : {}),
    ...(typeof raw.material === "string" ? { material: clean(raw.material, 80) } : {}),
    ...(strings(raw.seasons) ? { seasons: strings(raw.seasons) } : {}),
    ...(strings(raw.styleTags) ? { styleTags: strings(raw.styleTags) } : {}),
    ...(typeof raw.details === "string" ? { details: clean(raw.details, 500) } : {}),
  };
}

function parseAction(raw: unknown): AssistantAction | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.type === "navigate" && typeof value.page === "string" && PAGE_SET.has(value.page)) {
    return {
      type: "navigate",
      page: value.page as AssistantPage,
      ...(typeof value.scenario === "string" ? { scenario: value.scenario } : {}),
    };
  }
  if (value.type === "updateProfile" && value.profile && typeof value.profile === "object") {
    return { type: "updateProfile", profile: value.profile as Record<string, unknown> };
  }
  if (value.type === "deleteWardrobeItem" && typeof value.id === "string") {
    return { type: "deleteWardrobeItem", id: value.id };
  }
  if (value.type === "packingChecklist") {
    const checked = strings(value.checked, 100);
    const unchecked = strings(value.unchecked, 100);
    const balance = typeof value.balance === "number" && Number.isFinite(value.balance)
      ? Math.max(0, Math.min(100, Math.round(value.balance))) : undefined;
    if (!checked && !unchecked && balance === undefined) return null;
    return { type: "packingChecklist", ...(checked ? { checked } : {}), ...(unchecked ? { unchecked } : {}), ...(balance !== undefined ? { balance } : {}) };
  }
  if (value.type === "updateWardrobeItem" && typeof value.id === "string" &&
      value.patch && typeof value.patch === "object") {
    const raw = value.patch as Record<string, unknown>;
    const patch: ItemPatch = {};
    if (typeof raw.title === "string") patch.title = clean(raw.title, 120);
    if (typeof raw.category === "string") patch.category = clean(raw.category, 80);
    if (typeof raw.subtype === "string") patch.subtype = clean(raw.subtype, 80);
    if (typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count > 0) patch.count = Math.min(raw.count, 99);
    if (typeof raw.fit === "string") patch.fit = clean(raw.fit, 80);
    if (typeof raw.material === "string") patch.material = clean(raw.material, 80);
    if (typeof raw.details === "string") patch.details = clean(raw.details, 500);
    return Object.keys(patch).length ? { type: "updateWardrobeItem", id: value.id, patch } : null;
  }
  if (value.type === "addWardrobeItem" && value.item && typeof value.item === "object") {
    const item = wardrobeItem(value.item as Record<string, unknown>);
    return item ? { type: "addWardrobeItem", item } : null;
  }
  if (value.type !== "createTripPlan" || !value.plan || typeof value.plan !== "object") return null;
  const plan = value.plan as Record<string, unknown>;
  if (typeof plan.scenario !== "string" || typeof plan.placeName !== "string" ||
      typeof plan.lat !== "number" || typeof plan.lon !== "number" ||
      typeof plan.startDate !== "string" || typeof plan.endDate !== "string") return null;
  return { type: "createTripPlan", plan: {
    scenario: plan.scenario, placeName: clean(plan.placeName, 200),
    ...(typeof plan.placeDetail === "string" ? { placeDetail: clean(plan.placeDetail, 300) } : {}),
    lat: plan.lat, lon: plan.lon, startDate: plan.startDate, endDate: plan.endDate,
  }};
}

/** Parse provider JSON; unknown actions degrade to an ordinary assistant reply. */
export function parseAssistantEnvelope(content: string): AssistantEnvelope {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  let raw: unknown;
  try { raw = JSON.parse((fenced ?? content).trim()); }
  catch { return { reply: content.trim(), actions: [] }; }
  if (!raw || typeof raw !== "object") return { reply: content.trim(), actions: [] };
  const envelope = raw as Record<string, unknown>;
  const actions = Array.isArray(envelope.actions)
    ? envelope.actions.map(parseAction).filter((a): a is AssistantAction => a !== null).slice(0, 5)
    : [];
  const reply = typeof envelope.reply === "string" && envelope.reply.trim()
    ? envelope.reply.trim() : "Done.";
  return { reply, actions };
}

export function executeAssistantActions(
  actions: AssistantAction[], ctx: AssistantActionContext
): { actions: ClientAssistantAction[]; errors: string[] } {
  const completed: ClientAssistantAction[] = [];
  const errors: string[] = [];
  for (const action of actions) {
    if (action.type === "navigate") { completed.push(action); continue; }
    if (action.type === "updateProfile") {
      const profile = validateProfile({ ...ctx.currentProfile(), ...action.profile });
      if (!profile.ok) { errors.push(profile.error); continue; }
      completed.push({ type: "profileUpdated", user: ctx.updateProfile(profile.values) });
      continue;
    }
    if (action.type === "addWardrobeItem") {
      ctx.wardrobe.add(ctx.userId, action.item);
      completed.push({ type: "wardrobeChanged" });
      continue;
    }
    if (action.type === "packingChecklist") {
      const { type: _type, ...packing } = action;
      completed.push({ type: "packingChanged", ...packing });
      continue;
    }
    if (action.type === "updateWardrobeItem") {
      if (!ctx.wardrobe.update(ctx.userId, action.id, action.patch)) errors.push("Wardrobe item not found.");
      else completed.push({ type: "wardrobeChanged" });
      continue;
    }
    if (action.type === "deleteWardrobeItem") {
      if (!ctx.wardrobe.remove(ctx.userId, action.id)) errors.push("Wardrobe item not found.");
      else completed.push({ type: "wardrobeChanged" });
      continue;
    }
    const p = action.plan;
    const coordinatesValid = Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
      p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
    if (!ctx.scenarioIds.has(p.scenario) || !p.placeName || !coordinatesValid ||
        !isIsoDate(p.startDate) || !isIsoDate(p.endDate) || p.endDate < p.startDate ||
        tripDayCount(p.startDate, p.endDate) > MAX_TRIP_DAYS) {
      errors.push("The trip details are incomplete or invalid.");
      continue;
    }
    ctx.tripPlans.save(ctx.userId, { ...p, placeDetail: p.placeDetail ?? "" });
    completed.push({ type: "tripCreated" }, { type: "navigate", page: "home" });
  }
  return { actions: completed, errors };
}
