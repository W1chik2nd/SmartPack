import SwiftUI

/// First screen for a signed-out visitor. Full-bleed cyan, world-map
/// silhouette behind, brand lockup at the top, and the packed cases with the
/// arrow-shaped entry button below.
///
/// Phone adaptation: the desktop layout hangs the suitcase in the bottom-right
/// corner beside a 56px headline. Here the page becomes one vertical column —
/// headline, then artwork — so nothing overlaps on a 390pt-wide screen, and
/// the arrow sits under the cases where a thumb reaches it.
struct LandingView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var presented = false
    @State private var advancing = false

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            WorldMapArt()
                .opacity(0.55)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    LogoMark(color: Theme.blue)
                        .frame(width: 46, height: 41)
                        .alignmentGuide(.firstTextBaseline) { $0.height * 0.86 }
                    Text("WearRoute")
                        .font(Theme.heavy(40))
                        .tracking(-0.8)
                        .foregroundStyle(Theme.blue)
                }
                .opacity(presented ? 1 : 0)
                .offset(y: presented ? 0 : -14)
                .animation(entranceAnimation, value: presented)

                Text(Strings.landingTagline(lang))
                    .font(Theme.bold(17))
                    .foregroundStyle(Theme.text)
                    .lineSpacing(4)
                    .padding(.top, 14)
                    .fixedSize(horizontal: false, vertical: true)
                    .opacity(presented ? 1 : 0)
                    .offset(y: presented ? 0 : 10)
                    .animation(entranceAnimation.delay(0.08), value: presented)

                Spacer(minLength: Theme.space3)

                SuitcaseArt()
                    .frame(height: 230)
                    .frame(maxWidth: .infinity)
                    .scaleEffect(presented ? 1 : 0.92)
                    .opacity(presented ? 1 : 0)
                    .offset(y: presented ? 0 : 18)
                    .animation(entranceAnimation.delay(0.14), value: presented)

                Button {
                    advance()
                } label: {
                    HStack(spacing: Theme.space1) {
                        Text(Strings.landingEnter(lang))
                            .font(Theme.heavy(15))
                            .tracking(0.5)
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 18, weight: .black))
                            .offset(x: advancing ? 12 : 0)
                    }
                    .foregroundStyle(Theme.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 26)
                    .padding(.trailing, 68)
                    .padding(.vertical, 22)
                    .background(ArrowBanner().fill(Theme.red))
                    .background(ArrowBanner().fill(Theme.black).offset(x: 4, y: 4))
                }
                .buttonStyle(LandingArrowButtonStyle())
                .allowsHitTesting(!advancing)
                .padding(.top, Theme.space3)
                .padding(.bottom, Theme.space4)
                .opacity(presented && !advancing ? 1 : 0)
                .offset(x: advancing ? 38 : 0, y: presented ? 0 : 16)
                .animation(entranceAnimation.delay(0.20), value: presented)
                .animation(reduceMotion ? nil : .snappy(duration: 0.30), value: advancing)
            }
            .padding(.horizontal, Theme.space3)
            .padding(.top, Theme.space4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay(alignment: .topTrailing) {
            LanguageToggle()
                .padding(Theme.space2)
                .opacity(presented ? 1 : 0)
        }
        .onAppear {
            if reduceMotion {
                presented = true
            } else {
                withAnimation { presented = true }
            }
        }
    }

    private var entranceAnimation: Animation {
        reduceMotion ? .linear(duration: 0) : .spring(duration: 0.62, bounce: 0.16)
    }

    private func advance() {
        guard !advancing else { return }
        if reduceMotion {
            app.phase = .login
            return
        }

        advancing = true
        Task {
            try? await Task.sleep(nanoseconds: 230_000_000)
            app.phase = .login
        }
    }
}

private struct LandingArrowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .offset(x: configuration.isPressed ? 5 : 0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// The entry control is the arrow itself, with the label written along its
/// shaft — `clip-path: polygon(0 25%, 62% 25%, 62% 0, 100% 50%, …)` in
/// `styles.css`.
struct ArrowBanner: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let x = { (fraction: CGFloat) in rect.minX + rect.width * fraction }
        let y = { (fraction: CGFloat) in rect.minY + rect.height * fraction }
        path.move(to: CGPoint(x: x(0), y: y(0.25)))
        path.addLine(to: CGPoint(x: x(0.62), y: y(0.25)))
        path.addLine(to: CGPoint(x: x(0.62), y: y(0)))
        path.addLine(to: CGPoint(x: x(1), y: y(0.5)))
        path.addLine(to: CGPoint(x: x(0.62), y: y(1)))
        path.addLine(to: CGPoint(x: x(0.62), y: y(0.75)))
        path.addLine(to: CGPoint(x: x(0), y: y(0.75)))
        path.closeSubpath()
        return path
    }
}
