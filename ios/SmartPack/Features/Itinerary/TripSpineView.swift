import SwiftUI

/// The trip overview: one snaking curve threading every day, nodes alternating
/// left and right. Ported from `TripSpine.tsx`, geometry included.
///
/// Two things matter before changing the constants:
/// 1. The canvas is authored at 360pt wide and scaled to whatever the screen
///    gives it, so nodes and labels stay locked together at any width.
/// 2. Label placement is not a fixed offset. Each label measures how much
///    horizontal room the curve leaves inside its own vertical band and takes
///    the roomier side — which is why the opening hook and the closing tail
///    never end up underneath the first and last labels.
struct TripSpineView: View {
    let trip: Trip
    let activeDayId: String
    let onPick: (String) -> Void

    @Environment(\.lang) private var lang

    // Authoring canvas. Everything below is in these coordinates.
    private static let width: CGFloat = 360
    private static let topGap: CGFloat = 32
    private static let padTop: CGFloat = topGap + 92
    private static let rowHeight: CGFloat = 132
    /// The tail reaches `last.y + 58`, so the bottom padding must exceed it.
    private static let padBottom: CGFloat = 92
    private static let nodeRadius: CGFloat = 11
    /// Two horizontal landing points: odd days right, even days left.
    private static let xRight: CGFloat = 286
    private static let xLeft: CGFloat = 74
    /// How far the control points bow outwards, relative to the node span.
    private static let bulge: CGFloat = 0.92
    private static let labelWidth: CGFloat = 122
    private static let labelHeight: CGFloat = 72
    private static let labelGap: CGFloat = 18

    private var days: [TripDay] { trip.days }

    private var canvasHeight: CGFloat {
        Self.padTop + CGFloat(max(days.count - 1, 0)) * Self.rowHeight + Self.padBottom
    }

    /// Measured from the container, never from the drawing itself — sizing the
    /// canvas from its own frame would be a feedback loop.
    @State private var availableWidth: CGFloat = Self.width

    /// Phones are narrower than the authoring canvas; never scale past 1:1.
    private var scale: CGFloat { min(1, availableWidth / Self.width) }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            Color.clear.frame(height: 0).measureWidth($availableWidth)

            CardHeading(text: Strings.tripOverview(lang))

