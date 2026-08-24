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

    func testLatestOutfitDescriptionContractDecodesWithoutPhotoFlag() throws {
        let json = Data(#"{"id":"top-1","kind":"top","label":"橙色印花长袖","labelEn":"orange printed long sleeve","tone":"orange","pattern":"printed","sleeve":"long","garmentStyle":"shirt","accessoryStyle":null,"fit":"regular","material":"cotton","detail":"contrast print","wardrobeItemId":"wardrobe-1"}"#.utf8)

        let piece = try JSONDecoder().decode(OutfitPiece.self, from: json)

        XCTAssertEqual(piece.tone, .orange)
        XCTAssertEqual(piece.pattern, .printed)
        XCTAssertEqual(piece.sleeve, .long)
        XCTAssertEqual(piece.wardrobeItemId, "wardrobe-1")
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

    func testLandingArrowShapeFillsItsTransitionHitArea() {
        let bounds = CGRect(x: 0, y: 0, width: 320, height: 80)
        let arrowBounds = ArrowBanner().path(in: bounds).boundingRect

        XCTAssertEqual(arrowBounds.minX, bounds.minX)
        XCTAssertEqual(arrowBounds.minY, bounds.minY)
        XCTAssertEqual(arrowBounds.maxX, bounds.maxX)
        XCTAssertEqual(arrowBounds.maxY, bounds.maxY)
    }

    func testDashboardDaytimeMatchesWebBoundaries() {
        XCTAssertFalse(DashboardClock.isDaytime(hour: 5))
        XCTAssertTrue(DashboardClock.isDaytime(hour: 6))
        XCTAssertTrue(DashboardClock.isDaytime(hour: 17))
        XCTAssertFalse(DashboardClock.isDaytime(hour: 18))
    }

    func testTodayCardTrailingArtworkColumnKeepsCompactIconsCentered() {
        XCTAssertEqual(TodayCardLayout.artworkColumnWidth, 126)
        XCTAssertEqual(TodayCardLayout.compactArtworkSize, 64)
        XCTAssertEqual(TodayCardLayout.chevronColumnWidth, 18)
        XCTAssertGreaterThan(
            TodayCardLayout.artworkColumnWidth,
            TodayCardLayout.compactArtworkSize
        )
    }

    func testWeatherArtworkUsesSharedConditionMapping() {
        XCTAssertEqual(WeatherArtwork.assetName(for: "Clear"), "weather-clear")
        XCTAssertEqual(WeatherArtwork.assetName(for: "Snow showers"), "weather-snow-showers")
        XCTAssertEqual(WeatherArtwork.assetName(for: "Unknown"), "weather-overcast")
    }

    func testProfileUsesNeutralAvatarWithoutBinaryGender() {
        XCTAssertEqual(ProfileAvatar.assetName(gender: "male"), "profile-male")
        XCTAssertEqual(ProfileAvatar.assetName(gender: "female"), "profile-female")
        XCTAssertEqual(ProfileAvatar.assetName(gender: nil), "profile-neutral")
        XCTAssertEqual(ProfileAvatar.assetName(gender: "other"), "profile-neutral")
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
            pattern: .solid,
            sleeve: kind == .top ? .short : nil,
            garmentStyle: kind == .accessory ? nil : .shirt,
            accessoryStyle: kind == .accessory ? .bag : nil,
            fit: .regular,
            material: .cotton,
            detail: "",
            wardrobeItemId: nil
        )
    }
}
