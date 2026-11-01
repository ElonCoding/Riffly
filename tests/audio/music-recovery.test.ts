import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';
import type { LavalinkManager } from 'lavalink-client';
import { LavalinkMusicEngine } from '../../src/audio/lavalink-engine.js';
import { GuildPlayerManager } from '../../src/player/guild-player.js';
import { FakeMusicEngine } from '../../src/audio/fake-engine.js';
import { makePlayCommand } from '../../src/commands/play.js';
import type { Track } from '../../src/audio/types.js';
import type { ResolveResult, TrackResolver } from '../../src/provider/resolver.js';

describe('Music Failure, Circuit Breaker, and Recovery Test Suite', () => {
  const fakeConfig = {
    discordToken: 'test-token',
    discordClientId: '123456789012345678',
    lavalink: {
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
      secure: false,
    },
  };

  const sampleTrack: Track = {
    encoded: 'encoded-track-1',
    title: 'Dua Lipa - Training Season',
    author: 'Dua Lipa',
    lengthMs: 209000,
    identifier: 'track-dl-1',
    isSeekable: true,
    isStream: false,
    uri: 'https://youtube.com/watch?v=sample1',
  };

  function createTrack(id: string, title = `Track ${id}`): Track {
    return {
      encoded: `encoded-${id}`,
      title,
      author: 'Test Artist',
      lengthMs: 180000,
      identifier: id,
      isSeekable: true,
      isStream: false,
      uri: `https://example.com/${id}`,
    };
  }

  describe('A. Voice Gateway Packet Buffering', () => {
    it('buffers VOICE_SERVER_UPDATE and replays it once VOICE_STATE_UPDATE arrives', async () => {
      let rawHandler: ((packet: unknown) => void) | undefined;
      const fakeClient = {
        user: { id: '123456789012345678' },
        on: vi.fn((event: string, cb: (packet: unknown) => void) => {
          if (event === 'raw') {
            rawHandler = cb;
          }
        }),
      } as unknown as Client;

      const sendRawDataMock = vi.fn().mockResolvedValue(undefined);
      const fakeManager = {
        nodeManager: { on: vi.fn() },
        on: vi.fn(),
        options: { client: { id: '123456789012345678' } },
        sendRawData: sendRawDataMock,
      } as unknown as LavalinkManager;

      new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      expect(rawHandler).toBeDefined();

      const voiceServerPacket = {
        t: 'VOICE_SERVER_UPDATE',
        d: {
          guild_id: 'guild-100',
          token: 'discord-voice-token-xyz',
          endpoint: 'voice.discord.gg:443',
        },
      };

      // Step 1: Discord sends VOICE_SERVER_UPDATE before VOICE_STATE_UPDATE
      rawHandler!(voiceServerPacket);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendRawDataMock).toHaveBeenCalledTimes(1);
      expect(sendRawDataMock).toHaveBeenNthCalledWith(1, voiceServerPacket);

      // Step 2: Discord sends VOICE_STATE_UPDATE for the bot
      const voiceStatePacket = {
        t: 'VOICE_STATE_UPDATE',
        d: {
          guild_id: 'guild-100',
          user_id: '123456789012345678',
          session_id: 'discord-session-abc',
          channel_id: 'vc-100',
        },
      };

      rawHandler!(voiceStatePacket);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Must be called with voiceStatePacket, followed by replayed voiceServerPacket
      expect(sendRawDataMock).toHaveBeenCalledTimes(3);
      expect(sendRawDataMock).toHaveBeenNthCalledWith(2, voiceStatePacket);
      expect(sendRawDataMock).toHaveBeenNthCalledWith(3, voiceServerPacket);
    });

    it('clears cached voice server payload on voice disconnect (channel_id: null)', async () => {
      let rawHandler: ((packet: unknown) => void) | undefined;
      const fakeClient = {
        user: { id: '123456789012345678' },
        on: vi.fn((event: string, cb: (packet: unknown) => void) => {
          if (event === 'raw') {
            rawHandler = cb;
          }
        }),
      } as unknown as Client;

      const sendRawDataMock = vi.fn().mockResolvedValue(undefined);
      const fakeManager = {
        nodeManager: { on: vi.fn() },
        on: vi.fn(),
        options: { client: { id: '123456789012345678' } },
        sendRawData: sendRawDataMock,
      } as unknown as LavalinkManager;

      new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      // 1. Server update received
      rawHandler!({
        t: 'VOICE_SERVER_UPDATE',
        d: { guild_id: 'guild-disconnect', token: 'token-old', endpoint: 'voice.old' },
      });

      // 2. Disconnect packet received (channel_id: null)
      rawHandler!({
        t: 'VOICE_STATE_UPDATE',
        d: {
          guild_id: 'guild-disconnect',
          user_id: '123456789012345678',
          session_id: 'session-old',
          channel_id: null,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 15));

      sendRawDataMock.mockClear();

      // 3. New state update connects to a new channel without server update yet
      rawHandler!({
        t: 'VOICE_STATE_UPDATE',
        d: {
          guild_id: 'guild-disconnect',
          user_id: '123456789012345678',
          session_id: 'session-new',
          channel_id: 'vc-new',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Should only send the state update, not the cleared stale server packet
      expect(sendRawDataMock).toHaveBeenCalledTimes(1);
      const sentPacket = sendRawDataMock.mock.calls[0]?.[0] as
        | { t?: string; d?: { channel_id?: string | null } }
        | undefined;
      expect(sentPacket?.t).toBe('VOICE_STATE_UPDATE');
      expect(sentPacket?.d?.channel_id).toBe('vc-new');
    });
  });

  describe('B. Error Cascade Protection', () => {
    it('configures LavalinkManager with disabled automated player destroy threshold', () => {
      const fakeClient = {
        user: { id: '123456789012345678' },
        on: vi.fn(),
        guilds: { cache: new Map() },
      } as unknown as Client;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
      });

      // Confirm playerOptions.maxErrorsPerTime has threshold 0 and maxAmount -1
      // which disables lavalink-client's built-in player.destroy('TrackErrorMaxTracksErroredPerTime')
      const options = (engine.manager as unknown as { options?: { playerOptions?: { maxErrorsPerTime?: unknown } } })
        .options;
      expect(options?.playerOptions?.maxErrorsPerTime).toEqual({
        threshold: 0,
        maxAmount: -1,
      });
    });

    it('consecutive trackError events do not invoke player.destroy or disconnect voice', async () => {
      const fakeDestroyMock = vi.fn().mockResolvedValue(undefined);
      const fakeDisconnectMock = vi.fn().mockResolvedValue(undefined);
      const fakeStopMock = vi.fn().mockImplementation(function (this: { playing: boolean; queue?: { current?: unknown } }) {
        this.playing = false;
        if (this.queue) this.queue.current = null;
        return Promise.resolve();
      });
      const fakePlayMock = vi.fn().mockImplementation(function (this: { playing: boolean; queue?: { current?: unknown } }, track: Track) {
        this.playing = true;
        if (this.queue) this.queue.current = track;
        return Promise.resolve();
      });

      const fakePlayer = {
        guildId: 'guild-cascade',
        voiceChannelId: 'vc-steady',
        connected: true,
        playing: true,
        paused: false,
        queue: { current: sampleTrack },
        destroy: fakeDestroyMock,
        disconnect: fakeDisconnectMock,
        stopPlaying: fakeStopMock,
        play: fakePlayMock,
      };

      const fakeManager = {
        nodeManager: { on: vi.fn() },
        on: vi.fn(),
        off: vi.fn(),
        getPlayer: vi.fn(() => fakePlayer),
        createPlayer: vi.fn(() => fakePlayer),
        init: vi.fn().mockResolvedValue(undefined),
        sendRawData: vi.fn().mockResolvedValue(undefined),
      } as unknown as LavalinkManager;

      const fakeClient = {
        on: vi.fn(),
        guilds: { cache: new Map() },
      } as unknown as Client;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      const manager = new GuildPlayerManager(engine);
      await manager.join('guild-cascade', 'vc-steady');

      // Enqueue tracks
      await manager.play('guild-cascade', [
        createTrack('track-1'),
        createTrack('track-2'),
      ]);

      // Emit trackError on engine
      engine.emit(
        'trackError',
        'guild-cascade',
        createTrack('track-1'),
        new Error('Sign in to confirm you are not a bot'),
      );
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Player must NOT be destroyed or disconnected
      expect(fakeDestroyMock).not.toHaveBeenCalled();
      expect(fakeDisconnectMock).not.toHaveBeenCalled();
      expect(fakePlayer.connected).toBe(true);
      expect(fakePlayer.voiceChannelId).toBe('vc-steady');
      expect(engine.getState('guild-cascade')).not.toBe('disconnected');
    });
  });

  describe('C. Circuit Breaker Notification', () => {
    it('notifies text channel and halts playback gracefully without voice disconnection on 3 errors within 5000ms', async () => {
      const textChannelSendMock = vi.fn().mockResolvedValue(undefined);
      const fakeClient = {
        channels: {
          cache: new Map([['text-channel-999', { send: textChannelSendMock }]]),
        },
      } as unknown as Client;

      const engine = new FakeMusicEngine();
      const manager = new GuildPlayerManager(engine, { client: fakeClient });

      // Join voice channel vc-safe and associate text channel text-channel-999
      await manager.join('guild-circuit', 'vc-safe', 'text-channel-999');

      // Enqueue 4 tracks
      await manager.play('guild-circuit', [
        createTrack('err-1'),
        createTrack('err-2'),
        createTrack('err-3'),
        createTrack('err-4'),
      ]);

      // Emit error 1
      engine.emit('trackError', 'guild-circuit', createTrack('err-1'), new Error('Decoder error 1'));
      await new Promise((r) => setTimeout(r, 10));

      // Emit error 2
      engine.emit('trackError', 'guild-circuit', createTrack('err-2'), new Error('Decoder error 2'));
      await new Promise((r) => setTimeout(r, 10));

      // Emit error 3 within 5000ms
      engine.emit('trackError', 'guild-circuit', createTrack('err-3'), new Error('Decoder error 3'));
      await new Promise((r) => setTimeout(r, 30));

      // 1. Text channel received circuit breaker alert
      expect(textChannelSendMock).toHaveBeenCalled();
      const lastCall = textChannelSendMock.mock.calls[textChannelSendMock.mock.calls.length - 1]?.[0] as {
        content: string;
      };
      expect(lastCall.content).toContain('🛑 **Playback halted**');
      expect(lastCall.content).toContain('3 consecutive playback errors occurred within 5 seconds');

      // 2. Queue cleared and playback stopped
      const state = manager.getState('guild-circuit');
      expect(state.upcoming).toHaveLength(0);
      expect(state.current).toBeUndefined();

      // 3. Voice connection remains INTACT (not kicked or disconnected)
      expect(state.engineState).toBe('idle');
      expect(engine.getState('guild-circuit')).toBe('idle');
      expect(engine.getState('guild-circuit')).not.toBe('disconnected');

      // 4. Inactivity wait timeout is armed
      expect(manager.isWaiting('guild-circuit')).toBe(true);
    });
  });

  describe('D. Accurate State Transitions in /play', () => {
    it('reports "Loading track..." and awaits track start before reporting "Playback started"', async () => {
      const joinMock = vi.fn().mockResolvedValue(undefined);
      const playMock = vi.fn().mockResolvedValue({ started: true });
      let trackStartResolver: ((track: Track) => void) | undefined;
      const waitForTrackStartMock = vi.fn().mockImplementation(() => {
        return new Promise<Track>((resolve) => {
          trackStartResolver = resolve;
        });
      });

      const playerManager = {
        join: joinMock,
        play: playMock,
        waitForTrackStart: waitForTrackStartMock,
        setTextChannelId: vi.fn(),
      } as unknown as GuildPlayerManager;

      const resolveResult: ResolveResult = {
        tracks: [sampleTrack],
        summary: '**Dua Lipa - Training Season**',
      };
      const resolver = {
        resolve: vi.fn().mockResolvedValue(resolveResult),
      } as unknown as TrackResolver;

      const cmd = makePlayCommand(playerManager, resolver);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-play-states',
        channelId: 'tc-play',
        member: { voice: { channelId: 'vc-user' } },
        guild: { members: { me: { voice: { channelId: null } } } },
        options: { getString: () => 'Dua Lipa Training Season' },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      // Begin command execution
      const commandPromise = cmd.execute(interaction);

      // Give event loop time to run up to waitForTrackStart
      await new Promise((resolve) => setTimeout(resolve, 20));

      // First response must be "Loading track..."
      expect(editReply).toHaveBeenCalledWith({
        content: '⏳ Loading track: **Dua Lipa - Training Season**...',
      });

      // Now simulate track start event
      trackStartResolver!(sampleTrack);
      await commandPromise;

      // Final response must clear loading message and present Now Playing embed
      const lastCallArg = editReply.mock.calls[editReply.mock.calls.length - 1]?.[0] as {
        content?: string | null;
        embeds?: EmbedBuilder[];
      };
      expect(lastCallArg.content).toBeNull();
      expect(Array.isArray(lastCallArg.embeds)).toBe(true);
      expect(lastCallArg.embeds?.[0]?.data.title).toBe('▶️ Now Playing');
      expect(lastCallArg.embeds?.[0]?.data.description).toContain('Dua Lipa - Training Season');
    });

    it('reports failure accurately when track fails to start instead of claiming success', async () => {
      const joinMock = vi.fn().mockResolvedValue(undefined);
      const playMock = vi.fn().mockResolvedValue({ started: true });
      const waitForTrackStartMock = vi.fn().mockRejectedValue(
        new Error('AllClientsFailedException: Video unavailable in your region'),
      );

      const playerManager = {
        join: joinMock,
        play: playMock,
        waitForTrackStart: waitForTrackStartMock,
        setTextChannelId: vi.fn(),
      } as unknown as GuildPlayerManager;

      const resolveResult: ResolveResult = {
        tracks: [sampleTrack],
        summary: '**Dua Lipa - Training Season**',
      };
      const resolver = {
        resolve: vi.fn().mockResolvedValue(resolveResult),
      } as unknown as TrackResolver;

      const cmd = makePlayCommand(playerManager, resolver);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-play-fail',
        channelId: 'tc-play',
        member: { voice: { channelId: 'vc-user' } },
        guild: { members: { me: { voice: { channelId: null } } } },
        options: { getString: () => 'Dua Lipa Training Season' },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);

      // Must NOT show Now Playing embed
      expect(editReply).toHaveBeenLastCalledWith({
        content:
          '❌ Playback failed for **Dua Lipa - Training Season**: AllClientsFailedException: Video unavailable in your region. Skipping to next track...',
        embeds: [],
      });
    });

    it('advises checking /musicdiag when buffering times out', async () => {
      const joinMock = vi.fn().mockResolvedValue(undefined);
      const playMock = vi.fn().mockResolvedValue({ started: true });
      const waitForTrackStartMock = vi.fn().mockRejectedValue(
        new Error('waitForTrackStart timed out after 7000ms'),
      );

      const playerManager = {
        join: joinMock,
        play: playMock,
        waitForTrackStart: waitForTrackStartMock,
        setTextChannelId: vi.fn(),
      } as unknown as GuildPlayerManager;

      const resolveResult: ResolveResult = {
        tracks: [sampleTrack],
        summary: '**Dua Lipa - Training Season**',
      };
      const resolver = {
        resolve: vi.fn().mockResolvedValue(resolveResult),
      } as unknown as TrackResolver;

      const cmd = makePlayCommand(playerManager, resolver);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-play-timeout',
        channelId: 'tc-play',
        member: { voice: { channelId: 'vc-user' } },
        guild: { members: { me: { voice: { channelId: null } } } },
        options: { getString: () => 'Dua Lipa Training Season' },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);

      const lastCallArg = editReply.mock.calls[editReply.mock.calls.length - 1]?.[0] as {
        content?: string;
        embeds?: EmbedBuilder[];
      };
      expect(lastCallArg.content).toBe(
        '⏳ Audio stream is taking longer than expected to buffer. Check `/musicdiag` for status.',
      );
      expect(Array.isArray(lastCallArg.embeds)).toBe(true);
    });
  });
});
