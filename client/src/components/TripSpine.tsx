// 左栏「总行程图」——一条蛇形曲线串起每一天,节点左右交替(照手绘稿)。
//
// 几何要点(改常量前先读):
// 1. SVG 固定尺寸、不缩放,日期标签是绝对定位的 HTML 按钮,两者共用下面
//    这批常量,所以圆点和文字永远对齐。
// 2. 标签摆位不是写死的偏移量,而是在标签自己的 y 区间里量出曲线的横向占用
//    范围,再挑空间更大的那一侧贴上去(见 labelBox)。这样换任何常量都不会
//    压到曲线上 —— 之前用固定偏移时,起笔钩和收笔就压在首尾两个标签下面。
// 3. 改完这个文件请跑 `npm run check:render`:那个脚本会真实渲染本组件,
//    把 <path> 和标签的内联 left/top 抠出来做碰撞检测,能挡住"标签压在
//    曲线上"这类看不出来的回归。它验的是真实渲染结果,不是另抄一份数学。
//
// 纯展示逻辑,留在前端;行程数据本身全部来自后端(AGENTS.md §3)。
import type { Trip } from "../api";
import { useLang } from "../i18n/useLang";

// 画布宽度必须与 itinerary.css 里 .itin-layout 的左栏宽度一致。
const SPINE_W = 360;
// 上留白要容下起笔钩和「x.xx 出发」标注。
const PAD_TOP = 92;
const ROW_H = 132;
// 收笔最远探到 last.y + 58,底部留白必须大于它,否则尾巴被裁掉。
const PAD_BOTTOM = 92;
const NODE_R = 11;
// 节点的两个横向落点:奇数天偏右、偶数天偏左,形成蛇形。
// 跨度要够大,手绘稿那条 S 是几乎横贯整栏的。
const X_RIGHT = 286;
const X_LEFT = 74;
// 控制点朝外鼓出的比例(相对节点横向跨度)。越大,弯越夸张。
const BULGE = 0.92;
// 标签尺寸(与 itinerary.css 的 .spine-day 固定尺寸一致)与离曲线的间距。
const LABEL_W = 122;
const LABEL_H = 72;
const LABEL_GAP = 18;

type Point = { x: number; y: number };
/** 一段三次贝塞尔:两个控制点 + 终点(起点是上一段的终点)。 */
type Segment = { c1: Point; c2: Point; to: Point };

/** 第 i 天(从 0 起)的节点坐标。 */
function nodeAt(i: number): Point {
  return { x: i % 2 === 0 ? X_RIGHT : X_LEFT, y: PAD_TOP + i * ROW_H };
}

function canvasHeight(days: number): number {
  return PAD_TOP + Math.max(days - 1, 0) * ROW_H + PAD_BOTTOM;
}

/**
 * 整条曲线拆成「起点 + 若干贝塞尔段」。之所以先建这个模型、而不是直接拼
 * path 字符串:标签摆位需要按 y 采样曲线,两边必须用同一份几何,否则改了
 * 曲线而忘了改摆位算法,标签就会压到线上。
 */
function buildCurve(days: number): { start: Point; segments: Segment[] } {
  const first = nodeAt(0);
  // 起笔钩:对应手绘稿左上角那一勾,从节点左上方绕进第一个节点。
  const start = { x: first.x - 120, y: PAD_TOP - 62 };
  const segments: Segment[] = [
    {
      c1: { x: start.x, y: start.y + 30 },
      c2: { x: first.x - 76, y: PAD_TOP },
      to: { x: first.x, y: PAD_TOP },
    },
  ];

  // 蛇形段:控制点朝各自外侧鼓出去,于是两个节点之间画出一个大 S 弯,
  // 而不是直线连过去。
  for (let i = 0; i < days - 1; i++) {
    const p = nodeAt(i);
    const q = nodeAt(i + 1);
    const bulge = (X_RIGHT - X_LEFT) * BULGE;
    const dir = q.x > p.x ? 1 : -1;
    segments.push({
      c1: { x: p.x - dir * bulge, y: p.y + ROW_H * 0.42 },
      c2: { x: q.x + dir * bulge, y: q.y - ROW_H * 0.42 },
      to: { x: q.x, y: q.y },
    });
  }

  // 收笔:从最后一个节点往外下方带一小段,对应手绘稿结尾那个小勾。
  const last = nodeAt(days - 1);
  const dir = last.x === X_RIGHT ? -1 : 1;
  segments.push({
    c1: { x: last.x + dir * 34, y: last.y + 44 },
    c2: { x: last.x + dir * 70, y: last.y + 30 },
    to: { x: last.x + dir * 78, y: last.y + 58 },
  });

  return { start, segments };
}

