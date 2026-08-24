import type { OutfitPiece } from "../api";

type Props = {
  piece: OutfitPiece;
  compact?: boolean;
};

/** Render every outfit piece from its description, regardless of stored photos. */
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
  const sleeveClass = piece.sleeve ? ` sleeve-${piece.sleeve}` : "";
  return (
    <span
      className={`dress-piece pixel-garment dress-piece-${piece.kind}${accessoryClass}${garmentClass}${fitClass}${materialClass}${sleeveClass} pattern-${piece.pattern} tone-${piece.tone}${compact ? " is-compact" : ""}`}
      role="img"
      aria-label={piece.detail ? `${label}: ${piece.detail}` : label}
    >
      {piece.pattern !== "solid" && (
        <span className="dress-piece-pattern" aria-hidden="true" />
      )}
    </span>
  );
}
