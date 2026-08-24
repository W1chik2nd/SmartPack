import SwiftUI

/// Trip outfit overview: the selected day's look, the trip context behind it,
/// and a grid of every other day.
///
/// Phone adaptation: the desktop layout is three columns inside one bordered
/// slab (context | featured look | day grid). Here the same three blocks stack
/// with the featured look first — it is what the screen is for — and the day
/// grid keeps two columns so the mini outfits stay large enough to read.
struct OutfitOverviewView: View {
    let tripPlanId: String?

    @Environment(\.lang) private var lang

    @State private var plan: OutfitPlan?
    @State private var weather: Weather?
    @State private var weatherFailed = false
    @State private var activeIndex = 0
    @State private var failed = false

    private var activeDay: OutfitDay? {
        guard let plan, plan.days.indices.contains(activeIndex) else { return nil }
        return plan.days[activeIndex]
    }

    var body: some View {
        PageScaffold {
            if failed {
                ErrorBanner(message: Strings.outfitLoadFailed(lang))
            } else if let plan, let day = activeDay {
                header(plan, day)
                featured(plan, day)
                context(plan)
                dayGrid(plan)
            } else {
                Text(Strings.outfitLoading(lang))
                    .font(Theme.bold(16))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .task(id: tripPlanId) { await load() }
    }

    // MARK: - Sections

    private func header(_ plan: OutfitPlan, _ day: OutfitDay) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(Strings.outfitOverviewTitle(lang))
                .font(Theme.heavy(28))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Theme.space1)
            Text("\(Strings.dayNumber(day.dayNumber, lang)) / \(plan.days.count)")
                .font(Theme.heavy(13))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Theme.yellow)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
        }
    }

    private func featured(_ plan: OutfitPlan, _ day: OutfitDay) -> some View {
        let scenario = Strings.scenarioLabel(plan.scenario, lang)
        let garments = day.pieces.filter { $0.kind != .accessory }
        let accessory = day.pieces.first { $0.kind == .accessory }
        let incomplete = day.pieces.contains { $0.wardrobeItemId == nil }

        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(text: "\(Strings.dayNumber(day.dayNumber, lang)) · \(TripDate.format(day.date, lang, style: .weekdayDay)) · \(day.placeName(lang))")
                Text(scenario).font(Theme.heavy(24))
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)

            Rule()

            HStack(spacing: Theme.space1) {
                stageButton("‹", -1, plan.days.count, label: Strings.outfitPreviousDay(lang))

                VStack(spacing: 14) {
                    ForEach(garments) { piece in
                        VStack(spacing: 5) {
                            OutfitPieceVisual(piece: piece, scale: 0.82)
                            Text(piece.name(lang))
                                .font(Theme.bold(12))
                                .foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                    }
                    if let accessory {
                        VStack(spacing: 5) {
                            OutfitPieceVisual(piece: accessory, scale: 0.82)
                            Text(accessory.name(lang))
                                .font(Theme.bold(12))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.space3)

                stageButton("›", 1, plan.days.count, label: Strings.outfitNextDay(lang))
            }
            .padding(.horizontal, Theme.space1)
            .background(Theme.bg)

            Rule()

            Text(incomplete ? Strings.outfitSuggestedPieces(lang) : Strings.outfitFromWardrobe(lang))
                .font(Theme.bold(12))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.space2)
                .background(Theme.bg)
        }
        .bauhausCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.outfitSelectedDay(lang))
    }

    private func stageButton(_ glyph: String, _ step: Int, _ count: Int, label: String) -> some View {
        Button {
            activeIndex = (activeIndex + step + count) % count
        } label: {
            Text(glyph)
                .font(Theme.heavy(30))
                .foregroundStyle(Theme.text)
                .frame(width: 38, height: 54)
                .background(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
        }
        .accessibilityLabel(label)
    }

    private func context(_ plan: OutfitPlan) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(text: Strings.outfitDestination(lang))
                Text(plan.destination).font(Theme.heavy(26))
                if !plan.destinationDetail.isEmpty {
                    Text(plan.destinationDetail)
                        .font(Theme.bold(13))
                        .foregroundStyle(Theme.textSecondary)
                }
                HStack(spacing: Theme.space3) {
                    labelled(Strings.outfitDate(lang),
                             "\(TripDate.format(plan.startDate, lang, style: .numericDay)) – \(TripDate.format(plan.endDate, lang, style: .numericDay))")
                    labelled(Strings.outfitScene(lang), Strings.scenarioLabel(plan.scenario, lang))
                }
                .padding(.top, Theme.space1)
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)

            Rule()

            HStack(spacing: Theme.space2) {
                Circle()
                    .fill(Theme.yellow)
                    .overlay(Circle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(weather.map { "\(Int($0.tempC.rounded()))°C" } ?? "—")
                        .font(Theme.heavy(22))
                    Text(weather.map { Strings.weatherCondition($0.condition, lang) }
                         ?? (weatherFailed ? Strings.weatherUnavailable(lang) : Strings.weatherLoading(lang)))
                        .font(Theme.bold(13))
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
            }
            .padding(Theme.space2)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Strings.destinationWeatherToday(lang))

            Rule()

            itineraryTable(plan)
        }
        .bauhausCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.outfitTripContext(lang))
    }

    private func labelled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(text: title, color: Theme.textSecondary)
            Text(value).font(Theme.heavy(14))
        }
    }

    private func itineraryTable(_ plan: OutfitPlan) -> some View {
        VStack(spacing: 0) {
            CardHeading(text: Strings.outfitItineraryOverview(lang))
                .padding(Theme.space2)

            HStack(spacing: 0) {
                ForEach([Strings.outfitDate(lang), Strings.outfitPlace(lang), Strings.outfitScene(lang)], id: \.self) { title in
                    Text(title.uppercased())
                        .font(Theme.heavy(10))
                        .tracking(0.6)
                        .foregroundStyle(Theme.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 7)
                }
            }
            .background(Theme.blue)

            ForEach(Array(plan.days.enumerated()), id: \.element.id) { index, day in
                Button {
                    activeIndex = index
                } label: {
                    HStack(spacing: 0) {
                        cell(TripDate.format(day.date, lang, style: .numericDay))
                        cell(day.placeName(lang))
                        cell(Strings.scenarioLabel(day.scene, lang))
                    }
                    .background(index == activeIndex ? Theme.yellow : Theme.white)
                    .overlay(alignment: .bottom) { Rule(width: Theme.hairline) }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(index == activeIndex ? [.isSelected, .isButton] : .isButton)
            }
        }
    }

    private func cell(_ text: String) -> some View {
        Text(text)
            .font(Theme.bold(12))
            .foregroundStyle(Theme.text)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .padding(.vertical, 9)
    }

    private func dayGrid(_ plan: OutfitPlan) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            Text(Strings.outfitDailyOverview(lang)).font(Theme.heavy(22))

            LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.space2),
                                GridItem(.flexible(), spacing: Theme.space2)],
                      spacing: Theme.space2) {
                ForEach(Array(plan.days.enumerated()), id: \.element.id) { index, day in
                    Button {
                        activeIndex = index
                    } label: {
                        VStack(alignment: .leading, spacing: Theme.space1) {
                            Text(Strings.dayNumber(day.dayNumber, lang)).font(Theme.heavy(17))
                            MiniOutfit(day: day)
                                .frame(maxWidth: .infinity)
                            Text(TripDate.format(day.date, lang, style: .numericDay))
                                .font(Theme.heavy(11))
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                        .padding(Theme.space1)
                        .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
                        .background(Theme.bg)
                        .overlay(Rectangle().strokeBorder(
                            index == activeIndex ? Theme.yellow : Theme.black,
                            lineWidth: index == activeIndex ? 5 : Theme.hairline
                        ))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(index == activeIndex ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.outfitDailyOverview(lang))
    }

    // MARK: - Loading

    private func load() async {
        do {
            let loaded = try await APIClient.shared.outfitPlan(tripPlanId: tripPlanId).plan
            plan = loaded
            activeIndex = 0
            weather = try? await APIClient.shared.weather(lat: loaded.lat, lon: loaded.lon)
            weatherFailed = weather == nil
        } catch {
            failed = true
        }
    }
}

/// The stacked thumbnail used on each day card: clothes above, accessory below.
struct MiniOutfit: View {
    let day: OutfitDay

    var body: some View {
        VStack(spacing: 6) {
            ForEach(day.pieces.filter { $0.kind == .top || $0.kind == .bottom }) { piece in
                OutfitPieceVisual(piece: piece, compact: true)
            }
            if let accessory = day.pieces.first(where: { $0.kind == .accessory }) {
                OutfitPieceVisual(piece: accessory, compact: true)
            }
        }
        .accessibilityHidden(true)
    }
}
