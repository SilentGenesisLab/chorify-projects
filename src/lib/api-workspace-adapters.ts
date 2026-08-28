import { NextResponse, type NextRequest } from "next/server";
import { GET as workspaceGET } from "@/app/api/projects/[projectId]/workspace/route";
import { POST as workspacePOST } from "@/app/api/projects/[projectId]/workspace/[module]/route";
import { DELETE as workspaceDELETE, PATCH as workspacePATCH } from "@/app/api/projects/[projectId]/workspace/[module]/[itemId]/route";

export type WorkspaceModule = "requirements" | "tasks" | "bugs" | "versions" | "releases";
type ProjectContext = { params: Promise<{ projectId: string }> };
type ItemContext = { params: Promise<{ projectId: string; itemId: string }> };

export function listWorkspaceModule(module: WorkspaceModule) {
  return async (request: Request, context: ProjectContext) => {
    const response = await workspaceGET(request as NextRequest, context);
    if (!response.ok) return response;
    const body = await response.json() as Record<string, unknown>;
    return NextResponse.json({ [module]: body[module], permissions: body.permissions });
  };
}

export function getWorkspaceItem(module: WorkspaceModule) {
  return async (request: Request, context: ItemContext) => {
    const { projectId, itemId } = await context.params;
    const response = await workspaceGET(request as NextRequest, { params: Promise.resolve({ projectId }) });
    if (!response.ok) return response;
    const body = await response.json() as Record<string, unknown>;
    const items = body[module] as Array<{ id: string }> | undefined;
    const item = items?.find((candidate) => candidate.id === itemId);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: "记录不存在" }, { status: 404 });
  };
}

export function createWorkspaceItem(module: WorkspaceModule) {
  return async (request: Request, context: ProjectContext) => {
    const { projectId } = await context.params;
    return workspacePOST(request as NextRequest, { params: Promise.resolve({ projectId, module }) });
  };
}

export function updateWorkspaceItem(module: WorkspaceModule) {
  return async (request: Request, context: ItemContext) => {
    const { projectId, itemId } = await context.params;
    return workspacePATCH(request as NextRequest, { params: Promise.resolve({ projectId, module, itemId }) });
  };
}

export function deleteWorkspaceItem(module: WorkspaceModule) {
  return async (request: Request, context: ItemContext) => {
    const { projectId, itemId } = await context.params;
    return workspaceDELETE(request as NextRequest, { params: Promise.resolve({ projectId, module, itemId }) });
  };
}
