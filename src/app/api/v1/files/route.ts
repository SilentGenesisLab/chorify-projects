import { GET as webGET } from "@/app/api/files/route";
import { apiRoute } from "@/lib/api-route";
export const GET = apiRoute("file:read", webGET, { paginateKey: "files" });
