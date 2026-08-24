import SwiftUI

/// The "today" card. On desktop its four blocks sit in a three-column grid;
/// on a phone they stack, keeping the same thick rules between them so the
/// card still reads as one gridded object rather than four loose tiles.
struct TodayCard: View {
    let trip: TripPlan
    let model: HomeModel
    let now: Date

    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            header
            Rule()
            weatherTile
            Rule()
            checklistTile
            Rule()
            outfitTile
            Rule()
            itineraryTile
            deleteControls
        }
        .frame(maxWidth: .infinity)
        .bauhausCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Today")
    }

    // MARK: - Header

    private var header: some View {
        // TODO: the web's date header links nowhere yet either; make it a
        // control once a dedicated dates page exists.
        HStack(alignment: .firstTextBaseline) {
            Text("\(Strings.upcoming(lang)) · \(longDate)")
                .font(Theme.bold(14))
                .foregroundStyle(Theme.text)
            Spacer()
            Text(trip.placeName)
                .font(Theme.heavy(14))
                .foregroundStyle(Theme.blue)
                .lineLimit(1)
        }
        .padding(.horizontal, Theme.space2)
        .padding(.vertical, 12)
    }

    private var longDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: lang.localeIdentifier)
        formatter.setLocalizedDateFormatFromTemplate("EEEdMMM")
        return formatter.string(from: now)
    }

    // MARK: - Tiles

    private var weatherTile: some View {
        Button {
            app.push(.weather(tripPlanId: trip.id))
        } label: {
            VStack(alignment: .leading, spacing: Theme.space1) {
                CardHeading(text: Strings.destinationWeatherToday(lang))
                if let weather = model.weather {
                    HStack(alignment: .firstTextBaseline, spacing: Theme.space2) {
                        Text("\(Int(weather.tempC.rounded()))°C")
                            .font(Theme.heavy(38))
                        Text(Strings.weatherCondition(weather.condition, lang))
                            .font(Theme.bold(15))
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    Text(model.weatherFailed ? Strings.weatherUnavailable(lang) : Strings.weatherLoading(lang))
                        .font(Theme.bold(18))
                        .foregroundStyle(Theme.disabledText)
                }
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottomTrailing) { Chevron().padding(12) }
            .contentShape(Rectangle())
        }
        .buttonStyle(TileButtonStyle())
        .accessibilityElement(children: .combine)
    }

    private var checklistTile: some View {
        Button {
            app.push(.packing(tripPlanId: trip.id))
        } label: {
            HStack(alignment: .center, spacing: 12) {
                CardHeading(text: Strings.checklist(lang))
                ChecklistBagArt()
                    .frame(width: 64, height: 64)
                    .frame(width: 126, alignment: .center)
                Chevron().frame(width: 18)
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(TileButtonStyle())
        .disabled(trip.itineraryId == nil)
        .opacity(trip.itineraryId == nil ? 0.45 : 1)
    }

    private var outfitTile: some View {
        Button {
            app.push(.outfit(tripPlanId: trip.id))
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: Theme.space1) {
                    Text(Strings.todaysOutfit(lang).uppercased())
                        .font(Theme.heavy(14))
                        .tracking(0.6)
                        .foregroundStyle(Theme.text)
                    Text(outfitSummary)
                        .font(Theme.bold(11))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                DashboardOutfitFigure(day: model.todayOutfit, placeName: trip.placeName)
                    .frame(width: 126, alignment: .center)

                Chevron().frame(width: 18)
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, minHeight: 170, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(TileButtonStyle())
    }

    private var outfitSummary: String {
        guard let pieces = model.todayOutfit?.pieces, !pieces.isEmpty else {
            return model.outfitFailed ? Strings.outfitUnavailable(lang) : Strings.outfitLoading(lang)
        }
        return pieces.map { $0.name(lang) }.joined(separator: " · ")
    }

    private var itineraryTile: some View {
        Button {
            openTrip()
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                CardHeading(text: Strings.itinerary(lang))
                HStack(spacing: Theme.space1) {
                    Text(trip.placeName)
                        .font(Theme.heavy(18))
                        .foregroundStyle(Theme.text)
                    Text(Strings.scenarioLabel(trip.scenario, lang))
                        .font(Theme.bold(11))
                        .foregroundStyle(Theme.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Theme.blue)
                }
                Text(dateRange)
                    .font(Theme.bold(13))
                    .foregroundStyle(Theme.textSecondary)

                switch trip.generationStatus {
                case .processing, .pending:
                    statusChip(Strings.tripGeneratingHome(lang), Theme.yellow, Theme.black)
                case .failed:
                    statusChip(Strings.tripGenerationFailedHome(lang), Theme.red, Theme.white)
                case .completed:
                    EmptyView()
                }
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottomTrailing) { Chevron().padding(.trailing, 12) }
            .contentShape(Rectangle())
        }
        .buttonStyle(TileButtonStyle())
    }

    private func statusChip(_ text: String, _ fill: Color, _ tint: Color) -> some View {
        Text(text)
            .font(Theme.bold(12))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(fill)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: 1.5))
    }

    private var dateRange: String {
        let start = TripDate.format(trip.startDate, lang, style: .shortDay)
        let nights = TripDate.nights(from: trip.startDate, to: trip.endDate)
        if nights <= 0 { return "\(start) · \(Strings.tripSameDay(lang))" }
        let end = TripDate.format(trip.endDate, lang, style: .shortDay)
        return "\(start) – \(end) · \(nights) \(Strings.tripNights(lang))"
    }

    private func openTrip() {
        if trip.generationStatus == .failed {
            app.push(.tripSetup(scenario: trip.scenario, retry: trip))
        } else if let itineraryId = trip.itineraryId {
            app.push(.itinerary(tripId: itineraryId, scenario: trip.scenario))
        } else {
            app.selectPrimarySection(.trips)
        }
    }

    // MARK: - Delete

    @ViewBuilder
    private var deleteControls: some View {
        if model.confirmingDeleteId == trip.id {
            VStack(alignment: .leading, spacing: Theme.space1) {
                Text(trip.placeName).font(Theme.heavy(16))
                Text(Strings.deleteTripWarning(lang))
                    .font(Theme.regular(13))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if model.deleteFailed {
                    ErrorBanner(message: Strings.deleteTripFailed(lang))
                }
                HStack(spacing: Theme.space1) {
                    Button(Strings.cancelDelete(lang)) { model.confirmingDeleteId = nil }
                        .buttonStyle(BauhausButtonStyle())
                    Button(model.deletingTripId == trip.id
                           ? Strings.deletingTrip(lang)
                           : Strings.confirmDeleteTrip(lang)) {
                        Task { await model.deleteSelected() }
                    }
                    .buttonStyle(BauhausButtonStyle(fill: Theme.red, tint: Theme.white))
                }
                .disabled(model.deletingTripId == trip.id)
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.bg)
            .overlay(alignment: .top) { Rule() }
        } else if model.deletingTripId == nil {
            Button(Strings.deleteTrip(lang)) { model.confirmingDeleteId = trip.id }
                .font(Theme.bold(13))
                .foregroundStyle(Theme.danger)
                .padding(Theme.space1)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .overlay(alignment: .top) { Rule(width: Theme.hairline) }
        }
    }
}

/// The card's corner arrow.
struct Chevron: View {
    var body: some View {
        Text("›")
            .font(Theme.heavy(26))
            .foregroundStyle(Theme.text)
            .accessibilityHidden(true)
    }
}
