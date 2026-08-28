import { POST as webPOST } from "@/app/api/files/uploads/[uploadId]/complete/route";
import { apiRoute } from "@/lib/api-route";
export const POST = apiRoute("file:create", webPOST, { idempotent: true });
