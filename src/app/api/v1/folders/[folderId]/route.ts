import { DELETE as webDELETE, PATCH as webPATCH } from "@/app/api/files/folders/[folderId]/route";
import { apiRoute } from "@/lib/api-route";
const confirm = (body: unknown) => (body as { confirmId?: string } | null)?.confirmId ? null : "删除文件夹需要 confirmId";
export const PATCH = apiRoute("file:update", webPATCH);
export const DELETE = apiRoute("file:delete", webDELETE, { highRisk: true, idempotent: true, confirm });
