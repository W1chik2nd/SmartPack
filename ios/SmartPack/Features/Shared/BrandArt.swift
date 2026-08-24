import SwiftUI

// Brand and illustration marks. The logo and world map are parsed from the
// same `.svg` files the web app serves, so both clients stay identical; the
// suitcase is redrawn as SwiftUI geometry because its source file is plain
// rectangles and lines.

/// The hanger/map-pin brand mark. Tinted by `color` exactly as the web mask is.
struct LogoMark: View {
    var color: Color = Theme.text

    var body: some View {
        SVGShape(asset: SVGAsset.named("logo") ?? SVGAsset(source: ""))
            .fill(color, style: FillStyle(eoFill: true))
            .accessibilityHidden(true)
    }
}

/// Continent silhouettes behind the landing screen.
struct WorldMapArt: View {
    var color: Color = Color(hex: 0xC3D0DC)

    var body: some View {
        SVGShape(asset: SVGAsset.named("world-map") ?? SVGAsset(source: ""))
            .fill(color)
            .accessibilityHidden(true)
    }
}

/// Two packed cases, drawn flat with hard edges and a hard offset shadow (§8).
struct SuitcaseArt: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width / 320, size.height / 300)
            let dx = (size.width - 320 * scale) / 2
            let dy = (size.height - 300 * scale) / 2
            func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
                CGRect(x: dx + x * scale, y: dy + y * scale, width: w * scale, height: h * scale)
            }
            let stroke = StrokeStyle(lineWidth: 4 * scale)

            func case_(_ rect: CGRect, _ handle: CGRect, fill: Color) {
                context.stroke(Path(handle), with: .color(Theme.black), style: stroke)
                context.fill(Path(rect), with: .color(fill))
                context.stroke(Path(rect), with: .color(Theme.black), style: stroke)
            }

            // Yellow case sits behind and higher; the red one overlaps its left edge.
            case_(box(150, 86, 120, 168), box(176, 60, 26, 34), fill: Theme.yellow)
            var latch = Path()
            latch.move(to: CGPoint(x: dx + 234 * scale, y: dy + 86 * scale))
            latch.addLine(to: CGPoint(x: dx + 234 * scale, y: dy + 254 * scale))
            context.stroke(latch, with: .color(Theme.black), style: StrokeStyle(lineWidth: 3 * scale))

            case_(box(70, 110, 120, 150), box(96, 86, 26, 30), fill: Theme.red)
            var band = Path()
            band.addRect(box(70, 168, 120, 16))
            context.fill(band, with: .color(Theme.bg))
            context.stroke(band, with: .color(Theme.black), style: StrokeStyle(lineWidth: 3 * scale))
        }
        .accessibilityHidden(true)
    }
}

/// A photograph shipped in the app bundle (scenario cards, profile portraits).
/// Falls back to a flat primary block rather than an empty hole, matching the
/// web client's broken-image handling.
struct BundleImage: View {
    let name: String
    var fallback: Color = Theme.blue
    var contentMode: ContentMode = .fill

    var body: some View {
        if let image = Self.load(name) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: contentMode)
        } else {
            Rectangle().fill(fallback)
        }
    }

    private static var cache: [String: UIImage] = [:]

    private static func load(_ name: String) -> UIImage? {
        if let hit = cache[name] { return hit }
        let candidates = ["jpg", "jpeg", "png"]
        for ext in candidates {
            if let url = Bundle.main.url(forResource: name, withExtension: ext),
               let image = UIImage(contentsOfFile: url.path) {
                cache[name] = image
                return image
            }
        }
        return UIImage(named: name)
    }
}

/// The checklist tote on the dashboard card.
struct ChecklistBagArt: View {
    var body: some View {
        BundleImage(name: "checklist-bag", fallback: Theme.yellow, contentMode: .fit)
            .accessibilityHidden(true)
    }
}
