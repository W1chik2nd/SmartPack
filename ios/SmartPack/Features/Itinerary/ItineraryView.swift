import SwiftUI

/// The generated itinerary: the whole-trip overview curve, then the selected
/// day's plan. All of it comes from `/api/itinerary/trips`; this screen only
/// decides which day is showing and whether the overview is expanded.
///
/// Phone adaptation: the desktop layout is two panes side by side with a
/// collapse handle between them. Here they are stacked and the overview
/// collapses in place, so a tapped day scrolls straight into its plan instead
/// of updating a pane the user cannot see.
struct ItineraryView: View {
    let tripId: String?
    let scenario: String?

    @Environment(\.lang) private var lang

    @State private var trip: Trip?
    @State private var activeDayId = ""
    @State private var provider = ""
    @State private var error: String?
    @State private var loading = true
    @State private var overviewExpanded = true

    private var activeDay: TripDay? {
        trip?.days.first { $0.id == activeDayId }
    }

    var body: some View {
        ScrollViewReader { proxy in
            PageScaffold {
                header

                if let error {
                    ErrorBanner(message: error)
                }

                if trip == nil && error == nil {
                    Text(loading ? Strings.itineraryLoading(lang) : Strings.itineraryEmpty(lang))
                        .font(Theme.bold(15))
                        .foregroundStyle(Theme.textSecondary)
                } else if let trip, trip.days.isEmpty {
                    Text(Strings.itineraryEmpty(lang))
                        .font(Theme.bold(15))
                        .foregroundStyle(Theme.textSecondary)
                } else if let trip {
                    overviewSection(trip, proxy: proxy)
                    if let activeDay {
                        DayPlanView(day: activeDay)
                            .id("day-plan")
                    }
                }
            }
        }
        .task { await load() }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(trip?.name(lang) ?? Strings.itineraryTitle(lang))
                .font(Theme.heavy(30))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            if let trip {
                Text("\(trip.departLabel) \(Strings.departs(lang)) · \(trip.days.count) × \(lang == .zh ? "天" : "Day")")
                    .font(Theme.bold(13))
                    .foregroundStyle(Theme.textSecondary)
            }
            if !provider.isEmpty {
                Text("\(Strings.photoSource(lang)): \(provider)")
                    .font(Theme.regular(11))
                    .foregroundStyle(Theme.disabledText)
            }
        }
    }

    @ViewBuilder
    private func overviewSection(_ trip: Trip, proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            // Day chips stay visible when the curve is collapsed, so switching
            // days never costs a scroll back up.
            dayChips(trip, proxy: proxy)

            Button {
                withAnimation(.easeInOut(duration: 0.2)) { overviewExpanded.toggle() }
            } label: {
                Text(overviewExpanded ? "\(Strings.collapseOverview(lang)) ‹" : "\(Strings.expandOverview(lang)) ›")
            }
            .buttonStyle(BauhausButtonStyle(fontSize: 12))
            .accessibilityAddTraits(overviewExpanded ? .isSelected : [])

            if overviewExpanded {
                TripSpineView(trip: trip, activeDayId: activeDayId) { dayId in
                    select(dayId, proxy: proxy)
                }
            }
        }
    }

    private func dayChips(_ trip: Trip, proxy: ScrollViewProxy) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: Theme.space1) {
                ForEach(trip.days) { day in
                    Button {
                        select(day.id, proxy: proxy)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Strings.dayNumber(day.dayNumber, lang)).font(Theme.heavy(14))
                            Text(day.cityName(lang)).font(Theme.bold(11)).lineLimit(1)
                        }
                        .foregroundStyle(day.id == activeDayId ? Theme.white : Theme.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(day.id == activeDayId ? Theme.blue : Theme.white)
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(day.id == activeDayId ? [.isSelected, .isButton] : .isButton)
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Actions

    private func select(_ dayId: String, proxy: ScrollViewProxy) {
        activeDayId = dayId
        withAnimation { proxy.scrollTo("day-plan", anchor: .top) }
    }

    private func load() async {
        defer { loading = false }
        do {
            if let tripId {
                let response = try await APIClient.shared.itineraryTrip(id: tripId)
                apply(trip: response.trip, provider: response.photoProvider)
            } else {
                let response = try await APIClient.shared.itineraryTrips(scenario: scenario)
                apply(trip: response.trips.first, provider: response.photoProvider)
            }
        } catch {
            self.error = Strings.itineraryError(lang)
        }
    }

    private func apply(trip: Trip?, provider: String) {
        self.trip = trip
        self.provider = provider
        activeDayId = trip?.days.first?.id ?? ""
    }
}
