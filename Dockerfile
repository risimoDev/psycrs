# ─── Base ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat ffmpeg
WORKDIR /app

# ─── Dependencies ──────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# ─── Shared build ─────────────────────────────────────
FROM deps AS shared-build
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./
RUN cd packages/shared && npx tsc -p tsconfig.json

# ─── API build ─────────────────────────────────────────
FROM shared-build AS api-build
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate && npx tsc -p tsconfig.json

# ─── Web build ─────────────────────────────────────────
FROM shared-build AS web-build
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN cd apps/web && npx next build

# ─── API production ───────────────────────────────────
FROM base AS api
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=api-build /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-build /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=shared-build /app/packages/shared/dist ./packages/shared/dist
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY package.json ./

RUN mkdir -p /var/storage/videos

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]

# ─── Web production ───────────────────────────────────
FROM base AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=web-build /app/apps/web/.next ./apps/web/.next
COPY --from=web-build /app/apps/web/public ./apps/web/public
COPY --from=shared-build /app/packages/shared/dist ./packages/shared/dist
COPY apps/web/package.json ./apps/web/
COPY apps/web/next.config.mjs ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY package.json ./

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["npx", "next", "start"]
