// 量真实布局:用本机已装的 Chrome 无头模式渲染行程页的右栏,
// 把停靠点卡片的实际高度量出来,验证它塞不塞得进固定行高。
//
// 为什么需要它:render-check.mjs 能验 SVG 几何(圆点、竖线、卡片左右交替),
// 但验不了 HTML 盒子的真实高度 —— 那要靠浏览器排版才知道。
// .day-track 的行高是固定的 132px,卡片一旦超过这个高度就会溢出到相邻行,
// 和邻居卡片撞在一起。字号/内边距/备注长度任何一处变动都可能触发。
//
// 不引入 puppeteer:只用 Chrome 的 --headless --dump-dom,零新依赖。
// 用法:node scripts/layout-probe.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// 真实样式:把 theme/day-plan 两份 CSS 直接读进来,量的就是线上那套。
const css = [
  join(root, "client", "src", "theme.css"),
  join(root, "client", "src", "day-plan.css"),
]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")
  // theme.css 的 @import 在这里没用,去掉免得 Chrome 去找文件。
  .replace(/@import[^;]+;/g, "");

// 一张卡片的真实结构(与 StopCard.tsx 的 DOM 保持一致),
// 分别试最短和最长的内容,看行高够不够。
function card(name, time, note, credit) {
  return `
<button type="button" class="stop-card side-right">
  <span class="stop-photo"><span class="stop-photo-empty">No photo</span></span>
  <span class="stop-body">
    <span class="stop-kind"><span class="stop-kind-mark spot"></span>Sight</span>
    <span class="stop-name">${name}</span>
    ${time ? `<span class="stop-time">${time}</span>` : ""}
    ${note ? `<span class="stop-note">${note}</span>` : ""}
    ${credit ? `<span class="stop-credit">${credit}</span>` : ""}
  </span>
</button>`;
}

const CASES = [
  { id: "minimal", name: "锦里", time: "", note: "", credit: "" },
  {
    id: "typical",
    name: "大熊猫繁育研究基地",
    time: "14:00 · 3h",
    note: "下午熊猫活动少,记得戴帽子防晒",
    credit: "Photo by Someone on Unsplash",
  },
  {
    id: "worst-case",
    name: "成都大熊猫繁育研究基地北门游客中心",
    time: "14:00 · 3.5h",
    note: "下午熊猫活动少,记得戴帽子防晒;园区很大,建议坐观光车,从北门进南门出",
    credit: "Photo by A Very Long Photographer Name on Unsplash",
  },
];

const html = `<!doctype html><meta charset="utf-8"><style>
${css}
body { margin: 0; width: 1400px; }
/* 复刻页面里右栏的真实可用宽度:1fr | 150px | 1fr 的一侧 */
.probe { display: grid; grid-template-columns: 1fr 150px 1fr; }
.probe > div { grid-column: 3; }
</style>
<div class="probe">
${CASES.map((c) => `<div data-case="${c.id}">${card(c.name, c.time, c.note, c.credit)}</div>`).join("\n")}
</div>
<script>
const out = [...document.querySelectorAll('[data-case]')].map(d => {
  const b = d.querySelector('.stop-card').getBoundingClientRect();
  return { id: d.dataset.case, h: Math.round(b.height * 10) / 10, w: Math.round(b.width * 10) / 10 };
});
document.title = 'RESULT' + JSON.stringify(out);
</script>`;

const tmp = join(root, ".layout-probe.html");
writeFileSync(tmp, html);

let dom = "";
try {
  dom = execFileSync(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=1500",
      "--window-size=1400,2000",
      "--dump-dom",
      `file://${tmp}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000 }
  );
} finally {
  rmSync(tmp, { force: true });
}

const m = dom.match(/RESULT(\[.*?\])<\/title>/s);
if (!m) {
  console.error("Could not read measurements from the rendered page.");
  process.exit(1);
}

const ROW_H = 156; // 必须与 day-plan.css 的 grid-auto-rows 一致
const results = JSON.parse(m[1]);
let failures = 0;

console.log(`row height (grid-auto-rows): ${ROW_H}px\n`);
for (const r of results) {
  const over = r.h > ROW_H;
  if (over) failures++;
  console.log(
    `  ${r.id.padEnd(11)} card ${String(r.h).padStart(6)}px tall  ${String(r.w).padStart(6)}px wide  ` +
      (over ? `*** OVERFLOWS ROW by ${(r.h - ROW_H).toFixed(1)}px ***` : `fits (${(ROW_H - r.h).toFixed(1)}px spare)`)
  );
}

console.log(
  failures === 0
    ? "\nAll stop cards fit inside their grid row."
    : `\n${failures} card variant(s) overflow the row — neighbouring rows will collide.`
);
process.exit(failures === 0 ? 0 : 1);
