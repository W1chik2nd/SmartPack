import SwiftUI

/// The packing list: the light/variety balance, the checklist, the
/// don't-forget box, and the core pieces the whole plan leans on.
///
/// Phone adaptation: the desktop sketch runs the balance control as a tall
/// vertical slider down the left edge, with the list beside it. A vertical
/// slider is awkward under a thumb and would eat a third of a phone screen, so
/// it becomes a full-width horizontal one pinned above the list — same two
/// captions, same value, reachable without reaching across the screen.
struct PackingListView: View {
    let tripPlanId: String

    @Environment(\.lang) private var lang
    @State private var model: PackingModel

    init(tripPlanId: String) {
        self.tripPlanId = tripPlanId
        _model = State(initialValue: PackingModel(tripPlanId: tripPlanId))
    }

    var body: some View {
        PageScaffold {
            BackRow(title: Strings.backToHome(lang))

            header
            balanceSlider

            if let error = model.error {
                ErrorBanner(message: error)
            }

            if let plan = model.plan {
                checklist(plan)
                essentials(plan)
                corePieces(plan)
            }
        }
        .task { model.reload(debounce: false) }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: Strings.pkEyebrow(lang), color: Theme.textSecondary)
            if let plan = model.plan {
                Text(plan.summaryText(lang))
                    .font(Theme.heavy(20))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 6) {
                Text("\(Strings.pkPacked(lang)) \(model.packedCount) / \(model.totalItems)")
                    .font(Theme.bold(14))
                    .foregroundStyle(Theme.blue)
                if model.loading {
                    Text("· \(Strings.pkUpdating(lang))")
                        .font(Theme.regular(12))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .accessibilityAddTraits(.updatesFrequently)
        }
    }

    private var balanceSlider: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            HStack {
                Text(Strings.pkLight(lang))
                    .font(Theme.heavy(12))
                Spacer()
                Text(valueDescription)
                    .font(Theme.heavy(12))
                    .foregroundStyle(Theme.blue)
                Spacer()
                Text(Strings.pkVariety(lang))
                    .font(Theme.heavy(12))
            }
            Slider(
                value: Binding(get: { model.balance }, set: { model.balance = $0 }),
                in: 0...100,
                step: 1
            ) { editing in
                if !editing { model.reload(debounce: false) }
            }
            .tint(Theme.red)
            .onChange(of: model.balance) { model.reload(debounce: true) }
            .accessibilityLabel(Strings.pkSliderLabel(lang))
            .accessibilityValue(valueDescription)
        }
        .padding(Theme.space2)
        .frame(maxWidth: .infinity)
        .bauhausCard()
    }

    private var valueDescription: String {
        if model.balance >= 67 { return Strings.pkVariety(lang) }
        if model.balance <= 33 { return Strings.pkLight(lang) }
        return Strings.pkBalanced(lang)
    }

    // MARK: - Sections

    private func checklist(_ plan: PackingPlan) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            Text(Strings.pkListTitle(lang))
                .font(Theme.heavy(24))

            ForEach(plan.categories) { category in
                VStack(alignment: .leading, spacing: 0) {
                    CardHeading(text: category.name(lang))
                        .padding(Theme.space2)
                        .background(Theme.bg)
                    Rule(width: Theme.hairline)
                    ForEach(Array(category.items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { Rule(width: 1) }
                        itemRow(item)
                    }
                }
                .bauhausCard(shadow: 4)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.pkListTitle(lang))
    }

    private func itemRow(_ item: PackingItem) -> some View {
        Button {
            model.toggle(item.id)
        } label: {
            HStack(alignment: .top, spacing: Theme.space2) {
                CheckBox(checked: model.isChecked(item.id))
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name(lang))
                        .font(Theme.bold(15))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    metaRow(item)
                }
                Spacer(minLength: 0)
                Text("×\(item.reuse)")
                    .font(Theme.heavy(13))
                    .foregroundStyle(Theme.textSecondary)
                    .accessibilityLabel("\(Strings.pkReuse(lang)) \(item.reuse)")
            }
            .padding(Theme.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(TileButtonStyle())
        .accessibilityAddTraits(model.isChecked(item.id) ? [.isSelected, .isButton] : .isButton)
    }

    @ViewBuilder
    private func metaRow(_ item: PackingItem) -> some View {
        let quantity = (item.quantity ?? 1) > 1 ? "\(Strings.pkQuantity(lang)) ×\(item.quantity ?? 1)" : nil
        let days = item.daysUsed.map { "\(Strings.pkDays(lang)) \($0.map(String.init).joined(separator: " / "))" }

        if quantity != nil || days != nil || item.wardrobeGap == true {
            HStack(spacing: Theme.space1) {
                if let quantity {
                    Text(quantity).font(Theme.regular(11)).foregroundStyle(Theme.textSecondary)
                }
                if let days {
                    Text(days).font(Theme.regular(11)).foregroundStyle(Theme.textSecondary)
                }
                if item.wardrobeGap == true {
                    Text(Strings.pkWardrobeGap(lang))
                        .font(Theme.bold(10))
                        .foregroundStyle(Theme.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Theme.red)
                }
            }
        }
    }

    private func essentials(_ plan: PackingPlan) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CardHeading(text: Strings.pkEssentials(lang))
                .padding(Theme.space2)
                .background(Theme.yellow)
            Rule(width: Theme.hairline)
            ForEach(Array(plan.essentials.enumerated()), id: \.element.id) { index, essential in
                if index > 0 { Rule(width: 1) }
                Button {
                    model.toggle(essential.id)
                } label: {
                    HStack(spacing: Theme.space2) {
                        CheckBox(checked: model.isChecked(essential.id))
                        Text(essential.name(lang))
                            .font(Theme.bold(15))
                            .foregroundStyle(Theme.text)
                        Spacer(minLength: 0)
                    }
                    .padding(Theme.space2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(TileButtonStyle())
                .accessibilityAddTraits(model.isChecked(essential.id) ? [.isSelected, .isButton] : .isButton)
            }
        }
        .bauhausCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.pkEssentials(lang))
    }

    private func corePieces(_ plan: PackingPlan) -> some View {
        VStack(alignment: .leading, spacing: Theme.space2) {
            Text(Strings.pkCore(lang)).font(Theme.heavy(22))
            LazyVGrid(columns: [GridItem(.flexible(), spacing: Theme.space2),
                                GridItem(.flexible(), spacing: Theme.space2)],
                      spacing: Theme.space2) {
                ForEach(plan.corePieces) { piece in
                    VStack(alignment: .leading, spacing: 6) {
                        // Geometric garment mark, drawn rather than illustrated.
                        PixelShape.top.fill(Theme.blue)
                            .frame(height: 56)
                        Text("\(Strings.pkReuse(lang)): \(piece.reuse)")
                            .font(Theme.bold(12))
                            .foregroundStyle(Theme.textSecondary)
                        Text(piece.name(lang))
                            .font(Theme.heavy(15))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(Strings.pkCoreTag(lang))
                            .font(Theme.bold(10))
                            .foregroundStyle(Theme.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Theme.blue)
                    }
                    .padding(Theme.space1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .bauhausCard(shadow: 4)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Strings.pkCore(lang))
    }
}

/// Square checkbox with a heavy tick — no rounded system control.
struct CheckBox: View {
    let checked: Bool

    var body: some View {
        Rectangle()
            .fill(checked ? Theme.blue : Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
            .overlay {
                if checked {
                    Text("✓")
                        .font(Theme.heavy(15))
                        .foregroundStyle(Theme.white)
                }
            }
            .frame(width: 24, height: 24)
            .accessibilityHidden(true)
    }
}
