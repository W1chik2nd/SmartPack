import SwiftUI

/// Scenario picker, reached from the dashboard's Trip Planner tile. The
/// scenario list comes from `/api/scenarios`; this screen only displays it.
///
/// Phone adaptation: the desktop version is an infinite carousel driven by
/// arrow buttons, because a mouse has no swipe. Here the same card deck is a
/// paging horizontal scroll — the cards, photos, and bottom-left labels are
/// unchanged, but the interaction is the one a thumb already expects, so the
/// arrows and the clone-based looping are gone.
struct TripPlannerView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var scenarios: [Scenario]?
    @State private var error: String?

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.space3) {
                    header

                    if let error {
                        ErrorBanner(message: error)
                    }

                    if let scenarios {
                        Spacer(minLength: Theme.space2)
                        deck(scenarios)
                        Spacer(minLength: Theme.space2)
                    } else if error == nil {
                        Text(Strings.weatherLoading(lang))
                            .font(Theme.bold(15))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .padding(.horizontal, Theme.space2)
                .padding(.top, Theme.space2)
                .padding(.bottom, Theme.space5)
                .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .topLeading)
            }
            .background(Theme.bg)
            .scrollDismissesKeyboard(.interactively)
        }
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "\(Strings.tripHello(lang)), \(app.user?.name ?? "")", color: Theme.textSecondary)
            Text(Strings.tripGoingTo(lang))
                .font(Theme.heavy(32))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func deck(_ items: [Scenario]) -> some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: Theme.space2) {
                ForEach(items) { scenario in
                    Button {
                        app.push(.tripSetup(scenario: scenario.id, retry: nil))
                    } label: {
                        ScenarioCard(scenario: scenario)
                    }
                    .buttonStyle(.plain)
                    // One readable card plus a deliberate peek of the next.
                    // Two narrow cards made the photographs look like the
                    // wrong assets because most of each focal area was cut.
                    .containerRelativeFrame(.horizontal, count: 6, span: 5, spacing: Theme.space2)
                }
            }
            .scrollTargetLayout()
            .padding(.trailing, Theme.space2)
            // The shadow blocks sit outside the cards, so the row needs room.
            .padding(.bottom, Theme.space1)
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollIndicators(.hidden)
        // Cards bleed to the screen edge the way the web track does.
        .padding(.horizontal, -Theme.space2)
        .safeAreaPadding(.horizontal, Theme.space2)
        .accessibilityLabel(Strings.pickScenario(lang))
    }

    private func load() async {
        do {
            scenarios = try await APIClient.shared.scenarios().scenarios
        } catch {
            self.error = Strings.tripLoadError(lang)
        }
    }
}

/// One scenario: photo panel on top, label plate along the bottom.
private struct ScenarioCard: View {
    let scenario: Scenario
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { proxy in
                BundleImage(name: ScenarioArtworkName.resolve(scenario))
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
            }
            .frame(height: 280)

            Rule()

            Text(Strings.scenarioLabel(scenario.id, lang, fallback: scenario.label))
                .font(Theme.heavy(20))
                .foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.space2)
                .padding(.vertical, 14)
        }
        .bauhausCard()
    }
}

/// Converts the web catalog path into the flattened bundle resource name.
/// The API returns a web path (`/scenarios/commute.jpg`); the same artwork
/// ships in the app bundle flattened to `scenario-commute`.
enum ScenarioArtworkName {
    static func resolve(_ scenario: Scenario) -> String {
        let file = (scenario.image as NSString).lastPathComponent
        let stem = (file as NSString).deletingPathExtension
        return stem.isEmpty ? "scenario-\(scenario.id)" : "scenario-\(stem)"
    }
}
