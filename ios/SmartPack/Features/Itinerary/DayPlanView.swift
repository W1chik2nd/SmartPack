import SwiftUI

/// One day: the header, the three decision panels (weather / wear / carry),
/// and the thread of stops.
///
/// Phone adaptation: the desktop version hangs stop cards on alternating sides
/// of a central wavy line, which needs roughly 900pt. Here the thread runs
/// down the left edge — nodes still alternate their offset so the line keeps
/// its wave, and each node still ticks across to its card — and the cards take
/// the full remaining width instead of half of it.
struct DayPlanView: View {
    let day: TripDay
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            header
            decisions
            thread
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.space1) {
                Text(Strings.dayNumber(day.dayNumber, lang))
                    .font(Theme.heavy(26))
                Text(day.dateLabel)
                    .font(Theme.bold(13))
                    .foregroundStyle(Theme.textSecondary)
            }
            Text("\(day.summaryText(lang)) · \(day.stops.count) \(Strings.dayStops(lang))")
                .font(Theme.bold(14))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
    }

    // MARK: - Decisions

    private var decisions: some View {
        VStack(spacing: 0) {
            weatherPanel
            Rule()
            listPanel(
                title: Strings.dayOutfit(lang),
                mark: Theme.red,
                rows: day.outfit.map { ($0.name(lang), $0.wardrobeItemId, $0.hasPhoto ?? false) }
            )
            Rule()
            listPanel(
                title: Strings.dayEquipment(lang),
                mark: Theme.blue,
                rows: day.equipment.map { ($0.name(lang), String?.none, false) }
            )
        }
        .bauhausCard()
    }

    private var weatherPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: Theme.space1) {
                ColorMark(color: Theme.yellow, size: 18)
                CardHeading(text: Strings.dayWeather(lang))
            }
            Text(day.weatherText(lang))
                .font(Theme.heavy(17))
                .fixedSize(horizontal: false, vertical: true)
            Text(day.riskText(lang))
                .font(Theme.regular(13))
                .foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func listPanel(
        title: String,
        mark: Color,
        rows: [(String, String?, Bool)]
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            HStack(spacing: Theme.space1) {
                ColorMark(color: mark, size: 18)
                CardHeading(text: title)
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: Theme.space1) {
                    if let itemId = row.1, row.2 {
                        AsyncImage(url: APIClient.wardrobePhotoURL(id: itemId)) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Theme.bg
                        }
                        .frame(width: 34, height: 34)
                        .clipped()
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: 1.5))
                    }
                    Text(row.0)
                        .font(Theme.bold(14))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Stop thread

    private var thread: some View {
        VStack(spacing: 0) {
            ForEach(Array(day.stops.enumerated()), id: \.element.id) { index, stop in
                HStack(alignment: .center, spacing: 0) {
                    ThreadRail(
                        index: index,
                        isFirst: index == 0,
                        isLast: index == day.stops.count - 1
                    )
                    .frame(width: 44)

                    StopCardView(stop: stop)
                        .padding(.vertical, Theme.space1)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// One segment of the stop thread: the line through this row, the node at its
/// centre, and the tick that reaches across to the card.
private struct ThreadRail: View {
    let index: Int
    let isFirst: Bool
    let isLast: Bool

    private var nodeX: CGFloat { index % 2 == 0 ? 0.62 : 0.38 }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let x = w * nodeX
            let midY = h / 2

            ZStack(alignment: .topLeading) {
                // The line waves by meeting the neighbouring rows' node x.
                Path { path in
                    let previousX = isFirst ? x : w * (index % 2 == 0 ? 0.38 : 0.62)
                    let nextX = isLast ? x : w * (index % 2 == 0 ? 0.38 : 0.62)
                    path.move(to: CGPoint(x: previousX, y: 0))
                    path.addQuadCurve(to: CGPoint(x: x, y: midY),
                                      control: CGPoint(x: previousX, y: midY / 2))
                    path.addQuadCurve(to: CGPoint(x: nextX, y: h),
                                      control: CGPoint(x: nextX, y: midY + midY / 2))
                }
                .stroke(Theme.black, style: StrokeStyle(lineWidth: 4, lineCap: .round))

                Path { path in
                    path.move(to: CGPoint(x: x, y: midY))
                    path.addLine(to: CGPoint(x: w, y: midY))
                }
                .stroke(Theme.black, lineWidth: 4)

                Circle()
                    .fill(index % 2 == 0 ? Theme.yellow : Theme.white)
                    .overlay(Circle().strokeBorder(Theme.black, lineWidth: 4))
                    .frame(width: 18, height: 18)
                    .offset(x: x - 9, y: midY - 9)
            }
        }
        .accessibilityHidden(true)
    }
}
