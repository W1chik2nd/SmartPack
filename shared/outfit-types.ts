export type OutfitPieceKind = "top" | "bottom" | "shoes" | "accessory";

export type OutfitTone =
  | "red"
  | "yellow"
  | "blue"
  | "black"
  | "white"
  | "green"
  | "brown"
  | "gray"
  | "beige";

export type OutfitFit = "slim" | "regular" | "relaxed";
export type OutfitMaterial =
  | "cotton"
  | "knit"
  | "denim"
  | "leather"
  | "linen"
  | "technical"
  | "other";
export type AccessoryStyle =
  | "bag"
  | "hat"
  | "glasses"
  | "scarf"
  | "watch"
  | "necklace";
export type GarmentStyle =
  | "tee"
  | "shirt"
  | "knit"
  | "trousers"
  | "skirt"
  | "jeans"
  | "loafers"
  | "sneakers";

export type OutfitPiece = {
  id: string;
  kind: OutfitPieceKind;
  label: string;
  labelEn: string;
  tone: OutfitTone;
  garmentStyle: GarmentStyle | null;
  accessoryStyle: AccessoryStyle | null;
  fit: OutfitFit | null;
  material: OutfitMaterial | null;
  detail: string;
  wardrobeItemId: string | null;
  hasPhoto: boolean;
};

export type OutfitDay = {
  id: string;
  dayNumber: number;
  date: string;
  place: string;
  placeEn: string;
  scene: string;
  pieces: OutfitPiece[];
};

export type OutfitPlan = {
  destination: string;
  destinationDetail: string;
  scenario: string;
  startDate: string;
  endDate: string;
  lat: number;
  lon: number;
  usesWardrobe: boolean;
  days: OutfitDay[];
};
