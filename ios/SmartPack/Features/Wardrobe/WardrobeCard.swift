import SwiftUI

/// One wardrobe piece: photo (or the hand-drawn tee when there is none), the
/// count badge, a delete control, and the title/detail lines. The full detail
/// text stays in the database for outfit analysis and is deliberately not
/// printed on the card.
struct WardrobeCard: View {
    let item: WardrobeItem
    let onDelete: () -> Void

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                if item.hasPhoto {
                    AsyncImage(url: APIClient.wardrobePhotoURL(id: item.id)) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Theme.bg
                    }
                    .frame(height: 132)
                    .frame(maxWidth: .infinity)
                    .clipped()
                } else {
                    TeeSketch()
                        .frame(height: 132)
                        .frame(maxWidth: .infinity)
                        .background(Theme.bg)
                }

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
}

/// The hand-drawn tee that stands in for a missing photo.
struct TeeSketch: View {
    var body: some View {
        SVGPathShape(
            data: "M30 12 L42 6 Q50 15 58 6 L70 12 L87 27 L74 39 L71 32 L72 76 Q50 84 28 76 L29 32 L26 39 L13 27 Z",
            viewBox: CGRect(x: 0, y: 0, width: 100, height: 90)
        )
        .stroke(Theme.text, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
        .padding(Theme.space2)
        .accessibilityHidden(true)
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
