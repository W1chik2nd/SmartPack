// Profile questionnaire: the option catalog and its validation.
//
// Architecture note (AGENTS.md §3): the catalog and every rule about what a
// valid answer is live here, on the server. The web client renders whatever
// GET /api/profile-options returns, and the future SwiftUI client will render
// the same payload — no option list is duplicated in a front end.
//
// Only name/age/height/weight are required (they gate account creation).
// Everything else sharpens recommendations (US 2.1–2.3: dressing preference
// learning) but must never block sign-up, so those columns are nullable.

/** A selectable answer. `id` is the stored value; labels are for display. */
export type Option = { id: string; en: string; zh: string };

/**
 * text/int/decimal are typed inputs; single is one choice; multi is a set of
 * choices stored as a JSON array (SQLite has no array type — same convention
 * as wardrobe_items.colors).
 */
export type FieldKind = "text" | "int" | "decimal" | "single" | "multi";

export type FieldSpec = {
  key: string;
  /** users table column. Multi fields hold a JSON array of option ids. */
  column: string;
  kind: FieldKind;
  required: boolean;
  /** English label, used only in server-side error messages. */
  label: string;
  min?: number;
  max?: number;
  options?: Option[];
  /**
   * Set on fields offering the OTHER option: the column holding the user's own
   * wording. Kept in its own column rather than as a synthetic option id so the
   * catalog stays a fixed vocabulary — free text never becomes an option id
   * the recommendation engine has to guess at.
   */
  otherColumn?: string;
  /** Max length of that free text. */
  otherMax?: number;
};

/**
 * The escape hatch for the two habit questions: a fixed catalog cannot cover
 * how everyone dresses or packs, and forcing a wrong pick is worse than
 * letting them say it themselves.
 */
export const OTHER_ID = "other";

const OTHER: Option = { id: OTHER_ID, en: "Other (write your own)", zh: "其他(可自己填写)" };

const BODY_TYPES: Option[] = [
  { id: "hourglass", en: "Hourglass", zh: "沙漏型" },
  { id: "pear", en: "Pear", zh: "梨形" },
  { id: "apple", en: "Apple", zh: "苹果型" },
  { id: "h-shape", en: "H-shape", zh: "H 形" },
  { id: "inverted-triangle", en: "Inverted triangle", zh: "倒三角" },
];

// 四季型人 — the seasonal color analysis used by stylists.
const SEASON_COLOR_TYPES: Option[] = [
  { id: "spring", en: "Spring (warm, light)", zh: "春季型(暖·浅)" },
  { id: "summer", en: "Summer (cool, light)", zh: "夏季型(冷·浅)" },
  { id: "autumn", en: "Autumn (warm, deep)", zh: "秋季型(暖·深)" },
  { id: "winter", en: "Winter (cool, deep)", zh: "冬季型(冷·深)" },
];

const STYLE_PREFS: Option[] = [
  { id: "business", en: "Business", zh: "商务" },
  { id: "casual", en: "Casual", zh: "休闲" },
  { id: "streetwear", en: "Streetwear", zh: "街头" },
  { id: "minimalist", en: "Minimalist", zh: "极简" },
  { id: "outdoor", en: "Outdoor", zh: "户外" },
  { id: "elegant", en: "Elegant", zh: "优雅" },
  { id: "sporty", en: "Sporty", zh: "运动" },
  { id: "vintage", en: "Vintage", zh: "复古" },
];

// 穿着体感 — temperature sensitivity and fit comfort (US 2.2: "I feel colder
// than average"). These directly change how much layering we recommend.
const WEAR_FEEL: Option[] = [
  { id: "runs-cold", en: "Feels cold easily", zh: "怕冷" },
  { id: "runs-hot", en: "Feels hot easily", zh: "怕热" },
  { id: "prefers-loose", en: "Prefers loose fits", zh: "偏好宽松" },
  { id: "prefers-fitted", en: "Prefers fitted cuts", zh: "偏好修身" },
  { id: "needs-stretch", en: "Needs stretchy fabric", zh: "需要弹性面料" },
  { id: "dislikes-tight-waist", en: "Dislikes tight waistbands", zh: "不喜欢紧腰" },
  { id: "sensitive-skin", en: "Needs soft, non-itchy fabric", zh: "皮肤敏感,要柔软面料" },
  { id: "no-shorts", en: "Never wears shorts", zh: "从不穿短裤" },
  { id: "no-heels", en: "Never wears heels", zh: "从不穿高跟鞋" },
  OTHER,
];

