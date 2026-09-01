ARG SERVICE_TARGET=web

FROM node:22-bookworm-slim AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /atlas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /atlas
COPY --from=build /atlas/package.json /atlas/pnpm-workspace.yaml ./
COPY --from=build /atlas/node_modules ./node_modules
COPY --from=build /atlas/apps/api/package.json ./apps/api/package.json
COPY --from=build /atlas/apps/api/dist ./apps/api/dist
COPY --from=build /atlas/packages/core/package.json ./packages/core/package.json
COPY --from=build /atlas/packages/core/dist ./packages/core/dist
COPY --from=build /atlas/packages/types/package.json ./packages/types/package.json
COPY --from=build /atlas/packages/types/dist ./packages/types/dist
RUN mkdir -p /data/media && chown -R node:node /data
USER node
EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /atlas
COPY --from=build /atlas/apps/web/.next/standalone ./
COPY --from=build /atlas/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:22-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /atlas
COPY --from=build /atlas/node_modules ./node_modules
COPY --from=build /atlas/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /atlas/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/worker.js"]

# Railway builds the final stage. Set SERVICE_TARGET=api or worker on those services;
# the default remains web for the public interface and legal pages.
FROM ${SERVICE_TARGET} AS runtime
