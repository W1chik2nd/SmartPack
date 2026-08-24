import SwiftUI

/// One stop: photo, kind, name, timing, note.
///
/// The card fetches its own photo. The server looks it up once and caches it,
/// so a slow or rate-limited image provider only ever delays a single card
/// instead of holding up the whole itinerary.
struct StopCardView: View {
    let stop: TripStop

    @Environment(\.lang) private var lang
    @State private var photo: StopPhoto?
    @State private var pending: Bool

    init(stop: TripStop) {
        self.stop = stop
        // The server may already have stored a photo; skip the request then.
        _photo = State(initialValue: stop.photoUrl.map {
            StopPhoto(imageUrl: $0, credit: stop.photoCredit ?? "", sourceUrl: stop.photoSourceUrl ?? "")
        })
        _pending = State(initialValue: stop.photoUrl == nil && !stop.photoQuery.isEmpty)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            photoPanel
            Rule(width: Theme.hairline)
            details
        }
        .bauhausCard(shadow: 4)
        .task(id: stop.id) { await loadPhoto() }
    }

    private var photoPanel: some View {
        ZStack {
            Theme.bg
            if let photo, let url = URL(string: photo.imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Theme.bg
                }
            } else {
                Text(pending ? Strings.photoPending(lang) : Strings.photoNone(lang))
                    .font(Theme.bold(12))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(height: 128)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                ColorMark(color: kindColor, size: 12)
                Text(Strings.stopKindLabel(stop.kind, lang).uppercased())
                    .font(Theme.heavy(11))
                    .tracking(0.8)
                    .foregroundStyle(Theme.textSecondary)
            }
            Text(stop.title(lang))
                .font(Theme.heavy(17))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            if !stop.timing.isEmpty {
                Text(stop.timing)
                    .font(Theme.bold(12))
                    .foregroundStyle(Theme.blue)
            }
            let note = stop.detail(lang)
            if !note.isEmpty {
                Text(note)
                    .font(Theme.regular(13))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let credit = photo?.credit, !credit.isEmpty {
                Text(credit)
                    .font(Theme.regular(10))
                    .foregroundStyle(Theme.disabledText)
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Each stop kind gets one primary colour, so the thread reads at a glance.
    private var kindColor: Color {
        switch stop.kind {
        case .spot: return Theme.red
        case .transit: return Theme.blue
        case .meal: return Theme.yellow
        case .hotel: return Theme.black
        }
    }

    private func loadPhoto() async {
        guard photo == nil, !stop.photoQuery.isEmpty else { return }
        // A missing photo is not an error state: the placeholder is the final
        // form, so a failure just stops the spinner.
        photo = try? await APIClient.shared.stopPhoto(stopId: stop.id).photo
        pending = false
    }
}