// 出行与打包习惯 — feeds the minimal luggage plan (README core feature 6).
// Required, because cut, sizing and fit conventions differ by it — but
// "prefer not to say" is a real answer, not a gap: nobody is forced to
// disclose, and recommendations fall back to neutral fits for that case.
const GENDERS: Option[] = [
  { id: "female", en: "Female", zh: "女" },
  { id: "male", en: "Male", zh: "男" },
  { id: "non-binary", en: "Non-binary", zh: "非二元" },
  { id: "undisclosed", en: "Prefer not to say", zh: "不愿透露" },
];

const TRAVEL_HABITS: Option[] = [
  { id: "carry-on-only", en: "Carry-on only", zh: "只带登机箱" },
  { id: "packs-light", en: "Packs light", zh: "习惯少带" },
  { id: "checks-bags", en: "Usually checks a bag", zh: "通常托运" },
  { id: "does-laundry", en: "Does laundry on longer trips", zh: "长途会洗衣服" },
  { id: "shops-at-destination", en: "Shops at the destination", zh: "到当地会买衣服" },
  { id: "packs-spares", en: "Always packs a spare outfit", zh: "总带备用一套" },
  { id: "frequent-business", en: "Travels for work often", zh: "经常出差" },
  OTHER,
];

/**
 * The questionnaire, in display order. Required fields come first because the
 * client renders them as the mandatory block.
 */
export const PROFILE_FIELDS: FieldSpec[] = [
  { key: "name", column: "name", kind: "text", required: true, label: "name", max: 60 },
  {
    key: "gender",
    column: "gender",
    kind: "single",
    required: true,
    label: "gender",
    options: GENDERS,
  },
  { key: "age", column: "age", kind: "int", required: true, label: "age", min: 1, max: 120 },
  {
    key: "heightCm",
    column: "height_cm",
    kind: "decimal",
    required: true,
    label: "height in cm",
    min: 50,
    max: 280,
  },
  {
    key: "weightKg",
    column: "weight_kg",
    kind: "decimal",
    required: true,
    label: "weight in kg",
    min: 10,
    max: 400,
  },
  {
    key: "bustCm",
    column: "bust_cm",
    kind: "decimal",
    required: false,
    label: "bust in cm",
    min: 30,
    max: 250,
  },
  {
    key: "waistCm",
    column: "waist_cm",
    kind: "decimal",
    required: false,
    label: "waist in cm",
    min: 30,
    max: 250,
  },
  {
    key: "hipCm",
    column: "hip_cm",
    kind: "decimal",
    required: false,
    label: "hip in cm",
    min: 30,
    max: 250,
  },
  {
    key: "bodyType",
    column: "body_type",
    kind: "single",
    required: false,
    label: "body type",
    options: BODY_TYPES,
  },
  {
    key: "seasonColorType",
    column: "season_color_type",
    kind: "single",
    required: false,
    label: "seasonal color type",
    options: SEASON_COLOR_TYPES,
  },
  {
    key: "stylePrefs",
    column: "style_prefs",
    kind: "multi",
    required: false,
    label: "style preferences",
    options: STYLE_PREFS,
  },
  {
    key: "wearFeel",
    column: "wear_feel",
    kind: "multi",
    required: false,
    label: "wear comfort preferences",
    options: WEAR_FEEL,
    otherColumn: "wear_feel_other",
    otherMax: 200,
  },
  {
    key: "travelHabits",
    column: "travel_habits",
    kind: "multi",
    required: false,
    label: "travel and packing habits",
    options: TRAVEL_HABITS,
    otherColumn: "travel_habits_other",
    otherMax: 200,
  },
];

function sqlType(kind: FieldKind): string {
  if (kind === "int") return "INTEGER";
  if (kind === "decimal") return "REAL";
  return "TEXT";
}

/**
 * Columns the users table needs beyond the original account fields, for the
 * in-place ALTER TABLE patch in app.ts. `style` is the pre-questionnaire
 * single-choice column: kept so old rows (and old dev databases) stay
 * readable — prompts.ts falls back to it when style_prefs is empty.
 */
