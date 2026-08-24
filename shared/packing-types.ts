export type PackingItem = {
  id: string;
  label: string;
  labelEn: string;
  reuse: number;
  quantity?: number;
  daysUsed?: number[];
  wardrobeItemId?: string;
  /** 服务端判定的衣橱缺口；装备类永远为 false。 */
  wardrobeGap?: boolean;
  priority?: "core" | "support" | "optional";
};

export type PackingCategory = {
  id: string;
  title: string;
  titleEn: string;
  items: PackingItem[];
};

export type EssentialItem = {
  id: string;
  label: string;
  labelEn: string;
};

export type CorePiece = {
  id: string;
  label: string;
  labelEn: string;
  reuse: number;
};

export type PackingPlan = {
  /** 0 = 最少行李，100 = 最大穿搭变化。 */
  balance: number;
  tripDays: number;
  summary: string;
  summaryEn: string;
  categories: PackingCategory[];
  essentials: EssentialItem[];
  corePieces: CorePiece[];
};
