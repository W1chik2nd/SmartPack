import SwiftUI

/// Reports a view's own width upwards. Used by drawings authored at a fixed
/// canvas size that need to scale to whatever a phone gives them; attach it to
/// a zero-height spacer so nothing measures a size it also determines.
struct WidthPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

extension View {
    func measureWidth(_ width: Binding<CGFloat>) -> some View {
        background(
            GeometryReader { geo in
                Color.clear.preference(key: WidthPreferenceKey.self, value: geo.size.width)
            }
        )
        .onPreferenceChange(WidthPreferenceKey.self) { measured in
            if measured > 0 { width.wrappedValue = measured }
        }
    }
}
