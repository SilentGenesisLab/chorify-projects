import { PrismaClient } from "@prisma/client";
import { currentApiActor } from "@/lib/api-request-context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const client = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) {
  client.$use(async (params, next) => {
    const actor = currentApiActor();
    if (actor && params.model === "AuditLog" && params.action === "create") {
      const data = params.args.data as Record<string, unknown>;
      const metadata = data.metadata && typeof data.metadata === "object"
        ? data.metadata as Record<string, unknown>
        : {};
      params.args.data = {
        ...data,
        userId: actor.userId,
        actorType: "USER",
        channel: "API_KEY",
        metadata: {
          ...metadata,
          tokenId: actor.id,
          tokenName: actor.name,
          tokenPrefix: actor.prefix,
          requestMethod: actor.requestMethod,
          requestPath: actor.requestPath,
        },
      };
    }
    return next(params);
  });
}
export const prisma = client;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
