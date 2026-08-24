import SwiftUI

/// Category filter for the wardrobe grid, ported from
/// `client/src/lib/wardrobe-filter.ts`. The categories the server stores are
/// Chinese labels; the mapping lives here because it is presentation, not a
/// wardrobe rule.
enum WardrobeFilter: String, CaseIterable, Identifiable {
    case all, tops, pants, skirts, shoes, accessories

    var id: String { rawValue }

    var label: LocalizedText {
        switch self {
        case .all: return Strings.wardrobeFilterAll
        case .tops: return Strings.wardrobeFilterTops
        case .pants: return Strings.wardrobeFilterPants
        case .skirts: return Strings.wardrobeFilterSkirts
        case .shoes: return Strings.wardrobeFilterShoes
        case .accessories: return Strings.wardrobeFilterAccessories
        }
    }

    private var categories: [String] {
        switch self {
        case .all: return []
        case .tops: return ["T恤", "衬衫", "针织衫", "卫衣", "外套", "上装", "衣服"]
        case .pants: return ["裤装", "裤子"]
        case .skirts: return ["裙装", "裙子"]
        case .shoes: return ["鞋履", "鞋子"]
        case .accessories: return ["配饰"]
        }
    }

    func apply(to items: [WardrobeItem]) -> [WardrobeItem] {
        guard self != .all else { return items }
        let allowed = Set(categories)
        return items.filter { allowed.contains($0.category) }
    }
}

/// Filter chips plus the visible/total count.
struct WardrobeFilterBar: View {
    @Binding var selection: WardrobeFilter
    let visibleCount: Int
    let totalCount: Int

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.space1) {
            ScrollView(.horizontal) {
                HStack(spacing: Theme.space1) {
                    ForEach(WardrobeFilter.allCases) { filter in
                        Button {
                            selection = filter
                        } label: {
                            Text(filter.label(lang))
                                .font(Theme.bold(13))
                                .foregroundStyle(filter == selection ? Theme.white : Theme.text)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(filter == selection ? Theme.blue : Theme.white)
                                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(filter == selection ? [.isSelected, .isButton] : .isButton)
                    }
                }
                .padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
            .accessibilityLabel(Strings.wardrobeFilterAria(lang))

            Text(Strings.wardrobeFilterCount(lang, visible: visibleCount, total: totalCount))
                .font(Theme.bold(12))
                .foregroundStyle(Theme.textSecondary)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }
}
