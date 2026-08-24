// 穿搭详情页的数据模型与生成逻辑。
//
// 这里把「行程 + 用户衣橱 → 分日穿搭」放在后端，Web 与未来 iOS 都只需
// 渲染同一个结果。当前算法刻意简单：按品类轮换真实衣橱单品；某一品类为空
// 时给出明确的基础建议，而不是伪造一个属于用户衣橱的单品。
import type { TripPlan } from "./trip-plan.ts";
import type { WardrobeItem } from "./wardrobe.ts";
import { DEFAULT_COORDS } from "./weather.ts";

export type OutfitPieceKind = "top" | "bottom" | "shoes" | "accessory";
export type OutfitTone = "red" | "yellow" | "blue" | "black" | "white";
export type AccessoryStyle = "bag" | "hat" | "glasses" | "scarf" | "watch" | "necklace";
export type GarmentStyle = "tee" | "shirt" | "knit" | "trousers" | "skirt" | "jeans" | "loafers" | "sneakers";

export type OutfitPiece = {
  id: string;
  kind: OutfitPieceKind;
  label: string;
  labelEn: string;
  tone: OutfitTone;
  garmentStyle: GarmentStyle | null;
  accessoryStyle: AccessoryStyle | null;
  wardrobeItemId: string | null;
  hasPhoto: boolean;
};

