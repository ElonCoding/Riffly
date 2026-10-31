/**
 * Asynchronous FIFO Promise Mutex.
 *
 * Guarantees that asynchronous operations for a given scope are queued
 * and executed strictly sequentially without early returns or clobbering.
 */

export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      return await callback();
    });
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}
