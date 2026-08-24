import { useState } from "react";
import { useLang } from "../i18n/useLang";

// 日期区间选择 —— 线框图右侧的 calendar 方块。
//
// 第一次点击定起点,第二次点击定终点(点到早于起点的日子就重新起算)。
// 纯 UI 状态,不含业务规则(AGENTS.md §3):合法性由后端在保存时再校验一次。
//
// 日期一律用 "YYYY-MM-DD" 字符串传递,并且只按本地年月日拼接 ——
// 不走 Date.toISOString(),那会按 UTC 折算,东八区选 1 号会存成上个月 31 号。

export type DateRange = { start: string; end: string };

type Props = {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** 某月有多少天。第 0 天等于上个月最后一天,所以用下个月的第 0 天。 */
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** 该月 1 号是星期几,周一为 0(中英日历都习惯周一开头)。 */
function firstWeekday(y: number, m: number): number {
  const sunday0 = new Date(y, m, 1).getDay();
  return (sunday0 + 6) % 7;
}

const WEEKDAYS = {
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  zh: ["一", "二", "三", "四", "五", "六", "日"],
};

const MONTHS = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  zh: [
    "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
    "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
  ],
};

export default function DateRangePicker({ value, onChange }: Props) {
  const { lang, t } = useLang();
  const today = new Date();
  // 打开时停在已选区间所在的月份,否则停在本月。
  const [cursor, setCursor] = useState(() => {
    if (value) {
      const [y, m] = value.start.split("-").map(Number);
      return { y, m: m - 1 };
    }
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  function shiftMonth(delta: number) {
    setCursor(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  function pick(day: string) {
    // 没选过 / 已选完整区间 → 重新起算;只有起点时 → 补终点。
    if (!value || value.start !== value.end) {
      onChange({ start: day, end: day });
      return;
    }
    if (day < value.start) {
      onChange({ start: day, end: day });
      return;
    }
    onChange({ start: value.start, end: day });
  }

  const totalDays = daysInMonth(cursor.y, cursor.m);
  const lead = firstWeekday(cursor.y, cursor.m);
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  const monthLabel =
    lang === "zh"
      ? `${cursor.y} 年 ${MONTHS.zh[cursor.m]}`
      : `${MONTHS.en[cursor.m]} ${cursor.y}`;

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => shiftMonth(-1)}
          aria-label={t("prevMonth")}
        >
          ‹
        </button>
        <h2 className="calendar-month" aria-live="polite">
          {monthLabel}
        </h2>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => shiftMonth(1)}
          aria-label={t("nextMonth")}
        >
          ›
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS[lang].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={t("pickDates")}>
        {/* 补齐 1 号之前的空格,让日期落在正确的星期列上。 */}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} className="calendar-blank" />
        ))}

        {Array.from({ length: totalDays }, (_, i) => {
          const day = iso(cursor.y, cursor.m, i + 1);
          const isStart = value?.start === day;
          const isEnd = value?.end === day;
          const inRange = !!value && day >= value.start && day <= value.end;
          const classes = [
            "calendar-day",
            inRange ? "is-in-range" : "",
            isStart || isEnd ? "is-edge" : "",
            day === todayIso ? "is-today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day}
              type="button"
              className={classes}
              aria-pressed={inRange}
              aria-label={day}
              onClick={() => pick(day)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
