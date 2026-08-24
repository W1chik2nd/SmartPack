import SwiftUI

/// The compact phone version of the dashboard sky introduced on web.
/// Daytime uses the Bauhaus sun; nighttime swaps in stars and a crescent.
struct DashboardSkyScene: View {
    let isDaytime: Bool

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width - 34, y: size.height / 2)

            if isDaytime {
                let sun = Path(ellipseIn: CGRect(
                    x: center.x - 22,
                    y: center.y - 22,
                    width: 44,
                    height: 44
                ))
                context.fill(sun, with: .color(Theme.yellow))
                context.stroke(sun, with: .color(Theme.black), lineWidth: 3)
            } else {
                star(&context, at: CGPoint(x: 10, y: center.y + 10), radius: 4, color: Theme.white)
                star(&context, at: CGPoint(x: 34, y: center.y - 15), radius: 3, color: Theme.yellow)
                star(&context, at: CGPoint(x: 51, y: center.y + 13), radius: 3, color: Theme.white)

                let moon = Path(ellipseIn: CGRect(
                    x: center.x - 23,
                    y: center.y - 23,
                    width: 46,
                    height: 46
                ))
                context.fill(moon, with: .color(Theme.yellow))

                let cutout = Path(ellipseIn: CGRect(
                    x: center.x - 14,
                    y: center.y - 31,
                    width: 46,
                    height: 46
                ))
                context.fill(cutout, with: .color(Theme.blue))
            }
        }
        .accessibilityHidden(true)
    }

    private func star(
        _ context: inout GraphicsContext,
        at center: CGPoint,
        radius: CGFloat,
        color: Color
    ) {
        var path = Path()
        path.move(to: CGPoint(x: center.x, y: center.y - radius))
        path.addLine(to: CGPoint(x: center.x + radius, y: center.y))
        path.addLine(to: CGPoint(x: center.x, y: center.y + radius))
        path.addLine(to: CGPoint(x: center.x - radius, y: center.y))
        path.closeSubpath()
        context.fill(path, with: .color(color))
    }
}

/// Pure presentation rule shared with the web dashboard and covered by tests.
enum DashboardClock {
    static func isDaytime(hour: Int) -> Bool {
        hour >= 6 && hour < 18
    }
}
