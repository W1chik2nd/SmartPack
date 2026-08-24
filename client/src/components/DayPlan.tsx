// 右栏「每天的行程」——中间一条略带波形的竖线,停靠点左右交替挂在线上,
// 每个点用一小段横线连到卡片(照手绘稿)。
//
// 几何:竖线 SVG 宽度固定为 SPINE_W、行高固定为 ROW_H,第 i 个点的
// y = ROW_H/2 + i*ROW_H,正好落在第 i 行卡片的垂直中心,所以圆点和卡片
// 天然对齐。这两个常量必须与 day-plan.css 里的 grid 保持一致。
import type { TripDay } from "../api";
import { useLang } from "../i18n/useLang";
import StopCard from "./StopCard";
import { wardrobePhotoUrl, type TripOutfitItem } from "../api";

const SPINE_W = 150;
const ROW_H = 156;
const NODE_R = 9;
// 圆点朝自己那张卡片的一侧偏一点,竖线因此呈波形而不是笔直。
const X_RIGHT = SPINE_W * 0.62;
const X_LEFT = SPINE_W * 0.38;

/** 第 i 个停靠点的圆点坐标。偶数号挂右边,奇数号挂左边。 */
function nodeAt(i: number): { x: number; y: number } {
  return { x: i % 2 === 0 ? X_RIGHT : X_LEFT, y: ROW_H / 2 + i * ROW_H };
}

/** 顺着各圆点画一条平滑的波形竖线,首尾各留半行。 */
function wavyLine(count: number, height: number): string {
  if (count === 0) return "";
  const first = nodeAt(0);
  let d = `M ${first.x} 0`;
  for (let i = 0; i < count; i++) {
    const p = nodeAt(i);
    const prevY = i === 0 ? 0 : nodeAt(i - 1).y;
    const prevX = i === 0 ? first.x : nodeAt(i - 1).x;
    // 控制点只在竖向拉开,横向沿用两端各自的 x,得到平滑的 S 过渡。
    d += ` C ${prevX} ${prevY + (p.y - prevY) * 0.5}, ${p.x} ${
      p.y - (p.y - prevY) * 0.5
    }, ${p.x} ${p.y}`;
  }
  const last = nodeAt(count - 1);
  d += ` C ${last.x} ${last.y + (height - last.y) * 0.5}, ${last.x} ${
    height - (height - last.y) * 0.5
  }, ${last.x} ${height}`;
  return d;
}

type Props = {
  day: TripDay;
};

export default function DayPlan({ day }: Props) {
  const { lang, t } = useLang();
  const stops = day.stops;
  const outfit = day.outfit ?? [];
  const equipment = day.equipment ?? [];
  const height = Math.max(stops.length, 1) * ROW_H;
  const summary = lang === "zh" ? day.summary : day.summaryEn || day.summary;
  const weather =
    lang === "zh" ? day.weatherSummary : day.weatherSummaryEn || day.weatherSummary;
  const risk = lang === "zh" ? day.weatherRisk : day.weatherRiskEn || day.weatherRisk;

  return (
    <section className="day-plan" aria-label={`Day ${day.dayNumber}`}>
      <header className="day-plan-head">
        <h2 className="day-plan-title">Day {day.dayNumber}</h2>
        <span className="day-plan-date">{day.dateLabel}</span>
        <span className="day-plan-summary">
          {summary} · {stops.length} {t("dayStops")}
        </span>
      </header>

      <div className="day-decisions">
        <section className="day-weather">
          <h3>{t("dayWeather")}</h3>
          <strong>{weather}</strong>
          <p>{risk}</p>
        </section>
        <section>
          <h3>{t("dayOutfit")}</h3>
          <ul className="day-outfit-list">
            {outfit.map((item, index) => (
              <li key={`${item.labelEn}-${index}`}>
                {item.wardrobeItemId && item.hasPhoto ? (
                  <img
                    src={wardrobePhotoUrl(item.wardrobeItemId)}
                    alt=""
                    className="day-outfit-photo"
                  />
                ) : null}
                <span>{lang === "zh" ? item.label : item.labelEn}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t("dayEquipment")}</h3>
          <ul>
            {equipment.map((item, index) => (
              <li key={`${item.labelEn}-${index}`}>
                {lang === "zh" ? item.label : item.labelEn}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="day-track">
        {/* 竖线与圆点是几何装饰,信息由卡片承载 */}
        <div className="day-spine" style={{ gridRow: `1 / ${stops.length + 1}` }}>
          <svg
            width={SPINE_W}
            height={height}
            viewBox={`0 0 ${SPINE_W} ${height}`}
            aria-hidden="true"
            focusable="false"
          >
            <path
              d={wavyLine(stops.length, height)}
              fill="none"
              stroke="var(--black)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {stops.map((stop, i) => {
              const { x, y } = nodeAt(i);
              const onRight = i % 2 === 0;
              // 短横线:从圆点连到卡片那一侧的边缘。
              const tickX = onRight ? SPINE_W : 0;
              return (
                <g key={stop.id}>
                  <line
                    x1={x}
                    y1={y}
                    x2={tickX}
                    y2={y}
                    stroke="var(--black)"
                    strokeWidth="4"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={NODE_R}
                    fill={onRight ? "var(--yellow)" : "var(--white)"}
                    stroke="var(--black)"
                    strokeWidth="4"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {stops.map((stop, i) => (
          <StopCard
            key={stop.id}
            stop={stop}
            side={i % 2 === 0 ? "right" : "left"}
            row={i + 1}
          />
        ))}
      </div>
    </section>
  );
}
