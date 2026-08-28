import { POST as webPOST } from "@/app/api/files/uploads/[uploadId]/parts/route";
import { apiRoute } from "@/lib/api-route";
export const POST = apiRoute("file:create", webPOST);
