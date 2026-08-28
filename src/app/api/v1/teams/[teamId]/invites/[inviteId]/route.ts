import { DELETE as webDELETE } from "@/app/api/teams/[teamId]/invites/[inviteId]/route";
import { apiRoute } from "@/lib/api-route";

export const DELETE = apiRoute("team:invite:manage", webDELETE, { highRisk: true, idempotent: true });
