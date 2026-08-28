import { GET as webGET, POST as webPOST } from "@/app/api/teams/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("team:read", webGET, { paginateKey: "teams" });
export const POST = apiRoute("team:create", webPOST, { idempotent: true });
