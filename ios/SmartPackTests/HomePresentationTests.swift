import XCTest
@testable import SmartPack

final class HomePresentationTests: XCTestCase {
    func testDashboardIncludesEveryGeneratedScenario() {
        let scenarios = ["travel", "business", "date", "commute", "sport", "formal"]
        let plans = scenarios.map { trip(id: $0, scenario: $0) }

        XCTAssertEqual(DashboardTrips.filter(plans).map(\.scenario), scenarios)
    }

    func testDashboardExcludesUnknownAndIncompletePlans() {
        let unknown = trip(id: "unknown", scenario: "other")
        let incomplete = trip(id: "pending", scenario: "travel", itineraryId: nil, status: .pending)

        XCTAssertTrue(DashboardTrips.filter([unknown, incomplete]).isEmpty)
    }

    func testOutfitLayersKeepTwoTopsInOneTorsoSlot() {
        let pieces = [
            piece(id: "inner", kind: .top),
            piece(id: "outer", kind: .top),
            piece(id: "bottom", kind: .bottom),
            piece(id: "shoes", kind: .shoes),
            piece(id: "bag", kind: .accessory),
        ]

        let layers = DashboardOutfitLayers(pieces: pieces)

        XCTAssertEqual(layers.inner?.id, "inner")
        XCTAssertEqual(layers.outer?.id, "outer")
        XCTAssertEqual(layers.bottom?.id, "bottom")
        XCTAssertEqual(layers.shoes?.id, "shoes")
        XCTAssertEqual(layers.accessory?.id, "bag")
        XCTAssertEqual(layers.displayedPieces.map(\.id), ["inner", "outer", "bottom", "shoes", "bag"])
    }

    func testLegacyOutfitDayWithoutEnglishPlaceStillDecodes() throws {
        let json = Data(#"{"id":"day-1","dayNumber":1,"date":"2026-08-25","place":"成都","scene":"travel","pieces":[]}"#.utf8)

        let day = try JSONDecoder().decode(OutfitDay.self, from: json)

        XCTAssertEqual(day.placeName(.en), "成都")
    }

    func testTripWeatherContractDecodes() throws {
        let json = Data(#"{"trip":{"id":"trip-1","destination":"Tromsø","destinationDetail":"Norway","startDate":"2026-08-25","endDate":"2026-08-26","dayCount":2},"forecast":{"source":"Open-Meteo","available":true,"note":"","days":[{"date":"2026-08-25","condition":"Rain","minTempC":8.2,"maxTempC":13.4,"precipitationProbability":75,"uvIndex":1.3,"maxWindKph":22.5}]}}"#.utf8)

        let response = try JSONDecoder().decode(TripWeatherResponse.self, from: json)

        XCTAssertEqual(response.trip.dayCount, 2)
        XCTAssertEqual(response.forecast.days.first?.condition, "Rain")
        XCTAssertEqual(response.forecast.days.first?.precipitationProbability, 75)
    }

    func testScenarioArtworkUsesCatalogFilename() {
        let scenario = Scenario(id: "business", label: "Business", image: "/scenarios/business.jpg")

        XCTAssertEqual(ScenarioArtworkName.resolve(scenario), "scenario-business")
    }

    func testPersonalColorResponseDecodesSeasonRecommendation() throws {
        let json = Data(#"{"analysis":"偏冷，适合高对比配色","season":"winter"}"#.utf8)

        let response = try JSONDecoder().decode(PersonalColorResponse.self, from: json)

        XCTAssertEqual(response.season, "winter")
        XCTAssertFalse(response.analysis.isEmpty)
    }

    func testDockDragMapsHorizontalPositionToSections() {
        XCTAssertEqual(DockSection.at(x: -20, width: 500), .today)
        XCTAssertEqual(DockSection.at(x: 120, width: 500), .trips)
        XCTAssertEqual(DockSection.at(x: 250, width: 500), .wardrobe)
        XCTAssertEqual(DockSection.at(x: 375, width: 500), .profile)
        XCTAssertEqual(DockSection.at(x: 520, width: 500), .assistant)
    }

    func testDockSliderPullsTowardStopsAndKeepsEdgeResistance() {
        let rawPosition: CGFloat = 225
        let magnetized = DockSliderGeometry.magnetized(x: rawPosition, width: 500)

        XCTAssertGreaterThan(magnetized, rawPosition)
        XCTAssertEqual(DockSliderGeometry.magnetized(x: 250, width: 500), 250)
        XCTAssertGreaterThan(DockSliderGeometry.magnetized(x: -50, width: 500), 0)
    }

    func testDockSliderUsesDampedMomentumToPickReleaseStop() {
        XCTAssertEqual(
            DockSliderGeometry.projectedTarget(currentX: 145, predictedX: 390, width: 500),
            .wardrobe
        )
    }

    @MainActor
    func testChangingPrimarySectionClearsOnlyTheDetailStack() {
        let app = AppState()
        app.push(.weather(tripPlanId: "trip-1"))

        app.selectPrimarySection(.wardrobe)

        XCTAssertEqual(app.primarySection, .wardrobe)
        XCTAssertTrue(app.path.isEmpty)
    }

    private func trip(
        id: String,
        scenario: String,
        itineraryId: String? = "itinerary",
        status: TripPlan.GenerationStatus = .completed
    ) -> TripPlan {
        TripPlan(
            id: id,
            scenario: scenario,
            placeName: "Leeds",
            placeDetail: "UK",
            lat: 53.8,
            lon: -1.55,
            startDate: "2026-08-25",
            endDate: "2026-08-26",
            notes: "",
            itineraryId: itineraryId,
            generationStatus: status,
            generationError: nil,
            createdAt: "2026-08-24T00:00:00Z"
        )
    }

    private func piece(id: String, kind: OutfitPieceKind) -> OutfitPiece {
        OutfitPiece(
            id: id,
            kind: kind,
            label: id,
            labelEn: id,
            tone: .blue,
            garmentStyle: kind == .accessory ? nil : .shirt,
            accessoryStyle: kind == .accessory ? .bag : nil,
            fit: .regular,
            material: .cotton,
            detail: "",
            wardrobeItemId: nil,
            hasPhoto: false
        )
    }
}
