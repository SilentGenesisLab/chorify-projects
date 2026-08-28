import { DELETE as webDELETE } from "@/app/api/files/shares/[shareId]/route";
import { apiRoute } from "@/lib/api-route";
export const DELETE = apiRoute("file:share", webDELETE, { highRisk: true, idempotent: true });
