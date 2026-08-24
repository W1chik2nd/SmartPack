import SwiftUI

/// Sign-up step 2 of 2. Submitting this form is what creates the account:
/// step-1 credentials plus these answers go to `/api/register` in one call.
/// Leaving before submitting means no account, by design.
///
/// Every field and option comes from `/api/profile-options`, so a new question
/// ships without a client change. Only name/gender/age/height/weight are
/// required; the rest sharpen recommendations and never block sign-up.
struct QuestionnaireView: View {
    let credentials: Credentials

    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var fields: [ProfileField]?
    @State private var answers = ProfileAnswers()
    @State private var error: String?
    @State private var busy = false
    @State private var shakes = 0
    /// The first tap on an incomplete form only warns; the second submits.
    @State private var warned = false

    var body: some View {
        AuthScaffold {
            AuthHeadline(
                step: Strings.step2(lang),
                title: Strings.quizTitle(lang),
                subtitle: Strings.quizSubtitle(lang)
            )

            VStack(alignment: .leading, spacing: Theme.space3) {
                if let error {
                    ErrorBanner(message: error)
                }

                if let fields {
                    form(fields)
                }

                Button {
                    Task { await submit() }
                } label: {
                    Text(busy ? Strings.creating(lang) : Strings.finishCreate(lang))
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !busy && fields != nil))
                .disabled(busy || fields == nil)

                // Sits directly under the button: it explains what that tap did.
                if warned {
                    NoticeBanner(message: Strings.incompleteWarning(lang))
                        .accessibilityAddTraits(.updatesFrequently)
                }

                AuthSwitch(message: "", actionTitle: Strings.backToAccount(lang)) {
                    app.phase = .register
                }
            }
            .shake(shakes)
        }
        .task { await loadCatalog() }
    }

    // MARK: - Form

    @ViewBuilder
    private func form(_ fields: [ProfileField]) -> some View {
        // The white plate keeps the long form legible over the artwork.
        VStack(alignment: .leading, spacing: Theme.space3) {
            SectionLabel(Strings.requiredSection(lang))

            VStack(alignment: .leading, spacing: 6) {
                Text(Strings.fieldLabel("name", lang))
                    .font(Theme.bold(13))
                FormTextField(text: binding("name"), contentType: .name)
            }

            if let gender = field(fields, "gender") {
                choiceGroup(gender)
            }
            if let age = field(fields, "age") {
                numberField(age)
            }
            HStack(alignment: .top, spacing: Theme.space2) {
                if let height = field(fields, "heightCm") { numberField(height) }
                if let weight = field(fields, "weightKg") { numberField(weight) }
            }

            SectionLabel(Strings.optionalSection(lang))

            HStack(alignment: .top, spacing: Theme.space1) {
                ForEach(["bustCm", "waistCm", "hipCm"], id: \.self) { key in
                    if let spec = field(fields, key) { numberField(spec) }
                }
            }

            // Required choice fields render above, so this loop must not
            // repeat them.
            ForEach(fields.filter { ($0.kind == .single || $0.kind == .multi) && !$0.required }) { spec in
                choiceGroup(spec)
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
    }

    private func choiceGroup(_ spec: ProfileField) -> some View {
        let suffix = spec.required ? "" : " (\(Strings.optionalMark(lang)))"
        return OptionGroupView(
            legend: Strings.fieldLabel(spec.key, lang) + suffix,
            options: spec.options ?? [],
            selected: answers.selected(spec.key),
            multiple: spec.kind == .multi,
            hint: spec.kind == .multi ? Strings.pickMultiple(lang) : nil,
            otherId: spec.otherId,
            otherLabel: Strings.otherPlaceholder(lang),
            otherValue: binding(spec.otherKey ?? "\(spec.key)__other")
        ) { id in
            answers.toggle(spec, id)
        }
    }

    private func numberField(_ spec: ProfileField) -> some View {
        NumberField(
            label: Strings.fieldLabel(spec.key, lang),
            text: binding(spec.key),
            optionalMark: spec.required ? nil : Strings.optionalMark(lang),
            decimal: spec.kind == .decimal
        )
    }

    private func field(_ fields: [ProfileField], _ key: String) -> ProfileField? {
        fields.first { $0.key == key }
    }

    private func binding(_ key: String) -> Binding<String> {
        Binding(
            get: { answers.text[key] ?? "" },
            set: { answers.text[key] = $0 }
        )
    }

    // MARK: - Actions

    private func loadCatalog() async {
        do {
            fields = try await APIClient.shared.profileOptions().fields
        } catch {
            self.error = Strings.optionsLoadError(lang)
        }
    }

    private func submit() async {
        guard let fields else { return }
        error = nil

        // Required choice fields (gender) need an explicit check: unlike the
        // optional ones this is a hard stop, not warn-then-allow.
        let missing = fields.filter {
            $0.required && ($0.kind == .single || $0.kind == .multi) && !answers.answered($0)
        }
        if !missing.isEmpty {
            fail(Strings.requiredMissing(lang))
            return
        }

        // An incomplete profile is allowed, but not silently: warn once,
        // submit on the retry.
        if !warned && fields.contains(where: { !answers.answered($0) }) {
            warned = true
            return
        }

        busy = true
        defer { busy = false }
        do {
            let response = try await APIClient.shared.register(
                credentials: credentials,
                profile: answers.payload(for: fields)
            )
            app.signedIn(response)
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func fail(_ message: String) {
        error = message
        shakes += 1
    }
}

/// Divider label between the required and optional halves of a form.
struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: text)
            Rule(width: Theme.hairline)
        }
        .padding(.top, Theme.space1)
    }
}
