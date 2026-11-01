/**
 * Riffly Server Backup Service.
 */

import type { Guild, Role, GuildBasedChannel } from 'discord.js';
import type { GuildBackupSnapshot, IBackupService, RoleSnapshot, ChannelSnapshot } from './types.js';

export class BackupService implements IBackupService {
  private readonly backups = new Map<string, GuildBackupSnapshot[]>();

  public createBackup(rawGuild: unknown): Promise<GuildBackupSnapshot> {
    const guild = rawGuild as Guild;
    const backupId = `riffly-bk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const roles: RoleSnapshot[] = Array.from(guild.roles.cache.values())
      .filter((r: Role) => !r.managed && r.id !== guild.id)
      .map((r: Role) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.bitfield.toString(),
      }));

    const channels: ChannelSnapshot[] = Array.from(guild.channels.cache.values())
      .map((c: GuildBasedChannel) => {
        const textChan = 'topic' in c ? (c as { topic: string | null; nsfw: boolean }) : undefined;
        const voiceChan = 'bitrate' in c ? (c as { bitrate: number }) : undefined;
        const position = 'position' in c ? (c as { position: number }).position : 0;

        return {
          id: c.id,
          name: c.name,
          type: c.type,
          position,
          ...(c.parentId ? { parentId: c.parentId } : {}),
          ...(textChan?.topic ? { topic: textChan.topic } : {}),
          ...(textChan?.nsfw ? { nsfw: textChan.nsfw } : {}),
          ...(voiceChan?.bitrate ? { bitrate: voiceChan.bitrate } : {}),
        };
      });

    const snapshot: GuildBackupSnapshot = {
      id: backupId,
      guildId: guild.id,
      guildName: guild.name,
      createdAt: new Date().toISOString(),
      roles,
      channels,
    };

    const guildList = this.backups.get(guild.id) ?? [];
    guildList.unshift(snapshot);
    // Keep up to 10 latest snapshots per guild
    if (guildList.length > 10) {
      guildList.length = 10;
    }
    this.backups.set(guild.id, guildList);

    return Promise.resolve(snapshot);
  }

  public getBackups(guildId: string): Promise<readonly GuildBackupSnapshot[]> {
    return Promise.resolve(this.backups.get(guildId) ?? []);
  }
}
