import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { RifflyDashboardServer } from '../../src/dashboard/server.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import type {
  IGuildRepository,
  IModerationRepository,
  ILevelRepository,
  IEconomyRepository,
  IGiveawayRepository,
} from '../../src/database/types.js';

describe('RifflyDashboardServer', () => {
  let server: RifflyDashboardServer;
  let port: number;

  const mockGuildRepo: IGuildRepository = {
    getSettings: vi.fn().mockResolvedValue({ guildId: 'guild-1', prefix: '!', locale: 'en' }),
    saveSettings: vi.fn().mockResolvedValue({ guildId: 'guild-1', prefix: '?', locale: 'en' }),
    getModuleConfig: vi.fn().mockResolvedValue(null),
    setModuleEnabled: vi.fn(),
    updateModuleSettings: vi.fn(),
  };

  const mockPlayerManager = {
    getState: vi.fn().mockReturnValue({
      engineState: 'playing',
      current: { title: 'Song 1', uri: 'https://youtube.com' },
      upcoming: [],
      loopMode: 'off',
      volume: 100,
      position: 0,
    }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
  } as unknown as GuildPlayerManager;

  const mockModerationRepo = {
    getGuildCases: vi.fn().mockResolvedValue([{ id: 'c1', caseNumber: 1, action: 'warn' }]),
  } as unknown as IModerationRepository;

  const mockLevelRepo = {
    getLeaderboard: vi.fn().mockResolvedValue([{ userId: 'u1', level: 10, xp: 5000n }]),
  } as unknown as ILevelRepository;

  const mockEconomyRepo = {
    getLeaderboard: vi.fn().mockResolvedValue([{ userId: 'u1', wallet: 1000n, bank: 5000n }]),
  } as unknown as IEconomyRepository;

  const mockGiveawayRepo = {
    getActiveGiveaways: vi.fn().mockResolvedValue([{ id: 'g1', prize: 'Nitro', ended: false }]),
  } as unknown as IGiveawayRepository;

  beforeAll(async () => {
    server = new RifflyDashboardServer({
      guildRepository: mockGuildRepo,
      playerManager: mockPlayerManager,
      moderationRepository: mockModerationRepo,
      levelRepository: mockLevelRepo,
      economyRepository: mockEconomyRepo,
      giveawayRepository: mockGiveawayRepo,
    });

    port = await server.start(0); // Random free port
  });

  afterAll(async () => {
    await server.stop();
  });

  it('serves GET /api/status with operational statistics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name?: string; online?: boolean };
    expect(body.name).toBe('Riffly');
    expect(body.online).toBe(true);
  });

  it('serves GET /api/guilds/:id/settings', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/settings`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings?: { prefix?: string } };
    expect(body.settings?.prefix).toBe('!');
  });

  it('serves PATCH /api/guilds/:id/settings and updates prefix', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '?' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; settings?: { prefix?: string } };
    expect(body.success).toBe(true);
    expect(body.settings?.prefix).toBe('?');
  });

  it('serves GET /api/guilds/:id/music and returns live player state', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/music`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isPlaying?: boolean; currentTrack?: { title?: string } };
    expect(body.isPlaying).toBe(true);
    expect(body.currentTrack?.title).toBe('Song 1');
  });

  it('serves POST /api/guilds/:id/music/control and executes pause', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/music/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; action?: string };
    expect(body.success).toBe(true);
    expect(body.action).toBe('pause');
  });

  it('serves GET /api/guilds/:id/moderation/cases', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/moderation/cases`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cases?: Array<{ id: string }> };
    expect(body.cases?.length).toBe(1);
  });

  it('serves GET /api/guilds/:id/leaderboard with BigInt serialization', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/leaderboard`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { leaderboard?: Array<{ xp: string }> };
    expect(body.leaderboard?.[0]?.xp).toBe('5000');
  });

  it('serves GET /api/guilds/:id/economy with BigInt serialization', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/economy`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { leaderboard?: Array<{ wallet: string }> };
    expect(body.leaderboard?.[0]?.wallet).toBe('1000');
  });

  it('serves GET /api/guilds/:id/giveaways', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/guilds/guild-1/giveaways`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { giveaways?: Array<{ prize: string }> };
    expect(body.giveaways?.[0]?.prize).toBe('Nitro');
  });
});
