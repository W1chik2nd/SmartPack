import SwiftUI

/// Flat selectable blocks for the questionnaire's choice fields — radios for
/// single choice, checkboxes for multi. The control is a real button with the
/// right accessibility traits, so VoiceOver announces selection state without
/// a hand-rolled ARIA reimplementation.
struct OptionGroupView: View {
    let legend: String
    let options: [ProfileOption]
    let selected: [String]
    let multiple: Bool
    var hint: String?
    var otherId: String?
    var otherLabel: String = ""
    @Binding var otherValue: String
    let onToggle: (String) -> Void

    @Environment(\.lang) private var lang

    private var otherPicked: Bool {
        guard let otherId else { return false }
        return selected.contains(otherId)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            Text(legend)
                .font(Theme.heavy(15))
                .foregroundStyle(Theme.text)

            if let hint {
                Text(hint)
                    .font(Theme.regular(12))
                    .foregroundStyle(Theme.textSecondary)
            }

            // Two columns keep short labels on one line at phone widths while
            // long ones still wrap inside their own block.
            LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.space1),
                                GridItem(.flexible(), spacing: Theme.space1)],
                      spacing: Theme.space1) {
                ForEach(options) { option in
                    Button {
                        onToggle(option.id)
                    } label: {
                        ChoiceChip(label: option.label(lang), selected: selected.contains(option.id))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected.contains(option.id) ? [.isSelected, .isButton] : .isButton)
                }
            }

            // Only shown once "other" is picked: an always-visible box invites
            // text that is discarded the moment the option is unchecked.
            if otherPicked {
                VStack(alignment: .leading, spacing: 6) {
                    Text(otherLabel)
                        .font(Theme.bold(13))
                        .foregroundStyle(Theme.textSecondary)
                    FormTextField(text: $otherValue)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The form input used everywhere behind sign-in: white, thick black rule.
struct FormTextField: View {
    @Binding var text: String
    var placeholder: String = ""
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType?

    var body: some View {
        TextField(placeholder, text: $text)
            .font(Theme.bold(16))
            .foregroundStyle(Theme.text)
            .tint(Theme.blue)
            .keyboardType(keyboard)
            .textContentType(contentType)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)
            .padding(.vertical, 12)
            .padding(.horizontal, 12)
            .background(Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
    }
}

/// A labelled numeric field. `unit` is printed inside the box on the right,
/// as the profile page's measurement grid does.
struct NumberField: View {
    let label: String
    @Binding var text: String
    var unit: String = ""
    var optionalMark: String?
    var decimal = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(label)
                    .font(Theme.bold(13))
                    .foregroundStyle(Theme.text)
                if let optionalMark {
                    Text("(\(optionalMark))")
                        .font(Theme.regular(12))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            HStack(spacing: 4) {
                TextField("", text: $text)
                    .font(Theme.bold(16))
                    .foregroundStyle(Theme.text)
                    .tint(Theme.blue)
                    .keyboardType(decimal ? .decimalPad : .numberPad)
                if !unit.isEmpty {
                    Text(unit)
                        .font(Theme.bold(13))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 12)
            .background(Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
        }
    }
}

/// Single-choice dropdown drawn as a flat block, for fields with many options
/// where a grid of chips would swamp the page (gender, body type).
struct BlockPicker: View {
    let label: String
    let options: [ProfileOption]
    @Binding var selection: String
    var placeholder: String

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(Theme.bold(13))
                .foregroundStyle(Theme.text)
            Menu {
                Button(placeholder) { selection = "" }
                ForEach(options) { option in
                    Button(option.label(lang)) { selection = option.id }
                }
            } label: {
                HStack {
                    Text(current)
                        .font(Theme.bold(16))
                        .foregroundStyle(selection.isEmpty ? Theme.disabledText : Theme.text)
                    Spacer()
                    Text("▾").font(Theme.heavy(16)).foregroundStyle(Theme.text)
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .background(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
            }
        }
    }

    private var current: String {
        options.first { $0.id == selection }?.label(lang) ?? placeholder
    }
}
