import { GET as webGET } from "@/app/api/projects/[projectId]/overview/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("project:read", webGET);
