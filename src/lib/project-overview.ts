export const PROGRESS_WEIGHTS = {
  requirements: 20,
  tasks: 50,
  bugs: 20,
  milestones: 10,
} as const;

const REQUIREMENT_SCORES: Record<string, number> = {
  DRAFT: 0,
  REVIEW: 20,
  APPROVED: 40,
  DEVELOPING: 70,
  IN_PROGRESS: 70,
  DONE: 100,
};

const TASK_SCORES: Record<string, number> = {
  TODO: 0,
  IN_PROGRESS: 35,
  PENDING_ACCEPTANCE: 80,
  NEEDS_CHANGES: 55,
  ACCEPTED: 100,
  DONE: 100,
};

const BUG_SCORES: Record<string, number> = {
  NEW: 0,
  CONFIRMED: 10,
  ASSIGNED: 20,
  FIXING: 45,
  PENDING_VERIFICATION: 70,
  VERIFIED: 85,
  PENDING_RELEASE: 90,
  CLOSED: 100,
  REOPENED: 20,
  DEFERRED: 0,
};

const MILESTONE_SCORES: Record<string, number> = {
  PLANNED: 0,
  IN_PROGRESS: 50,
  COMPLETED: 100,
  DELAYED: 25,
};

type StatusItem = { status: string };
type ProgressInput = {
  requirements: StatusItem[];
  tasks: StatusItem[];
  bugs: StatusItem[];
  milestones: StatusItem[];
};

function categoryProgress(
  items: StatusItem[],
  scores: Record<string, number>,
  excluded: Set<string> = new Set(),
) {
  const included = items.filter((item) => !excluded.has(item.status));
  if (!included.length) return { value: 0, count: 0, available: false };
  const total = included.reduce((sum, item) => sum + (scores[item.status] ?? 0), 0);
  return { value: Math.round(total / included.length), count: included.length, available: true };
}

export function calculateProjectProgress(input: ProgressInput) {
  const breakdown = {
    requirements: categoryProgress(input.requirements, REQUIREMENT_SCORES),
    tasks: categoryProgress(input.tasks, TASK_SCORES),
    bugs: categoryProgress(input.bugs, BUG_SCORES, new Set(["REJECTED"])),
    milestones: categoryProgress(input.milestones, MILESTONE_SCORES, new Set(["CANCELLED"])),
  };
  const entries = Object.entries(breakdown) as Array<
    [keyof typeof PROGRESS_WEIGHTS, (typeof breakdown)[keyof typeof breakdown]]
  >;
  const activeWeight = entries.reduce(
    (sum, [key, item]) => sum + (item.available ? PROGRESS_WEIGHTS[key] : 0),
    0,
  );
  const overall = activeWeight
    ? Math.round(
        entries.reduce(
          (sum, [key, item]) =>
            sum + (item.available ? item.value * PROGRESS_WEIGHTS[key] : 0),
          0,
        ) / activeWeight,
      )
    : 0;
  return { overall, breakdown };
}

export function nextTaskCompletedAt(
  status: string,
  existing: Date | null | undefined,
  now = new Date(),
) {
  return status === "ACCEPTED" || status === "DONE" ? existing || now : null;
}

export function shanghaiDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildCompletionTrend(days: number, dates: Date[], now = new Date()) {
  const today = new Date(`${shanghaiDay(now)}T00:00:00+08:00`);
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = shanghaiDay(date);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * 86_400_000);
    const key = shanghaiDay(date);
    return { date: key, count: counts.get(key) || 0 };
  });
}

export function selectCurrentVersion<T extends { status: string; updatedAt: Date }>(versions: T[]) {
  const ranks: Record<string, number> = {
    DEVELOPING: 0,
    TESTING: 0,
    PENDING_RELEASE: 0,
    PLANNING: 1,
    RELEASED: 2,
    ARCHIVED: 3,
    CANCELLED: 4,
  };
  return [...versions].sort(
    (a, b) =>
      (ranks[a.status] ?? 5) - (ranks[b.status] ?? 5) ||
      b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0] || null;
}
