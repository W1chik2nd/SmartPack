import SwiftUI

/// SmartPack design tokens — the Swift mirror of `client/src/theme.css`
/// (AGENTS.md §8). Every screen pulls colors, type, spacing, and borders from
/// here. Do not hardcode colors in views or add per-screen variants.
enum Theme {

    // MARK: - Color

    /// Mandatory unified background.
    static let bg = Color(hex: 0xCAF5F7)

    /// Bauhaus primaries — accents only, on a black/white base.
    static let red = Color(hex: 0xE63946)
    static let yellow = Color(hex: 0xFFD100)
    static let blue = Color(hex: 0x1D3557)

    static let black = Color(hex: 0x111111)
    static let white = Color(hex: 0xFFFFFF)

    // Roles
    static let text = black
    static let textSecondary = Color(hex: 0x3D3D3D)
    static let surface = white
    static let disabledText = Color(hex: 0x6B6B6B)
    static let disabledSurface = Color(hex: 0xD9D9D9)
    static let danger = red

    // MARK: - Geometry
    // Thick borders, right angles. No gradients, no soft shadows.

    static let borderWidth: CGFloat = 3
    static let hairline: CGFloat = 2
    /// Bauhaus offset shadow: a hard black block, never a blur.
    static let shadowOffset: CGFloat = 6

    // MARK: - Spacing grid

    static let space1: CGFloat = 8
    static let space2: CGFloat = 16
    static let space3: CGFloat = 24
    static let space4: CGFloat = 40
    static let space5: CGFloat = 64

    // MARK: - Type
    // Sans-serif, strong weight contrast, left-aligned. Helvetica Neue is the
    // web stack's first choice and ships with iOS, so both clients render the
    // same letterforms.

    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(fontName(for: weight), size: size)
    }

    /// Display weight for headings — the web uses 800, which maps to
    /// Helvetica Neue Bold; heavier faces are not installed on iOS.
    static func heavy(_ size: CGFloat) -> Font { font(size, .heavy) }
    static func bold(_ size: CGFloat) -> Font { font(size, .bold) }
    static func regular(_ size: CGFloat) -> Font { font(size, .regular) }

    private static func fontName(for weight: Font.Weight) -> String {
        switch weight {
        case .heavy, .black, .bold, .semibold: return "HelveticaNeue-Bold"
        case .light, .thin, .ultraLight: return "HelveticaNeue-Light"
        case .medium: return "HelveticaNeue-Medium"
        default: return "HelveticaNeue"
        }
    }
}

// MARK: - Hex color

extension Color {
    /// 0xRRGGBB literal, so the tokens above read like the CSS they mirror.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
