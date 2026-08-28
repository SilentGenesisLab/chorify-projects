import { DELETE as webDELETE, GET as webGET, PATCH as webPATCH } from "@/app/api/files/[fileId]/route";
import { apiRoute } from "@/lib/api-route";
const confirm = (body: unknown) => (body as { confirmId?: string } | null)?.confirmId ? null : "删除文件需要 confirmId";
export const GET = apiRoute("file:read", webGET);
export const PATCH = apiRoute("file:update", webPATCH);
export const DELETE = apiRoute("file:delete", webDELETE, { highRisk: true, idempotent: true, confirm });
