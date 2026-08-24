import SwiftUI

/// Stable semantic layers for the compact dashboard illustration. Keeping the
/// grouping outside layout code prevents a second top from stretching the card.
struct DashboardOutfitLayers: Equatable {
    let inner: OutfitPiece?
    let outer: OutfitPiece?
    let bottom: OutfitPiece?
    let shoes: OutfitPiece?
    let accessory: OutfitPiece?

    init(pieces: [OutfitPiece]) {
        let tops = pieces.filter { $0.kind == .top }
        inner = tops.first
        outer = tops.dropFirst().first
        bottom = pieces.first { $0.kind == .bottom }
        shoes = pieces.first { $0.kind == .shoes }
        accessory = pieces.first { $0.kind == .accessory }
    }

    var displayedPieces: [OutfitPiece] {
        [inner, outer, bottom, shoes, accessory].compactMap { $0 }
    }
}

/// A fixed-height outfit stage for Home. Inner and outer tops share one torso
/// slot, then bottoms and shoes overlap slightly; accessories float beside the
/// body instead of becoming another full-height row.
struct DashboardOutfitFigure: View {
    let day: OutfitDay?
    let placeName: String

    @Environment(\.lang) private var lang

    private var layers: DashboardOutfitLayers {
        DashboardOutfitLayers(pieces: day?.pieces ?? [])
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: -2) {
                torso

                if let bottom = layers.bottom {
                    OutfitPieceVisual(piece: bottom, compact: true, scale: 0.9)
                }
                if let shoes = layers.shoes {
                    OutfitPieceVisual(piece: shoes, compact: true, scale: 0.9)
                }
            }
            .frame(maxWidth: .infinity)

            if let accessory = layers.accessory {
                OutfitPieceVisual(piece: accessory, compact: true, scale: 0.78)
                    .offset(x: -2, y: 24)
            }
        }
        .frame(width: 126, height: 142, alignment: .top)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
    }

    @ViewBuilder
    private var torso: some View {
        if let inner = layers.inner {
            ZStack {
                OutfitPieceVisual(piece: inner, compact: true, scale: 1.04)

                if let outer = layers.outer {
                    OutfitPieceVisual(piece: outer, compact: true, scale: 1.04)
                        .mask {
                            HStack(spacing: 7) {
                                Rectangle()
                                Rectangle()
                            }
                        }
                    Rectangle()
                        .fill(Theme.black.opacity(0.78))
                        .frame(width: 2.5, height: 48)
                }
            }
            .frame(height: 56)
        } else {
            PixelShape.top.stroke(Theme.black, lineWidth: 2)
                .background(PixelShape.top.fill(Theme.white))
                .frame(width: 75, height: 54)
        }
    }

    private var accessibilityDescription: String {
        let pieces = layers.displayedPieces
        guard !pieces.isEmpty else { return placeName }
        return pieces.map { piece in
            let name = piece.name(lang)
            return lang == .zh && !piece.detail.isEmpty ? "\(name)（\(piece.detail)）" : name
        }.joined(separator: lang == .zh ? "，" : ", ")
    }
}
