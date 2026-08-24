import SwiftUI

// Shared Bauhaus building blocks: flat surfaces, thick black rules, hard
// offset shadows, primary-color accents. Screens compose these instead of
// restating border widths and colors (AGENTS.md §8).

// MARK: - Surfaces

extension View {
    /// Flat panel: white fill, thick black rule, right angles.
    func bauhausPanel(
        fill: Color = Theme.surface,
        border: Color = Theme.black,
        width: CGFloat = Theme.borderWidth
    ) -> some View {
        background(fill)
            .overlay(Rectangle().strokeBorder(border, lineWidth: width))
    }

    /// The wireframe's hard offset shadow — a solid block, never a blur.
    func bauhausShadow(_ offset: CGFloat = Theme.shadowOffset, color: Color = Theme.black) -> some View {
        background(
            Rectangle()
                .fill(color)
                .offset(x: offset, y: offset)
        )
    }

    /// Panel + shadow, the combination most cards use.
    func bauhausCard(
        fill: Color = Theme.surface,
        shadow: CGFloat = Theme.shadowOffset
    ) -> some View {
        bauhausPanel(fill: fill).bauhausShadow(shadow)
    }

    /// Keyboard focus ring, matching the web's yellow `:focus-visible`.
    func bauhausFocusRing(_ active: Bool) -> some View {
        overlay(
            Rectangle()
                .strokeBorder(Theme.yellow, lineWidth: active ? Theme.borderWidth : 0)
        )
    }
}

// MARK: - Type helpers

/// Uppercase kicker line: small, heavy, wide-tracked. Used above headings.
struct Eyebrow: View {
    let text: String
    var color: Color = Theme.text

    var body: some View {
        Text(text.uppercased())
            .font(Theme.heavy(12))
            .tracking(1.2)
            .foregroundStyle(color)
    }
}

/// Section heading inside a card: heavy, uppercase, tight.
struct CardHeading: View {
    let text: String
    var color: Color = Theme.text

    var body: some View {
        Text(text.uppercased())
            .font(Theme.heavy(14))
            .tracking(0.6)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Controls

/// Flat rectangular button: black rule, inverts on press. The web's `.nav-link`.
struct BauhausButtonStyle: ButtonStyle {
    var fill: Color = Theme.surface
    var tint: Color = Theme.text
    var border: Color = Theme.black
    var padding: EdgeInsets = EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16)
    var fontSize: CGFloat = 14

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.bold(fontSize))
            .foregroundStyle(configuration.isPressed ? fill : tint)
            .padding(padding)
            .background(configuration.isPressed ? tint : fill)
            .overlay(Rectangle().strokeBorder(border, lineWidth: Theme.hairline))
    }
}

/// Primary action: full width, blue on cyan, thick rule. The web's `.btn-primary`.
struct PrimaryButtonStyle: ButtonStyle {
    var fill: Color = Theme.blue
    var tint: Color = Theme.white
    var border: Color = Theme.bg
    var enabled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.heavy(16))
            .tracking(0.4)
            .foregroundStyle(enabled ? (configuration.isPressed ? Theme.black : tint) : Theme.disabledText)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(enabled ? (configuration.isPressed ? border : fill) : Theme.disabledSurface)
            .overlay(Rectangle().strokeBorder(enabled ? border : Theme.disabledText, lineWidth: Theme.borderWidth))
    }
}

/// Rows and tiles inside a bordered card are flat: they tint to the page
/// background on press rather than animating.
struct TileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.bg : Theme.white)
    }
}

/// A selectable block (questionnaire options, preference chips, filters).
struct ChoiceChip: View {
    let label: String
    let selected: Bool

    var body: some View {
        Text(label)
            .font(Theme.bold(14))
            .foregroundStyle(selected ? Theme.white : Theme.text)
            .padding(.vertical, 9)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Theme.blue : Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
    }
}

/// Square colour mark used on nav tiles and list rows.
struct ColorMark: View {
    let color: Color
    var size: CGFloat = 22

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
    }
}

// MARK: - Banners

/// Red alert strip. `role="alert"` in the web client.
struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(Theme.bold(14))
            .foregroundStyle(Theme.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.space2)
            .background(Theme.red)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
            .accessibilityAddTraits(.isStaticText)
    }
}

/// Neutral status strip for "saved" / "loading" style messages.
struct NoticeBanner: View {
    let message: String
    var fill: Color = Theme.yellow

    var body: some View {
        Text(message)
            .font(Theme.bold(14))
            .foregroundStyle(Theme.black)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.space2)
            .background(fill)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
    }
}

/// Horizontal black rule matching the panel borders.
struct Rule: View {
    var width: CGFloat = Theme.borderWidth
    var color: Color = Theme.black

    var body: some View {
        Rectangle().fill(color).frame(height: width)
    }
}
