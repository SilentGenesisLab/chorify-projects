import { POST as webPOST } from "@/app/api/projects/[projectId]/milestones/route";
import { GET as overviewGET } from "@/app/api/projects/[projectId]/overview/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("milestone:read", overviewGET);
export const POST = apiRoute("milestone:create", webPOST, { idempotent: true });
