import { describe, expect, it, vi } from 'vitest';
import { NativeVoiceMusicEngine } from '../../src/audio/native-voice-engine.js';
import { NativeProvider } from '../../src/provider/native-provider.js';

describe('NativeVoiceMusicEngine & NativeProvider', () => {
  it('instantiates NativeVoiceMusicEngine with disconnected state', () => {
    const fakeClient = {
      guilds: {
        cache: new Map(),
      },
    } as unknown as import('discord.js').Client;

    const engine = new NativeVoiceMusicEngine({ client: fakeClient });
    expect(engine.isNative).toBe(true);
    expect(engine.getState('g1')).toBe('disconnected');
    expect(engine.getPosition('g1')).toBe(0);
    expect(engine.hasPlayer('g1')).toBe(false);
  });

  it('declares search and resolution capabilities in NativeProvider', () => {
    const provider = new NativeProvider();
    expect(provider.id).toBe('native');
    expect(provider.capabilities.has('search')).toBe(true);
    expect(provider.capabilities.has('resolveTrackUrl')).toBe(true);
    expect(provider.capabilities.has('resolvePlaylistUrl')).toBe(true);
  });

  it('rejects connect if guild not found in cache', async () => {
    const fakeClient = {
      guilds: {
        cache: new Map(),
      },
    } as unknown as import('discord.js').Client;

    const engine = new NativeVoiceMusicEngine({ client: fakeClient });
    await expect(engine.connect('unknown-guild', 'channel-1')).rejects.toThrow();
  });
});

