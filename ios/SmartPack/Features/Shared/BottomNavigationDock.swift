import SwiftUI

/// A phone-first navigation dock: the familiar icon-over-label rhythm from
/// native tab bars, expressed with SmartPack's flat Bauhaus palette.
struct BottomNavigationDock: View {
    @Binding var chatOpen: Bool

    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    var body: some View {
        HStack(spacing: 2) {
            dockButton(.today, symbol: "house.fill", color: Theme.red)
            dockButton(.trips, symbol: "airplane", color: Theme.yellow)
            dockButton(.wardrobe, symbol: "square.grid.2x2.fill", color: Theme.blue)
            dockButton(.profile, symbol: "person.crop.circle.fill", color: Theme.red)
            dockButton(.assistant, symbol: "sparkles", color: Theme.yellow)
        }
        .padding(6)
        .frame(maxWidth: 560)
        .background(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(Theme.black)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .strokeBorder(Theme.black, lineWidth: Theme.borderWidth)
        )
        .background(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(Theme.blue)
                .offset(x: 4, y: 4)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.navSections(lang))
    }

    private func dockButton(_ section: DockSection, symbol: String, color: Color) -> some View {
        let selected = selectedSection == section
        return Button {
            select(section)
        } label: {
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
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(selected ? Theme.white : Theme.black)
            )
            .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }

    private var selectedSection: DockSection {
        if chatOpen { return .assistant }
        guard let route = app.path.last else { return .today }
        switch route {
        case .wardrobe: return .wardrobe
        case .profile: return .profile
        case .tripPlanner, .tripSetup, .itinerary, .weather, .packing, .outfit: return .trips
        }
    }

    private func select(_ section: DockSection) {
        chatOpen = section == .assistant
        switch section {
        case .today:
            app.popToRoot()
        case .trips:
            app.replaceRoot(with: .tripPlanner)
        case .wardrobe:
            app.replaceRoot(with: .wardrobe)
        case .profile:
            app.replaceRoot(with: .profile)
        case .assistant:
            break
        }
    }
}

private enum DockSection: CaseIterable {
    case today, trips, wardrobe, profile, assistant

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
