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

    func apply(to items: [WardrobeItem]) -> [WardrobeItem] {
        guard self != .all else { return items }
        return items.filter { Self.category(of: $0) == self }
    }

    private static func category(of item: WardrobeItem) -> WardrobeFilter? {
        let category = item.category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let detail = "\(item.subtype) \(item.title)".lowercased()
        let text = "\(item.category) \(item.subtype) \(item.title)".lowercased()

        if ["top", "上衣", "上装", "衣服"].contains(category) { return .tops }
        if ["accessory", "accessories", "配饰"].contains(category) { return .accessories }
        if ["shoe", "shoes", "footwear", "鞋履", "鞋子"].contains(category) { return .shoes }
        if ["bottom", "下装"].contains(category) {
            return matches(detail, #"skirt|dress|裙装|裙子|半裙|连衣裙|a字裙"#) ? .skirts : .pants
        }

        if matches(text, #"skirt|dress|裙装|裙子|半裙|连衣裙|a字裙"#) { return .skirts }
        if matches(text, #"accessor|配饰|包|帽|围巾|眼镜|腕表|手表|项链|腰带|皮带"#) {
            return .accessories
        }
        if matches(text, #"shoe|sneaker|loafer|boot|sandal|鞋履|鞋子|鞋|靴"#) { return .shoes }
        if matches(text, #"pants|trouser|jeans|shorts|bottom|裤装|裤子|长裤|短裤|牛仔裤|工装裤|下装"#) {
            return .pants
        }
        if matches(text, #"top|shirt|tee|blouse|sweater|jacket|coat|hoodie|上衣|上装|t恤|衬衫|针织|卫衣|夹克|外套"#) {
            return .tops
        }
        return nil
    }

    private static func matches(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: .regularExpression) != nil
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
