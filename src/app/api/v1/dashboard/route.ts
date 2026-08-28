import { GET as webGET } from "@/app/api/dashboard/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("dashboard:read", webGET);
