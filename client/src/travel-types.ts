export type StopKind = "spot" | "transit" | "meal" | "hotel";

export type TripStop = {
  id: string;
  position: number;
  kind: StopKind;
  name: string;
  nameEn: string;
  startTime: string;
  duration: string;
  note: string;
  noteEn: string;
  photoQuery: string;
  photoUrl: string | null;
  photoCredit: string | null;
  photoSourceUrl: string | null;
};

export type TripDay = {
  id: string;
  dayNumber: number;
  dateLabel: string;
  city: string;
  cityEn: string;
  summary: string;
  summaryEn: string;
  weatherSummary: string;
  weatherSummaryEn: string;
  weatherRisk: string;
  weatherRiskEn: string;
  outfit: { label: string; labelEn: string }[];
  equipment: { label: string; labelEn: string }[];
  stops: TripStop[];
};

export type Trip = {
  id: string;
  title: string;
  titleEn: string;
  scenario: string;
  departLabel: string;
  createdAt: string;
  sourcePlanId: string | null;
  days: TripDay[];
};

export type StopPhoto = {
  imageUrl: string;
  credit: string;
  sourceUrl: string;
};

export type PackingItem = {
  id: string;
  label: string;
  labelEn: string;
  reuse: number;
  quantity?: number;
  daysUsed?: number[];
  wardrobeItemId?: string;
  priority?: "core" | "support" | "optional";
};

export type PackingCategory = {
  id: string;
  title: string;
  titleEn: string;
  items: PackingItem[];
};

export type EssentialItem = { id: string; label: string; labelEn: string };

export type CorePiece = {
  id: string;
  label: string;
  labelEn: string;
  reuse: number;
};

export type PackingPlan = {
  balance: number;
  tripDays: number;
  summary: string;
  summaryEn: string;
  categories: PackingCategory[];
  essentials: EssentialItem[];
  corePieces: CorePiece[];
};

export type Place = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
};

export type TripPlan = {
  id: string;
  scenario: string;
  placeName: string;
  placeDetail: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  notes: string;
  itineraryId: string | null;
  createdAt: string;
};

export type NewTripPlan = Omit<TripPlan, "id" | "createdAt" | "itineraryId">;
