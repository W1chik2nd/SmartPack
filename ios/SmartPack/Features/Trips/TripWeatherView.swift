import SwiftUI

/// Destination-local daily weather from the saved-trip API. The backend owns
/// forecast windows and day counts; this screen only adapts that contract to a
/// swipeable phone layout.
struct TripWeatherView: View {
    let tripPlanId: String

    @Environment(\.lang) private var lang

    @State private var data: TripWeatherResponse?
    @State private var failed = false
    @State private var requestVersion = 0

    var body: some View {
        PageScaffold {
            if let data {
                heading(data.trip)
                summary(data)
                forecast(data)
            } else if failed {
                VStack(alignment: .leading, spacing: Theme.space2) {
                    ErrorBanner(message: Strings.tripWeatherLoadFailed(lang))
                    Button(Strings.tripWeatherRetry(lang)) { requestVersion += 1 }
                        .buttonStyle(BauhausButtonStyle(fill: Theme.yellow))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(Strings.weatherLoading(lang))
                    .font(Theme.bold(16))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .task(id: requestVersion) { await load() }
    }

    private func heading(_ trip: TripWeatherSummary) -> some View {
        HStack(alignment: .bottom, spacing: Theme.space2) {
            VStack(alignment: .leading, spacing: 5) {
                Text(Strings.tripWeatherTitle(lang))
                    .font(Theme.heavy(36))
                    .tracking(-0.5)
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)

            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text("\(trip.dayCount)").font(Theme.heavy(34))
                Text(Strings.tripWeatherDayUnit(lang).uppercased()).font(Theme.heavy(11))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Theme.yellow)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
            .background(Rectangle().fill(Theme.black).offset(x: 4, y: 4))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(Strings.tripWeatherDays(lang)): \(trip.dayCount)")
        }
    }

    private func summary(_ data: TripWeatherResponse) -> some View {
        VStack(spacing: 0) {
            summaryRow(
                label: Strings.destination(lang),
                value: data.trip.destination,
                detail: data.trip.destinationDetail,
                fill: Theme.white,
                tint: Theme.text
            )
            Rule()
            summaryRow(
                label: Strings.tripWeatherDates(lang),
                value: "\(date(data.trip.startDate)) — \(date(data.trip.endDate))",
                fill: Theme.yellow,
                tint: Theme.text
            )
            Rule()
            summaryRow(
                label: Strings.tripWeatherSource(lang),
                value: data.forecast.source,
                fill: Theme.blue,
                tint: Theme.white
            )
        }
        .bauhausCard()
        .accessibilityElement(children: .contain)
    }

    private func summaryRow(
        label: String,
        value: String,
        detail: String = "",
        fill: Color,
        tint: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: label, color: tint)
            Text(value)
                .font(Theme.heavy(22))
                .foregroundStyle(tint)
                .fixedSize(horizontal: false, vertical: true)
            if !detail.isEmpty {
                Text(detail)
                    .font(Theme.bold(12))
                    .foregroundStyle(tint)
                    .opacity(0.78)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
        .background(fill)
    }

    private func forecast(_ data: TripWeatherResponse) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(Strings.tripWeatherDaily(lang).uppercased())
                    .font(Theme.heavy(20))
                Spacer()
                Text("\(data.forecast.days.count) / \(data.trip.dayCount)")
                    .font(Theme.heavy(12))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(Theme.bg)
                    .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
            }
            .padding(Theme.space2)

            Rule()

            if data.forecast.available {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 0) {
                        ForEach(Array(data.forecast.days.enumerated()), id: \.element.id) { index, day in
                            ForecastDayCard(day: day, index: index)
                                .containerRelativeFrame(.horizontal)
                                .scrollTransition(.animated.threshold(.visible(0.85))) { content, phase in
                                    content.opacity(phase.isIdentity ? 1 : 0.72)
                                }
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollIndicators(.hidden)
            } else {
                HStack(alignment: .top, spacing: Theme.space2) {
                    Text("!")
                        .font(Theme.heavy(24))
                        .frame(width: 42, height: 42)
                        .background(Theme.red)
                        .foregroundStyle(Theme.white)
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                    Text(Strings.tripWeatherOutsideWindow(lang))
                        .font(Theme.bold(14))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(Theme.space2)
            }
        }
        .bauhausCard()
    }

    private func date(_ iso: String) -> String {
        TripDate.format(iso, lang, style: .shortDay)
    }

    private func load() async {
        failed = false
        data = nil
        do {
            data = try await APIClient.shared.tripWeather(id: tripPlanId)
        } catch {
            failed = true
        }
    }
}

private struct ForecastDayCard: View {
    let day: ForecastDay
    let index: Int

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(Strings.dayNumber(index + 1, lang)).font(Theme.heavy(14))
                Spacer()
                Text(TripDate.format(day.date, lang, style: .weekdayDay))
                    .font(Theme.bold(12))
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.space2)
            .background(Theme.yellow)

            Rule(width: Theme.hairline)

            HStack(spacing: Theme.space2) {
                WeatherArtwork(condition: day.condition)
                    .frame(width: 96, height: 96)

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(Int(day.maxTempC.rounded()))°")
                        .font(Theme.heavy(42))
                    Text(Strings.weatherCondition(day.condition, lang))
                        .font(Theme.bold(14))
                }
                Spacer(minLength: 0)
            }
            .padding(Theme.space2)

            Rule(width: Theme.hairline)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.space1) {
                metric(Strings.tripWeatherHigh(lang), "\(Int(day.maxTempC.rounded()))°C")
                metric(Strings.tripWeatherLow(lang), "\(Int(day.minTempC.rounded()))°C")
                metric(Strings.tripWeatherRain(lang), "\(Int(day.precipitationProbability.rounded()))%")
                metric(Strings.tripWeatherUV(lang), String(format: "%.1f", day.uvIndex))
                metric(Strings.tripWeatherWind(lang), "\(Int(day.maxWindKph.rounded())) km/h")
            }
            .padding(Theme.space2)
        }
        .background(Theme.white)
        .accessibilityElement(children: .combine)
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(text: label, color: Theme.textSecondary)
            Text(value).font(Theme.heavy(16))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Theme.bg)
        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: 1.5))
    }

}
