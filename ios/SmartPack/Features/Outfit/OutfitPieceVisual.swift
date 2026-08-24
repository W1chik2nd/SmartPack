import SwiftUI

/// One garment drawn from its server-provided description. Photos no longer
/// replace the outfit figure, so color, cut, sleeve, and pattern stay legible
/// in both the dashboard and the overview.
struct OutfitPieceVisual: View {
    let piece: OutfitPiece
    var compact = false
    /// Phone screens are narrower than the desktop card grid, so every piece
    /// can be scaled down as a set without touching the drawings themselves.
    var scale: CGFloat = 1

    var body: some View {
        silhouette
        .frame(width: size.width, height: size.height)
        .accessibilityElement()
        .accessibilityLabel(piece.detail.isEmpty ? piece.label : "\(piece.label): \(piece.detail)")
    }

    // MARK: - Sizing

    private var size: CGSize {
        let base: CGSize
        switch piece.kind {
        case .top: base = compact ? CGSize(width: 72, height: 52) : CGSize(width: 176, height: 126)
        case .bottom: base = compact ? CGSize(width: 44, height: 58) : CGSize(width: 118, height: 156)
        case .shoes: base = compact ? CGSize(width: 72, height: 36) : CGSize(width: 152, height: 72)
        case .accessory: base = compact ? CGSize(width: 40, height: 34) : CGSize(width: 62, height: 52)
        }
        return CGSize(width: base.width * scale, height: base.height * scale)
    }

    private var outline: CGFloat { max(1.5, (compact ? 2 : 3) * scale) }

    // MARK: - Drawings

    @ViewBuilder
    private var silhouette: some View {
        switch piece.kind {
        case .top:
            TopPiece(piece: piece, outline: outline)
                .scaleEffect(x: (piece.fit ?? .regular).widthScale, y: 1)
        case .bottom:
            BottomPiece(piece: piece, outline: outline)
                .scaleEffect(x: (piece.fit ?? .regular).widthScale, y: 1)
        case .shoes:
            ShoesPiece(piece: piece, outline: outline)
        case .accessory:
            AccessoryPiece(piece: piece, outline: outline)
        }
    }
}

// MARK: - Tops

private struct TopPiece: View {
    let piece: OutfitPiece
    let outline: CGFloat

    private var shape: PixelPolygon {
        piece.sleeve == .long ? PixelShape.longSleeveTop : PixelShape.top
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .topLeading) {
                shape.fill(piece.tone.body)
                PiecePattern(pattern: piece.pattern ?? .solid, color: piece.tone.detail)
                    .mask { shape }
                shape.stroke(Theme.black, lineWidth: outline)

                // Neck notch: a bite of background out of the top edge.
                Rectangle()
                    .fill(Theme.bg)
                    .frame(width: w * 0.12, height: h * 0.08)
                    .offset(x: w * 0.44, y: 0)

                detail(w: w, h: h)
            }
        }
    }

    /// Style cues drawn as flat blocks: a placket for shirts, a hem band for
    /// knits, a chest pocket for everything else.
    @ViewBuilder
    private func detail(w: CGFloat, h: CGFloat) -> some View {
        switch piece.garmentStyle {
        case .shirt:
            Rectangle()
                .fill(Theme.black)
                .frame(width: max(2, w * 0.03), height: h * 0.72)
                .offset(x: w * 0.48, y: h * 0.28)
        case .knit:
            Rectangle()
                .fill(piece.tone.detail)
                .frame(width: w * 0.6, height: max(2, h * 0.05))
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Theme.black).frame(height: max(2, h * 0.04)).offset(y: h * 0.06)
                }
                .offset(x: w * 0.2, y: h * 0.72)
        default:
            Rectangle()
                .fill(Theme.white)
                .frame(width: w * 0.12, height: h * 0.14)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: max(1.5, outline)))
                .overlay(alignment: .top) {
                    Rectangle().fill(piece.tone.detail).frame(height: max(2, outline * 1.6))
                }
                .offset(x: w * 0.58, y: h * 0.61)
        }
    }
}

