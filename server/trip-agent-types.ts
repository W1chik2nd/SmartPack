import type { StopKind } from "./itinerary.ts";

export type OutfitItemKind = "top" | "bottom" | "shoes" | "accessory";

export type BilingualItem = {
  label: string;
  labelEn: string;
  /** Outfit items may point to the exact owned wardrobe piece. */
  wardrobeItemId?: string;
  kind?: OutfitItemKind;
  hasPhoto?: boolean;
}

export type GeneratedPackingItem = BilingualItem & {
  quantity: number;
  reuse: number;
  priority: "core" | "support" | "optional";
  daysUsed: number[];
  /** Exact wardrobe UUID when owned; empty means a genuine wardrobe gap. */
  wardrobeItemId: string;
};

export type GeneratedPackingCategory = {
  id: string;
  title: string;
  titleEn: string;
  items: GeneratedPackingItem[];
};

export type GeneratedPacking = {
  summary: string;
  summaryEn: string;
  categories: GeneratedPackingCategory[];
  essentials: BilingualItem[];
};

export type GeneratedStop = {
  kind: StopKind;
  name: string;
  nameEn: string;
  startTime: string;
  duration: string;
  note: string;
  noteEn: string;
  photoQuery: string;
};

export type GeneratedTripDay = {
  date: string;
  dateLabel: string;
  city: string;
  cityEn: string;
  summary: string;
  summaryEn: string;
  weatherSummary: string;
  weatherSummaryEn: string;
  weatherRisk: string;
  weatherRiskEn: string;
  outfit: BilingualItem[];
  equipment: BilingualItem[];
  stops: GeneratedStop[];
};

/** Strict structured output returned by the trip agent. */
export type GeneratedTripPlan = {
  title: string;
  titleEn: string;
  departLabel: string;
  days: GeneratedTripDay[];
  packing: GeneratedPacking;
};
