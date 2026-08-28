import { POST as webPOST } from "@/app/api/teams/[teamId]/key-results/[keyResultId]/check-ins/route";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute("okr:write", webPOST, { idempotent: true });
