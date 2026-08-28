import { GET as webGET, POST as webPOST } from "@/app/api/teams/[teamId]/okrs/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("okr:read", webGET, { paginateKey: "objectives" });
export const POST = apiRoute("okr:write", webPOST, { idempotent: true });
