# ---- Build the new interface (served below /v2) ----
FROM node:24-alpine AS app
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app ./
RUN npm run build

# ---- Runtime ----
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/hv-planer.sqlite \
    WEB_DIR=/app/web \
    APP_DIR=/app/app
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY web /app/web
COPY --from=app /build/app/dist /app/app
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "src/index.js"]
