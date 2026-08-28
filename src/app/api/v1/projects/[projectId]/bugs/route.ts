import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("bugs", { read: "bug:read", create: "bug:create", update: "bug:update", delete: "bug:delete" });
export const GET = routes.GET;
export const POST = routes.POST;
