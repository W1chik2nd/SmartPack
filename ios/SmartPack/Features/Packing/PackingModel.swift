import Foundation

/// Packing screen state. Every packing rule lives on the server (AGENTS.md
/// §3): this only holds the slider value, the ticked-off items, and whatever
/// plan came back.
@Observable
@MainActor
final class PackingModel {
    private static let checkedKey = "smartpack_packing_checked"
    private static let balanceKey = "smartpack_packing_balance"

    /// 0 = pack lightest · 100 = most outfit variety.
    var balance: Double {
        didSet { UserDefaults.standard.set(balance, forKey: Self.balanceKey) }
    }

    private(set) var plan: PackingPlan?
    private(set) var loading = true
    private(set) var error: String?

    /// Ticked items, keyed by item id. Local only — the checklist is a
    /// don't-forget aid, not server state.
    private(set) var checked: [String: Bool]

    private let tripPlanId: String
    private var reloadTask: Task<Void, Never>?

    init(tripPlanId: String) {
        self.tripPlanId = tripPlanId
        let stored = UserDefaults.standard.object(forKey: Self.balanceKey) as? Double
        balance = stored ?? 50
        checked = UserDefaults.standard.dictionary(forKey: Self.checkedKey) as? [String: Bool] ?? [:]
    }

    var packedCount: Int { checked.values.filter { $0 }.count }
    var totalItems: Int { plan?.totalItems ?? 0 }

    func isChecked(_ id: String) -> Bool { checked[id] ?? false }

    func toggle(_ id: String) {
        checked[id] = !isChecked(id)
        UserDefaults.standard.set(checked, forKey: Self.checkedKey)
    }

    /// Debounces the slider so dragging does not fire a request per pixel.
    /// The task is replaced on every change, so only the last value is fetched.
    func reload(debounce: Bool) {
        reloadTask?.cancel()
        let requested = balance
        reloadTask = Task {
            if debounce {
                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
            }
            loading = true
            defer { loading = false }
            do {
                plan = try await APIClient.shared.packingPlan(balance: requested, tripPlanId: tripPlanId).plan
                error = nil
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled else { return }
                self.error = error.localizedDescription
            }
        }
    }
}
