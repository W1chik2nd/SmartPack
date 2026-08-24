import type { OutfitDay, OutfitPiece } from "../api";
import OutfitPieceVisual from "./OutfitPieceVisual";
import { useLang } from "../i18n/useLang";

type Props = {
  day: OutfitDay | null;
  placeName: string;
};

function layers(pieces: OutfitPiece[]) {
  const tops = pieces.filter((piece) => piece.kind === "top");
  return {
    inner: tops[0] ?? null,
    outer: tops[1] ?? null,
    bottom: pieces.find((piece) => piece.kind === "bottom") ?? null,
    shoes: pieces.find((piece) => piece.kind === "shoes") ?? null,
    accessory: pieces.find((piece) => piece.kind === "accessory") ?? null,
  };
}

function description(piece: OutfitPiece, lang: "en" | "zh"): string {
  const label = lang === "zh" ? piece.label : piece.labelEn || piece.label;
  return piece.detail && lang === "zh" ? `${label}（${piece.detail}）` : label;
}

/** Compact dashboard illustration; never changes the dashboard grid dimensions. */
export default function DashboardOutfit({ day, placeName }: Props) {
  if (!day) {
    return (
      <span className="outfit-figure" aria-label={placeName}>
        <span className="outfit-shirt pixel-garment" />
        <span className="outfit-trousers pixel-garment" />
      </span>
    );
  }

  const { lang } = useLang();
  const outfit = layers(day.pieces);
  const pieces = [outfit.inner, outfit.outer, outfit.bottom, outfit.shoes, outfit.accessory]
    .filter((piece): piece is OutfitPiece => Boolean(piece));

  return (
    <span className="outfit-figure" aria-label={pieces.map((piece) => description(piece, lang)).join("，")}>
      <span className="dashboard-outfit-stack">
        <span className="dashboard-outfit-torso">
          {outfit.inner && <OutfitPieceVisual piece={outfit.inner} compact />}
          {outfit.outer && (
            <span
              className="dashboard-outfit-outer"
              aria-label={
                lang === "zh"
                  ? `${description(outfit.outer, lang)}，打开拉链，露出里面的${outfit.inner ? description(outfit.inner, lang) : "内搭"}`
                  : `${description(outfit.outer, lang)}, worn open over ${outfit.inner ? description(outfit.inner, lang) : "the inner layer"}`
              }
            >
              <OutfitPieceVisual piece={outfit.outer} compact />
              <span className="dashboard-outfit-zip" aria-hidden="true" />
            </span>
          )}
        </span>
        {outfit.bottom && <OutfitPieceVisual piece={outfit.bottom} compact />}
        {outfit.shoes && <OutfitPieceVisual piece={outfit.shoes} compact />}
        {outfit.accessory && <OutfitPieceVisual piece={outfit.accessory} compact />}
      </span>
      <span className="outfit-description">{pieces.map((piece) => description(piece, lang)).join(" · ")}</span>
    </span>
  );
}
