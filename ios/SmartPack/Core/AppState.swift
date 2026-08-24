import Foundation
import SwiftUI

/// The four persistent areas in the bottom dock. These are peer destinations,
/// not entries in the detail navigation stack.
enum PrimarySection: Hashable {
    case today
    case trips
    case wardrobe
    case profile
}

/// Screens reachable from the signed-in shell. The web client keeps these in
/// one in-memory `route` state; on iOS they are pushed onto a NavigationStack
/// so the system back gesture works.
enum Route: Hashable {
    case tripSetup(scenario: String, retry: TripPlan?)
    case itinerary(tripId: String?, scenario: String?)
    case weather(tripPlanId: String)
    case packing(tripPlanId: String)
    case outfit(tripPlanId: String?)
}

/// The unauthenticated flow, which replaces the whole screen rather than
/// pushing — sign-up step 2 must not be reachable with a back swipe once the
/// account exists.
enum AuthPhase: Equatable {
    case booting
    case landing
    case login
    case register
    case questionnaire(Credentials)
    case authed
}

/// Session and navigation state for the whole app.
@Observable
@MainActor
final class AppState {
    var phase: AuthPhase = .booting
    var user: User?
    var primarySection: PrimarySection = .today
    var path: [Route] = []
    /// Set when the assistant asks for a scenario-seeded trip setup.
    var pendingScenario: String?

    private let api = APIClient.shared

    // MARK: - Session

    /// Restores the signed-in user from a stored token, or drops the token.
    func restoreSession() async {
        guard TokenStore.token != nil else {
            phase = .landing
            return
        }
        do {
            user = try await api.me().user
            phase = .authed
        } catch {
            TokenStore.token = nil
            phase = .landing
        }
    }

    func signedIn(_ response: AuthResponse) {
        TokenStore.token = response.token
        user = response.user
        primarySection = .today
        path = []
        phase = .authed
    }

    func signOut() async {
        // The token may already be invalid; sign out locally either way.
        _ = try? await api.logout()
        TokenStore.token = nil
        user = nil
        primarySection = .today
        path = []
        phase = .landing
    }

    // MARK: - Navigation

    func push(_ route: Route) { path.append(route) }
    func popToRoot() { path.removeAll() }

    /// A tab change replaces the root area and clears only its detail stack.
    func selectPrimarySection(_ section: PrimarySection) {
        primarySection = section
        path.removeAll()
    }

    /// Applies the actions the assistant returns with its reply.
    func apply(_ actions: [AssistantAction]) async {
        for action in actions {
            switch action {
            case .profileUpdated(let updated):
                user = updated
            case .navigate(let page, let scenario):
                pendingScenario = scenario
                await navigate(to: page, scenario: scenario)
            case .tripCreated:
                popToRoot()
            case .packingChanged:
                await openLatestPacking()
            case .unsupported:
                break
            }
        }
    }

    private func navigate(to page: AssistantPage, scenario: String?) async {
        switch page {
        case .home:
            selectPrimarySection(.today)
        case .trips:
            selectPrimarySection(.trips)
        case .tripSetup:
            selectPrimarySection(.trips)
            push(.tripSetup(scenario: scenario ?? "travel", retry: nil))
        case .itinerary:
            selectPrimarySection(.trips)
            push(.itinerary(tripId: nil, scenario: scenario))
        case .wardrobe:
            selectPrimarySection(.wardrobe)
        case .profile:
            selectPrimarySection(.profile)
        case .packing: await openLatestPacking()
        }
    }

    /// The assistant refers to "the packing list" without an id; open the most
    /// recent generated trip's, matching the web client.
    private func openLatestPacking() async {
        selectPrimarySection(.trips)
        guard let plans = try? await api.tripPlans().plans,
              let latest = plans.first(where: { $0.itineraryId != nil })
        else {
            return
        }
        push(.packing(tripPlanId: latest.id))
    }
}

// MARK: - Dashboard trip selection
// Ported from `client/src/lib/trip-dashboard.ts` — pure presentation rules
// about which saved plans belong in the home carousel.

enum DashboardTrips {
    /// Every saved Agent-backed scenario is useful on Home. Hiding commute or
    /// formal plans makes the dashboard disagree with what the user created.
    private static let homeScenarios: Set<String> = [
        "travel", "business", "date", "commute", "sport", "formal",
    ]

    static func filter(_ plans: [TripPlan]) -> [TripPlan] {
        plans.filter { plan in
            homeScenarios.contains(plan.scenario)
                && (plan.itineraryId != nil
                    || plan.generationStatus == .processing
                    || plan.generationStatus == .failed)
        }
    }

    /// Cycle through saved trips without coupling selection to list order.
    static func adjacentId(_ trips: [TripPlan], selectedId: String?, direction: Int) -> String? {
        guard !trips.isEmpty else { return nil }
        let found = trips.firstIndex { $0.id == selectedId } ?? 0
        let next = (found + direction + trips.count) % trips.count
        return trips[next].id
    }

    /// Prefer the following trip after deletion, wrapping to the first one.
    static func afterDeletionId(_ trips: [TripPlan], deletedId: String) -> String? {
        guard trips.count > 1 else { return nil }
        guard let index = trips.firstIndex(where: { $0.id == deletedId }) else { return trips[0].id }
        return trips[(index + 1) % trips.count].id
    }
}
