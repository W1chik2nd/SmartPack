import SwiftUI

/// Weather artwork shared by Home and the trip forecast. The asset mapping is
/// kept identical to `client/src/lib/trip-dashboard.ts`.
struct WeatherArtwork: View {
    let condition: String

    var body: some View {
        BundleImage(
            name: Self.assetName(for: condition),
            fallback: Theme.white,
            contentMode: .fit
        )
        .blendMode(.multiply)
        .accessibilityHidden(true)
    }

    static func assetName(for condition: String) -> String {
        let names = [
            "Clear": "weather-clear",
            "Partly cloudy": "weather-partly-cloudy",
            "Overcast": "weather-overcast",
            "Fog": "weather-fog",
            "Drizzle": "weather-drizzle",
            "Rain": "weather-rain",
            "Snow": "weather-snow",
            "Showers": "weather-showers",
            "Snow showers": "weather-snow-showers",
            "Thunderstorm": "weather-thunderstorm",
        ]
        return names[condition] ?? "weather-overcast"
    }
}
