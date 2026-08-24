import SwiftUI

/// Sign-in. Credentials go straight to `/api/login`; every rule about them
/// (format, length, lockout) belongs to the server, so nothing is re-checked
/// here (AGENTS.md §4).
struct LoginView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false
    @State private var shakes = 0

    var body: some View {
        AuthScaffold {
            AuthHeadline(
                title: Strings.loginTitle(lang),
                subtitle: Strings.loginSubtitle(lang)
            )

            VStack(alignment: .leading, spacing: Theme.space2) {
                if let error {
                    ErrorBanner(message: error)
                }

                AuthField(
                    label: Strings.email(lang),
                    text: $email,
                    keyboard: .emailAddress,
                    contentType: .username
                )
                AuthField(
                    label: Strings.password(lang),
                    text: $password,
                    secure: true,
                    contentType: .password
                )

                Button {
                    Task { await signIn() }
                } label: {
                    Text(busy ? Strings.signingIn(lang) : Strings.signIn(lang))
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !busy))
                .disabled(busy)

                AuthSwitch(
                    message: Strings.noAccount(lang),
                    actionTitle: Strings.createYours(lang)
                ) {
                    app.phase = .register
                }
            }
            .shake(shakes)
        }
    }

    private func signIn() async {
        error = nil
        busy = true
        defer { busy = false }
        do {
            let response = try await APIClient.shared.login(email: email, password: password)
            app.signedIn(response)
        } catch {
            self.error = error.localizedDescription
            shakes += 1
        }
    }
}
