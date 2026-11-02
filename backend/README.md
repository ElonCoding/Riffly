# Riffly Web Dashboard — Backend API Gateway

Independent REST & SSE API service for the Riffly Web Dashboard.
Runs isolated from the core Discord bot code without touching `src/` or `tests/`.

## Port & Endpoints
- **Default Port**: `4000` (`http://localhost:4000`)
- **Health Check**: `GET /health`
- **System & Bot Telemetry**: `GET /api/status`
- **Guilds List**: `GET /api/guilds`
- **Guild Music Status**: `GET /api/guilds/:guildId/music`
- **Guild Music Control**: `POST /api/guilds/:guildId/music/control` (pause, resume, skip, stop, volume, loop, shuffle)
- **Guild Settings**: `GET /api/guilds/:guildId/settings` & `PATCH /api/guilds/:guildId/settings`
- **Real-Time Stream**: `GET /api/events` (Server-Sent Events)

## Quick Start
```bash
cd backend
npm start
```
