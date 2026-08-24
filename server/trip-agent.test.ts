import test from "node:test";
import assert from "node:assert/strict";
import {
  providerErrorMessage,
  structuredResponseRequestBody,
} from "./ai.ts";
import { tripPlanSchema } from "./trip-agent-prompt.ts";
import { normalizeGeneratedTrip } from "./trip-agent.ts";
import type { GeneratedTripPlan } from "./trip-agent-types.ts";

function generatedPlan(): GeneratedTripPlan {
  const stop = (name: string) => ({
    kind: "spot" as const,
    name,
    nameEn: name,
    startTime: "09:00",
    duration: "1h",
    note: "步行前往",
    noteEn: "Walk there",
    photoQuery: name,
  });
  return {
    title: "京都旅行",
    titleEn: "Kyoto trip",
    departLabel: "9.1",
    days: [
      {
        date: "2026-09-01",
        dateLabel: "9.1",
        city: "京都",
        cityEn: "Kyoto",
        summary: "文化散步",
        summaryEn: "Culture walk",
        weatherSummary: "18–25°C",
        weatherSummaryEn: "18–25°C",
        weatherRisk: "午后有雨",
        weatherRiskEn: "Afternoon rain",
        outfit: [
          { label: "衬衫", labelEn: "Shirt" },
          { label: "长裤", labelEn: "Trousers" },
        ],
        equipment: [{ label: "折叠伞", labelEn: "Umbrella" }],
        stops: [stop("伏见稻荷"), stop("锦市场"), stop("祇园")],
      },
    ],
    packing: {
      summary: "一只登机箱",
      summaryEn: "One carry-on",
      categories: [
        {
          id: "tops",
          title: "上装",
          titleEn: "Tops",
          items: [
            {
              label: "衬衫",
              labelEn: "Shirt",
              quantity: 1,
              reuse: 1,
              priority: "core",
              daysUsed: [1],
              wardrobeItemId: "",
            },
          ],
        },
      ],
      essentials: [{ label: "护照", labelEn: "Passport" }],
    },
  };
}

test("Terra strict schema omits unsupported minLength", () => {
  const schema = JSON.stringify(tripPlanSchema(3));
  assert.doesNotMatch(schema, /"minLength"/);
  assert.match(schema, /"minItems"/);
});

test("backend identifies critical blank text but allows wardrobe gaps", () => {
  const valid = generatedPlan();
  const normalized = normalizeGeneratedTrip(valid, ["2026-09-01"], []);
  assert.equal(normalized.packing.categories[0].items[0].wardrobeItemId, "");

  const blank = generatedPlan();
  blank.days[0].city = "  ";
  assert.throws(
    () => normalizeGeneratedTrip(blank, ["2026-09-01"], []),
    /empty required text field at \$\.days\[0\]\.city/
  );
});

test("backend repairs safe empty notes, risks, labels, and photo queries", () => {
  const plan = generatedPlan();
  plan.departLabel = "";
  plan.days[0].dateLabel = " ";
  plan.days[0].weatherRisk = "";
  plan.days[0].weatherRiskEn = "";
  plan.days[0].stops[0].note = "";
  plan.days[0].stops[0].noteEn = "";
  plan.days[0].stops[0].photoQuery = "";

  const normalized = normalizeGeneratedTrip(plan, ["2026-09-01"], []);
  assert.equal(normalized.departLabel, "09-01");
  assert.equal(normalized.days[0].dateLabel, "09-01");
  assert.match(normalized.days[0].weatherRiskEn, /No specific weather risk/);
  assert.equal(normalized.days[0].stops[0].photoQuery, "伏见稻荷 Kyoto");
});

test("provider error detail is compact, bounded, and shape-checked", () => {
  assert.equal(
    providerErrorMessage({ error: { message: "  Invalid\n schema  " } }),
    "Invalid schema"
  );
  assert.equal(providerErrorMessage({ error: { message: 401 } }), null);
  assert.equal(
    providerErrorMessage({ error: { message: "x".repeat(800) } })?.length,
    500
  );
});

test("third-party Responses gateways omit OpenAI-only safety identifier", () => {
  const options = {
    instructions: "Plan a trip",
    input: { destination: "Kyoto" },
    schema: { type: "object" },
    safetyIdentifier: "user-123",
  };

  const compatible = structuredResponseRequestBody(
    options,
    "https://api.openai-next.com/v1",
    "gpt-5.6-terra"
  );
  assert.equal("safety_identifier" in compatible, false);

  const official = structuredResponseRequestBody(
    options,
    "https://api.openai.com/v1",
    "gpt-5.6-terra"
  );
  assert.equal(official.safety_identifier, "user-123");
});
