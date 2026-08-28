import { GET as webGET, POST as webPOST } from "@/app/api/projects/[projectId]/members/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("project:read", webGET, { paginateKey: "members" });
export const POST = apiRoute("project:member:manage", webPOST, { highRisk: true, idempotent: true });
