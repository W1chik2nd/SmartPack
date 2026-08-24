import { useState } from "react";
import { useLang } from "../i18n/useLang";

// 日期区间选择 —— 线框图右侧的 calendar 方块。
//
// 第一次点击定起点,第二次点击定终点(点到早于起点的日子就重新起算)。
// 已选起点后,超过"起点 + 30 天(含首尾)"的日子会灰掉不可点,让用户选不到
// 超范围的区间。这只是即时反馈;30 天上限的强制校验在后端(AGENTS.md §3),
// 后端才是唯一事实来源。
//
// 日期一律用 "YYYY-MM-DD" 字符串传递,并且只按本地年月日拼接 ——
// 不走 Date.toISOString(),那会按 UTC 折算,东八区选 1 号会存成上个月 31 号。

export type DateRange = { start: string; end: string };

type Props = {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
};

// 行程最长天数(含首尾)。与后端 MAX_TRIP_DAYS 保持一致;后端才是强制守卫,
// 这里只是即时把超范围的日子灰掉,让用户根本选不到,而不是选完再被拒。
const MAX_TRIP_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** 在某个本地日期上加 n 天,返回 ISO 串。用来算起点之后允许的最晚终点。 */
function addDays(isoDay: string, n: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const next = new Date(y, m - 1, d + n);
  return iso(next.getFullYear(), next.getMonth(), next.getDate());
}

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

  // 已选起点、还在等终点时(start === end),终点最晚只能到"起点 + 29 天"
  // (含首尾共 30 天)。超过这个的日子灰掉,让用户选不出超范围区间。
  const waitingForEnd = !!value && value.start === value.end;
  const maxEnd =
    waitingForEnd && value ? addDays(value.start, MAX_TRIP_DAYS - 1) : null;

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
          // 过去的日子不能选:出行日期不会在今天之前。ISO 串按字典序比较即可。
          const isPast = day < todayIso;
          // 等待终点时,超过"起点 + 30 天"的日子不能选(超范围)。
          const isTooFar = maxEnd !== null && day > maxEnd;
          const disabled = isPast || isTooFar;
          const isStart = value?.start === day;
          const isEnd = value?.end === day;
          const inRange = !!value && day >= value.start && day <= value.end;
          const classes = [
            "calendar-day",
            isPast ? "is-past" : "",
            isTooFar ? "is-past" : "",
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
              disabled={disabled}
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
