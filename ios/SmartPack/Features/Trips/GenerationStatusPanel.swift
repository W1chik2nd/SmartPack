import SwiftUI

/// Progress plate for a queued trip: the estimate, the elapsed clock, and the
/// outcome. Generation continues on the server whether or not this screen is
/// open, which is what the copy tells the user.
struct GenerationStatusPanel: View {
    let progress: TripSetupView.GenerationProgress
    let elapsed: Int
    let isGenerating: Bool

    @Environment(\.lang) private var lang

    var body: some View {
        HStack(alignment: .top, spacing: Theme.space2) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(Theme.heavy(17))
                    .foregroundStyle(Theme.text)

                if isGenerating {
                    if let estimate = progress.estimate {
                        Text("\(Strings.tripEstimateLabel(lang)) · \(minutes(estimate.minSeconds))–\(minutes(estimate.maxSeconds)) \(Strings.tripMinutesShort(lang))")
                            .font(Theme.bold(13))
                            .foregroundStyle(Theme.blue)
                    }
                    Text(overdue ? Strings.tripEstimateExceeded(lang) : Strings.tripEstimateHint(lang))
                        .font(Theme.regular(12))
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(Strings.tripElapsedLabel(lang)) \(clock)")
                        .font(Theme.heavy(14))
                        .monospacedDigit()
                } else if progress.status == .completed {
                    Text(Strings.tripReadyMessage(lang))
                        .font(Theme.regular(13))
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(progress.error ?? Strings.saveTripFailed(lang))
                        .font(Theme.regular(13))
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // One heavy mark carries the state: working, done, or wrong.
            Text(mark)
                .font(Theme.heavy(22))
                .foregroundStyle(markTint)
                .frame(width: 46, height: 46)
                .background(markFill)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
        .accessibilityElement(children: .combine)
    }

    private var title: String {
        if isGenerating { return Strings.tripQueuedTitle(lang) }
        return progress.status == .completed
            ? Strings.tripReadyTitle(lang)
            : Strings.tripGenerationFailedHome(lang)
    }

    private var overdue: Bool {
        guard let estimate = progress.estimate else { return false }
        return Double(elapsed) > estimate.maxSeconds
    }

    private var clock: String {
        String(format: "%02d:%02d", elapsed / 60, elapsed % 60)
    }

    private func minutes(_ seconds: Double) -> Int {
        Int(ceil(seconds / 60))
    }

    private var mark: String {
        if isGenerating { return "AI" }
        return progress.status == .completed ? "✓" : "!"
    }

    private var markFill: Color {
        if isGenerating { return Theme.yellow }
        return progress.status == .completed ? Theme.blue : Theme.red
    }

    private var markTint: Color {
        isGenerating ? Theme.black : Theme.white
    }
}
