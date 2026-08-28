import { GET as webGET } from "@/app/api/teams/[teamId]/analytics/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("analytics:read", webGET);
