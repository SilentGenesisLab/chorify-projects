import { DELETE as webDELETE, PATCH as webPATCH } from "@/app/api/projects/[projectId]/members/[memberId]/route";
import { apiRoute } from "@/lib/api-route";

const confirmMember = (body: unknown) => {
  const value = body as { confirmUserId?: string; reason?: string } | null;
  return value?.confirmUserId && value.reason?.trim() ? null : "需要 confirmUserId 和操作原因";
};
export const PATCH = apiRoute("project:member:manage", webPATCH, { highRisk: true, idempotent: true, confirm: confirmMember });
export const DELETE = apiRoute("project:member:manage", webDELETE, { highRisk: true, idempotent: true, confirm: confirmMember });
