import { POST as webPOST } from "@/app/api/files/[fileId]/shares/route";
import { apiRoute } from "@/lib/api-route";
export const POST = apiRoute("file:share", webPOST, { highRisk: true, idempotent: true });
