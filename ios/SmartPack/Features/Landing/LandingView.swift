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
                    Text("SmartPack")
                        .font(Theme.heavy(40))
                        .tracking(-0.8)
                        .foregroundStyle(Theme.blue)
                }

                Text(Strings.landingTagline(lang))
                    .font(Theme.bold(17))
                    .foregroundStyle(Theme.text)
                    .lineSpacing(4)
                    .padding(.top, 14)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: Theme.space3)

                SuitcaseArt()
                    .frame(height: 230)
                    .frame(maxWidth: .infinity)

                Button {
                    app.phase = .login
                } label: {
                    Text(Strings.landingEnter(lang))
                        .font(Theme.heavy(15))
                        .tracking(0.5)
                        .foregroundStyle(Theme.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 26)
                        .padding(.trailing, 76)
                        .padding(.vertical, 22)
                        .background(ArrowBanner().fill(Theme.red))
                        .background(ArrowBanner().fill(Theme.black).offset(x: 4, y: 4))
                }
                .padding(.top, Theme.space3)
                .padding(.bottom, Theme.space4)
            }
            .padding(.horizontal, Theme.space3)
            .padding(.top, Theme.space4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay(alignment: .topTrailing) {
            LanguageToggle()
                .padding(Theme.space2)
        }
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
