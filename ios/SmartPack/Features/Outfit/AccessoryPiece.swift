import SwiftUI

/// Accessories in the same 8-bit register as the garments: white bodies,
/// black pixel linework, a single primary accent per piece. Ported from
/// `client/src/outfit-accessories.css`.
struct AccessoryPiece: View {
    let piece: OutfitPiece
    let outline: CGFloat

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            switch piece.accessoryStyle ?? .bag {
            case .bag: bag(w, h)
            case .hat: hat(w, h)
            case .glasses: glasses(w, h)
            case .scarf: scarf(w, h)
            case .watch: watch(w, h)
            case .necklace: necklace(w, h)
            }
        }
    }

    private var accent: Color { piece.tone.detail }

    // MARK: - Pieces

    private func bag(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            // Handle: an open-bottomed rectangle rising out of the body.
            Rectangle()
                .strokeBorder(Theme.black, lineWidth: max(3, outline * 1.6))
                .frame(width: w * 0.44, height: h * 0.5)
                .offset(x: w * 0.28, y: 0)
                .clipped()

            Rectangle()
                .fill(Theme.white)
                .overlay(alignment: .top) {
                    VStack(spacing: 0) {
                        Rectangle().fill(Theme.black).frame(height: max(2, h * 0.09))
                        Rectangle().fill(accent).frame(height: max(2, h * 0.09))
                    }
                }
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: outline))
                .frame(width: w * 0.84, height: h * 0.68)
                .offset(x: w * 0.08, y: h * 0.32)
        }
    }

    private func hat(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            PixelShape.hat.fill(Theme.white)
            PixelShape.hat.stroke(Theme.black, lineWidth: outline)
            Rectangle()
                .fill(accent)
                .frame(width: w * 0.6, height: max(2, h * 0.10))
                .offset(x: w * 0.2, y: h * 0.42)
        }
    }

    private func glasses(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            lens(w, h).offset(x: w * 0.02, y: h * 0.24)
            lens(w, h).offset(x: w * 0.64, y: h * 0.24)
            // Bridge, in the piece's accent colour.
            Rectangle()
                .fill(accent)
                .frame(width: w * 0.28, height: max(2, h * 0.08))
                .offset(x: w * 0.36, y: h * 0.38)
        }
    }

    private func lens(_ w: CGFloat, _ h: CGFloat) -> some View {
        Rectangle()
            .fill(Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: max(3, outline * 1.6)))
            .frame(width: w * 0.34, height: h * 0.42)
    }

    private func scarf(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            PixelShape.scarf.fill(Theme.white)
            PixelShape.scarf.stroke(Theme.black, lineWidth: outline)
            Rectangle()
                .fill(accent)
                .frame(width: w * 0.76, height: max(2, h * 0.08))
                .offset(x: w * 0.12, y: h * 0.30)
        }
    }

    private func watch(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: outline))
                .frame(width: w * 0.28, height: h)
                .offset(x: w * 0.36, y: 0)
            Rectangle()
                .fill(Theme.white)
                .overlay(alignment: .topLeading) {
                    Rectangle().fill(accent)
                        .frame(width: w * 0.12, height: max(2, h * 0.08))
                        .offset(x: w * 0.08, y: h * 0.10)
                }
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: max(3, outline * 1.4)))
                .frame(width: w * 0.56, height: h * 0.48)
                .offset(x: w * 0.22, y: h * 0.26)
        }
    }

    private func necklace(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            // Chain: two verticals dropping to a stepped V.
            ForEach([0.16, 0.78], id: \.self) { left in
                Rectangle()
                    .fill(Theme.black)
                    .frame(width: max(3, outline * 1.6), height: h * 0.5)
                    .offset(x: w * left, y: 0)
            }
            Rectangle()
                .fill(Theme.black)
                .frame(width: w * 0.28, height: max(3, outline * 1.6))
                .offset(x: w * 0.36, y: h * 0.62)
            ForEach([0.30, 0.64], id: \.self) { left in
                Rectangle()
                    .fill(Theme.black)
                    .frame(width: max(3, outline * 1.6), height: h * 0.16)
                    .offset(x: w * left, y: h * 0.5)
            }
            // Pendant.
            Rectangle()
                .fill(accent)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: outline))
                .frame(width: w * 0.22, height: h * 0.22)
                .offset(x: w * 0.39, y: h * 0.68)
        }
    }
}
