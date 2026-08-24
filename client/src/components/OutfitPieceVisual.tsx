import type { OutfitPiece } from "../api";

type Props = {
  piece: OutfitPiece;
  compact?: boolean;
};

/** Shared wardrobe/photo fallback renderer used by the dashboard and detail page. */
export default function OutfitPieceVisual({ piece, compact = false }: Props) {
  const label = piece.label;
  const isAccessory = piece.kind === "accessory";
  const accessoryClass = isAccessory
    ? ` accessory-${piece.accessoryStyle ?? "bag"}`
    : "";
  const garmentClass = piece.garmentStyle
    ? ` garment-${piece.garmentStyle}`
    : "";
  const fitClass = piece.fit ? ` fit-${piece.fit}` : "";
  const materialClass = piece.material ? ` material-${piece.material}` : "";
  return (
    <span
      className={`dress-piece pixel-garment dress-piece-${piece.kind}${accessoryClass}${garmentClass}${fitClass}${materialClass} tone-${piece.tone}${compact ? " is-compact" : ""}`}
      role="img"
      aria-label={piece.detail ? `${label}: ${piece.detail}` : label}
    />
  );
}
