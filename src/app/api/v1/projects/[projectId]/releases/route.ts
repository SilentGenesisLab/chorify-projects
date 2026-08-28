import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("releases", { read: "release:read", create: "release:create", update: "release:update", delete: "release:delete" });
export const GET = routes.GET;
export const POST = routes.POST;
