import { prisma } from "@/lib/prisma";

type ApiActor = { id: string; userId: string; name: string; prefix: string };

export async function auditApiCall(input: {
  auth: ApiActor;
  action: string;
  resource: string;
  resourceId?: string;
  projectId?: string;
  result?: "SUCCESS" | "DENIED" | "FAILED";
  request: Request;
  details?: Record<string, unknown>;
}) {
  const url = new URL(input.request.url);
  await prisma.auditLog.create({
    data: {
      userId: input.auth.userId,
      actorType: "USER",
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      channel: "API_KEY",
      metadata: {
        tokenId: input.auth.id,
        tokenName: input.auth.name,
        tokenPrefix: input.auth.prefix,
        projectId: input.projectId,
        result: input.result ?? "SUCCESS",
        requestMethod: input.request.method,
        requestPath: url.pathname,
        ...input.details,
      },
    },
  });
}
