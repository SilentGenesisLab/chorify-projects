import { GET as webGET } from "@/app/api/tasks/[taskId]/route";
import { apiRoute } from "@/lib/api-route";
export const GET = apiRoute("task:read", webGET);
