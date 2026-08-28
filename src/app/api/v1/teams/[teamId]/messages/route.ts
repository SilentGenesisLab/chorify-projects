import { GET as webGET, POST as webPOST } from "@/app/api/teams/[teamId]/messages/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("message:read", webGET, { paginateKey: "inbox" });
export const POST = apiRoute("message:write", webPOST, { idempotent: true });
