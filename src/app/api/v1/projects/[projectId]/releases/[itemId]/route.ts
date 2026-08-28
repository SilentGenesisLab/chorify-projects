import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("releases", { read: "release:read", create: "release:create", update: "release:update", delete: "release:delete" });
export const GET = routes.itemGET;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
