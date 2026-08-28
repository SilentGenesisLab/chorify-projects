import { GET as webGET } from "@/app/api/notifications/summary/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("notification:read", webGET);
