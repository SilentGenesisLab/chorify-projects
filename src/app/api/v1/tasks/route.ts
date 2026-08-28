import { GET as webGET } from "@/app/api/tasks/route";
import { apiRoute } from "@/lib/api-route";
export const GET = apiRoute("task:read", webGET, { paginateKey: "tasks" });
