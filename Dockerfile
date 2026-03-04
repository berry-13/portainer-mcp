FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S mcp && adduser -S mcp -G mcp
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN chown -R mcp:mcp /app
USER mcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "process.exit(0)"
ENTRYPOINT ["node", "dist/index.js"]
