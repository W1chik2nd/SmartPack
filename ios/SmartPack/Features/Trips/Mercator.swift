import CoreGraphics
import Foundation

/// Web Mercator (EPSG:3857) — the projection OSM raster tiles use: at zoom z
/// the world is 2^z × 2^z tiles of 256px. Pure maths, ported from
/// `client/src/lib/mercator.ts`.
enum Mercator {
    static let tileSize: CGFloat = 256

    static func worldSize(_ zoom: Int) -> CGFloat {
        tileSize * CGFloat(pow(2.0, Double(zoom)))
    }

    static func lonToX(_ lon: Double, _ zoom: Int) -> CGFloat {
        CGFloat((lon + 180) / 360) * worldSize(zoom)
    }

    static func latToY(_ lat: Double, _ zoom: Int) -> CGFloat {
        // Mercator diverges at the poles; clamp to the range tiles cover.
        let clamped = min(max(lat, -85.0511), 85.0511)
        let radians = clamped * .pi / 180
        let merc = log(tan(radians) + 1 / cos(radians))
        return CGFloat((1 - merc / .pi) / 2) * worldSize(zoom)
    }

    static func xToLon(_ x: CGFloat, _ zoom: Int) -> Double {
        Double(x / worldSize(zoom)) * 360 - 180
    }

    static func yToLat(_ y: CGFloat, _ zoom: Int) -> Double {
        let n = Double.pi * (1 - 2 * Double(y) / Double(worldSize(zoom)))
        return atan(sinh(n)) * 180 / .pi
    }

    /// Normalises longitude to (-180, 180] when panning across the date line.
    static func wrapLon(_ lon: Double) -> Double {
        ((lon + 180).truncatingRemainder(dividingBy: 360) + 360)
            .truncatingRemainder(dividingBy: 360) - 180
    }
}
