# ── Stage 1: Build ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy all source directories
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/

# Install dependencies for all workspaces
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Build client (Vite) and server (tsc)
RUN cd client && npm run build
RUN cd server && npm run build

# ── Stage 2: Production ────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy server package files and install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm install --omit=dev

# Copy built server
COPY --from=builder /app/server/dist/ ./server/dist/

# Copy shared (needed at runtime by server)
COPY shared/ ./shared/

# Copy built client static files
COPY --from=builder /app/client/dist/ ./client/dist/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/dist/server/src/index.js"]