export const PROFILE_COLUMNS: readonly (readonly [string, string])[] = [
  ...PROFILE_FIELDS.filter((f) => f.column !== "name").flatMap((f) => [
    [f.column, sqlType(f.kind)] as const,
    // A field offering OTHER needs its free-text column alongside it.
    ...(f.otherColumn ? [[f.otherColumn, "TEXT"] as const] : []),
  ]),
  ["style", "TEXT"] as const,
];

/** What GET /api/profile-options returns: the catalog minus server internals. */
export function profileOptionsPayload() {
  return {
    fields: PROFILE_FIELDS.map((f) => ({
      key: f.key,
      kind: f.kind,
      required: f.required,
      ...(f.min != null ? { min: f.min } : {}),
      ...(f.max != null ? { max: f.max } : {}),
      ...(f.options ? { options: f.options } : {}),
      // Tells the client to show a text box when OTHER is picked, and how long
      // it may be. The id itself is published so no client hardcodes "other".
      ...(f.otherColumn
        ? { otherId: OTHER_ID, otherKey: `${f.key}Other`, otherMax: f.otherMax }
        : {}),
    })),
  };
}

export type ProfileValues = Record<string, string | number | null>;

export type ValidationResult =
  | { ok: true; values: ProfileValues }
  | { ok: false; error: string };

function invalid(field: FieldSpec): { ok: false; error: string } {
  return { ok: false, error: `Please enter a valid ${field.label}.` };
}

function blank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function checkNumber(field: FieldSpec, raw: unknown): number | null {
  // Strings are rejected on purpose: the client parses inputs before sending,
  // so a string here means a real client bug, not a user typo to coerce away.
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (field.kind === "int" && !Number.isInteger(raw)) return null;
  if (field.min != null && raw < field.min) return null;
  if (field.max != null && raw > field.max) return null;
  return raw;
}

function checkMulti(field: FieldSpec, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = field.options!.map((o) => o.id);
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string" || !ids.includes(v) || seen.has(v)) return null;
    seen.add(v);
  }
  return [...seen];
}

/**
 * Trust boundary (AGENTS.md §4): the one place questionnaire answers from a
 * request body are checked. Returns values keyed by database column so the
 * caller can insert them directly.
 */
export function validateProfile(body: Record<string, unknown>): ValidationResult {
  const values: ProfileValues = {};

  for (const field of PROFILE_FIELDS) {
    const raw = body[field.key];

    if (blank(raw) || (field.kind === "multi" && Array.isArray(raw) && raw.length === 0)) {
      if (field.required) return invalid(field);
      // Unanswered optional fields stay NULL — "not filled in" must be
      // distinguishable from "answered with nothing".
      values[field.column] = null;
      if (field.otherColumn) values[field.otherColumn] = null;
      continue;
    }

    if (field.kind === "text") {
      if (typeof raw !== "string") return invalid(field);
      const text = raw.trim();
      if (field.max != null && text.length > field.max) return invalid(field);
      values[field.column] = text;
      continue;
    }

    if (field.kind === "int" || field.kind === "decimal") {
      const n = checkNumber(field, raw);
      if (n === null) return invalid(field);
      values[field.column] = n;
      continue;
    }

    if (field.kind === "single") {
      if (typeof raw !== "string" || !field.options!.some((o) => o.id === raw)) {
        return invalid(field);
      }
      values[field.column] = raw;
      continue;
    }

    const list = checkMulti(field, raw);
    if (list === null) return invalid(field);
    values[field.column] = JSON.stringify(list);

    if (field.otherColumn) {
      // Free text counts only when OTHER is actually picked; otherwise it is
      // leftover state from a box the user unchecked, and storing it would put
      // a preference in the profile that the user did not select.
      const text = body[`${field.key}Other`];
      if (!list.includes(OTHER_ID) || blank(text)) {
        values[field.otherColumn] = null;
      } else if (typeof text !== "string") {
        return invalid(field);
      } else {
        const trimmed = text.trim();
        if (trimmed.length > field.otherMax!) return invalid(field);
        values[field.otherColumn] = trimmed;
      }
    }
  }

  return { ok: true, values };
}

/** Option ids → English labels, for the assistant's system prompt. */
export function optionLabels(key: string, ids: string[]): string[] {
  const options = PROFILE_FIELDS.find((f) => f.key === key)?.options ?? [];
  return ids.map((id) => options.find((o) => o.id === id)?.en ?? id);
}
