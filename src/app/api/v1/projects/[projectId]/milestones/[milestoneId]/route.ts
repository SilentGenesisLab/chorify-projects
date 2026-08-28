import { DELETE as webDELETE, PATCH as webPATCH } from "@/app/api/projects/[projectId]/milestones/[milestoneId]/route";
import { apiRoute } from "@/lib/api-route";

const confirm = (body: unknown, context: unknown) => {
  const value = body as { confirmId?: string } | null;
  return value?.confirmId ? null : "删除里程碑需要 confirmId";
};
export const PATCH = apiRoute("milestone:update", webPATCH);
export const DELETE = apiRoute("milestone:delete", webDELETE, { highRisk: true, idempotent: true, confirm });
