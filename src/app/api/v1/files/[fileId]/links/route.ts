import { POST as webPOST } from "@/app/api/files/[fileId]/links/route";
import { apiRoute } from "@/lib/api-route";
export const POST = apiRoute("file:link", webPOST, { idempotent: true });
