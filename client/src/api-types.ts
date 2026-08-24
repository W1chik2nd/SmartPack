import type { WardrobeItem } from "../../shared/wardrobe-types";
import type { OutfitPiece } from "../../shared/outfit-types";

export type { WardrobeItem } from "../../shared/wardrobe-types";
export type WardrobeDisplayItem = WardrobeItem & { visual: OutfitPiece };
export type {
  ForecastDay,
  TripWeather,
  Weather,
} from "../../shared/weather-types";

export type User = {
  id: string;
  email: string;
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  style: string | null;
  gender: string | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  bodyType: string | null;
  seasonColorType: string | null;
  stylePrefs: string[];
  wearFeel: string[];
  wearFeelOther: string | null;
  travelHabits: string[];
  travelHabitsOther: string | null;
};

/** Step-1 credentials, held in memory until the questionnaire completes. */
export type Credentials = {
  email: string;
  password: string;
};

/**
 * Keyed by the field catalog published from /api/profile-options so adding a
 * questionnaire item does not require a new client-side property.
 */
export type Profile = Record<string, string | number | string[]>;
export type ProfileUpdate = Profile;

export type ProfileOption = {
  id: string;
  en: string;
  zh: string;
};

export type ProfileField = {
  key: string;
  kind: "text" | "int" | "decimal" | "single" | "multi";
  required: boolean;
  min?: number;
  max?: number;
  options?: ProfileOption[];
  otherId?: string;
  otherKey?: string;
  otherMax?: number;
};

export type Scenario = {
  id: string;
  label: string;
  image: string;
};

export type Product = {
  title: string;
  imageUrl: string;
  price: string;
  url: string;
};

export type RecognizeResponse = {
  item: WardrobeDisplayItem;
  provider: "jd" | "taobao" | null;
  products: Product[];
  productsError?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantPage =
  | "home"
  | "trips"
  | "tripSetup"
  | "itinerary"
  | "wardrobe"
  | "profile"
  | "packing";

export type AssistantClientAction =
  | { type: "navigate"; page: AssistantPage; scenario?: string }
  | { type: "profileUpdated"; user: User }
  | { type: "wardrobeChanged" }
  | { type: "tripCreated" }
  | {
      type: "packingChanged";
      balance?: number;
      checked?: string[];
      unchecked?: string[];
    };

export type TripGenerationEstimate = {
  minSeconds: number;
  maxSeconds: number;
};
