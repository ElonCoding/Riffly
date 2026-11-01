import { describe, it, expect } from 'vitest';
import type { Message, GuildMember, VoiceState } from 'discord.js';
import {
  formatMessageDeleteEmbed,
  formatMessageUpdateEmbed,
  formatMemberJoinEmbed,
  formatMemberLeaveEmbed,
  formatVoiceStateEmbed,
  createLoggingModule,
} from '../../src/modules/logging/index.js';

describe('Server Logging Module', () => {
  it('formats message delete embed, ignoring bot messages', () => {
    const botMsg = {
      guild: { id: 'g1' },
      author: { bot: true, id: 'bot1' },
    } as unknown as Message;
    expect(formatMessageDeleteEmbed(botMsg)).toBeNull();

    const userMsg = {
      guild: { id: 'g1' },
      author: { bot: false, id: 'user1' },
      channelId: 'c1',
      content: 'Hello deleted world',
    } as unknown as Message;

    const embed = formatMessageDeleteEmbed(userMsg);
    expect(embed).not.toBeNull();
    const data = embed?.toJSON();
    expect(data?.title).toBe('🗑️ Message Deleted');
    expect(data?.fields?.some((f) => f.value.includes('Hello deleted world'))).toBe(true);
  });

  it('formats message edit embed, ignoring unchanged content', () => {
    const oldMsg = { content: 'Same content' } as unknown as Message;
    const newMsg = {
      guild: { id: 'g1' },
      author: { bot: false, id: 'user1' },
      channelId: 'c1',
      content: 'Same content',
    } as unknown as Message;

    expect(formatMessageUpdateEmbed(oldMsg, newMsg)).toBeNull();

    const changedMsg = {
      guild: { id: 'g1' },
      author: { bot: false, id: 'user1' },
      channelId: 'c1',
      content: 'Different content',
    } as unknown as Message;

    const embed = formatMessageUpdateEmbed(oldMsg, changedMsg);
    expect(embed).not.toBeNull();
    const data = embed?.toJSON();
    expect(data?.title).toBe('✏️ Message Edited');
  });

  it('formats member join and leave embeds', () => {
    const joinMember = {
      id: 'u1',
      user: {
        tag: 'User#1234',
        createdTimestamp: Date.now() - 86400000 * 10,
        displayAvatarURL: () => 'https://cdn.example.com/avatar.png',
      },
      guild: { memberCount: 42 },
    } as unknown as GuildMember;

    const joinEmbed = formatMemberJoinEmbed(joinMember);
    expect(joinEmbed.toJSON().title).toBe('📥 Member Joined');

    const leaveEmbed = formatMemberLeaveEmbed(joinMember);
    expect(leaveEmbed.toJSON().title).toBe('📤 Member Left');
  });

  it('formats voice state embeds for join, leave, and move', () => {
    const member = {
      id: 'v_user',
      user: { bot: false },
    };

    // Join voice
    const joinOld = { channelId: null, member } as unknown as VoiceState;
    const joinNew = { channelId: 'vc1', member } as unknown as VoiceState;
    const joinEmbed = formatVoiceStateEmbed(joinOld, joinNew);
    expect(joinEmbed?.toJSON().title).toBe('🔊 Voice Joined');

    // Leave voice
    const leaveOld = { channelId: 'vc1', member } as unknown as VoiceState;
    const leaveNew = { channelId: null, member } as unknown as VoiceState;
    const leaveEmbed = formatVoiceStateEmbed(leaveOld, leaveNew);
    expect(leaveEmbed?.toJSON().title).toBe('🔇 Voice Left');

    // Move voice
    const moveOld = { channelId: 'vc1', member } as unknown as VoiceState;
    const moveNew = { channelId: 'vc2', member } as unknown as VoiceState;
    const moveEmbed = formatVoiceStateEmbed(moveOld, moveNew);
    expect(moveEmbed?.toJSON().title).toBe('🔄 Voice Switched');
  });

  it('registers logging module with 5 core event listeners', () => {
    const logModule = createLoggingModule();
    expect(logModule.id).toBe('logging');
    expect(logModule.events).toHaveLength(5);

    const eventNames = logModule.events?.map((e) => e.event);
    expect(eventNames).toContain('messageDelete');
    expect(eventNames).toContain('messageUpdate');
    expect(eventNames).toContain('guildMemberAdd');
    expect(eventNames).toContain('guildMemberRemove');
    expect(eventNames).toContain('voiceStateUpdate');
  });
});
