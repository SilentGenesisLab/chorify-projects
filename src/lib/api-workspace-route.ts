import type { ApiTokenPermission } from "@/lib/api-token-permissions";
import { apiRoute } from "@/lib/api-route";
import { createWorkspaceItem, deleteWorkspaceItem, getWorkspaceItem, listWorkspaceModule, updateWorkspaceItem, type WorkspaceModule } from "@/lib/api-workspace-adapters";

type CrudPermissions = { read: ApiTokenPermission; create: ApiTokenPermission; update: ApiTokenPermission; delete: ApiTokenPermission };

const confirmId = (body: unknown) => (body as { confirmId?: string } | null)?.confirmId ? null : "删除资源需要 confirmId";

export function workspaceRoutes(module: WorkspaceModule, permissions: CrudPermissions) {
  return {
    GET: apiRoute(permissions.read, listWorkspaceModule(module), { paginateKey: module }),
    POST: apiRoute(permissions.create, createWorkspaceItem(module), { idempotent: true }),
    itemGET: apiRoute(permissions.read, getWorkspaceItem(module)),
    PATCH: apiRoute(permissions.update, updateWorkspaceItem(module)),
    DELETE: apiRoute(permissions.delete, deleteWorkspaceItem(module), { highRisk: true, idempotent: true, confirm: confirmId }),
  };
}
