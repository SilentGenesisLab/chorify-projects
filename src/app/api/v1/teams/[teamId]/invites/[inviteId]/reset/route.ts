import { POST as webPOST } from "@/app/api/teams/[teamId]/invites/[inviteId]/reset/route";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute("team:invite:manage", webPOST, { highRisk: true, idempotent: true });
