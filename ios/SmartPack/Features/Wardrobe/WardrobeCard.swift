import SwiftUI

/// One wardrobe piece rendered from the server-provided visual description.
/// Uploaded photos remain analysis inputs and never replace the shared pixel
/// representation used by the web and iOS wardrobes.
struct WardrobeCard: View {
    let item: WardrobeItem
    let onDelete: () -> Void

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                OutfitPieceVisual(piece: item.visual, scale: visualScale)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .frame(height: 132)
                    .background(Theme.bg)

                Text("×\(item.count)")
                    .font(Theme.heavy(12))
                    .foregroundStyle(Theme.black)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Theme.yellow)
                    .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: 1.5))
                    .padding(6)
            }
            .overlay(alignment: .topTrailing) {
                Button(action: onDelete) {
                    Text("✕")
                        .font(Theme.heavy(13))
                        .foregroundStyle(Theme.white)
                        .frame(width: 26, height: 26)
                        .background(Theme.red)
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: 1.5))
                }
                .padding(6)
                .accessibilityLabel("\(Strings.wardrobeDelete(lang)) \(item.title)")
            }

            Text(item.title)
                .font(Theme.heavy(14))
                .foregroundStyle(Theme.text)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            Text(item.metaLine)
                .font(Theme.regular(11))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(2)
        }
        .padding(Theme.space1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard(shadow: 4)
    }

    private var visualScale: CGFloat {
        switch item.visual.kind {
        case .top: 0.78
        case .bottom: 0.72
        case .shoes: 0.86
        case .accessory: 1.35
        }
    }
}

/// Camera mark for the add-photo control: body, viewfinder hump, lens.
struct CameraGlyph: View {
    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width, geo.size.height) / 32
            ZStack {
                Rectangle()
                    .strokeBorder(Theme.black, lineWidth: 2.5 * scale)
                    .frame(width: 26 * scale, height: 19 * scale)
                    .offset(y: 2.5 * scale)
                Path { path in
                    path.move(to: CGPoint(x: 11 * scale, y: 9 * scale))
                    path.addLine(to: CGPoint(x: 13 * scale, y: 4 * scale))
                    path.addLine(to: CGPoint(x: 19 * scale, y: 4 * scale))
                    path.addLine(to: CGPoint(x: 21 * scale, y: 9 * scale))
                }
                .stroke(Theme.black, style: StrokeStyle(lineWidth: 2.5 * scale, lineJoin: .round))
                Circle()
                    .strokeBorder(Theme.black, lineWidth: 2.5 * scale)
                    .frame(width: 11 * scale, height: 11 * scale)
                    .offset(y: 2.5 * scale)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .accessibilityHidden(true)
    }
}
