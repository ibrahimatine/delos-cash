FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV APP_ENV=prod
ENV PORT=8000
ENV BASE_URL=/
ENV DATABASE_PATH=/app/data/delos.db
ENV FILES_DIR=/app/data/files
ENV BITNOB_MODE=mock
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/web ./web
COPY --from=build /app/dist ./dist
COPY --from=build /app/prod-server.ts ./prod-server.ts
COPY --from=build /app/task-backup.ts ./task-backup.ts
RUN mkdir -p /app/data/files /app/data/backups
EXPOSE 8000
VOLUME /app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--env-file-if-exists=.env-prod", "--import", "tsx", "prod-server.ts"]
