// Database context added to the assistant prompt. Recommendations and actions
// should use real user data rather than guessing wardrobe ids or existing trips.
import type { WardrobeItem } from "./wardrobe.ts";
import type { TripPlan } from "./trip-plan.ts";

function compactWardrobe(items: WardrobeItem[]): unknown[] {
  return items.map((item) => ({
    id: item.id,
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
  }));
}

function compactTrips(plans: TripPlan[]): unknown[] {
  return plans.map((plan) => ({
    id: plan.id,
    scenario: plan.scenario,
    placeName: plan.placeName,
    placeDetail: plan.placeDetail,
    startDate: plan.startDate,
    endDate: plan.endDate,
  }));
}

export function assistantDataContext(
  wardrobeItems: WardrobeItem[], tripPlans: TripPlan[]
): string {
  const wardrobe = compactWardrobe(wardrobeItems);
  const trips = compactTrips(tripPlans);
  return `\n\n## Current database data\nWardrobe items: ${JSON.stringify(wardrobe)}\nSaved trip plans: ${JSON.stringify(trips)}\nUse these exact ids for updates/deletes. An empty array means there is no saved data.`;
}
