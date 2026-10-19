/**
 * /play command
 *
 * Validates input, resolves a track (or playlist), joins voice, and enqueues.
 */

import { SlashCommandBuilder, GuildMember } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { TrackResolver } from '../provider/resolver.js';
import { RifflyError } from '../errors.js';
import { validatePlayInput } from './input.js';

export function makePlayCommand(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): Command {
  return {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play a song or playlist from a search query or URL.')
      .addStringOption((opt) =>
        opt
          .setName('input')
          .setDescription('Song name, search query, or supported URL')
          .setRequired(true),
      ),

    async execute(interaction) {
      await interaction.deferReply();

      const raw = interaction.options.getString('input', true);
      const validation = validatePlayInput(raw);
      if (!validation.ok) {
        const messages: Record<string, string> = {
          empty: '❌ Please provide a search query or URL.',
          'too-long': '❌ Input is too long. Keep it under 500 characters.',
          'control-characters': '❌ Input contains invalid characters.',
        };
        await interaction.editReply(messages[validation.problem] ?? '❌ Invalid input.');
        return;
      }

      // Require the user to be in a voice channel
      const member = interaction.member;
      const voiceChannelId =
        member instanceof GuildMember ? member.voice.channelId : null;
      if (!voiceChannelId) {
        await interaction.editReply(RifflyError.notInVoiceChannel().userMessage);
        return;
      }

      const guildId = interaction.guildId!;

      try {
        // Join voice channel (idempotent)
        await playerManager.join(guildId, voiceChannelId);

        // Resolve track(s)
        const resolved = await resolver.resolve(validation.value);

        // Enqueue and possibly start playback
        const { started } = await playerManager.play(guildId, resolved.tracks);

        const action = started ? '▶️ Now playing' : '📋 Added to queue';
        await interaction.editReply(`${action}: ${resolved.summary}`);
      } catch (err) {
        const message =
          err instanceof RifflyError
            ? err.userMessage
            : '💥 Something went wrong. Please try again.';
        if (!(err instanceof RifflyError)) {
          console.error('[Play] Unexpected error:', err);
        }
        await interaction.editReply(message);
      }
    },
  };
}
