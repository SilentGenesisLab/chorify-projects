import { POST as webPOST } from "@/app/api/teams/[teamId]/messages/read/route";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute("message:write", webPOST);
