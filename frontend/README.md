# Riffly Web Dashboard — Frontend UI

Modern, dark-glassmorphic responsive dashboard and live audio controller for Riffly.
Runs isolated from the core Discord bot code without touching `src/` or `tests/`.

## Features
- **Live Overview**: Host CPU/RAM telemetry, Discord gateway latency, audio engine status.
- **Interactive Music Console**:
  - Live animated visualizer & album artwork.
  - Controls: Play / Pause, Skip, Stop, Volume slider, Shuffle, Loop.
  - Interactive track search & enqueue bar.
  - Live upcoming track queue list.
- **Guilds & Server Management**: Server inspection and voice status.
- **Settings**: Dynamic prefix configuration and default volume controls.
- **Real-Time Updates**: Auto-refreshes and connects to backend Server-Sent Events (`/api/events`).

## Quick Start
```bash
cd frontend
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

