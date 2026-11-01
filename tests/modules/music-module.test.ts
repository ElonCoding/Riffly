import { describe, it, expect, vi } from 'vitest';
import { createMusicModule } from '../../src/modules/music/index.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import type { TrackResolver } from '../../src/provider/resolver.js';
import { ModuleRegistry } from '../../src/modules/core/registry.js';

describe('MusicModule', () => {
  it('creates a valid music module definition with registered commands and settings', () => {
    const fakePlayerManager = {} as GuildPlayerManager;
    const fakeResolver = {
      resolve: vi.fn(),
    } as unknown as TrackResolver;

    const musicMod = createMusicModule({
      playerManager: fakePlayerManager,
      resolver: fakeResolver,
    });

    expect(musicMod.id).toBe('music');
    expect(musicMod.name).toBe('Riffly Music');
    expect(musicMod.alwaysOn).toBe(true);
    expect(musicMod.commands?.length).toBeGreaterThanOrEqual(14);

    const commandNames = musicMod.commands?.map((c) => c.name);
    expect(commandNames).toContain('play');
    expect(commandNames).toContain('pause');
    expect(commandNames).toContain('resume');
    expect(commandNames).toContain('skip');
    expect(commandNames).toContain('stop');
    expect(commandNames).toContain('queue');
    expect(commandNames).toContain('nowplaying');
    expect(commandNames).not.toContain('ping');

    // Register into ModuleRegistry
    const registry = new ModuleRegistry();
    registry.register(musicMod);
    expect(registry.has('music')).toBe(true);

    const settings = registry.getSettings<{
      defaultVolume: number;
      maxQueueSize: number;
      disconnectTimeoutSeconds: number;
    }>('guild-test', 'music');

    expect(settings.defaultVolume).toBe(100);
    expect(settings.maxQueueSize).toBe(500);
    expect(settings.disconnectTimeoutSeconds).toBe(180);
  });
});

