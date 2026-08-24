import Combine
import SwiftUI

/// Destination and dates for one scenario. Collects input and shows progress —
/// place lookup is proxied by `/api/places` and the whole plan is generated on
/// the server, so no planning rule lives here (AGENTS.md §3).
///
/// Phone adaptation: the desktop page is two columns (map left, calendar
/// right). Here they stack, each keeping its full width so the map stays
/// draggable and every calendar cell stays a comfortable tap target.
struct TripSetupView: View {
    let scenario: String
    var retryPlan: TripPlan?

    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [Place]?
    @State private var searching = false
    @State private var place: Place?
    @State private var range: DateRange?
    @State private var agenda = ""
    @State private var error: String?
    @State private var saving = false
    @State private var generation: GenerationProgress?
    @State private var elapsed = 0
    @State private var seeded = false

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    struct GenerationProgress: Equatable {
        let planId: String
        var status: TripPlan.GenerationStatus
        var estimate: TripGenerationEstimate?
        var error: String?
    }

    private var isGenerating: Bool {
        generation?.status == .pending || generation?.status == .processing
    }

    /// With nothing picked the map rests on a recognisably global view rather
    /// than blank ocean.
    private var center: MapPoint {
        place.map { MapPoint(lat: $0.lat, lon: $0.lon) } ?? MapPoint(lat: 30, lon: 20)
    }

