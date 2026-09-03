import { GET as webGET, PATCH as webPATCH } from "@/app/api/tasks/[taskId]/route";
import { apiRoute } from "@/lib/api-route";
export const GET = apiRoute("task:read", webGET);
export const PATCH = apiRoute("task:update", webPATCH);
