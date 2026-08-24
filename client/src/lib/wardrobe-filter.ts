export const WARDROBE_FILTER_OPTIONS = [
  { id: "all", labelKey: "wardrobeFilterAll" },
  { id: "tops", labelKey: "wardrobeFilterTops" },
  { id: "pants", labelKey: "wardrobeFilterPants" },
  { id: "skirts", labelKey: "wardrobeFilterSkirts" },
  { id: "shoes", labelKey: "wardrobeFilterShoes" },
  { id: "accessories", labelKey: "wardrobeFilterAccessories" },
] as const;

export type WardrobeFilterId = (typeof WARDROBE_FILTER_OPTIONS)[number]["id"];

type FilterableWardrobeItem = {
  category: string;
  subtype?: string;
  title?: string;
};

function categoryOf(item: FilterableWardrobeItem): Exclude<WardrobeFilterId, "all"> | null {
  const category = item.category.toLowerCase();
  const detail = `${item.subtype ?? ""} ${item.title ?? ""}`.toLowerCase();
  const text = `${item.category} ${item.subtype ?? ""} ${item.title ?? ""}`.toLowerCase();

  // 后端的通用品类优先级最高。“连帽卫衣”虽然含“帽”，仍必须归上装。
  if (/^(top|上衣|上装|衣服)$/.test(category)) return "tops";
  if (/^(accessory|accessories|配饰)$/.test(category)) return "accessories";
  if (/^(shoes?|footwear|鞋履|鞋子)$/.test(category)) return "shoes";
  if (/^(bottom|下装)$/.test(category)) {
    return /skirt|dress|裙装|裙子|半裙|连衣裙|a字裙/.test(detail)
      ? "skirts"
      : "pants";
  }

  // 模型也可能直接返回具体品类；裙装必须先于裤装判断。
  if (/skirt|dress|裙装|裙子|半裙|连衣裙|a字裙/.test(text)) return "skirts";
  if (/accessor|配饰|包|帽|围巾|眼镜|腕表|手表|项链|腰带|皮带/.test(text)) {
    return "accessories";
  }
  if (/shoe|sneaker|loafer|boot|sandal|鞋履|鞋子|鞋|靴/.test(text)) {
    return "shoes";
  }
  if (/pants|trouser|jeans|shorts|bottom|裤装|裤子|长裤|短裤|牛仔裤|工装裤|下装/.test(text)) {
    return "pants";
  }
  if (/top|shirt|tee|blouse|sweater|jacket|coat|hoodie|上衣|上装|t恤|衬衫|针织|卫衣|夹克|外套/.test(text)) {
    return "tops";
  }
  return null;
}

export function filterWardrobeItems<T extends FilterableWardrobeItem>(
  items: T[],
  filter: WardrobeFilterId
): T[] {
  if (filter === "all") return items;
  return items.filter((item) => categoryOf(item) === filter);
}
