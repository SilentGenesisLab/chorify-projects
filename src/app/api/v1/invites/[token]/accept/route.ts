import { POST as webPOST } from "@/app/api/invites/[token]/route";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute("team:read", webPOST, { idempotent: true });
