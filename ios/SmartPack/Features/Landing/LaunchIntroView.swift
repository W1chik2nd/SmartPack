import SwiftUI

/// A short brand reveal that covers session restoration instead of exposing a
/// blank cyan frame. It uses only the established Bauhaus tokens and logo.
struct LaunchIntroView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            VStack(spacing: Theme.space2) {
                LogoMark(color: Theme.blue)
                    .frame(width: 104, height: 92)
                    .rotationEffect(.degrees(appeared ? 0 : -8))
                    .scaleEffect(appeared ? 1 : 0.72)

                Text("WEARROUTE")
                    .font(Theme.heavy(32))
                    .tracking(1.2)
                    .foregroundStyle(Theme.blue)
                    .offset(y: appeared ? 0 : 10)

                HStack(spacing: 0) {
                    Rectangle().fill(Theme.red)
                    Rectangle().fill(Theme.yellow)
                    Rectangle().fill(Theme.blue)
                }
                .frame(width: 108, height: 8)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                .scaleEffect(x: appeared ? 1 : 0, anchor: .leading)
            }
            .opacity(appeared ? 1 : 0)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("WearRoute")
        }
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(.spring(duration: 0.68, bounce: 0.18)) {
                    appeared = true
                }
            }
        }
    }
}
