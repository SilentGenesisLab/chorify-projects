import { GET as webGET } from "@/app/api/me/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("dashboard:read", webGET);
