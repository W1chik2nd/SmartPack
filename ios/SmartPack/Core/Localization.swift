import Foundation
import SwiftUI

/// Central i18n, mirroring `client/src/i18n/strings.ts`: every user-facing
/// string exists in both languages, and the choice persists across launches.

enum Lang: String, CaseIterable {
    case en, zh

    var localeIdentifier: String { self == .zh ? "zh-CN" : "en-GB" }
    var toggleLabel: String { self == .en ? "中文" : "EN" }
    var toggleAccessibilityLabel: String { self == .en ? "切换到中文" : "Switch to English" }
}

/// A string that exists in both languages. `text(lang)` picks one.
struct LocalizedText {
    let en: String
    let zh: String

    func callAsFunction(_ lang: Lang) -> String { lang == .zh ? zh : en }
    func text(_ lang: Lang) -> String { lang == .zh ? zh : en }
}

/// App-wide language selection. One instance lives at the root; views read it
/// from the environment.
@Observable
@MainActor
final class LanguageStore {
    private static let key = "smartpack_lang"

    var lang: Lang {
        didSet { UserDefaults.standard.set(lang.rawValue, forKey: Self.key) }
    }

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.key)
        lang = stored == Lang.zh.rawValue ? .zh : .en
    }

    func toggle() { lang = lang == .en ? .zh : .en }
}

private struct LangKey: EnvironmentKey {
    static let defaultValue: Lang = .en
}

extension EnvironmentValues {
    var lang: Lang {
        get { self[LangKey.self] }
        set { self[LangKey.self] = newValue }
    }
}

// MARK: - Sentences that need a formatter

extension Strings {
    /// Word order differs per language, so these are built, not looked up.

    static func wardrobeFilterCount(_ lang: Lang, visible: Int, total: Int) -> String {
        lang == .zh ? "\(visible) / \(total) 款" : "\(visible) of \(total) items"
    }

    static func wardrobeFilterRegion(_ lang: Lang, filter: String) -> String {
        lang == .zh ? "我的衣柜，当前筛选：\(filter)" : "My wardrobe, current filter: \(filter)"
    }

    static func wardrobeNoFilteredItems(_ lang: Lang, filter: String) -> String {
        lang == .zh ? "还没有\(filter)" : "No \(filter.lowercased()) yet"
    }

    static func confirmDelete(_ lang: Lang, title: String) -> String {
        lang == .zh ? "确定删除「\(title)」?" : "Delete \"\(title)\"?"
    }

    /// A dead backend otherwise reads like a validation bug. Name the real
    /// problem, and say which host was tried — the simulator and a phone on
    /// the LAN need different values (see ios/README.md).
    static func backendUnreachable(_ path: String, _ detail: String) -> String {
        let host = APIClient.baseURL.absoluteString
        return "无法连接 WearRoute 服务（\(host)\(path)）。\(detail) 请确认后端已启动，并检查 Info.plist 里的 SmartPackAPIBaseURL。"
    }

    /// Scenario labels come from the server by id; translated here so the API
    /// stays language-neutral.
    static let scenarioLabels: [String: LocalizedText] = [
        "commute": .init(en: "Commute", zh: "通勤"),
        "travel": .init(en: "Travel", zh: "旅行"),
        "business": .init(en: "Business Trip", zh: "出差"),
        "date": .init(en: "Date", zh: "约会"),
        "sport": .init(en: "Sport", zh: "运动"),
        "formal": .init(en: "Formal", zh: "正式场合"),
    ]

    static func scenarioLabel(_ id: String, _ lang: Lang, fallback: String? = nil) -> String {
        scenarioLabels[id]?(lang) ?? fallback ?? id
    }

    static func weatherCondition(_ condition: String, _ lang: Lang) -> String {
        weatherConditionLabels[condition]?(lang) ?? condition
    }

    static func dayNumber(_ number: Int, _ lang: Lang) -> String {
        lang == .zh ? "第\(number)天" : "Day \(number)"
    }

    /// Questionnaire field labels. The server owns the catalog, so a key with
    /// no entry yet degrades to the raw key — never a crash that blocks
    /// sign-up.
    static func fieldLabel(_ key: String, _ lang: Lang) -> String {
        fieldLabels[key]?(lang) ?? key
    }
}

// MARK: - Date helpers
// The API speaks "YYYY-MM-DD". Parsing is done with local calendar components
// rather than ISO-8601 dates: east of UTC, `2026-08-01` read as UTC lands on
// July 31 and every label is a day out.

enum TripDate {
    static func components(_ iso: String) -> DateComponents? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return DateComponents(year: parts[0], month: parts[1], day: parts[2])
    }

    static func date(_ iso: String) -> Date? {
        components(iso).flatMap { Calendar.current.date(from: $0) }
    }

    static func iso(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func iso(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// Whole days between two ISO dates, end exclusive — the trip's nights.
    static func nights(from start: String, to end: String) -> Int {
        guard let a = date(start), let b = date(end) else { return 0 }
        return Calendar.current.dateComponents([.day], from: a, to: b).day ?? 0
    }

    static func addingDays(_ iso: String, _ days: Int) -> String {
        guard let base = date(iso),
              let moved = Calendar.current.date(byAdding: .day, value: days, to: base)
        else { return iso }
        return Self.iso(moved)
    }

    static var todayISO: String { iso(Date()) }

    /// Formats one ISO day with the language's own conventions.
    static func format(_ iso: String, _ lang: Lang, style: Style) -> String {
        guard let date = date(iso) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: lang.localeIdentifier)
        switch style {
        case .shortDay: formatter.setLocalizedDateFormatFromTemplate("MMMd")
        case .weekdayDay: formatter.setLocalizedDateFormatFromTemplate("EEEMMMd")
        case .numericDay: formatter.setLocalizedDateFormatFromTemplate("Md")
        case .full: formatter.setLocalizedDateFormatFromTemplate("dMMMMy")
        }
        return formatter.string(from: date)
    }

    enum Style { case shortDay, weekdayDay, numericDay, full }
}
