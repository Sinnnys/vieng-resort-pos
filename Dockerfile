# ── Stage 1: Build frontend ──────────────────────────────
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production server ───────────────────────────
FROM node:18-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/src/ ./src/
COPY backend/env.example ./.env
COPY --from=frontend-build /app/frontend/dist ./frontend-dist/

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=./data/app.sqlite
ENV FRONTEND_DIST_PATH=./frontend-dist

EXPOSE 4000

VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
