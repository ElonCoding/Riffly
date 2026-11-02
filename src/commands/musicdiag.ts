/**
 * /musicdiag command — Comprehensive music pipeline diagnostics.
 * Reports voice connection, Lavalink node status, player state, permissions, and errors.
 */

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { LavalinkMusicEngine } from '../audio/lavalink-engine.js';
import type { MusicEngine } from '../audio/types.js';
import { formatDuration } from './helpers.js';

function sanitizeErrorText(msg: string): string {
  return msg
    .replace(/(?:password|token|secret|authorization|sessionId|bearer)[:=\s]+[^\s,;]+/gi, '[REDACTED]')
    .replace(/youshallnotpass/gi, '[REDACTED]')
    .replace(/[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{20,}/g, '[REDACTED_TOKEN]');
}

export const musicDiagCommandData = new SlashCommandBuilder()
  .setName('musicdiag')
  .setDescription('Run comprehensive diagnostics on Riffly music pipeline and player status.');

export function makeMusicDiagCommand(
  playerManager: GuildPlayerManager,
  engine?: LavalinkMusicEngine | MusicEngine,
): Command {
  return {
    data: musicDiagCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();
      const guildId = interaction.guildId;
      const guild = interaction.guild;
      const activeEngine = (engine ?? playerManager.engine) as LavalinkMusicEngine | undefined;

      // 1. Bot voice channel & 12. Missing voice permissions
      const me = guild?.members?.me;
      const voiceChannel = me?.voice?.channel;
      const botVoiceChannelText = voiceChannel
        ? `🔊 **${voiceChannel.name}** (\`${voiceChannel.id}\`)`
        : '❌ Not connected';

      const missingPerms: string[] = [];
      if (voiceChannel && me) {
        const perms =
          (typeof (voiceChannel as { permissionsFor?: (member: unknown) => { has(perm: unknown): boolean } }).permissionsFor === 'function'
            ? (voiceChannel as { permissionsFor: (member: unknown) => { has(perm: unknown): boolean } }).permissionsFor(me)
            : undefined) ??
          (typeof me.permissionsIn === 'function'
            ? me.permissionsIn(voiceChannel.id ?? voiceChannel)
            : undefined) ??
          (typeof (me as unknown as { permissionsFor?: (channel: unknown) => { has(perm: unknown): boolean } }).permissionsFor === 'function'
            ? (me as unknown as { permissionsFor: (channel: unknown) => { has(perm: unknown): boolean } }).permissionsFor(voiceChannel)
            : undefined);

        if (perms && typeof perms.has === 'function') {
          if (!perms.has(PermissionFlagsBits.ViewChannel)) missingPerms.push('View Channel');
          if (!perms.has(PermissionFlagsBits.Connect)) missingPerms.push('Connect');
          if (!perms.has(PermissionFlagsBits.Speak)) missingPerms.push('Speak');
        }
      }

      const permissionsText = voiceChannel
        ? missingPerms.length > 0
          ? `⚠️ Missing: **${missingPerms.join(', ')}**`
          : '✅ All granted (View Channel, Connect, Speak)'
        : 'ℹ️ Connect to a voice channel to inspect permissions';

      // 2. Voice connection state
      const isNative = Boolean((activeEngine as { isNative?: boolean })?.isNative);
      const isNativeConnected = (activeEngine as unknown as { isConnected?: (id: string) => boolean })?.isConnected?.(guildId);

      const player = (activeEngine as unknown as { manager?: { getPlayer?: (id: string) => unknown } })
        ?.manager?.getPlayer?.(guildId) as {
          connected?: boolean;
          voiceChannelId?: string;
          track?: { encoded?: string; info?: { title?: string } };
          queue?: { current?: { info?: { title?: string } } };
        } | undefined;

      const isVoiceConnected = isNative ? isNativeConnected : player?.connected;

      let voiceStateText = '❌ Disconnected';
      if (voiceChannel && isVoiceConnected) {
        voiceStateText = '✅ Connected (Voice Gateway Synchronized)';
      } else if (voiceChannel && !isVoiceConnected) {
        voiceStateText = `⚠️ Bot in voice channel but ${isNative ? 'Native' : 'Lavalink'} player is not connected`;
      } else if (!voiceChannel && isVoiceConnected) {
        voiceStateText = '⚠️ Stale player session detected (engine connected, bot left)';
      }

      // 3. Audio node connection status & 4. Node latency / load
      const nodeManager = (activeEngine as unknown as { manager?: { nodeManager?: { nodes?: Map<string, { connected?: boolean; options?: { host?: string; port?: number }; stats?: { players?: number; cpu?: { lavalinkLoad?: number } } }> } } })
        ?.manager?.nodeManager;
      const primaryNode = nodeManager?.nodes?.get('primary-node')
        ?? (nodeManager?.nodes?.values() ? Array.from(nodeManager.nodes.values())[0] : undefined);

      const nodeOnline = isNative ? true : (primaryNode?.connected ?? false);
      const nodeStatusText = isNative
        ? '🟢 Online (Native @discordjs/voice Direct In-Process)'
        : nodeOnline
          ? `🟢 Online (${primaryNode?.options?.host ?? 'localhost'}:${primaryNode?.options?.port ?? 2333})`
          : '🔴 Offline / Disconnected';

      const nodeLatencyText = isNative
        ? 'In-process (0ms Node overhead, Direct UDP)'
        : nodeOnline
          ? `${primaryNode?.stats?.players ?? 0} active player(s)`
          : 'N/A';

      // 5. Player existence & 6. Actual player state
      const nativeHasPlayer = (activeEngine as unknown as { hasPlayer?: (id: string) => boolean })?.hasPlayer?.(guildId);
      const playerExists = isNative ? nativeHasPlayer : Boolean(player);
      const playerExistsText = playerExists ? `✅ Active instance (\`${guildId}\`)` : '❌ No player instance';
      const actualPlayerState = activeEngine?.getState ? activeEngine.getState(guildId) : 'unknown';

      // 7. Current track, 8. Track position and duration, 9. Queue length, 11. Paused
      const state = playerManager.getState(guildId);
      const currentTrack = state.current;
      const currentTrackText = currentTrack
        ? `**[${currentTrack.title}](${currentTrack.uri ?? '#'})** by ${currentTrack.author}`
        : 'None';

      const positionMs = activeEngine?.getPosition ? activeEngine.getPosition(guildId) : 0;
      const durationMs = currentTrack?.lengthMs ?? 0;
      const progressText = currentTrack
        ? currentTrack.isStream
          ? '🔴 Live Stream'
          : `${formatDuration(positionMs, true)} / ${formatDuration(durationMs, true)}`
        : '00:00 / 00:00';

      const queueLengthText = `${state.upcoming.length} track(s)`;
      const isPausedText = state.engineState === 'paused' ? '⏸️ Yes' : '▶️ No';

      // 10. Track loading status
      const isLoading = (activeEngine as unknown as { isBuffering?: (gId: string) => boolean })?.isBuffering?.(guildId)
        ?? (actualPlayerState === 'buffering');
      const loadingStatusText = isLoading ? '🔄 Buffering / Loading stream' : 'Idle / Ready';

      // 12. Backend reporting active track
      const nativeCurrentTrack = (activeEngine as unknown as { getCurrentTrack?: (id: string) => { title?: string } | undefined })?.getCurrentTrack?.(guildId);
      const backendReportingTrack = isNative
        ? Boolean(nativeCurrentTrack)
        : Boolean(player?.track?.encoded ?? player?.queue?.current);
      const backendTrackTitle = isNative
        ? nativeCurrentTrack?.title
        : (player?.queue?.current?.info?.title ?? player?.track?.info?.title);
      const backendTrackText = backendReportingTrack
        ? `✅ Yes (\`${backendTrackTitle?.slice(0, 30) ?? 'Loaded'}\`)`
        : '❌ No active track in backend';

      // 13. Last relevant playback error
      const lastError = (playerManager as unknown as { getLastError?: (id: string) => { timestamp: number; trackTitle: string; error: string } | undefined })?.getLastError?.(guildId)
        ?? (playerManager as unknown as { lastPlaybackErrors?: Map<string, { timestamp: number; trackTitle: string; error: string }> })?.lastPlaybackErrors?.get(guildId);

      const sanitizedError = lastError ? sanitizeErrorText(lastError.error) : '';
      const lastErrorText = lastError
        ? `⚠️ <t:${Math.floor(lastError.timestamp / 1000)}:R> on **${lastError.trackTitle}**:\n\`${sanitizedError.slice(0, 150)}\``
        : 'None recorded';

      // Actionable diagnostic summary
      const issues: string[] = [];
      if (!isNative && !nodeOnline) {
        issues.push('• **Audio Node Offline**: Docker container `riffly-lavalink` is not connected. Ensure container is running at `localhost:2333`.');
      }
      if (voiceChannel && missingPerms.length > 0) {
        issues.push(`• **Missing Permissions**: Grant ${missingPerms.join(', ')} to Riffly in ${voiceChannel.name}.`);
      }
      if (voiceChannel && !isVoiceConnected) {
        issues.push('• **Voice Gateway Desynced**: Bot voice state is active in Discord, but audio session is disconnected. Run `/leave` and `/join`.');
      }
      if (lastError?.error?.includes('AllClientsFailedException') || lastError?.error?.includes('requires login')) {
        issues.push('• **YouTube Stream Blocked**: YouTube blocked audio extraction. Try searching for a different source (Bandcamp/SoundCloud) or direct MP3 URL.');
      }
      if (!voiceChannel && state.upcoming.length > 0) {
        issues.push('• **Tracks queued while not in voice**: Join a voice channel and run `/join` or `/play` to begin audio delivery.');
      }
      if (actualPlayerState === 'playing' && !voiceChannel) {
        issues.push('• **Ghost Playback**: Player is playing in engine without a voice channel. Run `/stop` to reset.');
      }

      const issuesText = issues.length > 0
        ? issues.join('\n')
        : '✅ All diagnostics normal. Audio pipeline is healthy.';

      const embed = new EmbedBuilder()
        .setTitle('🩺 Riffly Audio Engine Diagnostics')
        .setColor(issues.length > 0 ? 0xffa500 : 0x57f287)
        .addFields(
          { name: '1. Voice Channel', value: botVoiceChannelText, inline: true },
          { name: '2. Connection State', value: voiceStateText, inline: true },
          { name: '3. Lavalink Node', value: nodeStatusText, inline: true },
          { name: '4. Node Load', value: nodeLatencyText, inline: true },
          { name: '5. Player Instance', value: playerExistsText, inline: true },
          { name: '6. Player Engine State', value: `\`${actualPlayerState}\``, inline: true },
          { name: '7. Current Track', value: currentTrackText, inline: false },
          { name: '8. Position / Duration', value: progressText, inline: true },
          { name: '9. Queue Length', value: queueLengthText, inline: true },
          { name: '10. Loading Status', value: loadingStatusText, inline: true },
          { name: '11. Playback Paused', value: isPausedText, inline: true },
          { name: '12. Backend Track Loaded', value: backendTrackText, inline: true },
          { name: '13. Voice Permissions', value: permissionsText, inline: false },
          { name: '14. Last Playback Error', value: lastErrorText, inline: false },
          { name: '🔍 Diagnostic Summary & Actionable Steps', value: issuesText, inline: false },
        )
        .setFooter({ text: 'Riffly Diagnostics • No sensitive tokens are surfaced' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
