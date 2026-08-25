import SwiftUI

/// Open raster map — the official OpenStreetMap tiles, no key required, the
/// same source the web client uses so both look identical.
///
/// Hand-rolled rather than MapKit: a tile map is "lay out z/x/y images on a
/// grid", and Apple's map style would replace the flat cartography the rest of
/// the design is built around. Swapping in a real map SDK later means
/// replacing this view and nothing else.
///
/// OSM tile usage policy: the public tiles are for light use only — before
/// shipping, move to a self-hosted or commercial tile service. The attribution
/// below is mandatory.
struct TileMapView: View {
    let center: MapPoint
    var zoom: Int
    var marker: MapPoint?
    let label: String

    @State private var view: MapViewport
    @State private var dragAnchor: CGSize = .zero

    private static let minZoom = 2
    private static let maxZoom = 18

    init(center: MapPoint, zoom: Int = 5, marker: MapPoint?, label: String) {
        self.center = center
        self.zoom = zoom
        self.marker = marker
        self.label = label
        _view = State(initialValue: MapViewport(lat: center.lat, lon: center.lon, zoom: zoom))
    }

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let originX = Mercator.lonToX(view.lon, view.zoom) - size.width / 2
            let originY = Mercator.latToY(view.lat, view.zoom) - size.height / 2

