import { describe, it, expect, vi } from 'vitest';
import type { GuildMember, Role, TextChannel } from 'discord.js';
import { VerificationService } from '../../src/modules/verification/service.js';
import { createVerificationModule } from '../../src/modules/verification/index.js';

describe('VerificationService', () => {
  const service = new VerificationService();

  it('posts verification panel with verify button', async () => {
    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = {
      send: sendFn,
    } as unknown as TextChannel;

    await service.sendVerificationPanel(mockChannel, 'Server Gate', 'Click below');
    expect(sendFn).toHaveBeenCalledTimes(1);
    const callArgs = (sendFn.mock.calls[0] as [{ embeds?: unknown[]; components?: unknown[] }])[0];
    expect(callArgs.embeds).toHaveLength(1);
    expect(callArgs.components).toHaveLength(1);
  });

  it('handles verification button click and grants role', async () => {
    const addRoleFn = vi.fn().mockResolvedValue({});
    const verifiedRole = { id: 'role_verified', name: 'Verified' } as Role;

    const member = {
      guild: {
        roles: {
          cache: new Map([['role_verified', verifiedRole]]),
        },
      },
      roles: {
        cache: new Map(),
        add: addRoleFn,
      },
    } as unknown as GuildMember;

    const res = await service.handleVerificationClick(member, 'role_verified');
    expect(res.success).toBe(true);
    expect(res.message).toContain('Verified');
    expect(addRoleFn).toHaveBeenCalledWith(verifiedRole, expect.any(String));

    // Already verified
    const alreadyVerifiedMember = {
      guild: {
        roles: {
          cache: new Map([['role_verified', verifiedRole]]),
        },
      },
      roles: {
        cache: new Map([['role_verified', verifiedRole]]),
        add: addRoleFn,
      },
    } as unknown as GuildMember;

    const res2 = await service.handleVerificationClick(alreadyVerifiedMember, 'role_verified');
    expect(res2.success).toBe(true);
    expect(res2.message).toContain('already verified');
  });

  it('handles member join with auto-role and welcome template', async () => {
    const addRoleFn = vi.fn().mockResolvedValue({});
    const autoRole = { id: 'auto_1' } as Role;
    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = { send: sendFn } as unknown as TextChannel;

    const member = {
      id: 'u1',
      guild: {
        name: 'Test Guild',
        memberCount: 99,
        roles: { cache: new Map([['auto_1', autoRole]]) },
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      },
      user: {
        tag: 'User#0001',
        displayAvatarURL: () => 'https://cdn.example.com/avatar.png',
      },
      roles: { add: addRoleFn },
    } as unknown as GuildMember;

    await service.handleMemberJoin(member, {
      autoRoleId: 'auto_1',
      welcomeChannelId: 'w_chan',
      welcomeMessage: 'Hey {user}, welcome to {server}! Member #{count}',
    });

    expect(addRoleFn).toHaveBeenCalledWith(autoRole, expect.any(String));
    expect(sendFn).toHaveBeenCalledTimes(1);
    const callArgs = (sendFn.mock.calls[0] as [{ embeds?: [{ data?: { description?: string } }] }])[0];
    expect(callArgs.embeds?.[0]?.data?.description).toBe('Hey <@u1>, welcome to Test Guild! Member #99');
  });

  it('builds valid verification module definition', () => {
    const modDef = createVerificationModule();
    expect(modDef.id).toBe('verification');
    expect(modDef.commands).toHaveLength(1);
    expect(modDef.commands?.[0]?.name).toBe('verification');
  });
});
