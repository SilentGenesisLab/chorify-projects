import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("tasks", { read: "task:read", create: "task:create", update: "task:update", delete: "task:delete" });
export const GET = routes.itemGET;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
