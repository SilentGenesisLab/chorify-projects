FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com

FROM dependencies AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS production-dependencies
WORKDIR /app
RUN npm init -y \
  && npm install --omit=dev --no-save prisma@6.12.0 --registry=https://registry.npmmirror.com \
  && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=production-dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
# `prisma generate` runs in the builder stage. Restore its generated runtime
# after copying production dependencies, otherwise npm's placeholder client
# shadows the generated client and every database-backed route fails at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
