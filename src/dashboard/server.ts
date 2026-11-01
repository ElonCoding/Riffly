import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { DashboardServerOptions } from './types.js';
import { getDashboardHtml } from './portal.js';
import { getApiDocsHtml, openApiSpec } from './openapi.js';

function serializeWithBigInt(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value as unknown;
  });
}

/**
 * REST API and Dashboard backend service for Riffly.
 */
export class RifflyDashboardServer {
  private server: Server | null = null;
  private readonly options: DashboardServerOptions;

  constructor(options: DashboardServerOptions = {}) {
    this.options = options;
  }

  /**
   * Starts the HTTP dashboard server.
   */
  public start(port = this.options.port ?? 3000): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.on('error', reject);

      this.server.listen(port, this.options.host ?? '0.0.0.0', () => {
        const address = this.server?.address();
        const actualPort =
          typeof address === 'object' && address ? address.port : port;
        resolve(actualPort);
      });
    });
  }

  /**
   * Stops the HTTP dashboard server.
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Handles incoming HTTP requests and dispatches to appropriate route handlers.
   */
  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      // Interactive Web Portal UI
      if (
        method === 'GET' &&
        (path === '/dashboard' || (path === '/' && req.headers.accept?.includes('text/html')))
      ) {
        const html = getDashboardHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html),
        });
        res.end(html);
        return;
      }

      // API Documentation
      if (method === 'GET' && path === '/api/docs') {
        const html = getApiDocsHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html),
        });
        res.end(html);
        return;
      }

      if (method === 'GET' && path === '/api/openapi.json') {
        this.sendJson(res, 200, openApiSpec);
        return;
      }

      // Health check endpoint for host platforms (Render, Railway, Fly.io, etc.)
      if (method === 'GET' && (path === '/health' || path === '/')) {
        this.sendJson(res, 200, { status: 'healthy', service: 'riffly' });
        return;
      }

      // 1. GET /api/status
      if (method === 'GET' && path === '/api/status') {
        const client = this.options.client;
        const uptime = process.uptime();
        const ping = client?.ws?.ping ?? 0;
        const guildsCount = client?.guilds?.cache?.size ?? 0;
        const usersCount = client?.users?.cache?.size ?? 0;

        this.sendJson(res, 200, {
          name: 'Riffly',
          version: '1.0.0',
          online: true,
          uptimeSeconds: Math.floor(uptime),
          pingMs: Math.max(0, ping),
          guildsCount,
          usersCount,
        });
        return;
      }

      // 2. GET /api/guilds
      if (method === 'GET' && path === '/api/guilds') {
        const client = this.options.client;
        const guilds = client?.guilds?.cache.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.iconURL(),
          memberCount: g.memberCount,
        })) ?? [];

        this.sendJson(res, 200, { guilds });
        return;
      }

      // Match routes: /api/guilds/:guildId/*
      const guildMatch = path.match(/^\/api\/guilds\/([^/]+)(.*)$/);
      if (guildMatch) {
        const guildId = guildMatch[1] ?? '';
        const subPath = guildMatch[2] ?? '';

        // 3. GET /api/guilds/:guildId
        if (method === 'GET' && subPath === '') {
          const client = this.options.client;
          const guild = client?.guilds?.cache.get(guildId);
          if (!guild) {
            this.sendJson(res, 404, { error: 'Guild not found or bot is not a member.' });
            return;
          }

          this.sendJson(res, 200, {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
          });
          return;
        }

        // 4. GET /api/guilds/:guildId/settings
        if (method === 'GET' && subPath === '/settings') {
          const settings = await this.options.guildRepository?.getSettings(guildId);
          this.sendJson(res, 200, { settings: settings ?? { guildId, prefix: '!', locale: 'en' } });
          return;
        }

        // 5. PATCH /api/guilds/:guildId/settings
        if (method === 'PATCH' && subPath === '/settings') {
          const body = await this.readJsonBody(req);
          if (body && typeof body === 'object') {
            const prefix = typeof body.prefix === 'string' ? body.prefix : undefined;
            const locale = typeof body.locale === 'string' ? body.locale : undefined;
            const updated = await this.options.guildRepository?.saveSettings(guildId, {
              ...(prefix !== undefined ? { prefix } : {}),
              ...(locale !== undefined ? { locale } : {}),
            });
            this.sendJson(res, 200, { success: true, settings: updated });
            return;
          }
          this.sendJson(res, 400, { error: 'Invalid settings payload.' });
          return;
        }

        // 6. GET /api/guilds/:guildId/music
        if (method === 'GET' && subPath === '/music') {
          const playerManager = this.options.playerManager;
          if (!playerManager) {
            this.sendJson(res, 503, { error: 'Music subsystem unavailable.' });
            return;
          }

          const status = playerManager.getState(guildId);

          this.sendJson(res, 200, {
            guildId,
            engineState: status.engineState,
            isPlaying: status.engineState === 'playing',
            isPaused: status.engineState === 'paused',
            volume: status.volume,
            loopMode: status.loopMode,
            currentTrack: status.current,
            queue: status.upcoming,
            position: status.position,
          });
          return;
        }

        // 7. POST /api/guilds/:guildId/music/control
        if (method === 'POST' && subPath === '/music/control') {
          const playerManager = this.options.playerManager;
          if (!playerManager) {
            this.sendJson(res, 503, { error: 'Music subsystem unavailable.' });
            return;
          }

          const body = await this.readJsonBody(req);
          const action = typeof body?.action === 'string' ? body.action : '';

          switch (action) {
            case 'pause':
              await playerManager.pause(guildId);
              break;
            case 'resume':
              await playerManager.resume(guildId);
              break;
            case 'skip':
              await playerManager.skip(guildId);
              break;
            case 'stop':
              await playerManager.stop(guildId);
              break;
            case 'seek':
              if (body && typeof body.positionMs === 'number') {
                await playerManager.seek(guildId, body.positionMs);
              }
              break;
            case 'volume':
              if (body && typeof body.volume === 'number') {
                await playerManager.setVolume(guildId, body.volume);
              }
              break;
            default:
              this.sendJson(res, 400, { error: `Unknown music action: "${action}"` });
              return;
          }

          this.sendJson(res, 200, { success: true, action });
          return;
        }

        // 8. GET /api/guilds/:guildId/moderation/cases
        if (method === 'GET' && subPath === '/moderation/cases') {
          const cases =
            (await this.options.moderationRepository?.getGuildCases(guildId, 50)) ?? [];
          this.sendJson(res, 200, { cases });
          return;
        }

        // 9. GET /api/guilds/:guildId/leaderboard
        if (method === 'GET' && subPath === '/leaderboard') {
          const leaderboard =
            (await this.options.levelRepository?.getLeaderboard(guildId, 20)) ?? [];
          this.sendJson(res, 200, { leaderboard });
          return;
        }

        // 10. GET /api/guilds/:guildId/economy
        if (method === 'GET' && subPath === '/economy') {
          const economyLeaders =
            (await this.options.economyRepository?.getLeaderboard(guildId, 20)) ?? [];
          this.sendJson(res, 200, { leaderboard: economyLeaders });
          return;
        }

        // 11. GET /api/guilds/:guildId/giveaways
        if (method === 'GET' && subPath === '/giveaways') {
          const giveaways =
            (await this.options.giveawayRepository?.getActiveGiveaways(guildId)) ?? [];
          this.sendJson(res, 200, { giveaways });
          return;
        }
      }

      // Default: Not Found
      this.sendJson(res, 404, { error: 'Route not found.' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.sendJson(res, 500, { error: 'Internal Server Error', message: errorMsg });
    }
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    const payload = serializeWithBigInt(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: Buffer | string) => {
        data += chunk.toString();
      });
      req.on('end', () => {
        if (!data) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          resolve(parsed);
        } catch {
          resolve(null);
        }
      });
    });
  }
}
