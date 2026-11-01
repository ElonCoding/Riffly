/**
 * Returns the HTML string for the interactive Riffly Web Dashboard portal.
 */
export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Riffly — Modular Discord Music & Server Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: rgba(22, 27, 34, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: radial-gradient(circle at top, #1e1b4b 0%, var(--bg) 70%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      background: rgba(9, 10, 15, 0.6);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent), #ec4899);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--success);
    }
    main {
      flex: 1;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .hero {
      text-align: center;
      padding: 2rem 0;
    }
    .hero h1 {
      font-size: 2.5rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      background: linear-gradient(to right, #fff, #9ca3af);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
    }
    .stat-title {
      color: var(--text-muted);
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
    }
    .player-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(12px);
    }
    .player-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .player-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: center;
      margin-top: 1.5rem;
    }
    .btn {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      border-top: 1px solid var(--card-border);
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">🎵</div>
      <span>Riffly</span>
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      <span id="bot-status">System Operational</span>
    </div>
  </header>
  <main>
    <section class="hero">
      <h1>Riffly Dashboard & Control API</h1>
      <p>High-performance audio streaming, comprehensive moderation, and community automation.</p>
    </section>
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">Connected Guilds</div>
        <div class="stat-value" id="guilds-count">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Cached Users</div>
        <div class="stat-value" id="users-count">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Gateway Ping</div>
        <div class="stat-value" id="ping-ms">-- ms</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Uptime</div>
        <div class="stat-value" id="uptime">--</div>
      </div>
    </section>
    <section class="player-card">
      <div class="player-header">
        <h3>Live Audio Playback Engine</h3>
        <span style="color: var(--text-muted); font-size: 0.9rem;">Lavalink v4 • NodeLink Ready</span>
      </div>
      <div style="background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--card-border);">
        <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.25rem;">Now Playing</div>
        <div style="color: var(--text-muted); font-size: 0.95rem;" id="current-track">No audio currently playing in voice channel.</div>
      </div>
      <div class="player-controls">
        <button class="btn btn-secondary" onclick="control('pause')">⏸️ Pause</button>
        <button class="btn btn-secondary" onclick="control('resume')">▶️ Resume</button>
        <button class="btn btn-secondary" onclick="control('skip')">⏭️ Skip</button>
        <button class="btn btn-secondary" onclick="control('stop')">⏹️ Stop</button>
        <a href="/api/docs" class="btn" style="text-decoration: none;">📖 API Docs</a>
      </div>
    </section>
  </main>
  <footer>
    Riffly &bull; Autonomous Modular Discord Platform &bull; Apache-2.0 License
  </footer>
  <script>
    async function loadStats() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          document.getElementById('guilds-count').textContent = data.guildsCount ?? 0;
          document.getElementById('users-count').textContent = data.usersCount ?? 0;
          document.getElementById('ping-ms').textContent = (data.pingMs ?? 0) + ' ms';
          const up = data.uptimeSeconds ?? 0;
          const mins = Math.floor(up / 60);
          const hours = Math.floor(mins / 60);
          document.getElementById('uptime').textContent = hours > 0 ? hours + 'h ' + (mins % 60) + 'm' : mins + 'm';
        }
      } catch (e) {
        console.error('Failed loading stats', e);
      }
    }
    function control(action) {
      alert('REST API Action: ' + action + '. Connect via OAuth2 or Discord slash commands.');
    }
    loadStats();
    setInterval(loadStats, 10000);
  </script>
</body>
</html>`;
}
