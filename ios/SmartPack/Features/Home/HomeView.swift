import Combine
import SwiftUI

/// The home dashboard. Primary sections live in the persistent phone dock, so
/// this scroll view can stay focused on the time-sensitive recommendation.
struct HomeView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var model = HomeModel()
    @State private var now = Date()

    /// Half-minute ticks keep the greeting and day/night scene current.
    private let clock = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        PageScaffold {
            greeting

            if let trip = model.selectedTrip {
                if model.travelTrips.count > 1 {
                    TripSwitcherBar(
                        index: model.selectedIndex,
                        total: model.travelTrips.count,
                        placeName: trip.placeName,
                        onStep: model.step
                    )
                }
                TodayCard(trip: trip, model: model, now: now)
            } else if model.trips != nil {
                emptyCard
            }

        }
        .onReceive(clock) { now = $0 }
        .onAppear { model.start() }
        .onDisappear { model.stop() }
    }

    // MARK: - Greeting

    private var greeting: some View {
        ZStack(alignment: .trailing) {
            DashboardSkyScene(isDaytime: isDaytime)
                .frame(width: 92)

            Text(greetingLine)
                .font(Theme.heavy(22))
                .foregroundStyle(isDaytime ? Theme.text : Theme.white)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.trailing, 72)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, Theme.space2)
        .padding(.horizontal, Theme.space2)
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        .bauhausCard(fill: isDaytime ? Theme.white : Theme.blue)
    }

    private var greetingLine: String {
        "\(greetingWord), \(app.user?.name ?? "").".uppercased()
    }

    private var greetingWord: String {
        let hour = Calendar.current.component(.hour, from: now)
        switch hour {
        case ..<5: return Strings.goodNight(lang)
        case ..<12: return Strings.goodMorning(lang)
        case ..<18: return Strings.goodAfternoon(lang)
        default: return Strings.goodEvening(lang)
        }
    }

    private var isDaytime: Bool {
        DashboardClock.isDaytime(hour: Calendar.current.component(.hour, from: now))
    }

    // MARK: - Empty state

    private var emptyCard: some View {
        Button {
            app.selectPrimarySection(.trips)
        } label: {
            VStack(spacing: Theme.space1) {
                Text("+")
                    .font(Theme.heavy(64))
                    .foregroundStyle(Theme.red)
                Text(Strings.noTripYet(lang))
                    .font(Theme.bold(15))
                    .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.space5)
            .bauhausCard()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Strings.tripPlanner(lang))
    }

}

/// Previous/next controls above the today card, with the destination read out
/// between them. Hidden below two trips, exactly as the web component is.
struct TripSwitcherBar: View {
    let index: Int
    let total: Int
    let placeName: String
    let onStep: (Int) -> Void

    @Environment(\.lang) private var lang

    var body: some View {
        HStack(spacing: Theme.space2) {
            stepButton("‹", -1, label: Strings.previousTrip(lang))

            VStack(alignment: .leading, spacing: 2) {
                Eyebrow(text: Strings.destination(lang), color: Theme.textSecondary)
                Text(placeName)
                    .font(Theme.heavy(18))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)

            Text("\(index + 1)/\(total)")
                .font(Theme.bold(13))
                .foregroundStyle(Theme.textSecondary)

            stepButton("›", 1, label: Strings.nextTrip(lang))
        }
        .padding(.horizontal, Theme.space2)
        .padding(.vertical, Theme.space1)
        .frame(maxWidth: .infinity)
        .bauhausPanel(fill: Theme.white, width: Theme.hairline)
    }

    private func stepButton(_ glyph: String, _ direction: Int, label: String) -> some View {
        Button { onStep(direction) } label: {
            Text(glyph)
                .font(Theme.heavy(24))
                .frame(width: 34, height: 34)
        }
        .buttonStyle(BauhausButtonStyle(padding: .init(top: 0, leading: 0, bottom: 0, trailing: 0)))
        .accessibilityLabel(label)
    }
}
