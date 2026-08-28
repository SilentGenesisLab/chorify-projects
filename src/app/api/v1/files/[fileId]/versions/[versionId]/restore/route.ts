import { POST as webPOST } from "@/app/api/files/[fileId]/versions/[versionId]/restore/route";
import { apiRoute } from "@/lib/api-route";
export const POST = apiRoute("file:update", webPOST, { idempotent: true });
