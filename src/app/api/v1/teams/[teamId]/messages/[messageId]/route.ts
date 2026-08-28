import { DELETE as webDELETE } from "@/app/api/teams/[teamId]/messages/[messageId]/route";
import { apiRoute } from "@/lib/api-route";

export const DELETE = apiRoute("message:write", webDELETE, { highRisk: true, idempotent: true });
