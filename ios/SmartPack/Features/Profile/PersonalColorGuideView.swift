import PhotosUI
import SwiftUI

/// Photo-assisted seasonal-colour questionnaire shared by sign-up and the
/// profile editor. The vision model and recommendation stay on the backend;
/// this view only selects a photo and presents the returned report.
struct PersonalColorGuideView: View {
    let onSeasonDetected: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.lang) private var lang

    @State private var selection: PhotosPickerItem?
    @State private var image: UIImage?
    @State private var analysis = ""
    @State private var season: String?
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.space3) {
                header
                intro
                photoPicker

                if analysis.isEmpty {
                    coverage
                } else {
                    result
                }

                if let error {
                    ErrorBanner(message: error)
                }

                Text(Strings.personalColorNote(lang))
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                actions
            }
            .padding(Theme.space2)
            .padding(.bottom, Theme.space3)
        }
        .background(Theme.bg.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onChange(of: selection) {
            guard let selection else { return }
            Task { await load(selection) }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.space2) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(text: Strings.personalColorKicker(lang), color: Theme.blue)
                Text(Strings.personalColorTitle(lang))
                    .font(Theme.heavy(30))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .black))
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(BauhausButtonStyle(padding: .init()))
            .accessibilityLabel(Strings.close(lang))
        }
        .padding(Theme.space2)
        .background(Theme.yellow)
        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
    }

    private var intro: some View {
        Text(Strings.personalColorIntro(lang))
            .font(Theme.bold(16))
            .foregroundStyle(Theme.text)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var photoPicker: some View {
        PhotosPicker(selection: $selection, matching: .images) {
            VStack(spacing: Theme.space1) {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 132, height: 132)
                        .clipped()
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                } else {
                    Image(systemName: "plus")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(Theme.red)
                }

                Text(image == nil ? Strings.personalColorUpload(lang) : Strings.personalColorReplace(lang))
                    .font(Theme.heavy(17))
                    .foregroundStyle(Theme.text)
                Text(Strings.personalColorPhotoHint(lang))
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, minHeight: 164)
            .background(Theme.bg)
            .overlay(
                Rectangle()
                    .strokeBorder(Theme.blue, style: StrokeStyle(lineWidth: Theme.borderWidth, dash: [8, 5]))
            )
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }

    private var coverage: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            Text(Strings.personalColorCoverage(lang)).font(Theme.heavy(15))
            ForEach(Array(Strings.personalColorCoverageItems.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: Theme.space1) {
                    Rectangle().fill(Theme.red).frame(width: 8, height: 8).padding(.top, 5)
                    Text(item(lang))
                        .font(Theme.regular(14))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausPanel()
    }

    private var result: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            Text(Strings.personalColorResult(lang)).font(Theme.heavy(18))
            if let season {
                Text(Strings.personalColorSeason(season, lang))
                    .font(Theme.heavy(18))
                    .foregroundStyle(Theme.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Theme.blue)
            }
            Text(analysis)
                .font(Theme.regular(14))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
    }

    private var actions: some View {
        VStack(spacing: Theme.space1) {
            if let season {
                Button {
                    onSeasonDetected(season)
                    dismiss()
                } label: {
                    Text("\(Strings.personalColorUse(lang)): \(Strings.personalColorSeason(season, lang))")
                }
                .buttonStyle(PrimaryButtonStyle())
            }

            if image != nil {
                Button {
                    Task { await analyze() }
                } label: {
                    Text(busy ? Strings.personalColorAnalysing(lang) : Strings.personalColorStart(lang))
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !busy))
                .disabled(busy)
            }
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        selection = nil
        guard let data = try? await item.loadTransferable(type: Data.self),
              let chosen = UIImage(data: data)
        else {
            error = Strings.personalColorFailed(lang)
            return
        }
        image = chosen
        analysis = ""
        season = nil
        error = nil
    }

    private func analyze() async {
        guard let image else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let dataURL = try ImageEncoding.dataURL(from: image)
            let response = try await APIClient.shared.analyzePersonalColor(imageDataURL: dataURL)
            analysis = response.analysis
            season = response.season
        } catch {
            self.error = error.localizedDescription
        }
    }
}
