// 行程页渲染检查:渲染真实组件,再对渲染结果做几何碰撞检测。
//
// 为什么不是另写一份数学:标签摆位由 TripSpine 的 labelBox() 从曲线形状
// 推出来,若检查脚本自己抄一份公式,两边就会各自漂移 —— 那时脚本"通过"
// 也证明不了页面没问题。这里用 esbuild 打包真实组件、SSR 成 HTML,
// 把 <path> 的 d 和标签的内联 left/top 抠出来验,检的就是真正渲染的东西。
//
// 用法:node scripts/render-check.mjs
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// LangProvider 在模块初始化时读 localStorage,Node 里没有,先补一个最小实现。
globalThis.localStorage = {
  store: new Map(),
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  },
  setItem(k, v) {
    this.store.set(k, String(v));
  },
  removeItem(k) {
    this.store.delete(k);
  },
};

// 产物必须落在仓库内:react / react-dom 保持 external(见下),Node 运行
// 打包结果时要能按裸模块名向上找到仓库的 node_modules。放 /tmp 就找不到。
const outFile = join(root, ".render-check.bundle.mjs");

await build({
  entryPoints: [join(root, "scripts", "render-harness.jsx")],
  outfile: outFile,
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  absWorkingDir: root,
  // react-dom/server 是 CJS,里面 require("stream")。打进 ESM 产物会在
  // 运行时炸 "Dynamic require of stream is not supported",所以让 Node
  // 自己去 require 它们。CSS import 在 SSR 里没有意义,一并排除。
  external: ["react", "react-dom", "react-dom/server", "*.css"],
  logLevel: "silent",
});

const harness = await import(pathToFileURL(outFile).href);

// ---- 从渲染出的 HTML 里抠几何信息 ----

const bezier = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** 解析 "M x y C c1x c1y, c2x c2y, tox toy C ..." 并采样成点集。 */
function samplePath(d, step = 0.005) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 8) return [];
  const pts = [];
  let from = { x: nums[0], y: nums[1] };
  // 每段 cubic 吃 6 个数
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const c1 = { x: nums[i], y: nums[i + 1] };
    const c2 = { x: nums[i + 2], y: nums[i + 3] };
    const to = { x: nums[i + 4], y: nums[i + 5] };
    for (let t = 0; t <= 1; t += step) {
      pts.push({
        x: bezier(from.x, c1.x, c2.x, to.x, t),
        y: bezier(from.y, c1.y, c2.y, to.y, t),
      });
    }
    from = to;
  }
  return pts;
}

function viewBoxOf(html) {
  const m = html.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

/** 取所有 <path d="..."> 的 d。 */
function pathsOf(html) {
  return [...html.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
}

/** 取 <circle cx cy r>。 */
function circlesOf(html) {
  return [...html.matchAll(/<circle[^>]*?cx="([\d.]+)"[^>]*?cy="([\d.]+)"[^>]*?r="([\d.]+)"/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) })
  );
}

/** 取带内联 left/top 的元素(标签块),连同它的 class。 */
function boxesOf(html, className) {
  const re = new RegExp(
    `<(?:button|span)[^>]*class="([^"]*${className}[^"]*)"[^>]*style="([^"]*)"`,
    "g"
  );
  const alt = new RegExp(
    `<(?:button|span)[^>]*style="([^"]*)"[^>]*class="([^"]*${className}[^"]*)"`,
    "g"
  );
  const out = [];
  for (const m of html.matchAll(re)) out.push({ cls: m[1], style: m[2] });
  for (const m of html.matchAll(alt)) out.push({ cls: m[2], style: m[1] });
  return out.map(({ cls, style }) => {
    const left = Number(style.match(/left:\s*(-?[\d.]+)px/)?.[1] ?? NaN);
    const top = Number(style.match(/top:\s*(-?[\d.]+)px/)?.[1] ?? NaN);
    return { cls, left, top };
  });
}

// 标签尺寸取自 itinerary.css 的 .spine-day 固定宽高;
// 「x.xx 出发」是内容自适应,按 13px 大写字重的实测包围盒估。
const LABEL_W = 122;
const LABEL_H = 72;
const DEPART_W = 122;
const DEPART_H = 27;
const TOP_GAP = 32;

let failures = 0;
const fail = (msg) => {
  console.log(`  *** FAIL: ${msg}`);
  failures++;
};

function hitsIn(pts, box) {
  return pts.filter(
    (p) => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1
  ).length;
}

console.log("=== 首页物品清单(真实渲染) ===");
{
  const html = harness.renderHome();
  if (!html.includes('class="checklist-bag"')) {
    fail("dashboard: checklist bag image was not rendered");
  }
  if (!html.includes('src="/checklist-bag.png"')) {
    fail("dashboard: checklist bag image points to the wrong asset");
  }
  if (html.includes('class="check-mark"')) {
    fail("dashboard: old checklist placeholder is still rendered");
  }
  console.log("  checklist bag image rendered");
}

console.log("\n=== 个人档案页(真实渲染) ===");
{
  const html = harness.renderProfile();
  const inputs = [...html.matchAll(/<input/g)].length;
  const selects = [...html.matchAll(/<select/g)].length;
  const sections = [...html.matchAll(/<details/g)].length;
  const avatars = [...html.matchAll(/class="avatar-stage"/g)].length;
  if (inputs !== 7) fail(`profile: expected 7 text/measurement inputs, got ${inputs}`);
  if (selects !== 2) fail(`profile: expected 2 selects, got ${selects}`);
  if (sections !== 3) fail(`profile: expected 3 preference sections, got ${sections}`);
  if (avatars !== 1) fail(`profile: expected 1 gender portrait, got ${avatars}`);
  if (!html.includes("Anna")) fail("profile: user name was not prefilled");
  console.log(`  inputs ${inputs}  selects ${selects}  preferences ${sections}  portrait ${avatars}`);
}

