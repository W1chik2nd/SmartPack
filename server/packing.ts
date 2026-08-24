// SmartPack packing-plan generator.
//
// Architecture note (AGENTS.md §3): the entire packing plan is computed here
// on the server. The client sends only the user's slider value and renders
// whatever comes back — no packing rules, reuse math, or category logic live
// in the front end, so the future SwiftUI client reuses this untouched.
//
// This serves the "Minimal Luggage Plan" and "Travel Essentials Checklist"
// features (docs/personas-and-user-stories.md):
//   US 6.1 — the fewest items that still cover the whole trip
//   US 6.2 — show where each item is reused so the plan is trustworthy
//   US 6.3 — a slider trading outfit variety against luggage minimization
//   US 7.1 — a tickable checklist so nothing gets left behind
//   US 1.3 — surface how often each core piece is used

/** One line item on the checklist. `id` is stable so the client can key on it. */
export type PackingItem = {
  id: string;
  label: string;
  /** How many trip scenarios this piece covers — the reuse count (US 6.2). */
  reuse: number;
};

export type PackingCategory = {
  id: string;
  title: string;
  items: PackingItem[];
};

/** A non-clothing must-bring (US 7.1–7.3). */
export type EssentialItem = {
  id: string;
  label: string;
};

/** A most-reused hero piece surfaced as a card (sketch: 复用次数 / 核心单品). */
export type CorePiece = {
  id: string;
  label: string;
  reuse: number;
};

export type PackingPlan = {
  /** 0 = pack as light as possible · 100 = maximum outfit variety (US 6.3). */
  balance: number;
  /** Trip length the plan is sized for. TODO: derive from a real itinerary. */
  tripDays: number;
  summary: string;
  categories: PackingCategory[];
  essentials: EssentialItem[];
  corePieces: CorePiece[];
};

// The candidate wardrobe, per category, ordered most-versatile first. Packing
// "light" keeps the head of each list; adding variety extends toward the tail.
// TODO: replace this static seed with the user's real wardrobe + itinerary once
// those features land. Kept flat and readable on purpose (AGENTS.md §4).
type Candidate = { id: string; label: string };

const WARDROBE: { id: string; title: string; pool: Candidate[] }[] = [
  {
    id: "tops",
    title: "上衣 Tops",
    pool: [
      { id: "tee-white", label: "白色基础 T 恤" },
      { id: "shirt-oxford", label: "牛津纺衬衫" },
      { id: "knit-navy", label: "藏青针织衫" },
      { id: "tee-stripe", label: "条纹 T 恤" },
      { id: "blouse-silk", label: "真丝衬衫" },
    ],
  },
  {
    id: "bottoms",
    title: "下装 Bottoms",
    pool: [
      { id: "jeans-dark", label: "深色直筒牛仔裤" },
      { id: "chino-beige", label: "米色休闲裤" },
      { id: "skirt-black", label: "黑色半裙" },
      { id: "shorts-linen", label: "亚麻短裤" },
    ],
  },
  {
    id: "outer",
    title: "外套 Outerwear",
    pool: [
      { id: "blazer-navy", label: "藏青西装外套" },
      { id: "jacket-denim", label: "牛仔外套" },
      { id: "coat-trench", label: "风衣" },
    ],
  },
  {
    id: "shoes",
    title: "鞋履 Shoes",
    pool: [
      { id: "sneaker-white", label: "白色小白鞋" },
      { id: "loafer-black", label: "黑色乐福鞋" },
      { id: "sandal-tan", label: "棕色凉鞋" },
    ],
  },
];

// Non-clothing essentials always merged into every plan (US 7.1–7.3). The
// sketch calls these out explicitly: 身份证 / 护照 first.
const ESSENTIALS: EssentialItem[] = [
  { id: "id-card", label: "身份证" },
  { id: "passport", label: "护照" },
  { id: "charger", label: "手机充电器 / 充电宝" },
  { id: "adapter", label: "旅行转换插头" },
  { id: "umbrella", label: "折叠伞" },
  { id: "sunscreen", label: "防晒霜" },
  { id: "meds", label: "常备药品" },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * How many pieces to pack from a category's pool for a given balance.
 * balance 0 → 1 piece (leanest), balance 100 → the whole pool (most variety).
 * The pool length caps it so we never invent items we don't have.
 */
function countForBalance(poolSize: number, balance: number): number {
  const ratio = clamp(balance, 0, 100) / 100;
  const span = poolSize - 1;
  return 1 + Math.round(span * ratio);
}

/**
 * Reuse count for a piece: with `days` of wear spread over `pieces` items in a
 * category, each piece is worn roughly days/pieces times. Fewer pieces (lean
 * packing) pushes reuse up — exactly the trade-off the slider expresses (US 6.2).
 */
function reuseFor(days: number, pieces: number): number {
  return Math.max(1, Math.round(days / pieces));
}

/**
 * Build a complete packing plan for the given slider value. Pure and
 * deterministic: same balance in, same plan out — trivial to test and to call
 * from the API handler.
 */
export function buildPackingPlan(balance: number, tripDays = 4): PackingPlan {
  const b = clamp(Math.round(balance), 0, 100);

  const categories: PackingCategory[] = WARDROBE.map((cat) => {
    const take = countForBalance(cat.pool.length, b);
    const reuse = reuseFor(tripDays, take);
    return {
      id: cat.id,
      title: cat.title,
      items: cat.pool.slice(0, take).map((c) => ({
        id: c.id,
        label: c.label,
        reuse,
      })),
    };
  });

  // Core pieces = the most-reused items across all categories (the ones the
  // whole plan leans on). Cards in the sketch show up to four.
  const corePieces: CorePiece[] = categories
    .flatMap((cat) => cat.items)
    .sort((a, b) => b.reuse - a.reuse)
    .slice(0, 4)
    .map((item) => ({ id: item.id, label: item.label, reuse: item.reuse }));

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  const summary =
    b <= 33
      ? `精简模式:${totalItems} 件单品覆盖 ${tripDays} 天，高复用、行李最轻。`
      : b >= 67
      ? `造型模式:${totalItems} 件单品，每天都有新搭配、复用较低。`
      : `均衡模式:${totalItems} 件单品，兼顾变化与行李空间。`;

  return { balance: b, tripDays, summary, categories, essentials: ESSENTIALS, corePieces };
}
