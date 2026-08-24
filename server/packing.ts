// WearRoute packing-plan generator.
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
import type {
  CorePiece,
  EssentialItem,
  PackingCategory,
  PackingItem,
  PackingPlan,
} from "../shared/packing-types.ts";

export type {
  CorePiece,
  EssentialItem,
  PackingCategory,
  PackingItem,
  PackingPlan,
} from "../shared/packing-types.ts";

export type StoredGeneratedPacking = {
  summary: string;
  summaryEn: string;
  categories: (Omit<PackingCategory, "items"> & {
    items: Required<
      Pick<
        PackingItem,
        | "id"
        | "label"
        | "labelEn"
        | "reuse"
        | "quantity"
        | "daysUsed"
        | "wardrobeItemId"
        | "priority"
      >
    >[];
  })[];
  essentials: EssentialItem[];
};

// The candidate wardrobe, per category, ordered most-versatile first. Packing
// "light" keeps the head of each list; adding variety extends toward the tail.
// TODO: replace this static seed with the user's real wardrobe + itinerary once
// those features land. Kept flat and readable on purpose (AGENTS.md §4).
type Candidate = { id: string; label: string; labelEn: string };

const WARDROBE: { id: string; title: string; titleEn: string; pool: Candidate[] }[] = [
  {
    id: "tops",
    title: "上衣 Tops",
    titleEn: "Tops",
    pool: [
      { id: "tee-white", label: "白色基础 T 恤", labelEn: "White basic tee" },
      { id: "shirt-oxford", label: "牛津纺衬衫", labelEn: "Oxford shirt" },
      { id: "knit-navy", label: "藏青针织衫", labelEn: "Navy knit sweater" },
      { id: "tee-stripe", label: "条纹 T 恤", labelEn: "Striped tee" },
      { id: "blouse-silk", label: "真丝衬衫", labelEn: "Silk blouse" },
    ],
  },
  {
    id: "bottoms",
    title: "下装 Bottoms",
    titleEn: "Bottoms",
    pool: [
      { id: "jeans-dark", label: "深色直筒牛仔裤", labelEn: "Dark straight jeans" },
      { id: "chino-beige", label: "米色休闲裤", labelEn: "Beige chinos" },
      { id: "skirt-black", label: "黑色半裙", labelEn: "Black skirt" },
      { id: "shorts-linen", label: "亚麻短裤", labelEn: "Linen shorts" },
    ],
  },
  {
    id: "outer",
    title: "外套 Outerwear",
    titleEn: "Outerwear",
    pool: [
      { id: "blazer-navy", label: "藏青西装外套", labelEn: "Navy blazer" },
      { id: "jacket-denim", label: "牛仔外套", labelEn: "Denim jacket" },
      { id: "coat-trench", label: "风衣", labelEn: "Trench coat" },
    ],
  },
  {
    id: "shoes",
    title: "鞋履 Shoes",
    titleEn: "Shoes",
    pool: [
      { id: "sneaker-white", label: "白色小白鞋", labelEn: "White sneakers" },
      { id: "loafer-black", label: "黑色乐福鞋", labelEn: "Black loafers" },
      { id: "sandal-tan", label: "棕色凉鞋", labelEn: "Tan sandals" },
    ],
  },
];

// Non-clothing essentials always merged into every plan (US 7.1–7.3). The
// sketch calls these out explicitly: 身份证 / 护照 first.
const ESSENTIALS: EssentialItem[] = [
  { id: "id-card", label: "身份证", labelEn: "ID card" },
  { id: "passport", label: "护照", labelEn: "Passport" },
  { id: "charger", label: "手机充电器 / 充电宝", labelEn: "Phone charger / power bank" },
  { id: "adapter", label: "旅行转换插头", labelEn: "Travel adapter" },
  { id: "umbrella", label: "折叠伞", labelEn: "Foldable umbrella" },
  { id: "sunscreen", label: "防晒霜", labelEn: "Sunscreen" },
  { id: "meds", label: "常备药品", labelEn: "Everyday medicine" },
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
      titleEn: cat.titleEn,
      items: cat.pool.slice(0, take).map((c) => ({
        id: c.id,
        label: c.label,
        labelEn: c.labelEn,
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
    .map((item) => ({
      id: item.id,
      label: item.label,
      labelEn: item.labelEn,
      reuse: item.reuse,
    }));

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  const summary =
    b <= 33
      ? `精简模式:${totalItems} 件单品覆盖 ${tripDays} 天，高复用、行李最轻。`
      : b >= 67
      ? `造型模式:${totalItems} 件单品，每天都有新搭配、复用较低。`
      : `均衡模式:${totalItems} 件单品，兼顾变化与行李空间。`;
  const summaryEn =
    b <= 33
      ? `Lean mode: ${totalItems} pieces for ${tripDays} days — high reuse, lightest bag.`
      : b >= 67
      ? `Style mode: ${totalItems} pieces, a fresh look every day with lower reuse.`
      : `Balanced mode: ${totalItems} pieces balancing variety and luggage space.`;

  return {
    balance: b,
    tripDays,
    summary,
    summaryEn,
    categories,
    essentials: ESSENTIALS,
    corePieces,
  };
}

/**
 * 不来自衣橱的分类。充电宝、转换插头这类东西衣柜里根本不会有,空的
 * wardrobeItemId 只说明它不是衣服,不是「缺口」。分类 id 的全部取值见
 * trip-agent-prompt.ts 里 packing.categories 的 enum。
 */
const GEAR_CATEGORIES = new Set(["equipment"]);

/**
 * Apply the existing variety/light slider to the agent's prioritized list.
 * The agent makes the semantic recommendation; this deterministic server rule
 * only reveals support/optional pieces as the user asks for more variety.
 */
export function buildGeneratedPackingPlan(
  source: StoredGeneratedPacking,
  balance: number,
  tripDays: number
): PackingPlan {
  const b = clamp(Math.round(balance), 0, 100);
  const include = (priority: "core" | "support" | "optional") =>
    priority === "core" ||
    (priority === "support" && b >= 34) ||
    (priority === "optional" && b >= 67);
  const categories = source.categories
    .map((category) => {
      const gear = GEAR_CATEGORIES.has(category.id);
      return {
        ...category,
        items: category.items
          .filter((item) => include(item.priority))
          .map((item) => ({
            ...item,
            wardrobeGap: !gear && !item.wardrobeItemId,
          })),
      };
    })
    .filter((category) => category.items.length > 0);
  const corePieces = categories
    .flatMap((category) => category.items)
    .sort((a, b) => b.reuse - a.reuse)
    .slice(0, 4)
    .map(({ id, label, labelEn, reuse }) => ({ id, label, labelEn, reuse }));

  return {
    balance: b,
    tripDays,
    summary: source.summary,
    summaryEn: source.summaryEn,
    categories,
    essentials: source.essentials,
    corePieces,
  };
}
