import Foundation

/// Answers to the server-published questionnaire, plus the selection rules
/// both the sign-up form and the profile page need. The catalog itself comes
/// from `/api/profile-options` (AGENTS.md §3) — this only tracks what the user
/// has picked and turns it back into a payload.
@Observable
@MainActor
final class ProfileAnswers {
    /// Free text and numbers, keyed by field key. Kept as typed strings until
    /// submit so a half-typed number never becomes 0.
    var text: [String: String] = [:]
    /// Selected option ids, keyed by field key. Single-choice fields hold at
    /// most one.
    var choices: [String: [String]] = [:]

    init() {}

    /// Seeds the form from an existing account, for the profile page.
    init(user: User, fields: [ProfileField]) {
        text = [
            "name": user.name,
            "age": user.age.map(String.init) ?? "",
            "heightCm": Self.number(user.heightCm),
            "weightKg": Self.number(user.weightKg),
            "bustCm": Self.number(user.bustCm),
            "waistCm": Self.number(user.waistCm),
            "hipCm": Self.number(user.hipCm),
            "wearFeelOther": user.wearFeelOther ?? "",
            "travelHabitsOther": user.travelHabitsOther ?? "",
        ]
        choices = [
            "gender": user.gender.map { [$0] } ?? [],
            "bodyType": user.bodyType.map { [$0] } ?? [],
            "seasonColorType": user.seasonColorType.map { [$0] } ?? [],
            "stylePrefs": user.stylePrefs,
            "wearFeel": user.wearFeel,
            "travelHabits": user.travelHabits,
        ]
        // Keys the account does not carry still need an entry so bindings work.
        for field in fields where choices[field.key] == nil && field.options != nil {
            choices[field.key] = []
        }
    }

    private static func number(_ value: Double?) -> String {
        guard let value else { return "" }
        return value == value.rounded() ? String(Int(value)) : String(value)
    }

    // MARK: - Selection

    func selected(_ key: String) -> [String] { choices[key] ?? [] }

    func toggle(_ field: ProfileField, _ id: String) {
        var current = selected(field.key)
        let otherId = field.otherId

        if field.kind == .single {
            // Re-picking the selected option clears it: these fields are
            // optional, so there has to be a way back to "not answered".
            choices[field.key] = current.first == id ? [] : [id]
        } else if current.contains(id) {
            current.removeAll { $0 == id }
            choices[field.key] = current
        } else if id == otherId {
            // "Other" means "none of the above", so it replaces the selection.
            choices[field.key] = [id]
        } else {
            // Picking a listed option contradicts "none of the above".
            current.removeAll { $0 == otherId }
            current.append(id)
            choices[field.key] = current
        }

        // Leaving "other" behind discards what was typed in its box; keeping
        // it would resend that text next time the option is checked.
        if let otherId, let otherKey = field.otherKey,
           !(choices[field.key] ?? []).contains(otherId) {
            text[otherKey] = ""
        }
    }

    // MARK: - Completeness

    /// True when "other" is picked but nothing has been written in its box.
    func otherPending(_ field: ProfileField) -> Bool {
        guard let otherId = field.otherId, let otherKey = field.otherKey else { return false }
        return selected(field.key).contains(otherId)
            && (text[otherKey] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func answered(_ field: ProfileField) -> Bool {
        if field.kind == .single || field.kind == .multi {
            // Picking "other" and leaving the box empty says nothing, so it
            // counts as unanswered — that is what fires the incomplete notice.
            return !selected(field.key).isEmpty && !otherPending(field)
        }
        return !(text[field.key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Payload

    /// `alwaysInclude` names fields that must travel even when empty. The
    /// profile page needs it for the multi-select lists: skipping an empty one
    /// would make clearing every style preference impossible, because the
    /// server would just keep the old array.
    func payload(for fields: [ProfileField], alwaysInclude: Set<String> = []) -> Profile {
        var profile: Profile = [:]
        for field in fields {
            if selected(field.key).isEmpty && !answered(field) && !alwaysInclude.contains(field.key) {
                continue
            }

            switch field.kind {
            case .multi:
                profile[field.key] = .list(selected(field.key))
                // Send the free text whenever "other" is checked; the server
                // drops it if that option is not among the selections.
                if let otherKey = field.otherKey {
                    let value = (text[otherKey] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !value.isEmpty { profile[otherKey] = .text(value) }
                }
            case .single:
                if let first = selected(field.key).first { profile[field.key] = .text(first) }
            case .int, .decimal:
                if let value = Double(text[field.key] ?? "") { profile[field.key] = .number(value) }
            case .text:
                profile[field.key] = .text((text[field.key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }
        return profile
    }
}
