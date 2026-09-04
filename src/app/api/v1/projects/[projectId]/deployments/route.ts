import { GET as webGET } from "@/app/api/projects/[projectId]/deployment-center/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("release:read", webGET);
