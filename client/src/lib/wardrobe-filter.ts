export const WARDROBE_FILTER_OPTIONS = [
  { id: "all", labelKey: "wardrobeFilterAll" },
  { id: "tops", labelKey: "wardrobeFilterTops" },
  { id: "pants", labelKey: "wardrobeFilterPants" },
  { id: "skirts", labelKey: "wardrobeFilterSkirts" },
  { id: "shoes", labelKey: "wardrobeFilterShoes" },
  { id: "accessories", labelKey: "wardrobeFilterAccessories" },
] as const;

export type WardrobeFilterId = (typeof WARDROBE_FILTER_OPTIONS)[number]["id"];

const FILTER_CATEGORIES: Record<Exclude<WardrobeFilterId, "all">, string[]> = {
  tops: ["T恤", "衬衫", "针织衫", "卫衣", "外套", "上装", "衣服"],
  pants: ["裤装", "裤子"],
  skirts: ["裙装", "裙子"],
  shoes: ["鞋履", "鞋子"],
  accessories: ["配饰"],
};

export function filterWardrobeItems<T extends { category: string }>(
  items: T[],
  filter: WardrobeFilterId
): T[] {
  if (filter === "all") return items;
  return items.filter((item) => FILTER_CATEGORIES[filter].includes(item.category));
}
