import SwiftUI

/// The personal profile. Every field and option comes from
/// `/api/profile-options`, and saving is one `PUT /api/profile` — this screen
/// owns none of the rules, only the editing.
///
/// Phone adaptation: the desktop board is a two-column form (identity aside,
/// details beside it). Here it is one column, and the three preference groups
/// collapse so the page opens on the measurements rather than on a wall of
/// chips.
struct ProfileView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang

    @State private var fields: [ProfileField]?
    @State private var answers: ProfileAnswers?
    @State private var notice: Notice?
    @State private var expanded: Set<String> = []
    @State private var colorGuideOpen = false
    @State private var signingOut = false

    private enum Notice: Equatable { case saved, failed, options }

    /// The lists that must be sent even when emptied.
    private static let multiKeys: Set<String> = ["stylePrefs", "wearFeel", "travelHabits"]

    private let measurements: [(key: String, label: (Lang) -> String, unit: String)] = [
        ("age", { Strings.profileAge($0) }, ""),
        ("heightCm", { Strings.profileHeight($0) }, "cm"),
        ("weightKg", { Strings.profileWeight($0) }, "kg"),
        ("bustCm", { Strings.profileBust($0) }, "cm"),
        ("waistCm", { Strings.profileWaist($0) }, "cm"),
        ("hipCm", { Strings.profileHip($0) }, "cm"),
    ]

    var body: some View {
        PageScaffold {
            header
            accountControls

            if let fields, let answers {
                identity(fields, answers)
                measurementSection(fields, answers)
                seasonSection(fields, answers)
                preferenceSections(fields, answers)
                actions(fields, answers)
            } else if notice == .options {
                ErrorBanner(message: Strings.optionsLoadError(lang))
            }
        }
        .task { await load() }
        .sheet(isPresented: $colorGuideOpen) {
            PersonalColorGuideView { season in
                answers?.choices["seasonColorType"] = [season]
            }
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "WearRoute / 03", color: Theme.textSecondary)
            Text(Strings.profileTitle(lang))
                .font(Theme.heavy(30))
                .foregroundStyle(Theme.text)
        }
    }

    private var accountControls: some View {
        HStack(spacing: Theme.space2) {
            LanguageToggle()
            Spacer(minLength: Theme.space2)
            Button {
                signingOut = true
                Task {
                    await app.signOut()
                    signingOut = false
                }
            } label: {
                Text(Strings.navSignOut(lang))
            }
            .buttonStyle(BauhausButtonStyle(
                fill: Theme.red,
                tint: Theme.white,
                padding: .init(top: 8, leading: 12, bottom: 8, trailing: 12),
                fontSize: 12
            ))
            .disabled(signingOut)
        }
        .padding(Theme.space1)
        .frame(maxWidth: .infinity)
        .bauhausPanel(width: Theme.hairline)
    }

    private func identity(_ fields: [ProfileField], _ answers: ProfileAnswers) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            if let avatar = avatarName(answers) {
                ZStack(alignment: .bottom) {
                    Circle().fill(Theme.white)
                    BundleImage(name: avatar, contentMode: .fit)
                        .frame(width: 188, height: 198, alignment: .bottom)
                }
                .frame(width: 210, height: 210)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
                .frame(maxWidth: .infinity)
                .accessibilityLabel(Strings.profileAvatar(lang))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(Strings.profileNickname(lang)).font(Theme.bold(13))
                FormTextField(text: binding(answers, "name"), contentType: .name)
            }

            if let gender = field(fields, "gender") {
                BlockPicker(
                    label: Strings.profileGender(lang),
                    options: gender.options ?? [],
                    selection: singleBinding(answers, gender),
                    placeholder: Strings.profileChoose(lang)
                )
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
    }

    private func measurementSection(_ fields: [ProfileField], _ answers: ProfileAnswers) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            sectionHead("01", Strings.profileMeasurements(lang), Strings.profileMeasurementsHint(lang))

            LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.space2),
                                GridItem(.flexible(), spacing: Theme.space2)],
                      spacing: Theme.space2) {
                ForEach(measurements, id: \.key) { measurement in
                    if let spec = field(fields, measurement.key) {
                        NumberField(
                            label: measurement.label(lang),
                            text: binding(answers, measurement.key),
                            unit: measurement.unit,
                            optionalMark: spec.required ? nil : Strings.optionalMark(lang),
                            decimal: spec.kind == .decimal
                        )
                    }
                }
            }

            if let bodyType = field(fields, "bodyType") {
                BlockPicker(
                    label: Strings.profileBodyType(lang),
                    options: bodyType.options ?? [],
                    selection: singleBinding(answers, bodyType),
                    placeholder: Strings.profileChoose(lang)
                )
            }
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bauhausCard()
    }

    @ViewBuilder
    private func seasonSection(_ fields: [ProfileField], _ answers: ProfileAnswers) -> some View {
        if let season = field(fields, "seasonColorType") {
            VStack(alignment: .leading, spacing: Theme.space1) {
                OptionGroupView(
                    legend: Strings.profileSeasonType(lang),
                    options: season.options ?? [],
                    selected: answers.selected(season.key),
                    multiple: false,
                    otherId: season.otherId,
                    otherLabel: Strings.otherPlaceholder(lang),
                    otherValue: binding(answers, season.otherKey ?? "seasonColorType__other")
                ) { id in
                    answers.toggle(season, id)
                }

                Button {
                    colorGuideOpen = true
                } label: {
                    Label(Strings.personalColorHelp(lang), systemImage: "camera.viewfinder")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(BauhausButtonStyle(fill: Theme.yellow))
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .bauhausCard()
        }
    }

    private func preferenceSections(_ fields: [ProfileField], _ answers: ProfileAnswers) -> some View {
        VStack(spacing: Theme.space2) {
            preference(fields, answers, "stylePrefs", "02", Strings.profileStylePreferences(lang))
            preference(fields, answers, "wearFeel", "03", Strings.profileWearFeel(lang))
            preference(fields, answers, "travelHabits", "04", Strings.profileTravelHabits(lang))
        }
    }

    @ViewBuilder
    private func preference(
        _ fields: [ProfileField],
        _ answers: ProfileAnswers,
        _ key: String,
        _ number: String,
        _ title: String
    ) -> some View {
        if let spec = field(fields, key) {
            let isOpen = expanded.contains(key)
            VStack(alignment: .leading, spacing: Theme.space1) {
                Button {
                    if isOpen { expanded.remove(key) } else { expanded.insert(key) }
                } label: {
                    HStack {
                        Text(title).font(Theme.heavy(16)).foregroundStyle(Theme.text)
                        Spacer()
                        Text(number).font(Theme.heavy(16)).foregroundStyle(Theme.blue)
                        Text(isOpen ? "▾" : "▸").font(Theme.heavy(14)).foregroundStyle(Theme.text)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isOpen ? .isSelected : [])

                if isOpen {
                    OptionGroupView(
                        legend: "",
                        options: spec.options ?? [],
                        selected: answers.selected(key),
                        multiple: true,
                        hint: Strings.pickMultiple(lang),
                        otherId: spec.otherId,
                        otherLabel: Strings.otherPlaceholder(lang),
                        otherValue: binding(answers, spec.otherKey ?? "\(key)__other")
                    ) { id in
                        answers.toggle(spec, id)
                    }
                }
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .bauhausCard()
        }
    }

    private func actions(_ fields: [ProfileField], _ answers: ProfileAnswers) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            if let notice, notice != .options {
                if notice == .saved {
                    NoticeBanner(message: Strings.profileSaved(lang))
                } else {
                    ErrorBanner(message: Strings.profileSaveFailed(lang))
                }
            }
            Button {
                Task { await save(fields, answers) }
            } label: {
                Text(Strings.profileFinish(lang))
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    private func sectionHead(_ number: String, _ title: String, _ hint: String) -> some View {
        HStack(alignment: .top, spacing: Theme.space2) {
            Text(number)
                .font(Theme.heavy(22))
                .foregroundStyle(Theme.white)
                .frame(width: 40, height: 40)
                .background(Theme.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.heavy(19))
                Text(hint)
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Helpers

    private func field(_ fields: [ProfileField], _ key: String) -> ProfileField? {
        fields.first { $0.key == key }
    }

    private func binding(_ answers: ProfileAnswers, _ key: String) -> Binding<String> {
        Binding(get: { answers.text[key] ?? "" }, set: { answers.text[key] = $0 })
    }

    /// Bridges a single-choice field to the picker, which speaks in one id.
    private func singleBinding(_ answers: ProfileAnswers, _ spec: ProfileField) -> Binding<String> {
        Binding(
            get: { answers.selected(spec.key).first ?? "" },
            set: { answers.choices[spec.key] = $0.isEmpty ? [] : [$0] }
        )
    }

    private func avatarName(_ answers: ProfileAnswers) -> String? {
        ProfileAvatar.assetName(gender: answers.selected("gender").first)
    }

    // MARK: - Loading and saving

    private func load() async {
        guard let user = app.user else { return }
        do {
            let catalog = try await APIClient.shared.profileOptions().fields
            fields = catalog
            answers = ProfileAnswers(user: user, fields: catalog)
        } catch {
            notice = .options
        }
    }

    private func save(_ fields: [ProfileField], _ answers: ProfileAnswers) async {
        do {
            let payload = answers.payload(for: fields, alwaysInclude: Self.multiKeys)
            app.user = try await APIClient.shared.updateProfile(payload).user
            notice = .saved
        } catch {
            notice = .failed
        }
    }
}

enum ProfileAvatar {
    static func assetName(gender: String?) -> String {
        switch gender {
        case "male": return "profile-male"
        case "female": return "profile-female"
        default: return "profile-neutral"
        }
    }
}
