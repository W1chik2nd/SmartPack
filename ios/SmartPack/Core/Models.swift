import Foundation

// Account, profile catalog, wardrobe, and outfit shapes. These mirror
// `client/src/api.ts` field for field so both clients read one API contract
// (AGENTS.md §3) — the server owns every rule expressed here.

// MARK: - Account

struct User: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    var name: String
    var age: Int?
    var heightCm: Double?
    var weightKg: Double?
    var style: String?
    var gender: String?
    var bustCm: Double?
    var waistCm: Double?
    var hipCm: Double?
    var bodyType: String?
    var seasonColorType: String?
    var stylePrefs: [String]
    var wearFeel: [String]
    var wearFeelOther: String?
    var travelHabits: [String]
    var travelHabitsOther: String?
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct UserResponse: Codable {
    let user: User
}

struct Credentials: Equatable {
    var email: String
    var password: String
}

// MARK: - Profile questionnaire catalog

/// One selectable answer. `id` is stored; the labels are display-only.
struct ProfileOption: Codable, Identifiable, Hashable {
    let id: String
    let en: String
    let zh: String

    func label(_ lang: Lang) -> String { lang == .zh ? zh : en }
}

struct ProfileField: Codable, Identifiable, Hashable {
    enum Kind: String, Codable {
        case text, int, decimal, single, multi
    }

    let key: String
    let kind: Kind
    let required: Bool
    let min: Double?
    let max: Double?
    let options: [ProfileOption]?
    /// Present when this field offers a free-text "other" choice.
    let otherId: String?
    /// The payload key the free text is sent under.
    let otherKey: String?
    let otherMax: Int?

    var id: String { key }
    var isNumeric: Bool { kind == .int || kind == .decimal }
}

struct ProfileFieldsResponse: Codable {
    let fields: [ProfileField]
}

struct PersonalColorResponse: Codable, Equatable {
    let analysis: String
    let season: String?
}

/// The questionnaire payload. Keyed by the field keys the server publishes,
/// not typed field by field: a new question needs no client change.
enum ProfileValue: Encodable {
    case text(String)
    case number(Double)
    case list([String])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let value): try container.encode(value)
        case .number(let value):
            // Whole numbers must not travel as "31.0" — the server validates
            // age/height as integers.
            if value == value.rounded() { try container.encode(Int(value)) }
            else { try container.encode(value) }
        case .list(let value): try container.encode(value)
        }
    }
}

typealias Profile = [String: ProfileValue]

// MARK: - Scenarios

struct Scenario: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let image: String
}

struct ScenariosResponse: Codable {
    let scenarios: [Scenario]
}

// MARK: - Wardrobe

/// A stored wardrobe piece. The detail fields feed outfit recommendation.
struct WardrobeItem: Codable, Identifiable, Hashable {
    let id: String
    /// Headline, e.g. 黄色宽松工装裤.
    let title: String
    let category: String
    /// Specific cut, e.g. 工装裤.
    let subtype: String
    let count: Int
    let colors: [String]
    let fit: String
    let material: String
    let seasons: [String]
    let styleTags: [String]
    let details: String
    let hasPhoto: Bool
    let createdAt: String

    /// Card subtitle: cut · fit · fabric, skipping whatever is blank.
    var metaLine: String {
        [subtype.isEmpty ? category : subtype, fit, material]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}

struct WardrobeItemsResponse: Codable {
    let items: [WardrobeItem]
}

struct RecognizeResponse: Codable {
    let item: WardrobeItem
}

// MARK: - Weather

struct Weather: Codable, Equatable {
    let tempC: Double
    let condition: String
}

// MARK: - Assistant

struct ChatMessage: Codable, Identifiable, Equatable {
    enum Role: String, Codable { case user, assistant }

    var id = UUID()
    let role: Role
    let content: String

    enum CodingKeys: String, CodingKey { case role, content }
}

struct ChatResponse: Decodable {
    let reply: String
    let actions: [AssistantAction]?
}

/// The subset of assistant actions this client acts on. Unknown action types
/// decode to `.unsupported` rather than failing the whole reply.
enum AssistantAction: Decodable {
    case navigate(page: AssistantPage, scenario: String?)
    case profileUpdated(User)
    case tripCreated
    case packingChanged(balance: Double?, checked: [String], unchecked: [String])
    case unsupported

    private enum CodingKeys: String, CodingKey {
        case type, page, scenario, user, balance, checked, unchecked
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "navigate":
            let page = AssistantPage(rawValue: try container.decode(String.self, forKey: .page)) ?? .home
            self = .navigate(page: page, scenario: try container.decodeIfPresent(String.self, forKey: .scenario))
        case "profileUpdated":
            self = .profileUpdated(try container.decode(User.self, forKey: .user))
        case "tripCreated":
            self = .tripCreated
        case "packingChanged":
            self = .packingChanged(
                balance: try container.decodeIfPresent(Double.self, forKey: .balance),
                checked: try container.decodeIfPresent([String].self, forKey: .checked) ?? [],
                unchecked: try container.decodeIfPresent([String].self, forKey: .unchecked) ?? []
            )
        default:
            self = .unsupported
        }
    }
}

enum AssistantPage: String, Codable {
    case home, trips, tripSetup, itinerary, wardrobe, profile, packing
}

// MARK: - Outfit plan

enum OutfitPieceKind: String, Codable { case top, bottom, shoes, accessory }

enum OutfitTone: String, Codable {
    case red, orange, yellow, blue, purple, pink, black, white, green, brown, gray, beige
}

enum OutfitPattern: String, Codable { case solid, plaid, striped, printed }

enum OutfitSleeve: String, Codable { case short, long }

enum OutfitFit: String, Codable { case slim, regular, relaxed }

enum OutfitMaterial: String, Codable {
    case cotton, knit, denim, leather, linen, technical, other
}

enum AccessoryStyle: String, Codable {
    case bag, hat, glasses, scarf, watch, necklace
}

enum GarmentStyle: String, Codable {
    case tee, shirt, knit, trousers, skirt, jeans, loafers, sneakers
}

struct OutfitPiece: Codable, Identifiable, Hashable {
    let id: String
    let kind: OutfitPieceKind
    let label: String
    let labelEn: String
    let tone: OutfitTone
    /// Optional while older generated plans age out; current servers always
    /// return one of the shared pattern values.
    let pattern: OutfitPattern?
    let sleeve: OutfitSleeve?
    let garmentStyle: GarmentStyle?
    let accessoryStyle: AccessoryStyle?
    let fit: OutfitFit?
    let material: OutfitMaterial?
    let detail: String
    let wardrobeItemId: String?

    func name(_ lang: Lang) -> String { lang == .zh ? label : labelEn }
}

struct OutfitDay: Codable, Identifiable, Hashable {
    let id: String
    let dayNumber: Int
    let date: String
    let place: String
    /// Optional only for compatibility with plans generated before the
    /// bilingual field shipped; current servers always send it.
    let placeEn: String?
    let scene: String
    let pieces: [OutfitPiece]

    func placeName(_ lang: Lang) -> String {
        guard lang == .en, let placeEn, !placeEn.isEmpty else { return place }
        return placeEn
    }
}

struct OutfitPlan: Codable, Equatable {
    let destination: String
    let destinationDetail: String
    let scenario: String
    let startDate: String
    let endDate: String
    let lat: Double
    let lon: Double
    let usesWardrobe: Bool
    let days: [OutfitDay]
}

struct OutfitPlanResponse: Codable {
    let plan: OutfitPlan
}
