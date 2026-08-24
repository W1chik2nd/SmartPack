import SwiftUI

/// Sign-up step 1 of 2: credentials only. Nothing reaches the database here —
/// the account is created in one call after the style questionnaire, so an
/// abandoned sign-up stores nothing.
struct RegisterView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var error: String?
    @State private var busy = false
    @State private var shakes = 0

    var body: some View {
        AuthScaffold {
            AuthHeadline(
                step: Strings.step1(lang),
                title: Strings.registerTitle(lang),
                subtitle: Strings.registerSubtitle(lang)
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
                    hint: Strings.passwordHint(lang),
                    secure: true,
                    contentType: .newPassword
                )
                AuthField(
                    label: Strings.confirmPassword(lang),
                    text: $confirm,
                    secure: true,
                    contentType: .newPassword
                )

                Button {
                    Task { await advance() }
                } label: {
                    Text(busy ? Strings.checking(lang) : Strings.continueBtn(lang))
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !busy))
                .disabled(busy)

                AuthSwitch(
                    message: Strings.haveAccount(lang),
                    actionTitle: Strings.signInLink(lang)
                ) {
                    app.phase = .login
                }
            }
            .shake(shakes)
        }
    }

    private func advance() async {
        error = nil

        // The confirmation field never leaves the device, so this is the one
        // check that belongs here. Password length, email format, and
        // duplicates are the server's call, and its messages are shown as-is.
        guard password == confirm else {
            fail(Strings.passwordsMismatch(lang))
            return
        }

        busy = true
        defer { busy = false }
        do {
            // Fail fast on taken addresses so nobody fills the questionnaire
            // for nothing. Creates no account.
            _ = try await APIClient.shared.checkEmail(email)
            app.phase = .questionnaire(Credentials(email: email, password: password))
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func fail(_ message: String) {
        error = message
        shakes += 1
    }
}