    var body: some View {
        PageScaffold {
            header

            if let error {
                ErrorBanner(message: error)
            }

            searchBar
            if let results { resultList(results) }

            TileMapView(
                center: center,
                zoom: place == nil ? 2 : 9,
                marker: place.map { MapPoint(lat: $0.lat, lon: $0.lon) },
                label: Strings.mapLabel(lang)
            )
            .frame(height: 280)

            DateRangePickerView(value: $range)
            dateBar

            agendaSection

            if let generation {
                GenerationStatusPanel(progress: generation, elapsed: elapsed, isGenerating: isGenerating)
            }

            actions
        }
        .onAppear(perform: seedFromRetry)
        .onReceive(ticker) { _ in if isGenerating { elapsed += 1 } }
        .task(id: generation?.planId) { await pollGeneration() }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(
                text: "\(Strings.scenarioLabel(scenario, lang)) · \(app.user?.name ?? "")",
                color: Theme.textSecondary
            )
            Text(Strings.tripSetupTitle(lang))
                .font(Theme.heavy(30))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var searchBar: some View {
        HStack(spacing: 0) {
            TextField(Strings.searchPlace(lang), text: $query)
                .font(Theme.bold(16))
                .foregroundStyle(Theme.text)
                .tint(Theme.blue)
                .submitLabel(.search)
                .onSubmit { Task { await search() } }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .accessibilityLabel(Strings.searchPlace(lang))

            Button {
                Task { await search() }
            } label: {
                Text(searching ? "…" : "⌕")
                    .font(Theme.heavy(20))
                    .foregroundStyle(Theme.white)
                    .frame(width: 52, height: 46)
                    .background(Theme.blue)
            }
            .disabled(searching)
            .accessibilityLabel(Strings.searchAction(lang))
        }
        .bauhausPanel()
    }

    @ViewBuilder
    private func resultList(_ places: [Place]) -> some View {
        VStack(spacing: 0) {
            if places.isEmpty {
                Text(Strings.noPlaces(lang))
                    .font(Theme.bold(14))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.space2)
            }
            ForEach(Array(places.enumerated()), id: \.element.id) { index, candidate in
                if index > 0 { Rule(width: Theme.hairline) }
                Button {
                    place = candidate
                    results = nil
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(candidate.name).font(Theme.heavy(16))
                        if !candidate.detail.isEmpty {
                            Text(candidate.detail)
                                .font(Theme.regular(13))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.space2)
                    .background(place?.id == candidate.id ? Theme.yellow : Theme.white)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .bauhausPanel()
    }

    private var dateBar: some View {
        HStack(spacing: Theme.space2) {
            Button {
                range = nil
            } label: {
                Text("✕").font(Theme.heavy(16)).frame(width: 34, height: 34)
            }
            .buttonStyle(BauhausButtonStyle(padding: .init(top: 0, leading: 0, bottom: 0, trailing: 0)))
            .disabled(range == nil)
            .accessibilityLabel(Strings.clearDates(lang))

            if let range {
                VStack(alignment: .leading, spacing: 2) {
                    Text(rangeLabel(range))
                        .font(Theme.bold(14))
                        .foregroundStyle(Theme.text)
                    Text(nightsLabel(range))
                        .font(Theme.heavy(12))
                        .foregroundStyle(Theme.blue)
                }
            } else {
                Text(Strings.noDates(lang))
                    .font(Theme.bold(14))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausPanel(width: Theme.hairline)
        .accessibilityElement(children: .combine)
    }

    private var agendaSection: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            Eyebrow(text: Strings.tripAgendaKicker(lang), color: Theme.textSecondary)
            Text(Strings.tripAgendaTitle(lang))
                .font(Theme.heavy(20))
            Text(Strings.tripAgendaHint(lang))
                .font(Theme.regular(13))
                .foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            TextEditor(text: $agenda)
                .font(Theme.regular(15))
                .foregroundStyle(Theme.text)
                .tint(Theme.blue)
                .scrollContentBackground(.hidden)
                .frame(height: 140)
                .padding(8)
                .background(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                .overlay(alignment: .topLeading) {
                    if agenda.isEmpty {
                        Text(Strings.tripAgendaPlaceholder(lang))
                            .font(Theme.regular(15))
                            .foregroundStyle(Theme.disabledText)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 16)
                            .allowsHitTesting(false)
                    }
                }
                .accessibilityLabel(Strings.tripAgendaTitle(lang))
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            Button {
                if generation != nil { finish() } else { Task { await generate() } }
            } label: {
                Text(primaryTitle)
            }
            .buttonStyle(PrimaryButtonStyle(enabled: !saving && !isGenerating))
            .disabled(saving || isGenerating)

            if isGenerating {
                Button(Strings.backToHome(lang)) { finish() }
                    .buttonStyle(BauhausButtonStyle())
            }

            if generation == nil {
                Text(saving ? Strings.tripAgentWorking(lang) : Strings.tripAgentNote(lang))
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var primaryTitle: String {
        if isGenerating { return Strings.tripQueuedButton(lang) }
        switch generation?.status {
        case .completed: return Strings.tripViewPlan(lang)
        case .failed: return Strings.backToHome(lang)
        default: return saving ? Strings.generatingTrip(lang) : Strings.generateTrip(lang)
        }
    }

    // MARK: - Labels

    private func rangeLabel(_ range: DateRange) -> String {
        let start = TripDate.format(range.start, lang, style: .full)
        guard TripDate.nights(from: range.start, to: range.end) > 0 else { return start }
        return "\(start) — \(TripDate.format(range.end, lang, style: .full))"
    }

    private func nightsLabel(_ range: DateRange) -> String {
        let nights = TripDate.nights(from: range.start, to: range.end)
        return nights > 0 ? "\(nights) \(Strings.nights(lang))" : Strings.sameDay(lang)
    }

    // MARK: - Actions

    /// A failed dashboard plan seeds this retry with its own values.
    private func seedFromRetry() {
        guard !seeded, let retryPlan else { return }
        seeded = true
        query = retryPlan.placeName
        place = Place(
            id: retryPlan.id,
            name: retryPlan.placeName,
            detail: retryPlan.placeDetail,
            lat: retryPlan.lat,
            lon: retryPlan.lon
        )
        range = DateRange(start: retryPlan.startDate, end: retryPlan.endDate)
        agenda = retryPlan.notes
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        searching = true
        error = nil
        defer { searching = false }
        do {
            let found = try await APIClient.shared.searchPlaces(text, lang: lang).places
            results = found
            // Jump straight to the best match; the list stays open so
            // same-named places can still be swapped in.
            if let first = found.first { place = first }
        } catch {
            // Surface the server's real reason instead of a blanket failure.
            self.error = error.localizedDescription
            results = nil
        }
    }

    private func generate() async {
        guard let place, let range else {
            error = Strings.needPlaceAndDates(lang)
            return
        }
        saving = true
        error = nil
        defer { saving = false }
        do {
            let response = try await APIClient.shared.generateTripPlan(NewTripPlan(
                scenario: scenario,
                placeName: place.name,
                placeDetail: place.detail,
                lat: place.lat,
                lon: place.lon,
                startDate: range.start,
                endDate: range.end,
                notes: agenda,
                replaceFailedPlanId: retryPlan?.id
            ))
            elapsed = 0
            generation = GenerationProgress(
                planId: response.plan.id,
                status: response.plan.generationStatus,
                estimate: response.estimate,
                error: response.plan.generationError
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Generation runs on the server; poll the durable status until it settles.
    private func pollGeneration() async {
        guard let planId = generation?.planId else { return }
        while !Task.isCancelled, isGenerating {
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled else { return }
            guard let response = try? await APIClient.shared.tripPlan(id: planId) else { continue }
            generation = GenerationProgress(
                planId: planId,
                status: response.plan.generationStatus,
                estimate: response.estimate,
                error: response.plan.generationError
            )
        }
    }

    private func finish() {
        app.popToRoot()
    }
}
