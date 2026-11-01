import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { REST } from 'discord.js';
import { CommandSynchronizer, formatCommandPayload } from '../../src/modules/commands/sync.js';
import type { CommandDefinition } from '../../src/modules/core/types.js';
import { ModuleRegistry } from '../../src/modules/core/registry.js';
import { defineModule } from '../../src/modules/core/define-module.js';

describe('CommandSynchronizer — Debounced Per-Guild REST Registration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockRest() {
    const putMock = vi.fn().mockResolvedValue([]);
    const rest = { put: putMock } as unknown as REST;
    return { rest, putMock };
  }

  it('formats command payloads correctly with and without data.toJSON', () => {
    const commands: CommandDefinition[] = [
      {
        name: 'ping',
        description: 'Check bot latency',
        execute: vi.fn(),
      },
      {
        name: 'play',
        description: 'Play music',
        guildOnly: true,
        defaultMemberPermissions: 8n, // ADMINISTRATOR
        data: {
          name: 'play',
          toJSON: () => ({
            name: 'play',
            description: 'Custom play payload',
          }),
        },
        execute: vi.fn(),
      },
    ];

    const payload = formatCommandPayload(commands);
    expect(payload).toEqual([
      {
        name: 'ping',
        description: 'Check bot latency',
        default_member_permissions: null,
        dm_permission: true,
      },
      {
        name: 'play',
        description: 'Custom play payload',
      },
    ]);
  });

  it('debounces rapid sync requests within 5000ms window per guild', async () => {
    const { rest, putMock } = createMockRest();
    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      debounceMs: 5000,
    });

    const cmdV1: CommandDefinition = {
      name: 'help',
      description: 'Help v1',
      execute: vi.fn(),
    };

    const cmdV2: CommandDefinition = {
      name: 'help',
      description: 'Help v2 updated',
      execute: vi.fn(),
    };

    const guildId = 'guild-456';

    // First call at t = 0ms
    const promise1 = synchronizer.queueGuildSync(guildId, [cmdV1]);
    expect(synchronizer.isPending(guildId)).toBe(true);

    // Advance 3000ms: REST PUT must NOT have been called yet
    await vi.advanceTimersByTimeAsync(3000);
    expect(putMock).not.toHaveBeenCalled();

    // Second call at t = 3000ms with updated commands: resets debounce window to +5000ms (t = 8000ms)
    const promise2 = synchronizer.queueGuildSync(guildId, [cmdV2]);

    // Advance 3000ms (t = 6000ms): still not called because timer was reset at t = 3000ms
    await vi.advanceTimersByTimeAsync(3000);
    expect(putMock).not.toHaveBeenCalled();

    // Advance remaining 2000ms (t = 8000ms): now timer triggers
    await vi.advanceTimersByTimeAsync(2000);

    expect(putMock).toHaveBeenCalledTimes(1);

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1.commandCount).toBe(1);
    expect(res2.commandCount).toBe(1);
    expect(synchronizer.isPending(guildId)).toBe(false);
  });

  it('isolates debounce windows across different guilds', async () => {
    const { rest, putMock } = createMockRest();
    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      debounceMs: 5000,
    });

    const cmd: CommandDefinition = {
      name: 'ping',
      description: 'Ping',
      execute: vi.fn(),
    };

    // Queue guild 1 at t = 0ms
    const p1 = synchronizer.queueGuildSync('guild-1', [cmd]);

    // Advance 2000ms, queue guild 2 at t = 2000ms
    await vi.advanceTimersByTimeAsync(2000);
    const p2 = synchronizer.queueGuildSync('guild-2', [cmd]);

    // Advance to t = 5000ms: guild-1 fires, guild-2 has 2000ms remaining
    await vi.advanceTimersByTimeAsync(3000);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(synchronizer.isPending('guild-1')).toBe(false);
    expect(synchronizer.isPending('guild-2')).toBe(true);

    // Advance 2000ms to t = 7000ms: guild-2 fires
    await vi.advanceTimersByTimeAsync(2000);
    expect(putMock).toHaveBeenCalledTimes(2);
    expect(synchronizer.isPending('guild-2')).toBe(false);

    await Promise.all([p1, p2]);
  });

  it('syncs immediately when syncGuildNow is called and clears pending debounce timer', async () => {
    const { rest, putMock } = createMockRest();
    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      debounceMs: 5000,
    });

    const cmd: CommandDefinition = {
      name: 'reload',
      description: 'Reload',
      execute: vi.fn(),
    };

    const guildId = 'guild-now';

    // Queue debounced sync
    const queuedPromise = synchronizer.queueGuildSync(guildId, [cmd]);
    expect(synchronizer.isPending(guildId)).toBe(true);

    // Immediate sync fires REST PUT right away
    const nowResult = await synchronizer.syncGuildNow(guildId, [cmd]);
    expect(nowResult.commandCount).toBe(1);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(synchronizer.isPending(guildId)).toBe(false);

    // Queued promise also resolves
    const queuedResult = await queuedPromise;
    expect(queuedResult.commandCount).toBe(1);

    // Advance time: timer was cancelled so it must not fire again
    await vi.advanceTimersByTimeAsync(10000);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('pulls commands automatically from ModuleRegistry if commands parameter is omitted', async () => {
    const { rest, putMock } = createMockRest();
    const registry = new ModuleRegistry();

    const musicMod = defineModule({
      id: 'music',
      name: 'Music',
      description: 'Music player',
      commands: [
        {
          name: 'play',
          description: 'Play song',
          execute: vi.fn(),
        },
        {
          name: 'skip',
          description: 'Skip song',
          execute: vi.fn(),
        },
      ],
    });

    registry.register(musicMod);

    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      registry,
    });

    const result = await synchronizer.syncGuildNow('guild-auto');
    expect(result.commandCount).toBe(2);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('cancels pending sync and cleans up on destroy', async () => {
    const { rest } = createMockRest();
    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      debounceMs: 5000,
    });

    const cmd: CommandDefinition = {
      name: 'test',
      description: 'Test',
      execute: vi.fn(),
    };

    const p = synchronizer.queueGuildSync('guild-cancel', [cmd]);
    expect(synchronizer.isPending('guild-cancel')).toBe(true);

    // Cancel sync
    const cancelled = synchronizer.cancelGuildSync('guild-cancel');
    expect(cancelled).toBe(true);
    expect(synchronizer.isPending('guild-cancel')).toBe(false);

    await expect(p).rejects.toThrow(/cancelled/);

    // Destroy test
    const p2 = synchronizer.queueGuildSync('guild-destroy', [cmd]);
    synchronizer.destroy();
    await expect(p2).rejects.toThrow(/destroyed/);
    expect(synchronizer.getPendingGuilds()).toHaveLength(0);
  });

  it('handles REST API errors gracefully and rejects queued callers', async () => {
    const restError = new Error('Discord HTTP 500 Internal Server Error');
    const putMock = vi.fn().mockRejectedValue(restError);
    const rest = { put: putMock } as unknown as REST;

    const errorSpy = vi.fn();
    const synchronizer = new CommandSynchronizer({
      rest,
      clientId: 'bot-client-123',
      debounceMs: 100,
      onSyncError: errorSpy,
    });

    const cmd: CommandDefinition = {
      name: 'fail',
      description: 'Fail',
      execute: vi.fn(),
    };

    const promise = synchronizer.queueGuildSync('guild-err', [cmd]);
    const assertion = expect(promise).rejects.toThrow('Discord HTTP 500 Internal Server Error');

    await vi.advanceTimersByTimeAsync(100);

    await assertion;
    expect(errorSpy).toHaveBeenCalledWith('guild-err', restError);
  });
});
