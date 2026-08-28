import { GET as webGET, POST as webPOST } from "@/app/api/projects/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("project:read", webGET, { paginateKey: "projects" });
export const POST = apiRoute("project:create", webPOST, { idempotent: true });
