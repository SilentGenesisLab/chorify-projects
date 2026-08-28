import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("versions", { read: "version:read", create: "version:create", update: "version:update", delete: "version:delete" });
export const GET = routes.itemGET;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