function pathFrom(curve: { start: Point; segments: Segment[] }): string {
  let d = `M ${curve.start.x} ${curve.start.y}`;
  for (const s of curve.segments) {
    d += ` C ${s.c1.x} ${s.c1.y}, ${s.c2.x} ${s.c2.y}, ${s.to.x} ${s.to.y}`;
  }
  return d;
}

const bezier = (a: number, b: number, c: number, d: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/**
 * 把曲线离散成点集,供标签摆位按 y 区间查询横向占用。
 * step 越小越精确,但摆位只需要"够准到不压线",0.005 已经远超需要。
 */
function samplePoints(
  curve: { start: Point; segments: Segment[] },
  step = 0.005
): Point[] {
  const pts: Point[] = [];
  let from = curve.start;
  for (const s of curve.segments) {
    for (let t = 0; t <= 1; t += step) {
      pts.push({
        x: bezier(from.x, s.c1.x, s.c2.x, s.to.x, t),
        y: bezier(from.y, s.c1.y, s.c2.y, s.to.y, t),
      });
    }
    from = s.to;
  }
  return pts;
}

/**
 * 标签摆位:在标签自己的 y 区间里量出曲线的横向占用范围,再挑左右两侧
 * 空间更大的那一边贴上去 —— 摆位从曲线真实形状推出来,不是猜的固定偏移。
 */
function labelBox(
  i: number,
  pts: Point[]
): { x0: number; top: number; side: "left" | "right" } {
  const node = nodeAt(i);
  const top = node.y - LABEL_H / 2;
  const bottom = node.y + LABEL_H / 2;

  const band = pts.filter((p) => p.y >= top && p.y <= bottom).map((p) => p.x);
  const curveLeft = band.length ? Math.min(...band) : node.x;
  const curveRight = band.length ? Math.max(...band) : node.x;

  const roomLeft = curveLeft - LABEL_GAP;
  const roomRight = SPINE_W - (curveRight + LABEL_GAP);
  const putRight = roomRight >= roomLeft;

  return {
    x0: putRight ? curveRight + LABEL_GAP : curveLeft - LABEL_GAP - LABEL_W,
    top,
    side: putRight ? "right" : "left",
  };
}

type Props = {
  trip: Trip;
  /** 当前选中的那一天(trip_days.id)。 */
  activeDayId: string;
  onPickDay: (dayId: string) => void;
};

export default function TripSpine({ trip, activeDayId, onPickDay }: Props) {
  const { lang, t } = useLang();
  const days = trip.days;
  const height = canvasHeight(days.length);
  const curve = buildCurve(days.length);
  const points = samplePoints(curve);

  return (
    <div className="itin-overview">
      <h2 className="spine-head">{t("tripOverview")}</h2>

      <div className="spine-canvas" style={{ height }}>
        {/* 曲线与圆点是几何图形,信息由下面的按钮承载 */}
        <svg
          className="spine-curve"
          width={SPINE_W}
          height={height}
          viewBox={`0 0 ${SPINE_W} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={pathFrom(curve)}
            fill="none"
            stroke="var(--black)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {days.map((day, i) => {
            const { x, y } = nodeAt(i);
            const active = day.id === activeDayId;
            return (
              <circle
                key={day.id}
                cx={x}
                cy={y}
                r={NODE_R}
                fill={active ? "var(--red)" : "var(--white)"}
                stroke="var(--black)"
                strokeWidth="4"
              />
            );
          })}
        </svg>

        {/* 「x.xx 出发」压在起笔钩上方,对应手绘稿左上角那一行 */}
        <span className="spine-depart" style={{ left: curve.start.x, top: 0 }}>
          {trip.departLabel} {t("departs")}
        </span>

        {/* 每天一个可点标签,摆位由 labelBox 从曲线形状算出 */}
        <ul className="spine-days" aria-label={t("pickDay")}>
          {days.map((day, i) => {
            const box = labelBox(i, points);
            const active = day.id === activeDayId;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  className={
                    `spine-day align-${box.side}` + (active ? " is-active" : "")
                  }
                  style={{ left: box.x0, top: box.top }}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onPickDay(day.id)}
                >
                  <span className="spine-day-number">Day {day.dayNumber}</span>
                  <span className="spine-day-date">{day.dateLabel}</span>
                  <span className="spine-day-city">
                    {lang === "zh" ? day.city : day.cityEn}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
