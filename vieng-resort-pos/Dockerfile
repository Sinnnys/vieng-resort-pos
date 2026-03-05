FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/src/ ./src/
COPY --from=frontend-build /app/frontend/dist ./frontend-dist/
ENV NODE_ENV=production \
    PORT=4001 \
    DATABASE_PATH=./data/pos.sqlite \
    FRONTEND_DIST_PATH=./frontend-dist
EXPOSE 4001
VOLUME ["/app/data"]
CMD ["node", "src/server.js"]
