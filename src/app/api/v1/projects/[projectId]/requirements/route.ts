import { workspaceRoutes } from "@/lib/api-workspace-route";
const routes = workspaceRoutes("requirements", { read: "requirement:read", create: "requirement:create", update: "requirement:update", delete: "requirement:delete" });
export const GET = routes.GET;
export const POST = routes.POST;
