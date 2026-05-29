# ── Stage 1: build the frontend ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: production Node + Express ───────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy only production deps manifest, then install (no devDeps)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend and server source
COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 8080
CMD ["node", "server/prod.js"]
