import Foundation

/// Dashboard data: the saved trips, the selected one, and the weather and
/// outfit that follow it. Generation happens on the server, so this only
/// polls while a trip is still being planned and then stops.
@Observable
@MainActor
final class HomeModel {
    private(set) var trips: [TripPlan]?
    private(set) var weather: Weather?
    private(set) var weatherFailed = false
    private(set) var todayOutfit: OutfitDay?
    private(set) var outfitFailed = false
    private(set) var deleteFailed = false
    private(set) var deletingTripId: String?

    var selectedTripId: String?
    var confirmingDeleteId: String?

    private let api = APIClient.shared
    private var deletedIds: Set<String> = []
    private var pollTask: Task<Void, Never>?
    private var detailTask: Task<Void, Never>?

    /// Every durable Agent-backed scenario belongs in the carousel.
    var travelTrips: [TripPlan] { DashboardTrips.filter(trips ?? []) }

    var selectedTrip: TripPlan? {
        travelTrips.first { $0.id == selectedTripId } ?? travelTrips.first
    }

    var selectedIndex: Int {
        max(0, travelTrips.firstIndex { $0.id == selectedTrip?.id } ?? 0)
    }

    // MARK: - Loading

    func start() {
        guard pollTask == nil else { return }
        pollTask = Task { await pollTrips() }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
        detailTask?.cancel()
        detailTask = nil
    }

    private func pollTrips() async {
        while !Task.isCancelled {
            do {
                let plans = try await api.tripPlans().plans
                trips = plans.filter { !deletedIds.contains($0.id) }
                syncSelection()
                guard plans.contains(where: { $0.generationStatus == .processing }) else { return }
            } catch {
                trips = []
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }

    /// Keeps the selection stable as background status updates replace the list.
    private func syncSelection() {
        let current = selectedTrip
        if current?.id != selectedTripId {
            selectedTripId = current?.id
            loadDetails()
        } else if current == nil {
            selectedTripId = nil
        }
    }

    /// Weather and today's outfit both follow the selected destination.
    func loadDetails() {
        detailTask?.cancel()
        weather = nil
        weatherFailed = false
        todayOutfit = nil
        outfitFailed = false
        guard let trip = selectedTrip else { return }

        detailTask = Task {
            let forecast = try? await api.weather(lat: trip.lat, lon: trip.lon)
            guard !Task.isCancelled else { return }
            weather = forecast
            weatherFailed = forecast == nil

            do {
                let plan = try await api.outfitPlan(tripPlanId: trip.id).plan
                guard !Task.isCancelled else { return }
                let today = TripDate.todayISO
                todayOutfit = plan.days.first { $0.date == today } ?? plan.days.first
            } catch {
                guard !Task.isCancelled else { return }
                outfitFailed = true
            }
        }
    }

    // MARK: - Selection and deletion

    func select(_ id: String) {
        guard id != selectedTripId else { return }
        selectedTripId = id
        confirmingDeleteId = nil
        deleteFailed = false
        loadDetails()
    }

    func step(_ direction: Int) {
        guard let id = DashboardTrips.adjacentId(travelTrips, selectedId: selectedTrip?.id, direction: direction)
        else { return }
        select(id)
    }

    func deleteSelected() async {
        guard let trip = selectedTrip else { return }
        let nextId = DashboardTrips.afterDeletionId(travelTrips, deletedId: trip.id)
        deletingTripId = trip.id
        deleteFailed = false
        defer { deletingTripId = nil }

        do {
            _ = try await api.deleteTripPlan(id: trip.id)
            deletedIds.insert(trip.id)
            trips = trips?.filter { $0.id != trip.id }
            selectedTripId = nextId
            confirmingDeleteId = nil
            loadDetails()
        } catch {
            deleteFailed = true
        }
    }
}
