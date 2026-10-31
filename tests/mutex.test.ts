import { describe, expect, it } from 'vitest';
import { AsyncMutex } from '../src/player/mutex.js';

describe('AsyncMutex', () => {
  it('executes tasks in sequential FIFO order', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    const p1 = mutex.runExclusive(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
      return 'one';
    });

    const p2 = mutex.runExclusive(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push(2);
      return 'two';
    });

    const p3 = mutex.runExclusive(async () => {
      await Promise.resolve();
      order.push(3);
      return 'three';
    });

    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual(['one', 'two', 'three']);
    expect(order).toEqual([1, 2, 3]);
  });

  it('does not reject or deadlock following operations when an operation throws', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    const p1 = mutex.runExclusive(async () => {
      await Promise.resolve();
      order.push(1);
      throw new Error('Task 1 failed');
    });

    const p2 = mutex.runExclusive(async () => {
      await Promise.resolve();
      order.push(2);
      return 'success';
    });

    await expect(p1).rejects.toThrow('Task 1 failed');
    const result2 = await p2;
    expect(result2).toBe('success');
    expect(order).toEqual([1, 2]);
  });

  it('Safeguard C-03: queues incoming concurrent operations without early returns', async () => {
    const mutex = new AsyncMutex();
    const executed: string[] = [];

    // Launch 5 concurrent calls simultaneously
    const promises = Array.from({ length: 5 }, (_, i) =>
      mutex.runExclusive(async () => {
        await new Promise((r) => setTimeout(r, 5));
        executed.push(`task-${i}`);
        return i;
      }),
    );

    const results = await Promise.all(promises);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(executed).toEqual(['task-0', 'task-1', 'task-2', 'task-3', 'task-4']);
  });
});
