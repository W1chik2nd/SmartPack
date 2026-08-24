import { type IncomingMessage, type ServerResponse } from "node:http";
import type { TripPlanStore } from "./trip-plan.ts";
import type { WardrobeStore } from "./wardrobe.ts";
import { buildOutfitPlan } from "./outfit-plan.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  wardrobe: WardrobeStore;
  tripPlans: TripPlanStore;
  itinerary: import("./itinerary.ts").ItineraryStore;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  userFromHeader: () => { id: string } | null;
};

export async function handleOutfitRoutes(ctx: Ctx): Promise<boolean> {
  if (ctx.req.method !== "GET" || ctx.url.pathname !== "/api/outfit-plan") {
    return false;
  }
  const user = ctx.userFromHeader();
  if (!user) {
    ctx.json(ctx.res, 401, { error: "Not signed in." });
    return true;
  }
  const latestTrip = ctx.tripPlans.list(user.id)[0] ?? null;
  const linkedItinerary = latestTrip?.itineraryId
    ? ctx.itinerary.get(user.id, latestTrip.itineraryId)
    : null;
  const agentDays = linkedItinerary?.days.map((day) => ({
    date: day.dateLabel,
    place: day.city,
    scene: linkedItinerary.scenario,
    outfit: day.outfit,
  }));
  const plan = buildOutfitPlan(
    latestTrip,
    ctx.wardrobe.list(user.id),
    new Date(),
    agentDays
  );
  ctx.json(ctx.res, 200, { plan });
  return true;
}
