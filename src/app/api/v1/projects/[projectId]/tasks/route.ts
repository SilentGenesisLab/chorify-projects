import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("tasks", { read: "task:read", create: "task:create", update: "task:update", delete: "task:delete" });
export const GET = routes.GET;
export const POST = routes.POST;
