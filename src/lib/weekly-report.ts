export const WEEKLY_REPORT_TEMPLATE = `## 本周完成

- 

## 下周计划

- 

## 风险与协作需求

- 无
`;

export function weekRange(value?: string, now = new Date()) {
  const source = value || new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return null;
  const [year, month, day] = source.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) return null;
  const mondayOffset = (calendarDate.getUTCDay() + 6) % 7;
  calendarDate.setUTCDate(calendarDate.getUTCDate() - mondayOffset);
  const startLabel = calendarDate.toISOString().slice(0, 10);
  const start = new Date(`${startLabel}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 7 * 86_400_000 - 1);
  return { start, end, startLabel };
}