            ZStack(alignment: .topLeading) {
                curveLayer
                departLabel
                ForEach(Array(days.enumerated()), id: \.element.id) { index, day in
                    dayLabel(index: index, day: day)
                }
            }
            .frame(width: Self.width, height: canvasHeight, alignment: .topLeading)
            .scaleEffect(scale, anchor: .topLeading)
            .frame(width: Self.width * scale, height: canvasHeight * scale, alignment: .topLeading)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.pickDay(lang))
    }

    // MARK: - Layers

    private var curveLayer: some View {
        ZStack(alignment: .topLeading) {
            spinePath
                .stroke(Theme.black, style: StrokeStyle(lineWidth: 4, lineCap: .round))
            ForEach(Array(days.enumerated()), id: \.element.id) { index, day in
                let node = Self.node(at: index)
                Circle()
                    .fill(day.id == activeDayId ? Theme.red : Theme.white)
                    .overlay(Circle().strokeBorder(Theme.black, lineWidth: 4))
                    .frame(width: Self.nodeRadius * 2, height: Self.nodeRadius * 2)
                    .offset(x: node.x - Self.nodeRadius, y: node.y - Self.nodeRadius)
            }
        }
        .accessibilityHidden(true)
    }

    private var departLabel: some View {
        Text("\(trip.departLabel) \(Strings.departs(lang))")
            .font(Theme.heavy(12))
            .foregroundStyle(Theme.text)
            .offset(x: Self.curve(days.count).start.x, y: Self.topGap)
    }

    private func dayLabel(index: Int, day: TripDay) -> some View {
        let box = Self.labelBox(index: index, days: days.count)
        let active = day.id == activeDayId
        return Button {
            onPick(day.id)
        } label: {
            VStack(alignment: box.side == .right ? .leading : .trailing, spacing: 2) {
                Text(Strings.dayNumber(day.dayNumber, lang))
                    .font(Theme.heavy(15))
                Text(day.dateLabel)
                    .font(Theme.bold(11))
                    .foregroundStyle(Theme.textSecondary)
                Text(day.cityName(lang))
                    .font(Theme.bold(12))
                    .lineLimit(1)
            }
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .frame(width: Self.labelWidth, height: Self.labelHeight,
                   alignment: box.side == .right ? .leading : .trailing)
            .background(active ? Theme.yellow : Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
        .offset(x: box.x, y: box.top)
        .accessibilityAddTraits(active ? [.isSelected, .isButton] : .isButton)
    }

    // MARK: - Geometry

    private var spinePath: Path {
        let curve = Self.curve(days.count)
        var path = Path()
        path.move(to: curve.start)
        for segment in curve.segments {
            path.addCurve(to: segment.to, control1: segment.c1, control2: segment.c2)
        }
        return path
    }

    static func node(at index: Int) -> CGPoint {
        CGPoint(x: index % 2 == 0 ? xRight : xLeft, y: padTop + CGFloat(index) * rowHeight)
    }

    struct Segment {
        let c1: CGPoint
        let c2: CGPoint
        let to: CGPoint
    }

    /// The curve as a start point plus cubic segments. Modelled rather than
    /// emitted as a path string because label placement samples the same
    /// geometry — one source, so the two can never drift apart.
    static func curve(_ dayCount: Int) -> (start: CGPoint, segments: [Segment]) {
        guard dayCount > 0 else { return (.zero, []) }
        let first = node(at: 0)
        // Opening hook: swings in from above-left of the first node.
        let start = CGPoint(x: first.x - 120, y: padTop - 62)
        var segments: [Segment] = [
            Segment(
                c1: CGPoint(x: start.x, y: start.y + 30),
                c2: CGPoint(x: first.x - 76, y: padTop),
                to: CGPoint(x: first.x, y: padTop)
            )
        ]

        // Snake: control points bow outwards so each pair of nodes is joined
        // by a wide S rather than a straight run.
        for index in 0..<max(dayCount - 1, 0) {
            let p = node(at: index)
            let q = node(at: index + 1)
            let span = (xRight - xLeft) * bulge
            let direction: CGFloat = q.x > p.x ? 1 : -1
            segments.append(Segment(
                c1: CGPoint(x: p.x - direction * span, y: p.y + rowHeight * 0.42),
                c2: CGPoint(x: q.x + direction * span, y: q.y - rowHeight * 0.42),
                to: q
            ))
        }

        // Closing tail: a short flick past the final node.
        let last = node(at: dayCount - 1)
        let direction: CGFloat = last.x == xRight ? -1 : 1
        segments.append(Segment(
            c1: CGPoint(x: last.x + direction * 34, y: last.y + 44),
            c2: CGPoint(x: last.x + direction * 70, y: last.y + 30),
            to: CGPoint(x: last.x + direction * 78, y: last.y + 58)
        ))
        return (start, segments)
    }

    enum Side { case left, right }

    /// Measures the curve's horizontal spread inside the label's own vertical
    /// band, then hangs the label off the roomier side.
    static func labelBox(index: Int, days: Int) -> (x: CGFloat, top: CGFloat, side: Side) {
        let node = node(at: index)
        let top = node.y - labelHeight / 2
        let bottom = node.y + labelHeight / 2

        let band = samplePoints(days).filter { $0.y >= top && $0.y <= bottom }.map(\.x)
        let curveLeft = band.min() ?? node.x
        let curveRight = band.max() ?? node.x

        let roomLeft = curveLeft - labelGap
        let roomRight = width - (curveRight + labelGap)
        let putRight = roomRight >= roomLeft

        return (
            x: putRight ? curveRight + labelGap : curveLeft - labelGap - labelWidth,
            top: top,
            side: putRight ? .right : .left
        )
    }

    /// Discretises the curve so label placement can query it by y. The step is
    /// far finer than "accurate enough not to overlap" needs.
    private static func samplePoints(_ days: Int, step: CGFloat = 0.01) -> [CGPoint] {
        let curve = curve(days)
        var points: [CGPoint] = []
        var from = curve.start
        for segment in curve.segments {
            var t: CGFloat = 0
            while t <= 1 {
                points.append(CGPoint(
                    x: bezier(from.x, segment.c1.x, segment.c2.x, segment.to.x, t),
                    y: bezier(from.y, segment.c1.y, segment.c2.y, segment.to.y, t)
                ))
                t += step
            }
            from = segment.to
        }
        return points
    }

    private static func bezier(_ a: CGFloat, _ b: CGFloat, _ c: CGFloat, _ d: CGFloat, _ t: CGFloat) -> CGFloat {
        let u = 1 - t
        return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
    }
}
