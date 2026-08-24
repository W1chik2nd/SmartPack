import Combine
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

/// Everything behind sign-in: four peer root areas, one detail stack, and the
/// thumb-ready bottom dock shared by the signed-in experience.
private struct SignedInShell: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang
    @State private var chatOpen = false
    @State private var keyboardVisible = false

    var body: some View {
        @Bindable var app = app

        NavigationStack(path: $app.path) {
            primaryContent
                .navigationTitle(primaryTitle)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { route in
                    destination(for: route)
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar(.visible, for: .navigationBar)
                }
        }
        .tint(Theme.blue)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !keyboardVisible {
                BottomNavigationDock(chatOpen: $chatOpen)
                    .padding(.horizontal, 12)
                    .padding(.top, Theme.space1)
                    .padding(.bottom, 6)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $chatOpen) { ChatView() }
        .background(Theme.bg)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.easeOut(duration: 0.18)) { keyboardVisible = true }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.easeOut(duration: 0.18)) { keyboardVisible = false }
        }
    }

    @ViewBuilder
    private var primaryContent: some View {
        switch app.primarySection {
        case .today:
            VStack(spacing: 0) {
                HomeBrandBar()
                HomeView()
            }
        case .trips:
            TripPlannerView()
        case .wardrobe:
            WardrobeView()
        case .profile:
            ProfileView()
        }
    }

    private var primaryTitle: String {
        switch app.primarySection {
        case .today: return Strings.navToday(lang)
        case .trips: return Strings.navTrips(lang)
        case .wardrobe: return Strings.navWardrobe(lang)
        case .profile: return Strings.navProfile(lang)
        }
    }

    @ViewBuilder
    private func destination(for route: Route) -> some View {
        switch route {
        case .tripSetup(let scenario, let retry):
            TripSetupView(scenario: scenario, retryPlan: retry)
        case .itinerary(let tripId, let scenario):
            ItineraryView(tripId: tripId, scenario: scenario)
        case .weather(let tripPlanId):
            TripWeatherView(tripPlanId: tripPlanId)
        case .packing(let tripPlanId):
            PackingListView(tripPlanId: tripPlanId)
        case .outfit(let tripPlanId):
            OutfitOverviewView(tripPlanId: tripPlanId)
        }
    }
}

/// Product identity belongs on Today; navigation and account actions use their
/// standard iOS homes instead of repeating this web-style header on every page.
struct HomeBrandBar: View {
    var body: some View {
        HStack(spacing: 10) {
            LogoMark()
                .frame(width: 30, height: 27)
            Text("SMARTPACK")
                .font(Theme.heavy(17))
                .tracking(-0.2)
                .foregroundStyle(Theme.text)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.space2)
        .padding(.vertical, Theme.space1)
        .frame(maxWidth: .infinity)
        .background(Theme.bg)
        .overlay(alignment: .bottom) { Rule() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SmartPack")
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

/// Page scaffold: cyan ground and consistent content gutters. Navigation chrome
/// is owned by the surrounding NavigationStack.
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
    }
}
