import { apiRoute } from "@/lib/api-route";
import { GET as scheduleGET } from "@/app/api/projects/[projectId]/schedule/route";

export const GET = apiRoute("project:read", scheduleGET);