console.log("\n=== 左栏 TripSpine(真实渲染) ===");
for (const days of [1, 2, 3, 4, 5, 7]) {
  const html = harness.renderSpine(days);
  const vb = viewBoxOf(html);
  const paths = pathsOf(html);
  const circles = circlesOf(html);
  const labels = boxesOf(html, "spine-day");
  const departs = boxesOf(html, "spine-depart");

  if (!vb) { fail(`${days}d: no viewBox rendered`); continue; }
  if (paths.length !== 1) fail(`${days}d: expected 1 curve path, got ${paths.length}`);
  if (circles.length !== days) fail(`${days}d: expected ${days} nodes, got ${circles.length}`);
  if (labels.length !== days) fail(`${days}d: expected ${days} labels, got ${labels.length}`);
  if (departs.length !== 1) fail(`${days}d: expected 1 depart badge, got ${departs.length}`);

  const pts = samplePath(paths[0] ?? "");
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const curveIn =
    Math.min(...xs) >= 0 && Math.max(...xs) <= vb.w &&
    Math.min(...ys) >= 0 && Math.max(...ys) <= vb.h;
  if (!curveIn) fail(`${days}d: curve leaves viewBox`);
  if (Math.min(...ys) < TOP_GAP) fail(`${days}d: top whitespace is too small`);

  for (const c of circles) {
    if (c.x - c.r < 0 || c.x + c.r > vb.w || c.y - c.r < 0 || c.y + c.r > vb.h) {
      fail(`${days}d: node (${c.x},${c.y}) leaves viewBox`);
    }
  }

  const sweep = ((Math.max(...xs) - Math.min(...xs)) / vb.w) * 100;
  // 一天时没有蛇形段(只剩起笔钩和收笔),不要求大摆幅。
  if (days >= 2 && sweep < 70) fail(`${days}d: sweep only ${sweep.toFixed(0)}% of width`);

  console.log(
    `  ${days}d canvas ${vb.w}x${vb.h}  sweep ${sweep.toFixed(0)}%  ` +
      `nodes ${circles.length}  labels ${labels.length}`
  );

  for (const [i, l] of labels.entries()) {
    if (!Number.isFinite(l.left) || !Number.isFinite(l.top)) {
      fail(`${days}d label ${i}: missing inline left/top`);
      continue;
    }
    const box = { x0: l.left, x1: l.left + LABEL_W, y0: l.top, y1: l.top + LABEL_H };
    const hits = hitsIn(pts, box);
    const inBounds = box.x0 >= 0 && box.x1 <= vb.w && box.y0 >= 0 && box.y1 <= vb.h;
    if (hits > 0) fail(`${days}d label ${i}: overlaps curve at ${hits} sampled points`);
    if (!inBounds) fail(`${days}d label ${i}: out of bounds (${box.x0}..${box.x1})`);
  }

  const dep = departs[0];
  if (dep && Number.isFinite(dep.left)) {
    const box = { x0: dep.left, x1: dep.left + DEPART_W, y0: dep.top, y1: dep.top + DEPART_H };
    if (hitsIn(pts, box) > 0) fail(`${days}d depart badge overlaps curve`);
    if (box.y0 < TOP_GAP) fail(`${days}d depart badge enters top whitespace`);
    if (box.x1 > vb.w) fail(`${days}d depart badge overflows width`);
  }
}

console.log("\n=== 右栏 DayPlan(真实渲染) ===");
const ROW_H = 156; // 必须与 day-plan.css 的 grid-auto-rows 一致
for (const stops of [1, 3, 4, 5, 8]) {
  const html = harness.renderDay(stops);
  const vb = viewBoxOf(html);
  const circles = circlesOf(html);
  const cards = [...html.matchAll(/class="stop-card side-(left|right)"/g)].map((m) => m[1]);

  if (!vb) { fail(`${stops} stops: no viewBox`); continue; }
  if (vb.h !== stops * ROW_H) fail(`${stops} stops: spine height ${vb.h} != ${stops * ROW_H}`);
  if (circles.length !== stops) fail(`${stops} stops: expected ${stops} nodes, got ${circles.length}`);
  if (cards.length !== stops) fail(`${stops} stops: expected ${stops} cards, got ${cards.length}`);

  // 圆点必须落在各自那一行的垂直中心,否则线上的点和卡片对不齐。
  circles.forEach((c, i) => {
    const expected = ROW_H / 2 + i * ROW_H;
    if (Math.abs(c.y - expected) > 0.5) {
      fail(`${stops} stops: node ${i} y=${c.y}, expected ${expected}`);
    }
  });
  // 卡片左右交替。
  cards.forEach((side, i) => {
    const expected = i % 2 === 0 ? "right" : "left";
    if (side !== expected) fail(`${stops} stops: card ${i} on ${side}, expected ${expected}`);
  });

  console.log(`  ${stops} stops  spine ${vb.w}x${vb.h}  nodes ${circles.length}  cards ${cards.join(",")}`);
}

rmSync(outFile, { force: true });
console.log(
  failures === 0
    ? "\nAll render checks passed."
    : `\n${failures} render check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
