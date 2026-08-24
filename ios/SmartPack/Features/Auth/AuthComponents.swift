import SwiftUI

// The shared furniture of the sign-in and sign-up screens. The web uses one
// uninterrupted watercolour behind a blue/cyan control hierarchy
// (`.scenic-auth-page` in auth.css); these pieces reproduce that palette so
// each screen only describes its own fields.

/// Full-bleed artwork on blue, with the form scrolling above it.
struct AuthScaffold<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.space2) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.space3)
            // Top gap clears the floating language toggle, the same reason the
            // web's mobile rule pads the auth page down by 104px.
            .padding(.top, 64)
            .padding(.bottom, Theme.space4)
        }
        .scrollDismissesKeyboard(.interactively)
        // The artwork is a background, not a sibling: a `.fill` image paints
        // wider than the screen, and as a ZStack child that would stretch the
        // whole layer to the image's width and push the form off-screen.
        .background {
            ZStack {
                Theme.blue
                BundleImage(name: "login-background", fallback: Theme.blue)
                    .accessibilityHidden(true)
            }
            .clipped()
            .ignoresSafeArea()
        }
        .overlay(alignment: .topTrailing) {
            LanguageToggle().padding(Theme.space2)
        }
    }
}

/// Headline block: solid blue plates with a thick cyan edge on the left.
struct AuthHeadline: View {
    var step: String?
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            if let step {
                Text(step)
                    .font(Theme.heavy(12))
                    .tracking(1)
                    .foregroundStyle(Theme.blue)
                    .padding(.vertical, 5)
                    .padding(.horizontal, 10)
                    .background(Theme.bg)
            }
            Text(title)
                .font(Theme.heavy(26))
                .foregroundStyle(Theme.white)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 14)
                .padding(.horizontal, 16)
                .background(Theme.blue)
                .cyanEdge(10)

            Text(subtitle)
                .font(Theme.bold(15))
                .foregroundStyle(Theme.white)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .background(Theme.blue)
                .cyanEdge(10)
        }
    }
}

/// One labelled input. The label is a blue chip that shrinks to its text; the
/// field itself is cyan with blue type.
struct AuthField: View {
    let label: String
    @Binding var text: String
    var hint: String?
    var secure = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(Theme.bold(13))
                .foregroundStyle(Theme.white)
                .padding(.vertical, 5)
                .padding(.horizontal, 10)
                .background(Theme.blue)
                .cyanEdge(6)

            Group {
                if secure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                }
            }
            .font(Theme.bold(16))
            .foregroundStyle(Theme.blue)
            .tint(Theme.blue)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(keyboard)
            .textContentType(contentType)
            .padding(.vertical, 12)
            .padding(.horizontal, 12)
            .background(Theme.bg)
            .overlay(Rectangle().strokeBorder(Theme.blue, lineWidth: Theme.borderWidth))

            if let hint {
                Text(hint)
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.white)
                    .padding(.vertical, 4)
                    .padding(.horizontal, 10)
                    .background(Theme.blue)
                    .cyanEdge(6)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The "already have an account?" footer plate.
struct AuthSwitch: View {
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(message)
                .font(Theme.bold(14))
                .foregroundStyle(Theme.white)
            Button(action: action) {
                Text(actionTitle)
                    .font(Theme.heavy(14))
                    .foregroundStyle(Theme.bg)
                    .underline()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(Theme.blue)
        .cyanEdge(10)
    }
}

private extension View {
    /// The thick cyan rule the web draws as `border-left` on every blue plate.
    func cyanEdge(_ width: CGFloat) -> some View {
        overlay(alignment: .leading) {
            Rectangle().fill(Theme.bg).frame(width: width)
        }
    }
}

/// A failed submit shakes the form, the same 500ms nudge as `@keyframes shake`.
struct ShakeEffect: GeometryEffect {
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: -6 * sin(animatableData * .pi * 2), y: 0))
    }
}

extension View {
    func shake(_ trigger: Int) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }
}

private struct ShakeModifier: ViewModifier {
    let trigger: Int
    @State private var amount: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .modifier(ShakeEffect(animatableData: amount))
            .onChange(of: trigger) {
                amount = 0
                withAnimation(.linear(duration: 0.5)) { amount = 2 }
            }
    }
}
