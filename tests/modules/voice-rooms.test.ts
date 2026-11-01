import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Guild, GuildMember, VoiceChannel, VoiceState } from 'discord.js';
import { VoiceRoomService, VoiceRoomError } from '../../src/modules/voice-rooms/service.js';
import { createVoiceRoomsModule } from '../../src/modules/voice-rooms/index.js';

describe('VoiceRoomService', () => {
  let service: VoiceRoomService;

  beforeEach(() => {
    service = new VoiceRoomService();
  });

  it('spawns temporary voice channel on join and auto-deletes when empty', async () => {
    const deleteChannelFn = vi.fn().mockResolvedValue({});
    const setChannelFn = vi.fn().mockResolvedValue({});

    const tempChannel = {
      id: 'vc_temp_1',
      name: "Creator's Room",
      members: new Map(),
      delete: deleteChannelFn,
    } as unknown as VoiceChannel;

    const createChannelFn = vi.fn().mockResolvedValue(tempChannel);

    const mockGuild = {
      id: 'g1',
      channels: {
        create: createChannelFn,
        cache: new Map([['vc_temp_1', tempChannel]]),
      },
    } as unknown as Guild;

    const member = {
      id: 'user_creator',
      user: { username: 'Creator', bot: false },
      voice: {
        setChannel: setChannelFn,
      },
    } as unknown as GuildMember;

    const oldState = { channelId: null, member, guild: mockGuild } as unknown as VoiceState;
    const newState = { channelId: 'jtc_hub', member, guild: mockGuild } as unknown as VoiceState;

    // 1. User joins the generator channel
    const spawned = await service.handleVoiceStateUpdate(oldState, newState, {
      joinToCreateChannelId: 'jtc_hub',
    });

    expect(spawned?.id).toBe('vc_temp_1');
    expect(createChannelFn).toHaveBeenCalledTimes(1);
    expect(setChannelFn).toHaveBeenCalledWith(tempChannel);
    expect(service.getRoom('vc_temp_1')?.ownerId).toBe('user_creator');

    // 2. User leaves the temporary channel, leaving it empty
    const leaveOld = { channelId: 'vc_temp_1', member, guild: mockGuild } as unknown as VoiceState;
    const leaveNew = { channelId: null, member, guild: mockGuild } as unknown as VoiceState;

    await service.handleVoiceStateUpdate(leaveOld, leaveNew, {
      joinToCreateChannelId: 'jtc_hub',
    });

    expect(deleteChannelFn).toHaveBeenCalledTimes(1);
    expect(service.getRoom('vc_temp_1')).toBeUndefined();
  });

  it('enforces ownership checks on room rename', async () => {
    const setNameFn = vi.fn().mockResolvedValue({});
    const tempChannel = {
      id: 'vc_temp_2',
      setName: setNameFn,
    } as unknown as VoiceChannel;

    const createChannelFn = vi.fn().mockResolvedValue(tempChannel);
    const mockGuild = {
      id: 'g1',
      channels: { create: createChannelFn },
    } as unknown as Guild;

    const owner = {
      id: 'owner_1',
      user: { username: 'Owner', tag: 'Owner#0001', bot: false },
      voice: { setChannel: vi.fn().mockResolvedValue({}) },
    } as unknown as GuildMember;

    const stranger = {
      id: 'stranger_2',
      user: { username: 'Stranger', tag: 'Stranger#0002', bot: false },
    } as unknown as GuildMember;

    await service.createTemporaryRoom(mockGuild, owner, {});

    // Stranger cannot rename
    await expect(service.rename(tempChannel, stranger, 'Hacked Room')).rejects.toThrow(
      VoiceRoomError,
    );

    // Owner can rename
    await service.rename(tempChannel, owner, 'Lofi Chill Room');
    expect(setNameFn).toHaveBeenCalledWith('Lofi Chill Room', expect.any(String));
  });

  it('locks, unlocks, permits, and rejects room access', async () => {
    const editPermsFn = vi.fn().mockResolvedValue({});
    const disconnectFn = vi.fn().mockResolvedValue({});

    const tempChannel = {
      id: 'vc_temp_3',
      guild: { roles: { everyone: { id: 'everyone_role' } } },
      permissionOverwrites: {
        edit: editPermsFn,
      },
    } as unknown as VoiceChannel;

    const owner = {
      id: 'owner_1',
      user: { username: 'Owner', tag: 'Owner#0001', bot: false },
      voice: { setChannel: vi.fn().mockResolvedValue({}) },
    } as unknown as GuildMember;

    const target = {
      id: 'target_1',
      voice: { channelId: 'vc_temp_3', disconnect: disconnectFn },
    } as unknown as GuildMember;

    const mockGuild = {
      id: 'g1',
      channels: { create: vi.fn().mockResolvedValue(tempChannel) },
    } as unknown as Guild;

    await service.createTemporaryRoom(mockGuild, owner, {});

    // Lock
    await service.lock(tempChannel, owner);
    expect(editPermsFn).toHaveBeenCalled();

    // Unlock
    await service.unlock(tempChannel, owner);
    expect(editPermsFn).toHaveBeenCalled();

    // Permit
    await service.permit(tempChannel, owner, target);
    expect(editPermsFn).toHaveBeenCalledWith('target_1', expect.any(Object));

    // Reject (disconnects if in channel)
    await service.reject(tempChannel, owner, target);
    expect(disconnectFn).toHaveBeenCalledWith(expect.any(String));

    // Hide and Unhide
    await service.hide(tempChannel, owner);
    expect(editPermsFn).toHaveBeenCalled();
    await service.unhide(tempChannel, owner);
    expect(editPermsFn).toHaveBeenCalled();

    // Kick
    await service.kick(tempChannel, owner, target);
    expect(disconnectFn).toHaveBeenCalledWith('Kicked by room owner');
  });

  it('builds valid voice-rooms module definition', () => {
    const modDef = createVoiceRoomsModule();
    expect(modDef.id).toBe('voice-rooms');
    expect(modDef.commands).toHaveLength(3);
    expect(modDef.commands?.map((c) => c.name)).toEqual(['vc', 'voicemaster', 'setup-vc']);
    expect(modDef.events).toHaveLength(1);
  });
});
