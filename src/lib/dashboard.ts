import { shanghaiDay } from "@/lib/project-overview";

export const TERMINAL_TASK_STATUSES = new Set(["ACCEPTED", "DONE"]);
export const ACTIVE_VERSION_STATUSES = new Set([
  "PLANNING",
  "DEVELOPING",
  "TESTING",
  "PENDING_RELEASE",
]);

export function shanghaiMonth(date: Date) {
  return shanghaiDay(date).slice(0, 7);
}

export function isShanghaiDay(date: Date | null, expected: Date) {
  return Boolean(date && shanghaiDay(date) === shanghaiDay(expected));
}

export function isOpenTask(status: string) {
  return !TERMINAL_TASK_STATUSES.has(status);
}

export function dashboardTaskSort(
  a: { dueAt: Date | null; priority: string },
  b: { dueAt: Date | null; priority: string },
  now = new Date(),
) {
  const overdueA = Boolean(a.dueAt && a.dueAt < now);
  const overdueB = Boolean(b.dueAt && b.dueAt < now);
  if (overdueA !== overdueB) return overdueA ? -1 : 1;
  if (a.dueAt && b.dueAt && a.dueAt.getTime() !== b.dueAt.getTime())
    return a.dueAt.getTime() - b.dueAt.getTime();
  if (a.dueAt !== b.dueAt) return a.dueAt ? -1 : 1;
  const priority = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as Record<string, number>;
  return (priority[a.priority] ?? 4) - (priority[b.priority] ?? 4);
}

export function selectDashboardVersion<T extends {
  status: string;
  plannedAt: Date | null;
  updatedAt: Date;
}>(versions: T[], now = new Date()) {
  return versions
    .filter((version) => ACTIVE_VERSION_STATUSES.has(version.status))
    .sort((a, b) => {
      const group = (value: Date | null) => !value ? 2 : value >= now ? 0 : 1;
      const groupDiff = group(a.plannedAt) - group(b.plannedAt);
      if (groupDiff) return groupDiff;
      if (a.plannedAt && b.plannedAt)
        return group(a.plannedAt) === 0
          ? a.plannedAt.getTime() - b.plannedAt.getTime()
          : b.plannedAt.getTime() - a.plannedAt.getTime();
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })[0] || null;
}
