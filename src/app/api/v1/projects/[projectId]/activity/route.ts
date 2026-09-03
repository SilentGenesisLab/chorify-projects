import { GET as webGET } from "@/app/api/projects/[projectId]/activity/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("project:read", webGET);