            ZStack(alignment: .topLeading) {
                Theme.bg

                ForEach(tiles(size: size, originX: originX, originY: originY), id: \.key) { tile in
                    AsyncImage(url: tile.url) { image in
                        image.resizable()
                    } placeholder: {
                        Theme.bg
                    }
                    .frame(width: Mercator.tileSize, height: Mercator.tileSize)
                    .offset(x: tile.left, y: tile.top)
                }

                if let pin = pinPosition(size: size, originX: originX, originY: originY) {
                    // Square pin with a hard shadow — a Bauhaus mark, not a
                    // teardrop glyph.
                    Rectangle()
                        .fill(Theme.red)
                        .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
                        .frame(width: 18, height: 18)
                        .offset(x: pin.x - 9, y: pin.y - 9)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { value in
                        pan(by: CGSize(
                            width: value.translation.width - dragAnchor.width,
                            height: value.translation.height - dragAnchor.height
                        ))
                        dragAnchor = value.translation
                    }
                    .onEnded { _ in dragAnchor = .zero }
            )
        }
        .clipped()
        .overlay(alignment: .topTrailing) { zoomControls }
        .overlay(alignment: .bottomTrailing) { attribution }
        .bauhausPanel()
        .accessibilityElement()
        .accessibilityLabel(label)
        .accessibilityAdjustableAction { direction in
            zoomBy(direction == .increment ? 1 : -1)
        }
        // Selecting a search result moves both the centre and the zoom: only
        // recentring would leave the map on the world view.
        .onChange(of: center) { view = MapViewport(lat: center.lat, lon: center.lon, zoom: zoom) }
        .onChange(of: zoom) { view.zoom = zoom }
    }

    // MARK: - Tiles

    private struct Tile {
        let key: String
        let url: URL?
        let left: CGFloat
        let top: CGFloat
    }

    private func tiles(size: CGSize, originX: CGFloat, originY: CGFloat) -> [Tile] {
        guard size.width > 0, size.height > 0 else { return [] }
        let count = Int(pow(2.0, Double(view.zoom)))
        let firstX = Int(floor(originX / Mercator.tileSize))
        let firstY = Int(floor(originY / Mercator.tileSize))
        let columns = Int(ceil(size.width / Mercator.tileSize)) + 1
        let rows = Int(ceil(size.height / Mercator.tileSize)) + 1

        var result: [Tile] = []
        for row in 0..<rows {
            let ty = firstY + row
            // No vertical wrap: rows past the poles do not exist.
            guard ty >= 0, ty < count else { continue }
            for column in 0..<columns {
                let tx = firstX + column
                // Horizontal wrap picks up the other side of the world.
                let wrapped = ((tx % count) + count) % count
                result.append(Tile(
                    key: "\(view.zoom)/\(tx)/\(ty)",
                    url: URL(string: "https://tile.openstreetmap.org/\(view.zoom)/\(wrapped)/\(ty).png"),
                    left: CGFloat(tx) * Mercator.tileSize - originX,
                    top: CGFloat(ty) * Mercator.tileSize - originY
                ))
            }
        }
        return result
    }

    /// Picks the world copy nearest the viewport so the pin never lands
    /// off-screen after a wrap.
    private func pinPosition(size: CGSize, originX: CGFloat, originY: CGFloat) -> CGPoint? {
        guard let marker else { return nil }
        let world = Mercator.worldSize(view.zoom)
        let centerX = Mercator.lonToX(view.lon, view.zoom)
        var x = Mercator.lonToX(marker.lon, view.zoom)
        while x - centerX > world / 2 { x -= world }
        while centerX - x > world / 2 { x += world }
        return CGPoint(x: x - originX, y: Mercator.latToY(marker.lat, view.zoom) - originY)
    }

    // MARK: - Interaction

    private func pan(by delta: CGSize) {
        let zoom = view.zoom
        let x = Mercator.lonToX(view.lon, zoom) - delta.width
        let y = Mercator.latToY(view.lat, zoom) - delta.height
        view.lon = Mercator.wrapLon(Mercator.xToLon(x, zoom))
        // Clamp the latitude so panning past the poles cannot show blank space.
        view.lat = min(max(Mercator.yToLat(y, zoom), -85), 85)
    }

    private func zoomBy(_ delta: Int) {
        view.zoom = min(max(view.zoom + delta, Self.minZoom), Self.maxZoom)
    }

    private var zoomControls: some View {
        HStack(spacing: MapZoomControlLayout.spacing) {
            zoomButton(
                systemName: "plus",
                delta: 1,
                enabled: view.zoom < Self.maxZoom,
                fill: Theme.blue,
                tint: Theme.white
            )
            zoomButton(
                systemName: "minus",
                delta: -1,
                enabled: view.zoom > Self.minZoom,
                fill: Theme.white,
                tint: Theme.text
            )
        }
        .padding(.top, MapZoomControlLayout.inset)
        .padding(.trailing, MapZoomControlLayout.inset)
    }

    private func zoomButton(
        systemName: String,
        delta: Int,
        enabled: Bool,
        fill: Color,
        tint: Color
    ) -> some View {
        Button { zoomBy(delta) } label: {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .black))
                .foregroundStyle(enabled ? tint : Theme.disabledText)
                .frame(
                    width: MapZoomControlLayout.buttonSize,
                    height: MapZoomControlLayout.buttonSize
                )
                .background(enabled ? fill : Theme.disabledSurface)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .bauhausShadow(MapZoomControlLayout.shadow)
        .disabled(!enabled)
        .accessibilityLabel(delta > 0 ? "Zoom in" : "Zoom out")
    }

    /// OSM's terms require the attribution to stay visible.
    private var attribution: some View {
        Text("© OpenStreetMap")
            .font(Theme.regular(10))
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Theme.white.opacity(0.85))
    }
}

/// Fixed geometry keeps the overlay compact instead of accepting the map's
/// full-width proposal, while preserving Apple's 44-point minimum tap target.
enum MapZoomControlLayout {
    static let buttonSize: CGFloat = 44
    static let spacing: CGFloat = 10
    static let inset: CGFloat = 12
    static let shadow: CGFloat = 3
    static let totalWidth = buttonSize * 2 + spacing + shadow
}

/// Where the map is looking. Kept separate from the caller's `center` so a
/// user's own pan does not fight the destination the page sets.
private struct MapViewport {
    var lat: Double
    var lon: Double
    var zoom: Int
}

/// A plain coordinate pair. CoreLocation is not involved: every coordinate
/// this screen draws comes from the server's place search.
struct MapPoint: Equatable {
    let lat: Double
    let lon: Double
}
