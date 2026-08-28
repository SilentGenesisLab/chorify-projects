import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("versions", { read: "version:read", create: "version:create", update: "version:update", delete: "version:delete" });
export const GET = routes.GET;
export const POST = routes.POST;
