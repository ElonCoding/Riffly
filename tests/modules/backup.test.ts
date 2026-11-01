import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { BackupService } from '../../src/modules/backup/service.js';
import { createBackupCommands } from '../../src/modules/backup/commands.js';
import { createBackupModule } from '../../src/modules/backup/index.js';

describe('Backup Module & Service', () => {
  let service: BackupService;

  beforeEach(() => {
    service = new BackupService();
  });

  const fakeGuild = {
    id: 'guild-123',
    name: 'Riffly Server',
    roles: {
      cache: new Map([
        [
          'role-1',
          {
            id: 'role-1',
            name: 'Moderator',
            color: 0x3498db,
            hoist: true,
            position: 2,
            managed: false,
            permissions: { bitfield: 8n },
          },
        ],
        [
          'guild-123',
          {
            id: 'guild-123',
            name: '@everyone',
            color: 0,
            hoist: false,
            position: 0,
            managed: false,
            permissions: { bitfield: 0n },
          },
        ],
      ]),
    },
    channels: {
      cache: new Map([
        [
          'chan-1',
          {
            id: 'chan-1',
            name: 'general',
            type: 0,
            position: 0,
            topic: 'General chat',
            nsfw: false,
          },
        ],
        [
          'chan-2',
          {
            id: 'chan-2',
            name: 'Music Voice',
            type: 2,
            position: 1,
            bitrate: 64000,
          },
        ],
      ]),
    },
  };

  it('creates and stores backup snapshots correctly', async () => {
    const snapshot = await service.createBackup(fakeGuild);
    expect(snapshot.guildId).toBe('guild-123');
    expect(snapshot.guildName).toBe('Riffly Server');
    expect(snapshot.roles.length).toBe(1);
    expect(snapshot.channels.length).toBe(2);

    const backups = await service.getBackups('guild-123');
    expect(backups.length).toBe(1);
    expect(backups[0]?.id).toBe(snapshot.id);
  });

  it('caps saved snapshots per guild at 10', async () => {
    for (let i = 0; i < 12; i++) {
      await service.createBackup(fakeGuild);
    }
    const backups = await service.getBackups('guild-123');
    expect(backups.length).toBe(10);
  });

  describe('/backup command', () => {
    function createInteraction(overrides: {
      inGuild?: boolean;
      isAdmin?: boolean;
      subcommand?: string;
    }) {
      const replyMock = vi.fn().mockResolvedValue(true);
      const deferReplyMock = vi.fn().mockResolvedValue(true);
      const editReplyMock = vi.fn().mockResolvedValue(true);

      const interaction = {
        inGuild: () => overrides.inGuild !== false,
        guild: overrides.inGuild !== false ? fakeGuild : null,
        memberPermissions: {
          has: vi.fn().mockReturnValue(overrides.isAdmin !== false),
        } as unknown as PermissionsBitField,
        options: {
          getSubcommand: vi.fn().mockReturnValue(overrides.subcommand ?? 'create'),
        },
        reply: replyMock,
        deferReply: deferReplyMock,
        editReply: editReplyMock,
      } as unknown as ChatInputCommandInteraction;

      return { interaction, replyMock, deferReplyMock, editReplyMock };
    }

    it('rejects execution outside guild', async () => {
      const command = createBackupCommands(service)[0]!;
      const { interaction, replyMock } = createInteraction({ inGuild: false });
      await command.execute(interaction);

      expect(replyMock).toHaveBeenCalled();
      const arg = replyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(arg?.content).toContain('only be used in a server');
    });

    it('rejects execution if user lacks Administrator permission', async () => {
      const command = createBackupCommands(service)[0]!;
      const { interaction, replyMock } = createInteraction({ isAdmin: false });
      await command.execute(interaction);

      expect(replyMock).toHaveBeenCalled();
      const arg = replyMock.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(arg?.content).toContain('Administrator permission is required');
    });

    it('creates backup on create subcommand', async () => {
      const command = createBackupCommands(service)[0]!;
      const { interaction, deferReplyMock, editReplyMock } = createInteraction({ subcommand: 'create' });
      await command.execute(interaction);

      expect(deferReplyMock).toHaveBeenCalled();
      expect(editReplyMock).toHaveBeenCalled();
      const arg = editReplyMock.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
      expect(arg?.embeds?.length).toBe(1);
    });

    it('lists backups on list subcommand', async () => {
      const command = createBackupCommands(service)[0]!;
      await service.createBackup(fakeGuild);

      const { interaction, replyMock } = createInteraction({ subcommand: 'list' });
      await command.execute(interaction);

      expect(replyMock).toHaveBeenCalled();
      const arg = replyMock.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
      expect(arg?.embeds?.length).toBe(1);
    });
  });

  it('initializes module definition via createBackupModule', () => {
    const mod = createBackupModule(service);
    expect(mod.id).toBe('backup');
    expect(mod.commands?.length).toBe(1);
  });
});
