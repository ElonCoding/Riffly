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

trap cleanup SIGTERM SIGINT

echo "[All-in-One] Starting embedded Lavalink v4 server..."
cd /app/lavalink
java -Xmx512m -jar Lavalink.jar &
LAVALINK_PID=$!

echo "[All-in-One] Waiting for Lavalink to be ready on 127.0.0.1:2333..."
for i in $(seq 1 30); do
  if node -e "const net=require('net'); const s=net.connect(2333,'127.0.0.1',()=>process.exit(0)); s.on('error',()=>process.exit(1));" 2>/dev/null; then
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
