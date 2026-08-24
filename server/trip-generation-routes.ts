import { type IncomingMessage, type ServerResponse } from "node:http";
import { aiConfigured } from "./ai.ts";
import type { ItineraryStore } from "./itinerary.ts";
import type { PackingPlanStore } from "./packing-store.ts";
import type { TripPlanStore } from "./trip-plan.ts";
import { parseTripInput, tripDayCount } from "./trip-input.ts";
import type { GenerateTrip, TripAgentInput } from "./trip-agent.ts";
import type { WardrobeStore } from "./wardrobe.ts";

type AgentUser = TripAgentInput["user"];

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  scenarioIds: ReadonlySet<string>;
  tripPlans: TripPlanStore;
  itinerary: ItineraryStore;
  packingPlans: PackingPlanStore;
  wardrobe: WardrobeStore;
  generateTrip: GenerateTrip;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  userFromHeader: () => AgentUser | null;
};

/** Queue and persist one complete, linked SmartPack travel decision. */
export async function handleTripGenerationRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, json } = ctx;
  if (req.method !== "POST" || url.pathname !== "/api/trip-plans/generate") {
    return false;
  }

  const user = ctx.userFromHeader();
  if (!user) {
    json(res, 401, { error: "Not signed in." });
    return true;
  }
  const parsed = parseTripInput(await ctx.readBody(req), ctx.scenarioIds);
  if (!parsed.ok) {
    json(res, 400, { error: parsed.error });
    return true;
  }
  if (!aiConfigured()) {
    json(res, 503, {
      error:
        "旅行 Agent 尚未配置。请在 server/.env 填写 AI_API_KEY 后重试。",
    });
    return true;
  }

  const plan = ctx.tripPlans.save(user.id, parsed.plan);
  ctx.tripPlans.markGenerating(user.id, plan.id);
  plan.generationStatus = "processing";
  const wardrobe = ctx.wardrobe.list(user.id);

  // Return before the model call starts. The saved plan and its status remain
  // visible across page changes; clients can poll the normal trip list.
  json(res, 202, { plan });
  setImmediate(() => {
    void ctx
      .generateTrip({ user, plan: parsed.plan, wardrobe })
      .then((generated) => {
        // The user may delete a processing trip while the model is running.
        // In that case discard the answer instead of recreating orphan data.
        if (!ctx.tripPlans.get(user.id, plan.id)) return;
        const itinerary = ctx.itinerary.saveGenerated(
          user.id,
          plan.id,
          plan.scenario,
          generated
        );
        ctx.packingPlans.save(
          user.id,
          plan.id,
          tripDayCount(plan.startDate, plan.endDate),
          generated.packing
        );
        ctx.tripPlans.attachItinerary(user.id, plan.id, itinerary.id);
      })
      .catch((error: any) => {
        const message = String(
          error?.message ?? "旅行 Agent 生成失败,请稍后重试。"
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500);
        ctx.tripPlans.markFailed(user.id, plan.id, message);
      });
  });
  return true;
}
