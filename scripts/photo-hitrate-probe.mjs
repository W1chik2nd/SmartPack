// 实测配图命中率:换城市、换语言、换停靠点类型,看图库还能不能出图。
//
// 想回答的问题:演示数据里的 photoQuery 是我手写的英文地名(如
// "Kuanzhai Alley Chengdu"),命中率好看是被挑过的。真实场景里换个城市、
// 或者只有中文名,还能出图吗?
//
// 这个脚本直接打真实图库(默认 Openverse,免 key),不走我们的服务端,
// 只测"关键词 → 有没有图"这一件事。
// 用法:node scripts/photo-hitrate-probe.mjs
import { setTimeout as sleep } from "node:timers/promises";

// Openverse 匿名有速率限制,请求之间留间隔,免得被限流误判成"没图"。
const GAP_MS = 900;

async function openverse(query) {
  const url =
    `https://api.openverse.org/v1/images/` +
    `?q=${encodeURIComponent(query)}&page_size=1&mature=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "SmartPack/0.1 (dev probe)" } });
    if (res.status === 429) return { hit: false, note: "rate-limited" };
    if (!res.ok) return { hit: false, note: `http ${res.status}` };
    const body = await res.json();
    const first = body?.results?.[0];
    return {
      hit: typeof first?.url === "string",
      note: typeof first?.title === "string" ? first.title.slice(0, 42) : "",
      total: body?.result_count ?? 0,
    };
  } catch (err) {
    return { hit: false, note: `error: ${String(err.message).slice(0, 30)}` };
  }
}

const GROUPS = [
  {
    label: "A. 成都 · 手写英文(演示数据现状)",
    queries: [
      "Kuanzhai Alley Chengdu",
      "Chengdu giant panda",
      "Jinli Ancient Street lanterns",
      "Dujiangyan irrigation system",
      "Jinsha Site Museum Chengdu",
    ],
  },
  {
    label: "B. 成都 · 只有中文名(真实数据很可能长这样)",
    queries: ["宽窄巷子", "大熊猫繁育研究基地", "锦里古街", "都江堰景区", "金沙遗址博物馆"],
  },
  {
    label: "C. 换城市 · 英文名(国内)",
    queries: [
      "Terracotta Army Xian",
      "West Lake Hangzhou",
      "Forbidden City Beijing",
      "Bund Shanghai",
      "Li River Guilin",
    ],
  },
  {
    label: "D. 换城市 · 英文名(海外)",
    queries: [
      "Senso-ji Temple Tokyo",
      "Eiffel Tower Paris",
      "Colosseum Rome",
      "Sagrada Familia Barcelona",
      "Times Square New York",
    ],
  },
  {
    label: "E. 难例 · 餐饮/住宿/交通(任何城市都难)",
    queries: [
      "Long Chaoshou restaurant Chengdu",
      "Heming teahouse Chengdu",
      "guesthouse Qingcheng mountain",
      "Chengdu Tianfu airport terminal",
      "hotel near Taikoo Li Chengdu",
    ],
  },
  {
    label: "F. 难例回落 · 换成通用词(城市 + 类别)",
    queries: [
      "Sichuan restaurant interior",
      "Chinese teahouse",
      "Chinese guesthouse courtyard",
      "airport terminal China",
      "Chengdu city night",
    ],
  },
];

const summary = [];

for (const group of GROUPS) {
  console.log(`\n${group.label}`);
  let hits = 0;
  for (const q of group.queries) {
    const r = await openverse(q);
    if (r.hit) hits++;
    console.log(
      `  ${r.hit ? "OK  " : "MISS"}  ${q.padEnd(38)} ${r.hit ? `→ ${r.note}` : r.note}`
    );
    await sleep(GAP_MS);
  }
  const rate = Math.round((hits / group.queries.length) * 100);
  summary.push({ label: group.label, hits, of: group.queries.length, rate });
  console.log(`  ── ${hits}/${group.queries.length} (${rate}%)`);
}

console.log("\n===== 汇总 =====");
for (const s of summary) {
  console.log(`  ${String(s.rate).padStart(3)}%  ${s.hits}/${s.of}  ${s.label}`);
}
