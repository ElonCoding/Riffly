import { describe, expect, it, vi } from 'vitest';
import { EventDispatcher } from '../../src/modules/events/dispatcher.js';
import { EventPriorities } from '../../src/modules/core/types.js';
import { ModuleRegistry } from '../../src/modules/core/registry.js';
import { defineModule } from '../../src/modules/core/define-module.js';

describe('EventDispatcher — Priority Ordering & Error Boundaries', () => {
  it('executes handlers strictly in descending priority order', async () => {
    const dispatcher = new EventDispatcher();
    const executionOrder: number[] = [];

    dispatcher.registerHandler('customEvent', {
      priority: EventPriorities.NORMAL, // 0
      execute: () => {
        executionOrder.push(0);
      },
    });

    dispatcher.registerHandler('customEvent', {
      priority: EventPriorities.HIGH, // 50
      execute: () => {
        executionOrder.push(50);
      },
    });

    dispatcher.registerHandler('customEvent', {
      priority: EventPriorities.CRITICAL, // 200
      execute: () => {
        executionOrder.push(200);
      },
    });

    dispatcher.registerHandler('customEvent', {
      priority: EventPriorities.MONITOR, // -100
      execute: () => {
        executionOrder.push(-100);
      },
    });

    const result = await dispatcher.dispatch('customEvent', { data: 'test' });

    expect(result.executedHandlers).toBe(4);
    expect(result.failures).toHaveLength(0);
    expect(executionOrder).toEqual([200, 50, 0, -100]);
  });

  it('isolates handler errors so sibling handlers still execute without crashing', async () => {
    const errorSpy = vi.fn();
    const dispatcher = new EventDispatcher({
      onError: errorSpy,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    const executionTrail: string[] = [];

    // High priority handler runs first
    dispatcher.registerHandler('testFail', {
      priority: 100,
      execute: () => {
        executionTrail.push('high-success');
      },
    });

    // Middle priority handler throws an uncaught error
    dispatcher.registerHandler('testFail', {
      id: 'faulty-handler',
      moduleId: 'faulty-mod',
      priority: 50,
      execute: () => {
        executionTrail.push('middle-fault');
        throw new Error('Explosion in faulty-handler');
      },
    });

    // Normal priority handler must still execute despite the middle failure
    dispatcher.registerHandler('testFail', {
      priority: 0,
      execute: () => {
        executionTrail.push('normal-success');
      },
    });

    const result = await dispatcher.dispatch('testFail', { key: 'val' });

    expect(result.executedHandlers).toBe(3);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.handlerId).toBe('faulty-handler');
    expect(result.failures[0]?.moduleId).toBe('faulty-mod');
    expect(result.failures[0]?.error?.message).toBe('Explosion in faulty-handler');

    // Sibling handlers executed in full
    expect(executionTrail).toEqual(['high-success', 'middle-fault', 'normal-success']);

    // onError callback invoked with context
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Explosion in faulty-handler' }),
      expect.objectContaining({
        event: 'testFail',
        moduleId: 'faulty-mod',
        handlerId: 'faulty-handler',
        priority: 50,
      }),
    );
  });

  it('filters events by guild module activation state', async () => {
    const registry = new ModuleRegistry();
    const dispatcher = new EventDispatcher({ registry });

    const executedModules: string[] = [];

    const modA = defineModule({
      id: 'mod-a',
      name: 'Mod A',
      description: 'A',
      events: [
        {
          event: 'guildEvent',
          execute: () => {
            executedModules.push('mod-a');
          },
        },
      ],
    });

    const modB = defineModule({
      id: 'mod-b',
      name: 'Mod B',
      description: 'B',
      events: [
        {
          event: 'guildEvent',
          execute: () => {
            executedModules.push('mod-b');
          },
        },
      ],
    });

    registry.registerMany([modA, modB]);
    dispatcher.registerRegistry(registry);

    const guildId = 'guild-alpha';

    // Disable Mod B in guild-alpha
    await registry.disableModule(guildId, 'mod-b');

    // Dispatch event with guildId
    await dispatcher.dispatch('guildEvent', { guildId });
    expect(executedModules).toEqual(['mod-a']);

    // Dispatch event with nested guild object
    executedModules.length = 0;
    await dispatcher.dispatch('guildEvent', { guild: { id: guildId } });
    expect(executedModules).toEqual(['mod-a']);

    // Dispatch for another guild where both are enabled
    executedModules.length = 0;
    await dispatcher.dispatch('guildEvent', { guildId: 'guild-beta' });
    expect(executedModules).toEqual(['mod-a', 'mod-b']);
  });

  it('respects filter predicates and isolates filter exceptions', async () => {
    const dispatcher = new EventDispatcher({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });
    const executed: string[] = [];

    dispatcher.registerHandler('filterTest', {
      priority: 10,
      filter: (payload: unknown) => {
        const obj = payload as { value: number };
        return obj.value > 10;
      },
      execute: () => {
        executed.push('accepted');
      },
    });

    dispatcher.registerHandler('filterTest', {
      priority: 5,
      filter: () => {
        throw new Error('Filter exception');
      },
      execute: () => {
        executed.push('should-not-run');
      },
    });

    // Test payload that fails filter
    await dispatcher.dispatch('filterTest', { value: 5 });
    expect(executed).toEqual([]);

    // Test payload that passes filter
    await dispatcher.dispatch('filterTest', { value: 20 });
    expect(executed).toEqual(['accepted']);
  });

  it('supports one-time listeners via once: true', async () => {
    const dispatcher = new EventDispatcher();
    const calls: number[] = [];

    dispatcher.registerHandler('onceEvent', {
      once: true,
      execute: () => {
        calls.push(1);
      },
    });

    await dispatcher.dispatch('onceEvent', {});
    expect(calls).toEqual([1]);
    expect(dispatcher.getHandlerCount('onceEvent')).toBe(0);

    // Second dispatch does not invoke
    await dispatcher.dispatch('onceEvent', {});
    expect(calls).toEqual([1]);
  });

  it('attaches to and detaches from a Discord.js Client', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();

    const fakeClient = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
        return fakeClient;
      }),
      off: vi.fn((event: string) => {
        listeners.delete(event);
        return fakeClient;
      }),
    };

    const dispatcher = new EventDispatcher();
    const handledMessages: string[] = [];

    dispatcher.registerHandler('messageCreate', {
      execute: (arg: unknown) => {
        const msg = arg as { content: string };
        handledMessages.push(msg.content);
      },
    });

    // Attach client
    // @ts-expect-error Mocked client
    dispatcher.attach(fakeClient);
    expect(fakeClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));

    // Simulate gateway messageCreate event
    const gatewayListener = listeners.get('messageCreate');
    expect(gatewayListener).toBeDefined();
    gatewayListener?.({ content: 'Hello Riffly' });

    // Allow async dispatch
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(handledMessages).toEqual(['Hello Riffly']);

    // Detach client
    dispatcher.detach();
    expect(fakeClient.off).toHaveBeenCalledWith('messageCreate', expect.any(Function));
  });

  it('unregisters handlers and supports clearHandlers', async () => {
    const dispatcher = new EventDispatcher();
    const executed: string[] = [];

    const unsubscribe = dispatcher.registerHandler('tempEvent', {
      execute: () => {
        executed.push('temp');
      },
    });

    expect(dispatcher.getHandlerCount('tempEvent')).toBe(1);

    await dispatcher.dispatch('tempEvent', {});
    expect(executed).toEqual(['temp']);

    // Unsubscribe
    unsubscribe();
    expect(dispatcher.getHandlerCount('tempEvent')).toBe(0);

    await dispatcher.dispatch('tempEvent', {});
    expect(executed).toEqual(['temp']);
  });
});
