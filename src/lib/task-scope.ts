export type TaskScopeRecord = {
  assigneeId: string | null;
  acceptorId: string | null;
  createdById: string | null;
  status: string;
};

export function taskRoleForUser(task: TaskScopeRecord, userId: string) {
  if (task.assigneeId === userId) return "OWNER" as const;
  if (task.acceptorId === userId && task.status === "PENDING_ACCEPTANCE") return "ACCEPTOR" as const;
  if (task.createdById === userId && task.assigneeId && task.assigneeId !== userId) return "DELEGATED" as const;
  return null;
}

export function taskMatchesScope(task: TaskScopeRecord, userId: string, scope: "mine" | "delegated") {
  const role = taskRoleForUser(task, userId);
  return scope === "mine" ? role === "OWNER" || role === "ACCEPTOR" : role === "DELEGATED";
}
