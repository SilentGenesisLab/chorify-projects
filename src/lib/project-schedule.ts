const DAY_MS = 86_400_000;
export const TERMINAL_TASK_STATUSES = new Set(["ACCEPTED", "DONE"]);
export const ACTIVE_REQUIREMENT_STATUSES = new Set(["DEVELOPING", "IN_PROGRESS"]);

export function shanghaiDateKey(value: Date | string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date(value));
}

function calendarDate(value: Date | string) {
  const key = shanghaiDateKey(value);
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function naturalDays(start: Date | string | null, end: Date | string | null) {
  if (!start || !end) return null;
  return Math.max(1, Math.round((calendarDate(end) - calendarDate(start)) / DAY_MS) + 1);
}

export function scheduleHealth(input: { status: string; dueAt: Date | null; closedAt: Date | null }, now = new Date()) {
  if (!input.dueAt) return "UNSCHEDULED" as const;
  const dueDay = calendarDate(input.dueAt), today = calendarDate(now);
  if (input.closedAt) return calendarDate(input.closedAt) > dueDay ? "COMPLETED_LATE" as const : "COMPLETED" as const;
  if (dueDay < today) return "OVERDUE" as const;
  if (dueDay - today <= 3 * DAY_MS) return "AT_RISK" as const;
  return input.status === "TODO" || input.status === "DRAFT" || input.status === "REVIEW" || input.status === "APPROVED"
    ? "NOT_STARTED" as const
    : "IN_PROGRESS" as const;
}

export function hasDependencyConflict(task: { plannedStartAt: Date | null; dependencies: Array<{ dependsOn: { dueAt: Date | null; status: string } }> }) {
  if (!task.plannedStartAt) return false;
  return task.dependencies.some(({ dependsOn }) =>
    !TERMINAL_TASK_STATUSES.has(dependsOn.status) && Boolean(dependsOn.dueAt && calendarDate(task.plannedStartAt!) <= calendarDate(dependsOn.dueAt)),
  );
}

export function nextStartedAt(current: Date | null, previousStatus: string | null, nextStatus: string, type: "requirement" | "task", now = new Date()) {
  if (current) return current;
  if (type === "requirement") return ACTIVE_REQUIREMENT_STATUSES.has(nextStatus) || nextStatus === "DONE" ? now : null;
  return previousStatus === "TODO" && nextStatus !== "TODO" ? now : previousStatus === null && nextStatus !== "TODO" ? now : null;
}

export function validateSchedule(start: string | null | undefined, end: string | null | undefined) {
  if (start && end && new Date(end) < new Date(start)) return "计划结束时间不能早于计划开始时间";
  return null;
}

export function createsDependencyCycle(taskId: string, dependencyIds: string[], edges: Array<{ taskId: string; dependsOnId: string }>) {
  const graph = new Map<string, string[]>();
  for (const edge of edges) graph.set(edge.taskId, [...(graph.get(edge.taskId) || []), edge.dependsOnId]);
  graph.set(taskId, dependencyIds);
  const visit = (node: string, seen: Set<string>): boolean => {
    if (node === taskId && seen.size) return true;
    if (seen.has(node)) return false;
    const next = new Set(seen).add(node);
    return (graph.get(node) || []).some(dependency => visit(dependency, next));
  };
  return dependencyIds.some(dependency => visit(dependency, new Set([taskId])));
}
