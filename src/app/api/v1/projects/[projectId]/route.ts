import { DELETE as webDELETE, PATCH as webPATCH } from "@/app/api/projects/[projectId]/route";
import { GET as overviewGET } from "@/app/api/projects/[projectId]/overview/route";
import { apiRoute } from "@/lib/api-route";

const confirmProject = (body: unknown) => (body as { confirmName?: string } | null)?.confirmName ? null : "删除项目需要准确的 confirmName";
export const GET = apiRoute("project:read", overviewGET);
export const PATCH = apiRoute("project:update", webPATCH);
export const DELETE = apiRoute("project:delete", webDELETE, { highRisk: true, idempotent: true, confirm: confirmProject });
