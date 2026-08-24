import SwiftUI

/// The whole app in one switch, mirroring `App.tsx`: an unauthenticated flow
/// that replaces the screen, and a signed-in shell that pushes detail pages.
struct RootView: View {
    @State private var app = AppState()
    @State private var language = LanguageStore()

    var body: some View {
        content
            .environment(app)
            .environment(language)
            .environment(\.lang, language.lang)
            .task { await app.restoreSession() }
    }

    @ViewBuilder
    private var content: some View {
        switch app.phase {
        case .booting:
            // Nothing flashes before the token check resolves — the web client
            // returns null here for the same reason.
            Theme.bg.ignoresSafeArea()
        case .landing:
            LandingView()
        case .login:
            LoginView()
        case .register:
            RegisterView()
        case .questionnaire(let credentials):
            QuestionnaireView(credentials: credentials)
        case .authed:
            SignedInShell()
        }
    }
}

/// Everything behind sign-in: the top bar, pushed pages, and the thumb-ready
/// bottom dock shared by every signed-in screen.
private struct SignedInShell: View {
    @Environment(AppState.self) private var app
    @State private var chatOpen = false

    var body: some View {
        @Bindable var app = app

        // The bar is a sibling above the stack, not a safe-area inset: an
        // inset on NavigationStack does not reach the scroll views inside it,
        // and every page's first card ends up half-hidden behind the bar.
        VStack(spacing: 0) {
            TopBar()
            NavigationStack(path: $app.path) {
                HomeView()
                    .navigationDestination(for: Route.self) { route in
                        destination(for: route)
                    }
            }
        }
        .tint(Theme.blue)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomNavigationDock(chatOpen: $chatOpen)
                .padding(.horizontal, 12)
                .padding(.top, Theme.space1)
                .padding(.bottom, 6)
        }
        .sheet(isPresented: $chatOpen) { ChatView() }
        .background(Theme.bg)
    }

    @ViewBuilder
    private func destination(for route: Route) -> some View {
        switch route {
        case .tripPlanner:
            TripPlannerView()
        case .tripSetup(let scenario, let retry):
            TripSetupView(scenario: scenario, retryPlan: retry)
        case .itinerary(let tripId, let scenario):
            ItineraryView(tripId: tripId, scenario: scenario)
        case .weather(let tripPlanId):
            TripWeatherView(tripPlanId: tripPlanId)
        case .wardrobe:
            WardrobeView()
        case .profile:
            ProfileView()
        case .packing(let tripPlanId):
            PackingListView(tripPlanId: tripPlanId)
        case .outfit(let tripPlanId):
            OutfitOverviewView(tripPlanId: tripPlanId)
        }
    }
}

/// The fixed header from `styles.css` `.nav`: brand mark on the left, language
/// toggle and sign-out on the right, one thick rule underneath. On a phone the
/// user's name is dropped rather than truncated, exactly as the web's
/// `max-width: 600px` rule does.
struct TopBar: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang
    @State private var signingOut = false

    var body: some View {
        HStack(spacing: Theme.space1) {
            Button {
                app.popToRoot()
            } label: {
                HStack(spacing: 10) {
                    LogoMark()
                        .frame(width: 30, height: 27)
                    Text("SMARTPACK")
                        .font(Theme.heavy(17))
                        .tracking(-0.2)
                        .foregroundStyle(Theme.text)
                }
            }
            .accessibilityLabel("SmartPack")

            Spacer(minLength: Theme.space1)

            LanguageToggle()

            Button {
                signingOut = true
                Task {
                    await app.signOut()
                    signingOut = false
                }
            } label: {
                Text(Strings.navSignOut(lang))
            }
            .buttonStyle(BauhausButtonStyle(padding: .init(top: 6, leading: 10, bottom: 6, trailing: 10), fontSize: 12))
            .disabled(signingOut)
        }
        .padding(.horizontal, Theme.space2)
        .padding(.vertical, Theme.space1)
        .frame(maxWidth: .infinity)
        .background(Theme.bg)
        .overlay(alignment: .bottom) { Rule() }
    }
}

/// One toggle for the whole app; the stored value survives relaunch.
struct LanguageToggle: View {
    @Environment(LanguageStore.self) private var language
    @Environment(\.lang) private var lang

    var body: some View {
        Button {
            language.toggle()
        } label: {
            Text(lang.toggleLabel)
                .frame(minWidth: 30)
        }
        .buttonStyle(BauhausButtonStyle(padding: .init(top: 6, leading: 10, bottom: 6, trailing: 10), fontSize: 12))
        .accessibilityLabel(lang.toggleAccessibilityLabel)
    }
}

/// A back row that reads as part of the page, not as a system chrome button —
/// the web pages all open with the same `‹ Back to Home` control.
struct BackRow: View {
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button {
            dismiss()
        } label: {
            Text("‹ \(title)")
                .font(Theme.heavy(14))
                .foregroundStyle(Theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel(title)
    }
}

/// Page scaffold: cyan ground, consistent gutters, hidden system nav bar.
struct PageScaffold<Content: View>: View {
    var spacing: CGFloat = Theme.space3
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: spacing) {
                content()
            }
            .padding(.horizontal, Theme.space2)
            .padding(.top, Theme.space2)
            .padding(.bottom, Theme.space5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.bg)
        .scrollDismissesKeyboard(.interactively)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
    }
}
