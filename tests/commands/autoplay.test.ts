import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { makeAutoplayCommand } from '../../src/commands/autoplay.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/autoplay command', () => {
  let playerManager: GuildPlayerManager;
  let command: ReturnType<typeof makeAutoplayCommand>;
  let toggleAutoplayMock: (guildId: string) => boolean;
  let setAutoplayMock: (guildId: string, enabled: boolean) => void;

  beforeEach(() => {
    toggleAutoplayMock = vi.fn().mockReturnValue(true);
    setAutoplayMock = vi.fn();

    playerManager = {
      toggleAutoplay: toggleAutoplayMock,
      setAutoplay: setAutoplayMock,
    } as unknown as GuildPlayerManager;

    command = makeAutoplayCommand(playerManager);
  });

  function createInteraction(overrides: {
    inGuild?: boolean;
    sameVoice?: boolean;
    enabled?: boolean | null;
  }) {
    const replyMock = vi.fn().mockResolvedValue(true);
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
        getBoolean: vi.fn().mockReturnValue(overrides.enabled ?? null),
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    return { interaction, replyMock };
  }

  it('rejects execution outside a guild', async () => {
    const { interaction, replyMock } = createInteraction({ inGuild: false });
    await command.execute(interaction);

    expect(replyMock).toHaveBeenCalled();
    const arg = replyMock.mock.calls[0]?.[0] as
      { content?: string; ephemeral?: boolean } | undefined;
    expect(arg?.content).toContain('only be used in a server');
    expect(arg?.ephemeral).toBe(true);
  });

  it('rejects execution if user is not in same voice channel', async () => {
    const { interaction, replyMock } = createInteraction({ sameVoice: false });
    await command.execute(interaction);

    expect(replyMock).toHaveBeenCalled();
    const arg = replyMock.mock.calls[0]?.[0] as
      { content?: string; ephemeral?: boolean } | undefined;
    expect(arg?.content).toContain('same voice channel');
    expect(arg?.ephemeral).toBe(true);
  });

  it('toggles autoplay when no option provided', async () => {
    const { interaction, replyMock } = createInteraction({ enabled: null });
    await command.execute(interaction);

    expect(toggleAutoplayMock).toHaveBeenCalledWith('guild-1');
    expect(replyMock).toHaveBeenCalled();
    const arg = replyMock.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(arg?.embeds?.length).toBeGreaterThan(0);
  });

  it('sets explicit state when option provided', async () => {
    const { interaction, replyMock } = createInteraction({ enabled: false });
    await command.execute(interaction);

    expect(setAutoplayMock).toHaveBeenCalledWith('guild-1', false);
    expect(replyMock).toHaveBeenCalled();
    const arg = replyMock.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(arg?.embeds?.length).toBeGreaterThan(0);
  });
});
