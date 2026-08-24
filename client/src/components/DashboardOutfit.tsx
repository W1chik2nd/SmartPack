import type { OutfitDay, OutfitPiece } from "../api";
import { useLang } from "../i18n/useLang";
import { useLocalizedValues } from "../hooks/useLocalizedValues";
import OutfitPieceVisual from "./OutfitPieceVisual";

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

/** Compact dashboard illustration; never changes the dashboard grid dimensions. */
export default function DashboardOutfit({ day, placeName }: Props) {
  const { lang } = useLang();
  const outfit = day ? layers(day.pieces) : null;
  const pieces = outfit
    ? [outfit.inner, outfit.outer, outfit.bottom, outfit.shoes, outfit.accessory]
        .filter((piece): piece is OutfitPiece => Boolean(piece))
    : [];
  const labels = useLocalizedValues(
    pieces.map((piece) => ({ zh: piece.label, en: piece.labelEn })),
    lang
  );

  if (!outfit) {
    return (
      <span className="outfit-figure" aria-label={placeName}>
        <span className="outfit-shirt pixel-garment" />
        <span className="outfit-trousers pixel-garment" />
      </span>
    );
  }

  return (
    <span className="outfit-figure" aria-label={labels.join("，")}>
      <span className="dashboard-outfit-stack">
        <span className="dashboard-outfit-torso">
          {outfit.inner && (
            <span className="dashboard-outfit-inner">
              <OutfitPieceVisual piece={outfit.inner} compact />
            </span>
          )}
          {outfit.outer && (
            <span
              className="dashboard-outfit-outer"
              aria-label={
                lang === "zh"
                  ? `${labels[1] ?? labels[0]}，打开拉链，露出里面的${labels[0] ?? "内搭"}`
                  : `${labels[1] ?? labels[0]}, worn open over ${labels[0] ?? "the inner layer"}`
              }
            >
              <span className="dashboard-outfit-panel dashboard-outfit-panel-left">
                <OutfitPieceVisual piece={outfit.outer} compact />
              </span>
              <span className="dashboard-outfit-panel dashboard-outfit-panel-right" aria-hidden="true">
                <OutfitPieceVisual piece={outfit.outer} compact />
              </span>
              <span className="dashboard-outfit-zip" aria-hidden="true" />
            </span>
          )}
        </span>
        {outfit.bottom && <OutfitPieceVisual piece={outfit.bottom} compact />}
        {outfit.shoes && <OutfitPieceVisual piece={outfit.shoes} compact />}
        {outfit.accessory && <OutfitPieceVisual piece={outfit.accessory} compact />}
      </span>
      <span className="outfit-description">{labels.join(" · ")}</span>
    </span>
  );
}
