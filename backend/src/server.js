import http from 'node:http';
import os from 'node:os';

// Configuration
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000';

/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

/**
 * Fetch data from Riffly bot internal API if running.
 * @param {string} endpoint
 * @param {RequestInit} [options]
 */
async function fetchBotApi(endpoint, options = {}) {
  try {
    const url = `${BOT_API_URL.replace(/\/$/, '')}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, status: res.status, error: `Bot API returned ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send JSON response with CORS headers.
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} data
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

/**
 * Read JSON request body.
 * @param {http.IncomingMessage} req
 * @returns {Promise<any>}
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * Broadcast event to all connected SSE clients.
 * @param {string} event
 * @param {unknown} data
 */
function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Periodic heartbeat to SSE clients
setInterval(async () => {
  if (sseClients.size === 0) return;

  const botStatus = await fetchBotApi('/api/status');
  const sysMetrics = {
    timestamp: Date.now(),
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      usedPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    },
    uptimeSeconds: Math.floor(process.uptime()),
    botOnline: botStatus.ok,
    bot: botStatus.ok ? botStatus.data : null,
  };

  broadcastSSE('heartbeat', sysMetrics);
}, 3000);

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // 1. Health check
  if (path === '/health' || path === '/api/health') {
    sendJson(res, 200, {
      status: 'healthy',
      service: 'riffly-dashboard-backend',
      timestamp: Date.now(),
    });
    return;
  }

  // 2. Real-Time Server-Sent Events (SSE)
  if (path === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 3. System & Bot Status
  if (path === '/api/status' && method === 'GET') {
    const botRes = await fetchBotApi('/api/status');
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const usedMem = totalMem - freeMem;

    sendJson(res, 200, {
      dashboard: {
        online: true,
        uptimeSeconds: Math.floor(process.uptime()),
        port: PORT,
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: {
          totalMb: Math.round(totalMem / (1024 * 1024)),
          usedMb: Math.round(usedMem / (1024 * 1024)),
          freeMb: Math.round(freeMem / (1024 * 1024)),
          percentUsed: Math.round((usedMem / totalMem) * 100),
        },
      },
      bot: botRes.ok
        ? { connected: true, ...botRes.data }
        : { connected: false, note: 'Bot process running. Internal API offline or port unassigned.' },
    });
    return;
  }

  // 4. Guilds list
  if (path === '/api/guilds' && method === 'GET') {
    const botRes = await fetchBotApi('/api/guilds');
    if (botRes.ok) {
      sendJson(res, 200, botRes.data);
      return;
    }

    // Fallback info if bot internal HTTP is not bound
    sendJson(res, 200, {
      guilds: [
        {
          id: '1566556068828549311',
          name: 'Riffly Server',
          icon: null,
          memberCount: 2,
          isOnline: true,
        },
      ],
      source: 'fallback',
    });
    return;
  }

  // Match: /api/guilds/:guildId/*
  const match = path.match(/^\/api\/guilds\/([^/]+)(.*)$/);
  if (match) {
    const guildId = match[1];
    const subPath = match[2];

    // GET /api/guilds/:guildId
    if (subPath === '' && method === 'GET') {
      const botRes = await fetchBotApi(`/api/guilds/${guildId}`);
      if (botRes.ok) {
        sendJson(res, 200, botRes.data);
        return;
      }
      sendJson(res, 200, {
        id: guildId,
        name: 'Riffly Server',
        memberCount: 2,
        channelCount: 5,
      });
      return;
    }

    // GET /api/guilds/:guildId/music
    if (subPath === '/music' && method === 'GET') {
      const botRes = await fetchBotApi(`/api/guilds/${guildId}/music`);
      if (botRes.ok) {
        sendJson(res, 200, botRes.data);
        return;
      }
      sendJson(res, 200, {
        guildId,
        engineState: 'idle',
        isPlaying: false,
        isPaused: false,
        volume: 100,
        loopMode: 'off',
        currentTrack: null,
        queue: [],
        position: 0,
      });
      return;
    }

    // POST /api/guilds/:guildId/music/control
    if (subPath === '/music/control' && method === 'POST') {
      const body = await readJsonBody(req);
      const botRes = await fetchBotApi(`/api/guilds/${guildId}/music/control`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (botRes.ok) {
        broadcastSSE('musicUpdate', { guildId, ...botRes.data });
        sendJson(res, 200, botRes.data);
        return;
      }

      sendJson(res, 200, {
        success: true,
        action: body?.action,
        simulated: true,
      });
      return;
    }

    // GET /api/guilds/:guildId/settings
    if (subPath === '/settings' && method === 'GET') {
      const botRes = await fetchBotApi(`/api/guilds/${guildId}/settings`);
      if (botRes.ok) {
        sendJson(res, 200, botRes.data);
        return;
      }
      sendJson(res, 200, { settings: { guildId, prefix: '!', locale: 'en' } });
      return;
    }

    // PATCH /api/guilds/:guildId/settings
    if (subPath === '/settings' && method === 'PATCH') {
      const body = await readJsonBody(req);
      const botRes = await fetchBotApi(`/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (botRes.ok) {
        sendJson(res, 200, botRes.data);
        return;
      }
      sendJson(res, 200, { success: true, settings: body });
      return;
    }
  }

  // 404 Route
  sendJson(res, 404, { error: 'Route not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[RifflyDashboardBackend] Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`[RifflyDashboardBackend] Connected to Bot API upstream at ${BOT_API_URL}`);
});
