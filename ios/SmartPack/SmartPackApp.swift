import SwiftUI

@main
struct SmartPackApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                // The app is one committed light palette (AGENTS.md §8), so it
                // opts out of dark mode rather than inventing a second theme.
                .preferredColorScheme(.light)
        }
    }
}
