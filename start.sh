#!/bin/sh
set -e

cleanup() {
  echo "[All-in-One] Stopping services..."
  if [ -n "$BOT_PID" ]; then
    kill -TERM "$BOT_PID" 2>/dev/null || true
  fi
  if [ -n "$LAVALINK_PID" ]; then
    kill -TERM "$LAVALINK_PID" 2>/dev/null || true
  fi
}

trap cleanup TERM INT

echo "[All-in-One] Starting embedded Lavalink v4 server..."
cd /app/lavalink
# Use 256MB max heap so Lavalink and Node safely fit within 512MB RAM on Render
java -Xmx256m -Xms64m -XX:+UseG1GC -jar Lavalink.jar 2>&1 | sed 's/^/[Lavalink] /' &
LAVALINK_PID=$!

echo "[All-in-One] Waiting for Lavalink HTTP/WebSocket ready on 127.0.0.1:2333..."
for i in $(seq 1 45); do
  if node -e "fetch('http://127.0.0.1:2333/version').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null; then
    echo "[All-in-One] Lavalink is online and ready!"
    break
  fi
  sleep 1
done

echo "[All-in-One] Starting Riffly Discord bot..."
cd /app
node dist/index.js &
BOT_PID=$!

# Wait for bot process to terminate
wait "$BOT_PID"
