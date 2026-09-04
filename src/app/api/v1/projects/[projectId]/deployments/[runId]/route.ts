import { GET as webGET } from "@/app/api/projects/[projectId]/deployments/[runId]/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("release:read", webGET);
