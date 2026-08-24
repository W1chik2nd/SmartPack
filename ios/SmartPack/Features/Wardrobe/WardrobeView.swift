import PhotosUI
import SwiftUI

/// The wardrobe grid. Recognition happens on the server: this screen sends a
/// photo, shows a placeholder card while the item is identified, and drops the
/// placeholder in for the stored item when it comes back.
///
/// Phone adaptation: the web has a QR-code flow because a desktop browser has
/// no camera — you scan the code and shoot from your phone. On a phone that
/// detour is pointless, so this screen opens the camera (or the library)
/// directly, which is exactly what the web client does on a mobile browser.
struct WardrobeView: View {
    @Environment(\.lang) private var lang

    @State private var items: [WardrobeItem] = []
    @State private var pending: [PendingItem] = []
    @State private var loadError: String?
    @State private var filter: WardrobeFilter = .all
    @State private var cameraOpen = false
    @State private var libraryOpen = false
    @State private var libraryItem: PhotosPickerItem?
    @State private var confirmingDelete: WardrobeItem?

    /// A card that has been photographed but not yet stored, so it has no id.
    private struct PendingItem: Identifiable {
        let id = UUID()
        let image: UIImage
    }

    private var filtered: [WardrobeItem] { filter.apply(to: items) }

    private let columns = [
        GridItem(.flexible(), spacing: Theme.space2),
        GridItem(.flexible(), spacing: Theme.space2),
    ]

    var body: some View {
        PageScaffold {
            HStack(alignment: .top) {
                Text(Strings.wardrobeTitle(lang))
                    .font(Theme.heavy(28))
                    .foregroundStyle(Theme.text)
                Spacer()
                cameraMenu
            }

            WardrobeFilterBar(
                selection: $filter,
                visibleCount: filtered.count,
                totalCount: items.count
            )

            if let loadError {
                ErrorBanner(message: loadError)
            }

            grid
        }
        .task { await load() }
        .fullScreenCover(isPresented: $cameraOpen) {
            CameraPicker { image in
                Task { await recognize(image) }
            }
            .ignoresSafeArea()
        }
        .photosPicker(
            isPresented: $libraryOpen,
            selection: $libraryItem,
            matching: .images,
            preferredItemEncoding: .compatible
        )
        .onChange(of: libraryItem) {
            guard let libraryItem else { return }
            Task { await loadFromLibrary(libraryItem) }
        }
        .confirmationDialog(
            confirmingDelete.map { Strings.confirmDelete(lang, title: $0.title) } ?? "",
            isPresented: Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button(Strings.wardrobeDelete(lang), role: .destructive) {
                if let item = confirmingDelete { Task { await delete(item) } }
            }
            Button(Strings.cancelDelete(lang), role: .cancel) {}
        }
    }

    // MARK: - Camera

    private var cameraMenu: some View {
        Menu {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button(Strings.wardrobeTakePhoto(lang)) { cameraOpen = true }
            }
            Button(Strings.wardrobeChoosePhoto(lang)) { libraryOpen = true }
        } label: {
            CameraGlyph()
                .frame(width: 30, height: 30)
                .padding(10)
                .background(Theme.yellow)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
        }
        .accessibilityLabel(Strings.wardrobeAddPhoto(lang))
    }

    // MARK: - Grid

    @ViewBuilder
    private var grid: some View {
        // An empty grid has no height, so the empty states are siblings of the
        // grid rather than an overlay on it.
        if items.isEmpty && pending.isEmpty && loadError == nil {
            emptyState(title: Strings.wardrobeEmpty(lang), hint: Strings.wardrobeEmptyHint(lang))
        } else if !items.isEmpty && filtered.isEmpty && pending.isEmpty {
            filteredEmptyState
        }

        LazyVGrid(columns: columns, spacing: Theme.space2) {
            ForEach(pending) { item in
                VStack(spacing: Theme.space1) {
                    Image(uiImage: item.image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 132)
                        .clipped()
                    Text(Strings.wardrobeRecognizing(lang))
                        .font(Theme.bold(12))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(Theme.space1)
                .frame(maxWidth: .infinity)
                .bauhausCard(shadow: 4)
            }

            ForEach(filtered) { item in
                WardrobeCard(item: item) { confirmingDelete = item }
            }
        }
    }

    private func emptyState(title: String, hint: String) -> some View {
        VStack(spacing: Theme.space1) {
            Text(title).font(Theme.heavy(18))
            Text(hint)
                .font(Theme.regular(13))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Theme.space3)
        .frame(maxWidth: .infinity)
        .bauhausCard()
    }

    private var filteredEmptyState: some View {
        VStack(spacing: Theme.space2) {
            Text(Strings.wardrobeNoFilteredItems(lang, filter: filter.label(lang)))
                .font(Theme.heavy(16))
                .multilineTextAlignment(.center)
            Button(Strings.wardrobeShowAll(lang)) { filter = .all }
                .buttonStyle(BauhausButtonStyle())
        }
        .padding(Theme.space3)
        .frame(maxWidth: .infinity)
        .bauhausCard()
    }

    // MARK: - Actions

    private func load() async {
        do {
            items = try await APIClient.shared.wardrobeItems().items
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func loadFromLibrary(_ selection: PhotosPickerItem) async {
        defer { libraryItem = nil }
        guard let data = try? await selection.loadTransferable(type: Data.self),
              let image = UIImage(data: data)
        else {
            loadError = Strings.wardrobePhotoFailed(lang)
            return
        }
        await recognize(image)
    }

    /// Show the photo immediately, then swap in the stored item once the
    /// server has identified it.
    private func recognize(_ image: UIImage) async {
        let placeholder = PendingItem(image: image)
        pending.append(placeholder)
        defer { pending.removeAll { $0.id == placeholder.id } }

        do {
            let dataURL = try ImageEncoding.dataURL(from: image)
            let item = try await APIClient.shared.recognizeClothing(imageDataURL: dataURL).item
            items.insert(item, at: 0)
            loadError = nil
        } catch {
            // When the photo is not clothing the server stores nothing, so the
            // placeholder has to go too — otherwise the grid keeps a blank card.
            loadError = error.localizedDescription
        }
    }

    private func delete(_ item: WardrobeItem) async {
        confirmingDelete = nil
        let snapshot = items
        // Remove locally first and roll back on failure; saves a list refetch.
        items.removeAll { $0.id == item.id }
        do {
            _ = try await APIClient.shared.deleteWardrobeItem(id: item.id)
        } catch {
            items = snapshot
            loadError = error.localizedDescription
        }
    }
}
