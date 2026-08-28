import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("requirements", { read: "requirement:read", create: "requirement:create", update: "requirement:update", delete: "requirement:delete" });
export const GET = routes.itemGET;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
