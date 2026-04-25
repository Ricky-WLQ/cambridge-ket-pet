export class QueueFullError extends Error {
  constructor() {
    super("Listening generation queue is full");
    this.name = "QueueFullError";
  }
}

export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
}

export function createSemaphore(opts: {
  maxConcurrent: number;
  maxWaiting: number;
}): Semaphore {
  let active = 0;
  const waiting: Array<() => void> = [];

  return {
    async acquire() {
      if (active < opts.maxConcurrent) {
        active++;
        return;
      }
      if (waiting.length >= opts.maxWaiting) {
        throw new QueueFullError();
      }
      await new Promise<void>((resolve) => waiting.push(resolve));
      active++;
    },
    release() {
      active = Math.max(0, active - 1);
      const next = waiting.shift();
      if (next) next();
    },
  };
}

/**
 * Global audio-generation semaphore. Lazy-initialized from env.
 */
let _globalSem: Semaphore | null = null;
export function audioSemaphore(): Semaphore {
  if (!_globalSem) {
    _globalSem = createSemaphore({
      maxConcurrent: Number(process.env.LISTENING_MAX_CONCURRENT ?? 3),
      maxWaiting: Number(process.env.LISTENING_QUEUE_MAX ?? 5),
    });
  }
  return _globalSem;
}
