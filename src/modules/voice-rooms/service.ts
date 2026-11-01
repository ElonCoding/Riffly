import {
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import type {
  Guild,
  GuildMember,
  VoiceChannel,
  VoiceState,
} from 'discord.js';
import type { ActiveVoiceRoom } from './types.js';

export class VoiceRoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceRoomError';
  }
}

/**
 * Service managing dynamic Join-To-Create temporary voice channels,
 * ownership controls, auto-deletion on empty, and participant permissions.
 */
export class VoiceRoomService {
  private readonly activeRooms = new Map<string, ActiveVoiceRoom>();

  /**
   * Returns active room metadata for a channel if managed by this service.
   */
  public getRoom(channelId: string): ActiveVoiceRoom | undefined {
    return this.activeRooms.get(channelId);
  }

  /**
   * Asserts that a member is the recognized owner of the specified voice room.
   */
  public assertOwnership(channelId: string, memberId: string): ActiveVoiceRoom {
    const room = this.activeRooms.get(channelId);
    if (!room) {
      throw new VoiceRoomError('This voice channel is not a managed temporary room.');
    }
    if (room.ownerId !== memberId) {
      throw new VoiceRoomError('Only the room owner can manage this temporary channel.');
    }
    return room;
  }

  /**
   * Handles user joins/leaves to spawn temporary rooms or clean up empty ones.
   */
  public async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
    options: {
      joinToCreateChannelId?: string;
      categoryId?: string;
      defaultUserLimit?: number;
    },
  ): Promise<VoiceChannel | null> {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return null;

    const guild = newState.guild ?? oldState.guild;

    // 1. Join to create: User entered the designated generator channel
    if (
      options.joinToCreateChannelId &&
      newState.channelId === options.joinToCreateChannelId
    ) {
      return this.createTemporaryRoom(guild, member, options);
    }

    // 2. Leave / Move: Check if previous channel was a temporary room now empty
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const room = this.activeRooms.get(oldState.channelId);
      if (room) {
        const channel = guild.channels.cache.get(oldState.channelId) as VoiceChannel | undefined;
        if (channel && channel.members.size === 0) {
          this.activeRooms.delete(oldState.channelId);
          await channel.delete('Temporary voice room empty.').catch(() => null);
        }
      }
    }

    return null;
  }

  /**
   * Creates a private temporary voice channel and moves the user into it.
   */
  public async createTemporaryRoom(
    guild: Guild,
    creator: GuildMember,
    options: {
      categoryId?: string;
      defaultUserLimit?: number;
    },
  ): Promise<VoiceChannel> {
    const channelName = `${creator.user.username}'s Room`;

    const channel = await guild.channels.create<ChannelType.GuildVoice>({
      name: channelName,
      type: ChannelType.GuildVoice,
      ...(options.categoryId ? { parent: options.categoryId } : {}),
      userLimit: options.defaultUserLimit ?? 0,
      permissionOverwrites: [
        {
          id: creator.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
          ],
        },
      ],
    });

    this.activeRooms.set(channel.id, {
      channelId: channel.id,
      guildId: guild.id,
      ownerId: creator.id,
      createdAt: new Date(),
    });

    // Move creator into the newly spawned channel
    await creator.voice.setChannel(channel).catch(() => null);

    return channel;
  }

  /**
   * Renames the room.
   */
  public async rename(channel: VoiceChannel, member: GuildMember, newName: string): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    const sanitized = newName.trim().slice(0, 50);
    if (!sanitized) throw new VoiceRoomError('Channel name cannot be empty.');
    await channel.setName(sanitized, `Renamed by room owner ${member.user.tag}`);
  }

  /**
   * Adjusts the maximum user limit.
   */
  public async setLimit(channel: VoiceChannel, member: GuildMember, limit: number): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    const clamped = Math.min(99, Math.max(0, limit));
    await channel.setUserLimit(clamped, `User limit updated by room owner ${member.user.tag}`);
  }

  /**
   * Locks the room, preventing new members from connecting.
   */
  public async lock(channel: VoiceChannel, member: GuildMember): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      [PermissionFlagsBits.Connect.toString()]: false,
    });
  }

  /**
   * Unlocks the room for all members.
   */
  public async unlock(channel: VoiceChannel, member: GuildMember): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      [PermissionFlagsBits.Connect.toString()]: null,
    });
  }

  /**
   * Explicitly permits a specific member to join.
   */
  public async permit(
    channel: VoiceChannel,
    member: GuildMember,
    target: GuildMember,
  ): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    await channel.permissionOverwrites.edit(target.id, {
      [PermissionFlagsBits.Connect.toString()]: true,
      [PermissionFlagsBits.ViewChannel.toString()]: true,
    });
  }

  /**
   * Rejects and bans a specific member from the room.
   */
  public async reject(
    channel: VoiceChannel,
    member: GuildMember,
    target: GuildMember,
  ): Promise<void> {
    this.assertOwnership(channel.id, member.id);

    // Disconnect if currently inside
    if (target.voice.channelId === channel.id) {
      await target.voice.disconnect('Rejected by room owner.').catch(() => null);
    }

    await channel.permissionOverwrites.edit(target.id, {
      [PermissionFlagsBits.Connect.toString()]: false,
    });
  }

  /**
   * Transfers ownership to another participant in the channel.
   */
  public async transferOwnership(
    channel: VoiceChannel,
    currentOwner: GuildMember,
    newOwner: GuildMember,
  ): Promise<void> {
    const room = this.assertOwnership(channel.id, currentOwner.id);
    room.ownerId = newOwner.id;

    await channel.permissionOverwrites.edit(newOwner.id, {
      [PermissionFlagsBits.Connect.toString()]: true,
      [PermissionFlagsBits.Speak.toString()]: true,
      [PermissionFlagsBits.ManageChannels.toString()]: true,
      [PermissionFlagsBits.MoveMembers.toString()]: true,
    });
  }

  /**
   * Hides the room from everyone.
   */
  public async hide(channel: VoiceChannel, member: GuildMember): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      [PermissionFlagsBits.ViewChannel.toString()]: false,
    });
  }

  /**
   * Unhides the room for everyone.
   */
  public async unhide(channel: VoiceChannel, member: GuildMember): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      [PermissionFlagsBits.ViewChannel.toString()]: null,
    });
  }

  /**
   * Disconnects a target member from the channel without banning.
   */
  public async kick(channel: VoiceChannel, member: GuildMember, target: GuildMember): Promise<void> {
    this.assertOwnership(channel.id, member.id);
    if (target.voice.channelId === channel.id) {
      await target.voice.disconnect('Kicked by room owner');
    }
  }

  /**
   * One-click VoiceMaster setup: creates category and hub channel.
   */
  public async setupVoiceMaster(
    guild: Guild,
    channelType: 'normal' | 'duo' | 'trio' | 'quad' = 'normal',
  ): Promise<{ categoryId: string; hubChannelId: string }> {
    const defaultLimits = { normal: 0, duo: 2, trio: 3, quad: 4 };
    const limit = defaultLimits[channelType];

    const category = await guild.channels.create({
      name: 'RIFFLY VOICEMASTER',
      type: ChannelType.GuildCategory,
    });

    const hub = await guild.channels.create({
      name: `➕ Join to Create (${channelType.toUpperCase()})`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      userLimit: limit,
    });

    return { categoryId: category.id, hubChannelId: hub.id };
  }
}
