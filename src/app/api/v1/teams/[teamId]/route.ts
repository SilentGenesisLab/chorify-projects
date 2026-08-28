import { GET as webGET, PATCH as webPATCH } from "@/app/api/teams/[teamId]/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("team:read", webGET);
export const PATCH = apiRoute("team:update", webPATCH);
