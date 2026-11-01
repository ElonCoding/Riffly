import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { makeFilterCommand } from '../../src/commands/filter.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/filter command', () => {
  let playerManager: GuildPlayerManager;
  let command: ReturnType<typeof makeFilterCommand>;
  let setFilterMock: (guildId: string, preset: string) => Promise<void>;

  beforeEach(() => {
    setFilterMock = vi.fn().mockResolvedValue(undefined);

    playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Track 1', lengthMs: 180000 },
      }),
      setFilter: setFilterMock,
    } as unknown as GuildPlayerManager;

    command = makeFilterCommand(playerManager);
  });

  function createInteraction(overrides: {
    inGuild?: boolean;
    sameVoice?: boolean;
    preset?: string;
  }) {
    const replyMock = vi.fn().mockResolvedValue(true);
    const deferReplyMock = vi.fn().mockResolvedValue(true);
    const editReplyMock = vi.fn().mockResolvedValue(true);

    const botVoiceId = 'vc-1';
    const userVoiceId = overrides.sameVoice !== false ? 'vc-1' : 'vc-other';

    const interaction = {
      inGuild: () => overrides.inGuild !== false,
      guildId: 'guild-1',
      guild: {
        members: {
          me: { voice: { channelId: botVoiceId } },
        },
      },
      member: {
        voice: { channelId: userVoiceId },
      },
      options: {
        getString: vi.fn().mockReturnValue(overrides.preset ?? 'bassboost'),
      },
      reply: replyMock,
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    } as unknown as ChatInputCommandInteraction;

    return { interaction, replyMock, deferReplyMock, editReplyMock };
  }

  it('rejects execution outside a guild', async () => {
    const { interaction, replyMock } = createInteraction({ inGuild: false });
    await command.execute(interaction);
    expect(replyMock).toHaveBeenCalled();
    const callArg = replyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('only be used in a server');
  });

  it('rejects execution when member is in a different voice channel', async () => {
    const { interaction, replyMock } = createInteraction({ sameVoice: false });
    await command.execute(interaction);
    expect(replyMock).toHaveBeenCalled();
    const callArg = replyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('must be in the same voice channel');
  });

  it('notifies when nothing is currently playing', async () => {
    (playerManager.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      engineState: 'idle',
      current: null,
    });
    const { interaction, editReplyMock } = createInteraction({ sameVoice: true });
    await command.execute(interaction);
    expect(editReplyMock).toHaveBeenCalled();
    const callArg = editReplyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('Nothing is currently playing');
  });

  it('applies bassboost preset and edits reply with confirmation embed', async () => {
    const { interaction, deferReplyMock, editReplyMock } = createInteraction({ preset: 'bassboost' });
    await command.execute(interaction);

    expect(setFilterMock).toHaveBeenCalledWith('guild-1', 'bassboost');
    expect(deferReplyMock).toHaveBeenCalled();
    expect(editReplyMock).toHaveBeenCalled();
    const callArg = editReplyMock.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('handles Lavalink filter application errors gracefully', async () => {
    (setFilterMock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Lavalink filter failed'));
    const { interaction, editReplyMock } = createInteraction({ preset: '8d' });
    await command.execute(interaction);

    expect(editReplyMock).toHaveBeenCalled();
    const callArg = editReplyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('Failed to apply filter');
  });
});
