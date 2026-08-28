import { GET as webGET } from "@/app/api/audit-logs/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("audit:read", webGET, { paginateKey: "logs" });
