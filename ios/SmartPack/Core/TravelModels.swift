import Foundation

// Trip planning, itinerary, and packing shapes — the Swift mirror of
// `client/src/travel-types.ts`. Every rule behind these values (weather,
// reuse counts, wardrobe gaps) is decided on the server (AGENTS.md §3).

// MARK: - Places and saved trips

struct Place: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let detail: String
    let lat: Double
    let lon: Double
}

struct PlacesResponse: Codable {
    let places: [Place]
}

struct TripPlan: Codable, Identifiable, Hashable {
    enum GenerationStatus: String, Codable {
        case pending, processing, completed, failed
    }

    let id: String
    let scenario: String
    let placeName: String
    let placeDetail: String
    let lat: Double
    let lon: Double
    let startDate: String
    let endDate: String
    let notes: String
    let itineraryId: String?
    let generationStatus: GenerationStatus
    let generationError: String?
    let createdAt: String
}

/// The payload for creating a trip. Mirrors `NewTripPlan`.
struct NewTripPlan: Codable {
    let scenario: String
    let placeName: String
    let placeDetail: String
    let lat: Double
    let lon: Double
    let startDate: String
    let endDate: String
    let notes: String
    /// Set when this run replaces a plan whose generation failed.
    var replaceFailedPlanId: String?
}

struct TripGenerationEstimate: Codable, Equatable {
    let minSeconds: Double
    let maxSeconds: Double
}

struct TripPlanResponse: Codable {
    let plan: TripPlan
    let estimate: TripGenerationEstimate?
}

struct TripPlansResponse: Codable {
    let plans: [TripPlan]
}

// MARK: - Destination forecast

struct ForecastDay: Codable, Identifiable, Hashable {
    var id: String { date }

    let date: String
    let condition: String
    let minTempC: Double
    let maxTempC: Double
    let precipitationProbability: Double
    let uvIndex: Double
    let maxWindKph: Double
}

struct TripForecast: Codable, Hashable {
    let source: String
    let available: Bool
    let note: String
    let days: [ForecastDay]
}

struct TripWeatherSummary: Codable, Hashable {
    let id: String
    let destination: String
    let destinationDetail: String
    let startDate: String
    let endDate: String
    let dayCount: Int
}

struct TripWeatherResponse: Codable, Hashable {
    let trip: TripWeatherSummary
    let forecast: TripForecast
}

// MARK: - Generated itinerary

enum StopKind: String, Codable { case spot, transit, meal, hotel }

struct TripStop: Codable, Identifiable, Hashable {
    let id: String
    let position: Int
    let kind: StopKind
    let name: String
    let nameEn: String
    let startTime: String
    let duration: String
    let note: String
    let noteEn: String
    let photoQuery: String
    let photoUrl: String?
    let photoCredit: String?
    let photoSourceUrl: String?

    func title(_ lang: Lang) -> String { lang == .zh ? name : (nameEn.isEmpty ? name : nameEn) }
    func detail(_ lang: Lang) -> String { lang == .zh ? note : (noteEn.isEmpty ? note : noteEn) }

    var timing: String {
        [startTime, duration].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

struct TripOutfitItem: Codable, Hashable {
    let label: String
    let labelEn: String
    let wardrobeItemId: String?
    let kind: OutfitPieceKind?
    let hasPhoto: Bool?

    func name(_ lang: Lang) -> String { lang == .zh ? label : (labelEn.isEmpty ? label : labelEn) }
}

struct TripEquipmentItem: Codable, Hashable {
    let label: String
    let labelEn: String

    func name(_ lang: Lang) -> String { lang == .zh ? label : (labelEn.isEmpty ? label : labelEn) }
}

struct TripDay: Codable, Identifiable, Hashable {
    let id: String
    let dayNumber: Int
    let dateLabel: String
    let city: String
    let cityEn: String
    let summary: String
    let summaryEn: String
    let weatherSummary: String
    let weatherSummaryEn: String
    let weatherRisk: String
    let weatherRiskEn: String
    let outfit: [TripOutfitItem]
    let equipment: [TripEquipmentItem]
    let stops: [TripStop]

    func cityName(_ lang: Lang) -> String { lang == .zh ? city : (cityEn.isEmpty ? city : cityEn) }
    func summaryText(_ lang: Lang) -> String { lang == .zh ? summary : (summaryEn.isEmpty ? summary : summaryEn) }
    func weatherText(_ lang: Lang) -> String {
        lang == .zh ? weatherSummary : (weatherSummaryEn.isEmpty ? weatherSummary : weatherSummaryEn)
    }
    func riskText(_ lang: Lang) -> String {
        lang == .zh ? weatherRisk : (weatherRiskEn.isEmpty ? weatherRisk : weatherRiskEn)
    }
}

struct Trip: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let titleEn: String
    let scenario: String
    let departLabel: String
    let createdAt: String
    let sourcePlanId: String?
    let days: [TripDay]

    func name(_ lang: Lang) -> String { lang == .zh ? title : (titleEn.isEmpty ? title : titleEn) }
}

struct StopPhoto: Codable, Hashable {
    let imageUrl: String
    let credit: String
    let sourceUrl: String
}

struct StopPhotoResponse: Codable {
    let photo: StopPhoto?
}

struct TripsResponse: Codable {
    let trips: [Trip]
    let photoProvider: String
}

struct SingleTripResponse: Codable {
    let trip: Trip
    let photoProvider: String
}

// MARK: - Packing plan

struct PackingItem: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let labelEn: String
    let reuse: Int
    let quantity: Int?
    let daysUsed: [Int]?
    let wardrobeItemId: String?
    /// Server-decided "wardrobe gap" flag; always false for equipment.
    let wardrobeGap: Bool?
    let priority: String?

    func name(_ lang: Lang) -> String { lang == .zh ? label : (labelEn.isEmpty ? label : labelEn) }
}

struct PackingCategory: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let titleEn: String
    let items: [PackingItem]

    func name(_ lang: Lang) -> String { lang == .zh ? title : (titleEn.isEmpty ? title : titleEn) }
}

struct EssentialItem: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let labelEn: String

    func name(_ lang: Lang) -> String { lang == .zh ? label : (labelEn.isEmpty ? label : labelEn) }
}

struct CorePiece: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let labelEn: String
    let reuse: Int

    func name(_ lang: Lang) -> String { lang == .zh ? label : (labelEn.isEmpty ? label : labelEn) }
}

struct PackingPlan: Codable, Equatable {
    let balance: Double
    let tripDays: Int
    let summary: String
    let summaryEn: String
    let categories: [PackingCategory]
    let essentials: [EssentialItem]
    let corePieces: [CorePiece]

    func summaryText(_ lang: Lang) -> String { lang == .zh ? summary : (summaryEn.isEmpty ? summary : summaryEn) }

    var totalItems: Int { categories.reduce(0) { $0 + $1.items.count } }
}

struct PackingPlanResponse: Codable {
    let plan: PackingPlan
}

// MARK: - Trip constraints
// Mirrors `shared/trip-constraints.ts`. The server re-checks on save; this
// copy only greys out unreachable days in the calendar.

enum TripConstraints {
    /// A trip covers both end dates, so at most 30 calendar days.
    static let maxTripDays = 30
}
