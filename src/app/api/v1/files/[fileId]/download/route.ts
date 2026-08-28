import { GET as webGET } from "@/app/api/files/[fileId]/download/route";
import { apiRoute } from "@/lib/api-route";
export const GET = apiRoute("file:read", webGET);
