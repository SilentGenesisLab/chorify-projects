import { DELETE as webDELETE, PATCH as webPATCH } from "@/app/api/teams/[teamId]/okrs/[objectiveId]/route";
import { apiRoute } from "@/lib/api-route";

export const PATCH = apiRoute("okr:write", webPATCH);
export const DELETE = apiRoute("okr:write", webDELETE, { highRisk: true, idempotent: true });