// MARK: - Bottoms

private struct BottomPiece: View {
    let piece: OutfitPiece
    let outline: CGFloat

    private var isSkirt: Bool { piece.garmentStyle == .skirt }
    private var shape: PixelPolygon { isSkirt ? PixelShape.skirt : PixelShape.bottom }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            // Denim reads as a heavier waistband, matching the web's variant.
            let bandHeight = piece.material == .denim ? h * 0.08 : h * 0.05

            ZStack(alignment: .topLeading) {
                shape.fill(piece.tone.body)
                PiecePattern(pattern: piece.pattern ?? .solid, color: piece.tone.detail)
                    .mask { shape }
                shape.stroke(Theme.black, lineWidth: outline)

                Rectangle()
                    .fill(piece.tone.detail)
                    .frame(width: w * (isSkirt ? 0.64 : 0.84), height: max(2, bandHeight))
                    .offset(x: w * (isSkirt ? 0.18 : 0.08), y: h * 0.12)

                if piece.garmentStyle == .jeans {
                    ForEach([0.16, 0.62], id: \.self) { left in
                        Rectangle()
                            .fill(Theme.white)
                            .frame(width: w * 0.18, height: h * 0.10)
                            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: max(1.5, outline * 0.7)))
                            .offset(x: w * left, y: h * 0.22)
                    }
                }
            }
        }
    }
}

// MARK: - Shoes

private struct ShoesPiece: View {
    let piece: OutfitPiece
    let outline: CGFloat

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            // Back shoe up and left, front shoe down and right: a pair seen
            // from three-quarters rather than two identical stamps.
            ZStack(alignment: .topLeading) {
                shoe(width: w * 0.539, height: h * 0.778)
                    .offset(x: w * 0.026, y: h * 0.028)
                shoe(width: w * 0.618, height: h * 0.889)
                    .offset(x: w * 0.362, y: h * 0.097)
            }
        }
    }

    private func shoe(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            PixelShape.shoe.fill(piece.tone.body)
            PiecePattern(pattern: piece.pattern ?? .solid, color: piece.tone.detail)
                .mask { PixelShape.shoe }
            // Sneakers carry a contrast midsole; loafers a single dark welt.
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                if piece.garmentStyle == .sneakers {
                    Rectangle().fill(piece.tone.detail).frame(height: max(2, height * 0.12))
                }
                Rectangle().fill(Theme.black).frame(height: max(2, height * 0.09))
            }
            .mask { PixelShape.shoe }
            PixelShape.shoe.stroke(Theme.black, lineWidth: outline)
        }
        .frame(width: width, height: height)
    }
}

// MARK: - Surface pattern

/// Flat pattern marks matching the shared web renderer. The parent masks this
/// view to the garment silhouette, so marks never spill outside the pixels.
private struct PiecePattern: View {
    let pattern: OutfitPattern
    let color: Color

    private let printMarks = [
        CGPoint(x: 0.32, y: 0.28),
        CGPoint(x: 0.68, y: 0.52),
        CGPoint(x: 0.40, y: 0.76),
    ]

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .topLeading) {
                switch pattern {
                case .solid:
                    EmptyView()
                case .plaid:
                    Rectangle()
                        .fill(color)
                        .frame(width: max(2, w * 0.08), height: h)
                        .offset(x: w * 0.28)
                    Rectangle()
                        .fill(color)
                        .frame(width: w, height: max(2, h * 0.08))
                        .offset(y: h * 0.42)
                case .striped:
                    ForEach([0.28, 0.64], id: \.self) { left in
                        Rectangle()
                            .fill(color)
                            .frame(width: max(2, w * 0.08), height: h)
                            .offset(x: w * left)
                    }
                case .printed:
                    ForEach(printMarks.indices, id: \.self) { index in
                        let point = printMarks[index]
                        Rectangle()
                            .fill(color)
                            .frame(width: max(3, w * 0.10), height: max(3, h * 0.12))
                            .offset(x: w * point.x, y: h * point.y)
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
