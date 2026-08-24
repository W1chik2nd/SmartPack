import type {
  OutfitPattern,
  OutfitPieceKind,
  OutfitSleeve,
  OutfitTone,
} from "../shared/outfit-types.ts";

const COLOR_TERMS: [OutfitTone, string[]][] = [
  ["black", ["black", "黑色", "黑"]],
  ["white", ["off-white", "ivory", "white", "米白色", "米白", "象牙白", "白色", "白"]],
  ["gray", ["charcoal", "grey", "gray", "炭灰", "深灰", "浅灰", "灰色", "灰"]],
  ["beige", ["beige", "cream", "khaki", "卡其", "奶油", "米色", "米"]],
  ["brown", ["brown", "coffee", "棕色", "棕", "咖啡"]],
  ["red", ["burgundy", "maroon", "red", "酒红", "砖红", "红色", "红"]],
  ["orange", ["orange", "橙色", "橙"]],
  ["yellow", ["yellow", "gold", "黄色", "金色", "黄"]],
  ["green", ["olive", "green", "橄榄绿", "绿色", "绿"]],
  ["blue", ["navy", "blue", "藏蓝", "深蓝", "浅蓝", "蓝色", "蓝"]],
  ["purple", ["purple", "violet", "紫色", "紫"]],
  ["pink", ["pink", "rose", "粉色", "粉"]],
];

function toneIn(text: string): OutfitTone | null {
  const normalized = text.toLowerCase();
  let winner: { tone: OutfitTone; index: number; length: number } | null = null;
  for (const [tone, terms] of COLOR_TERMS) {
    for (const term of terms) {
      const index = normalized.indexOf(term);
      if (
        index >= 0 &&
        (!winner || index < winner.index || (index === winner.index && term.length > winner.length))
      ) {
        winner = { tone, index, length: term.length };
      }
    }
  }
  return winner?.tone ?? null;
}

/** Sources are authoritative in order: title, structured colors, then details. */
export function descriptionTone(...sources: string[]): OutfitTone {
  for (const source of sources) {
    const tone = toneIn(source);
    if (tone) return tone;
  }
  return "blue";
}

export function descriptionPattern(...sources: string[]): OutfitPattern {
  const text = sources.join(" ").toLowerCase();
  if (/plaid|checkered|checked|格纹|格子/.test(text)) return "plaid";
  if (/stripe|striped|条纹|竖纹|横纹/.test(text)) return "striped";
  if (/print|printed|graphic|印花|图案/.test(text)) return "printed";
  return "solid";
}

export function descriptionSleeve(
  kind: OutfitPieceKind,
  ...sources: string[]
): OutfitSleeve {
  if (kind !== "top") return null;
  const text = sources.join(" ").toLowerCase();
  if (/long[- ]?sleeve|长袖/.test(text)) return "long";
  if (/short[- ]?sleeve|短袖|tee|t-shirt|t恤/.test(text)) return "short";
  return null;
}
