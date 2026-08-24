import type { OutfitDay, OutfitPiece } from "../api";
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

function description(piece: OutfitPiece): string {
  return piece.detail ? `${piece.label}（${piece.detail}）` : piece.label;
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

  const outfit = layers(day.pieces);
  const pieces = [outfit.inner, outfit.outer, outfit.bottom, outfit.shoes, outfit.accessory]
    .filter((piece): piece is OutfitPiece => Boolean(piece));

  return (
    <span className="outfit-figure" aria-label={pieces.map(description).join("，")}>
      <span className="dashboard-outfit-stack">
        <span className="dashboard-outfit-torso">
          {outfit.inner && <OutfitPieceVisual piece={outfit.inner} compact />}
          {outfit.outer && (
            <span
              className="dashboard-outfit-outer"
              aria-label={`${description(outfit.outer)}，打开拉链，露出里面的${outfit.inner ? description(outfit.inner) : "内搭"}`}
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
      <span className="outfit-description">{pieces.map(description).join(" · ")}</span>
    </span>
  );
}