export type OutfitDay = {
  id: string;
  dayNumber: number;
  date: string;
  place: string;
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

type Candidate = OutfitPiece;

const FALLBACKS: Record<OutfitPieceKind, Candidate[]> = {
  top: [
    piece("suggested-red-tee", "top", "红色基础 T 恤", "Red basic tee", "red", { garmentStyle: "tee" }),
    piece("suggested-white-shirt", "top", "白色衬衫", "White shirt", "white", { garmentStyle: "shirt" }),
    piece("suggested-yellow-knit", "top", "黄色针织上衣", "Yellow knit top", "yellow", { garmentStyle: "knit" }),
  ],
  bottom: [
    piece("suggested-blue-trousers", "bottom", "藏蓝直筒裤", "Navy trousers", "blue", { garmentStyle: "trousers" }),
    piece("suggested-black-skirt", "bottom", "黑色半裙", "Black skirt", "black", { garmentStyle: "skirt" }),
    piece("suggested-white-jeans", "bottom", "白色牛仔裤", "White jeans", "white", { garmentStyle: "jeans" }),
  ],
  shoes: [
    piece("suggested-black-loafers", "shoes", "黑色乐福鞋", "Black loafers", "black", { garmentStyle: "loafers" }),
    piece("suggested-white-sneakers", "shoes", "白色运动鞋", "White sneakers", "white", { garmentStyle: "sneakers" }),
  ],
  accessory: [
    piece("suggested-yellow-bag", "accessory", "黄色随身包", "Yellow day bag", "yellow", { accessoryStyle: "bag" }),
    piece("suggested-blue-hat", "accessory", "藏蓝遮阳帽", "Navy sun hat", "blue", { accessoryStyle: "hat" }),
    piece("suggested-red-glasses", "accessory", "红色太阳镜", "Red sunglasses", "red", { accessoryStyle: "glasses" }),
    piece("suggested-white-scarf", "accessory", "白色轻薄围巾", "White light scarf", "white", { accessoryStyle: "scarf" }),
    piece("suggested-blue-watch", "accessory", "藏蓝腕表", "Navy watch", "blue", { accessoryStyle: "watch" }),
    piece("suggested-yellow-necklace", "accessory", "黄色项链", "Yellow necklace", "yellow", { accessoryStyle: "necklace" }),
  ],
};

function piece(
  id: string,
  kind: OutfitPieceKind,
  label: string,
  labelEn: string,
  tone: OutfitTone,
  style: { garmentStyle?: GarmentStyle; accessoryStyle?: AccessoryStyle } = {}
): OutfitPiece {
  return {
    id,
    kind,
    label,
    labelEn,
    tone,
    garmentStyle: style.garmentStyle ?? null,
    accessoryStyle: style.accessoryStyle ?? null,
    wardrobeItemId: null,
    hasPhoto: false,
  };
}

const CATEGORY_WORDS: Record<OutfitPieceKind, string[]> = {
  top: ["top", "shirt", "tee", "blouse", "sweater", "jacket", "coat", "上衣", "衬衫", "外套"],
  bottom: ["bottom", "pants", "trouser", "jeans", "skirt", "shorts", "下装", "裤", "裙"],
  shoes: ["shoe", "sneaker", "loafer", "boot", "sandal", "鞋", "靴"],
  accessory: ["accessory", "bag", "handbag", "hat", "cap", "scarf", "glasses", "sunglass", "watch", "jewel", "necklace", "配饰", "包", "帽", "围巾", "眼镜", "手表", "首饰", "项链"],
};

function kindOf(item: WardrobeItem): OutfitPieceKind | null {
  const text = `${item.category} ${item.subtype}`.toLowerCase();
  for (const kind of ["top", "bottom", "shoes", "accessory"] as const) {
    if (CATEGORY_WORDS[kind].some((word) => text.includes(word))) return kind;
  }
  return null;
}

function accessoryStyleOf(item: WardrobeItem): AccessoryStyle | null {
  const text = `${item.title} ${item.category} ${item.subtype}`.toLowerCase();
  if (/hat|cap|帽/.test(text)) return "hat";
  if (/glass|眼镜/.test(text)) return "glasses";
  if (/scarf|围巾/.test(text)) return "scarf";
  if (/watch|手表|腕表/.test(text)) return "watch";
  if (/necklace|jewel|项链|首饰/.test(text)) return "necklace";
  return "bag";
}

function garmentStyleOf(item: WardrobeItem, kind: OutfitPieceKind): GarmentStyle | null {
  const text = `${item.title} ${item.category} ${item.subtype}`.toLowerCase();
  if (kind === "top") {
    if (/shirt|blouse|衬衫/.test(text)) return "shirt";
    if (/knit|sweater|针织|毛衣/.test(text)) return "knit";
    return "tee";
  }
  if (kind === "bottom") {
    if (/skirt|裙/.test(text)) return "skirt";
    if (/jean|denim|牛仔/.test(text)) return "jeans";
    return "trousers";
  }
  if (kind === "shoes") {
    if (/sneaker|trainer|运动鞋/.test(text)) return "sneakers";
    return "loafers";
  }
  return null;
}

function toneOf(item: WardrobeItem): OutfitTone {
  const color = item.colors.join(" ").toLowerCase();
  if (/red|红/.test(color)) return "red";
  if (/yellow|黄/.test(color)) return "yellow";
  if (/white|白|cream|米/.test(color)) return "white";
  if (/black|黑/.test(color)) return "black";
  return "blue";
}

function fromWardrobe(item: WardrobeItem, kind: OutfitPieceKind): Candidate {
  return {
    id: item.id,
    kind,
    label: item.title,
    labelEn: item.title,
    tone: toneOf(item),
    garmentStyle: garmentStyleOf(item, kind),
    accessoryStyle: kind === "accessory" ? accessoryStyleOf(item) : null,
    wardrobeItemId: item.id,
    hasPhoto: item.hasPhoto,
  };
}

function isoToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function buildOutfitPlan(
  trip: TripPlan | null,
  wardrobe: WardrobeItem[],
  now = new Date()
): OutfitPlan {
  const today = isoToday(now);
  const startDate = trip?.startDate ?? today;
  const endDate = trip?.endDate ?? today;
  const pools: Record<OutfitPieceKind, Candidate[]> = {
    top: [],
    bottom: [],
    shoes: [],
    accessory: [],
  };

  for (const item of wardrobe) {
    const kind = kindOf(item);
    if (kind) pools[kind].push(fromWardrobe(item, kind));
  }

  const dates = datesBetween(startDate, endDate);
  const destination = trip?.placeName ?? "当前位置";
  const scenario = trip?.scenario ?? "commute";
  const days = dates.map((date, index) => ({
    id: `outfit-day-${index + 1}`,
    dayNumber: index + 1,
    date,
    place: destination,
    scene: scenario,
    pieces: (["top", "bottom", "accessory", "shoes"] as const).map((kind) => {
      const choices = pools[kind].length > 0 ? pools[kind] : FALLBACKS[kind];
      return choices[index % choices.length];
    }),
  }));

  return {
    destination,
    destinationDetail: trip?.placeDetail ?? "",
    scenario,
    startDate,
    endDate,
    lat: trip?.lat ?? DEFAULT_COORDS.lat,
    lon: trip?.lon ?? DEFAULT_COORDS.lon,
    usesWardrobe: days.some((day) => day.pieces.some((item) => item.wardrobeItemId)),
    days,
  };
}
