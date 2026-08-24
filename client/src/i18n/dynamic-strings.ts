import type { Lang } from "./strings";

export function wardrobeFilterCountMessage(
  lang: Lang,
  visibleCount: number,
  totalCount: number
): string {
  return lang === "zh"
    ? `${visibleCount} / ${totalCount} 款`
    : `${visibleCount} of ${totalCount} items`;
}

export function wardrobeFilterRegionLabel(lang: Lang, filter: string): string {
  return lang === "zh"
    ? `我的衣柜，当前筛选：${filter}`
    : `My wardrobe, current filter: ${filter}`;
}

export function wardrobeNoFilteredItemsMessage(
  lang: Lang,
  filter: string
): string {
  return lang === "zh" ? `还没有${filter}` : `No ${filter.toLowerCase()} yet`;
}

export function photosSentMessage(lang: Lang, count: number): string {
  return lang === "zh"
    ? `✓ 已传 ${count} 张到电脑`
    : `✓ ${count} photo${count === 1 ? "" : "s"} sent to your computer`;
}

export function confirmDeleteMessage(lang: Lang, title: string): string {
  return lang === "zh" ? `确定删除「${title}」?` : `Delete "${title}"?`;
}

export function unreachableHostMessage(lang: Lang, hostname: string): string {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return lang === "zh"
      ? "当前用 localhost 打开,手机连不到你的电脑。请改用终端里 Vite 打印的局域网地址(形如 https://192.168.x.x:5177 或 https://172.x.x.x:5177)重新打开本页,再点拍照。"
      : "This page is open on localhost, which your phone cannot reach. Reopen it using the LAN address Vite prints in the terminal (like https://192.168.x.x:5177 or https://172.x.x.x:5177), then tap the camera again.";
  }
  return lang === "zh"
    ? `当前地址 ${hostname} 是 VPN/代理的虚拟网卡,手机连不到。请改用真实的 WiFi 局域网地址(通常是 192.168.x.x 或 172.x.x.x)重新打开本页。也可以先关掉代理软件再看终端打印的地址。`
    : `The current address ${hostname} belongs to a VPN/proxy virtual adapter, which your phone cannot reach. Reopen this page on your real WiFi LAN address (usually 192.168.x.x or 172.x.x.x), or turn the proxy off and use the address Vite prints in the terminal.`;
}

export const SCENARIO_LABELS: Record<string, { en: string; zh: string }> = {
  commute: { en: "Commute", zh: "通勤" },
  travel: { en: "Travel", zh: "旅行" },
  business: { en: "Business Trip", zh: "出差" },
  date: { en: "Date", zh: "约会" },
  sport: { en: "Sport", zh: "运动" },
  formal: { en: "Formal", zh: "正式场合" },
};

export const WEATHER_CONDITION_LABELS: Record<
  string,
  { en: string; zh: string }
> = {
  Clear: { en: "Clear", zh: "晴" },
  "Partly cloudy": { en: "Partly cloudy", zh: "多云" },
  Overcast: { en: "Overcast", zh: "阴" },
  Fog: { en: "Fog", zh: "雾" },
  Drizzle: { en: "Drizzle", zh: "毛毛雨" },
  Rain: { en: "Rain", zh: "雨" },
  Snow: { en: "Snow", zh: "雪" },
  Showers: { en: "Showers", zh: "阵雨" },
  "Snow showers": { en: "Snow showers", zh: "阵雪" },
  Thunderstorm: { en: "Thunderstorm", zh: "雷暴" },
};
