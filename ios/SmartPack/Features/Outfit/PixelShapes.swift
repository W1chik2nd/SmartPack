import SwiftUI

/// The 8-bit garment silhouettes, ported one-for-one from the `clip-path`
/// polygons in `client/src/outfit*.css`. Every corner is a horizontal or
/// vertical step — no smoothing, no rounded joins — so the iOS pieces read as
/// the same drawings as the web ones.
struct PixelPolygon: Shape {
    /// Points in unit space (0…1), matching the CSS percentages exactly.
    let points: [CGPoint]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: CGPoint(x: rect.minX + first.x * rect.width, y: rect.minY + first.y * rect.height))
        for point in points.dropFirst() {
            path.addLine(to: CGPoint(x: rect.minX + point.x * rect.width, y: rect.minY + point.y * rect.height))
        }
        path.closeSubpath()
        return path
    }
}

/// Percentages read straight off the CSS, so the two files can be diffed.
private func pts(_ values: [(Double, Double)]) -> [CGPoint] {
    values.map { CGPoint(x: $0.0 / 100, y: $0.1 / 100) }
}

enum PixelShape {

    /// Stepped shoulder-and-sleeve outline shared by every top.
    static let top = PixelPolygon(points: pts([
        (32, 0), (68, 0), (68, 4), (72, 4), (72, 8), (76, 8),
        (76, 12), (80, 12), (80, 16), (84, 16), (84, 20),
        (88, 20), (88, 24), (92, 24), (92, 28), (96, 28),
        (96, 32), (100, 32), (100, 48), (96, 48), (96, 52),
        (92, 52), (92, 56), (88, 56), (88, 60), (84, 60),
        (84, 52), (80, 52), (80, 100), (20, 100), (20, 52),
        (16, 52), (16, 60), (12, 60), (12, 56), (8, 56),
        (8, 52), (4, 52), (4, 48), (0, 48), (0, 32), (4, 32),
        (4, 28), (8, 28), (8, 24), (12, 24), (12, 20),
        (16, 20), (16, 16), (20, 16), (20, 12), (24, 12),
        (24, 8), (28, 8), (28, 4), (32, 4),
    ]))

    /// Trousers: a block with the inseam notched out of the bottom edge.
    static let bottom = PixelPolygon(points: pts([
        (0, 0), (100, 0), (100, 100), (58, 100), (58, 64),
        (54, 64), (54, 56), (46, 56), (46, 64), (42, 64),
        (42, 100), (0, 100),
    ]))

    /// Skirt: the same waist, flaring in stepped stages instead of legs.
    static let skirt = PixelPolygon(points: pts([
        (18, 0), (82, 0), (82, 8), (86, 8), (86, 20), (90, 20),
        (90, 36), (94, 36), (94, 52), (98, 52), (98, 100),
        (2, 100), (2, 52), (6, 52), (6, 36), (10, 36),
        (10, 20), (14, 20), (14, 8), (18, 8),
    ]))

    /// One shoe in three-quarter view; the pair is two of these, offset.
    static let shoe = PixelPolygon(points: pts([
        (24, 0), (66, 0), (66, 8), (76, 8), (76, 18),
        (84, 18), (84, 34), (92, 34), (92, 48), (100, 48),
        (100, 82), (92, 82), (92, 90), (78, 90), (78, 96),
        (20, 96), (20, 90), (10, 90), (10, 82), (2, 82),
        (2, 52), (8, 52), (8, 36), (14, 36), (14, 18),
        (24, 18),
    ]))

    static let hat = PixelPolygon(points: pts([
        (32, 0), (68, 0), (68, 8), (76, 8), (76, 16), (84, 16),
        (84, 24), (92, 24), (92, 40), (100, 40), (100, 56),
        (72, 56), (72, 64), (28, 64), (28, 56), (0, 56), (0, 40),
        (8, 40), (8, 24), (16, 24), (16, 16), (24, 16),
        (24, 8), (32, 8),
    ]))

    static let scarf = PixelPolygon(points: pts([
        (12, 0), (88, 0), (88, 48), (72, 48), (72, 100),
        (52, 100), (52, 56), (40, 56), (40, 88), (20, 88),
        (20, 48), (12, 48),
    ]))
}

// MARK: - Tones

extension OutfitTone {
    /// Body colour of the piece, from the wardrobe description.
    var body: Color {
        switch self {
        case .red: return Theme.red
        case .yellow: return Theme.yellow
        case .blue: return Theme.blue
        case .black: return Theme.black
        case .white: return Theme.white
        case .green: return Color(hex: 0x4D8B57)
        case .brown: return Color(hex: 0x9A6A3A)
        case .gray: return Color(hex: 0x7D8790)
        case .beige: return Color(hex: 0xD8BD86)
        }
    }

    /// Detail colour for structural accents (waistbands, plackets, hems).
    /// White garments borrow black so their details stay visible.
    var detail: Color {
        switch self {
        case .white: return Theme.black
        case .green: return Color(hex: 0x285C35)
        case .brown: return Color(hex: 0x5C3D20)
        case .gray: return Color(hex: 0x4D5660)
        case .beige: return Color(hex: 0x9A7B43)
        default: return body
        }
    }
}

extension OutfitFit {
    /// The web narrows or widens the silhouette horizontally for fit.
    var widthScale: CGFloat {
        switch self {
        case .slim: return 0.88
        case .regular: return 1
        case .relaxed: return 1.08
        }
    }
}
