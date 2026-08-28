import { GET as webGET, POST as webPOST } from "@/app/api/teams/[teamId]/weekly-reports/route";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute("weekly_report:read", webGET, { paginateKey: "reports" });
export const POST = apiRoute("weekly_report:write", webPOST, { idempotent: true });
