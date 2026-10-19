# Stage 1: Build TypeScript bot
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: Runtime image with Java 21 + Node.js 22 + Lavalink v4
FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app

# Install Node.js 22 LTS
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Lavalink v4 jar from official Lavalink image
COPY --from=ghcr.io/lavalink-devs/lavalink:4 /opt/Lavalink/Lavalink.jar /app/lavalink/Lavalink.jar
COPY lavalink/application.yml /app/lavalink/application.yml

# Copy built application and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Copy startup script and strip possible CRLF
COPY start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

# Default environment variables for loopback connection inside container
ENV LAVALINK_HOST=127.0.0.1
ENV LAVALINK_PORT=2333
ENV LAVALINK_PASSWORD=youshallnotpass
ENV LAVALINK_SECURE=false

# Expose Render HTTP port and Lavalink internal port
EXPOSE 10000 2333

CMD ["/app/start.sh"]
