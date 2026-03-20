# Stage 1: Build
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Stage 2: Runtime
FROM node:20-slim AS runner

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy required files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./ 
COPY --from=builder /app/swagger.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/views ./views
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/middlewares ./middlewares

# Optional (if exists)
# COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]