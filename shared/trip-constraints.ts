/** 行程包含起止日,因此最多选择 30 个自然日。 */
export const MAX_TRIP_DAYS = 30;

const DAY_MS = 86_400_000;

/** ISO 日期相差的自然日数量,包含起止两天。 */
export function tripDaysInclusive(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((endMs - startMs) / DAY_MS) + 1;
}

/** 从一个 ISO 日期向后推指定天数,仍返回 YYYY-MM-DD。 */
export function addIsoDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
