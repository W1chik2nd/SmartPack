import SwiftUI

/// A phone-first navigation dock using the system Liquid Glass material on
/// iOS 26+, with an opaque fallback for the app's iOS 17 deployment target.
struct BottomNavigationDock: View {
    @Binding var chatOpen: Bool

    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var dragPosition: CGFloat?
    @State private var dragSelection: DockSection?
    @State private var dragStretch: CGFloat = 1

    @ViewBuilder
    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 6) {
                dockContent
                    .padding(6)
                    .glassEffect(
                        .regular.tint(Theme.black.opacity(0.78)).interactive(),
                        in: Capsule()
                    )
            }
        } else {
            dockContent
                .padding(6)
                .background(Capsule().fill(Theme.black))
                .overlay(Capsule().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
                .background(Capsule().fill(Theme.blue).offset(x: 4, y: 4))
        }
    }

    private var dockContent: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let slotWidth = DockSliderGeometry.slotWidth(for: width)

            ZStack(alignment: .leading) {
                selectionThumb(width: width, slotWidth: slotWidth)

                HStack(spacing: 0) {
                    dockButton(.today, symbol: "house.fill", color: Theme.red, width: slotWidth)
                    dockButton(.trips, symbol: "airplane", color: Theme.yellow, width: slotWidth)
                    dockButton(.wardrobe, symbol: "square.grid.2x2.fill", color: Theme.blue, width: slotWidth)
                    dockButton(.profile, symbol: "person.crop.circle.fill", color: Theme.red, width: slotWidth)
                    dockButton(.assistant, symbol: "sparkles", color: Theme.yellow, width: slotWidth)
                }
            }
            .contentShape(Capsule())
            .coordinateSpace(name: "BottomNavigationDock")
            .highPriorityGesture(dockDragGesture(width: width))
            .sensoryFeedback(.selection, trigger: dragSelection) { oldValue, newValue in
                oldValue != nil && newValue != nil && oldValue != newValue
            }
        }
        .frame(height: 50)
        .frame(maxWidth: 560)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.navSections(lang))
    }

    @ViewBuilder
    private func selectionThumb(width: CGFloat, slotWidth: CGFloat) -> some View {
        let center = dragPosition ?? DockSliderGeometry.center(of: selectedSection, width: width)
        let leading = center - slotWidth / 2

        if #available(iOS 26.0, *) {
            Color.clear
                .frame(width: slotWidth, height: 50)
                .glassEffect(
                    .regular.tint(Theme.white.opacity(0.92)).interactive(),
                    in: Capsule()
                )
                .scaleEffect(x: dragStretch, y: dragPosition == nil ? 1 : 0.97)
                .offset(x: leading)
                .animation(.spring(duration: 0.32, bounce: 0.08), value: selectedSection)
                .allowsHitTesting(false)
        } else {
            Capsule()
                .fill(Theme.white)
                .frame(width: slotWidth, height: 50)
                .scaleEffect(x: dragStretch, y: dragPosition == nil ? 1 : 0.97)
                .offset(x: leading)
                .animation(.spring(duration: 0.32, bounce: 0.08), value: selectedSection)
                .allowsHitTesting(false)
        }
    }

    private func dockButton(
        _ section: DockSection,
        symbol: String,
        color: Color,
        width: CGFloat
    ) -> some View {
        let selected = activeSection == section
        return Button { select(section) } label: {
            VStack(spacing: 3) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .bold))
                    .symbolRenderingMode(.monochrome)
                Text(section.label(lang))
                    .font(Theme.bold(10))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .foregroundStyle(selected ? color : Theme.white)
            .frame(width: width, height: 50)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }

    private func dockDragGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .named("BottomNavigationDock"))
            .onChanged { value in
                let position = DockSliderGeometry.magnetized(x: value.location.x, width: width)
                let target = DockSection.at(x: position, width: width)
                dragPosition = position
                dragStretch = 1.03 + min(
                    abs(value.predictedEndLocation.x - value.location.x) / 900,
                    0.09
                )
                if target != dragSelection {
                    dragSelection = target
                }
            }
            .onEnded { value in
                let target = DockSliderGeometry.projectedTarget(
                    currentX: value.location.x,
                    predictedX: value.predictedEndLocation.x,
                    width: width
                )
                if target != selectedSection {
                    select(target)
                }
                withAnimation(.spring(duration: 0.32, bounce: 0.08)) {
                    dragPosition = nil
                    dragSelection = nil
                    dragStretch = 1
                }
            }
    }

    private var activeSection: DockSection {
        dragSelection ?? selectedSection
    }

    private var selectedSection: DockSection {
        if chatOpen { return .assistant }
        switch app.primarySection {
        case .today: return .today
        case .trips: return .trips
        case .wardrobe: return .wardrobe
        case .profile: return .profile
        }
    }

    private func select(_ section: DockSection) {
        chatOpen = section == .assistant
        switch section {
        case .today:
            app.selectPrimarySection(.today)
        case .trips:
            app.selectPrimarySection(.trips)
        case .wardrobe:
            app.selectPrimarySection(.wardrobe)
        case .profile:
            app.selectPrimarySection(.profile)
        case .assistant:
            break
        }
    }
}

enum DockSection: Int, CaseIterable {
    case today, trips, wardrobe, profile, assistant

    static func at(x: CGFloat, width: CGFloat) -> DockSection {
        let slotWidth = DockSliderGeometry.slotWidth(for: width)
        let index = min(max(Int(x / slotWidth), 0), allCases.count - 1)
        return allCases[index]
    }

    func label(_ lang: Lang) -> String {
        switch self {
        case .today: return Strings.navToday(lang)
        case .trips: return Strings.navTrips(lang)
        case .wardrobe: return Strings.navWardrobe(lang)
        case .profile: return Strings.navProfile(lang)
        case .assistant: return Strings.navAssistant(lang)
        }
    }
}

/// Geometry and snapping rules for the five-stop glass thumb. The thumb stays
/// continuous under the finger, becomes resistant around a stop, and uses a
/// damped projected endpoint so a deliberate flick can still advance it.
enum DockSliderGeometry {
    static func slotWidth(for width: CGFloat) -> CGFloat {
        max(width, 1) / CGFloat(DockSection.allCases.count)
    }

    static func center(of section: DockSection, width: CGFloat) -> CGFloat {
        slotWidth(for: width) * (CGFloat(section.rawValue) + 0.5)
    }

    static func magnetized(x: CGFloat, width: CGFloat) -> CGFloat {
        let slot = slotWidth(for: width)
        let first = slot / 2
        let last = width - slot / 2

        if x < first { return first + (x - first) * 0.18 }
        if x > last { return last + (x - last) * 0.18 }

        let section = DockSection.at(x: x, width: width)
        let stop = center(of: section, width: width)
        let normalized = (x - stop) / (slot / 2)
        let sticky = pow(abs(normalized), 1.35) * (normalized < 0 ? -1 : 1)
        return stop + sticky * slot / 2
    }

    static func projectedTarget(currentX: CGFloat, predictedX: CGFloat, width: CGFloat) -> DockSection {
        let dampedProjection = currentX + (predictedX - currentX) * 0.35
        return DockSection.at(x: dampedProjection, width: width)
    }
}
