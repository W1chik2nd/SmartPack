import {
  wardrobePhotoUrl,
  type OutfitPiece,
} from "../api";

type Props = {
  piece: OutfitPiece;
  compact?: boolean;
};

/** Shared wardrobe/photo fallback renderer used by the dashboard and detail page. */
export default function OutfitPieceVisual({ piece, compact = false }: Props) {
  const label = piece.label;
  const isAccessory = piece.kind === "accessory";
  if (piece.hasPhoto && piece.wardrobeItemId) {
    return (
      <span
        className={`dress-piece pixel-garment dress-piece-photo${
          isAccessory ? " is-accessory-photo" : ""
        }${compact ? " is-compact" : ""}`}
      >
        <img src={wardrobePhotoUrl(piece.wardrobeItemId)} alt={label} />
      </span>
    );
  }

  const accessoryClass = isAccessory
    ? ` accessory-${piece.accessoryStyle ?? "bag"}`
    : "";
  const garmentClass = piece.garmentStyle
    ? ` garment-${piece.garmentStyle}`
    : "";
  return (
    <span
      className={`dress-piece pixel-garment dress-piece-${piece.kind}${accessoryClass}${garmentClass} tone-${piece.tone}${compact ? " is-compact" : ""}`}
      role="img"
      aria-label={label}
    />
  );
}
