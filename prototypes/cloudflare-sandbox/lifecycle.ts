/**
 * Opt-in lifecycle for the isolated probe only. Whole-container snapshots
 * include every writable file, potentially including secrets. Never use this
 * with real project data or credentials until retention and access are reviewed.
 */
export interface ProbeContainer {
  readonly running: boolean;
  start(options: { image?: string; containerSnapshot?: { id: string }; entrypoint: string[]; enableInternet: boolean }): void;
  snapshotContainer(options: { name: string }): Promise<{ id: string; size: number }>;
  destroy(): Promise<void>;
}
export interface ProbeStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export class ProbeLifecycle {
  private queue: Promise<unknown> = Promise.resolve();
  private container: ProbeContainer;
  private storage: ProbeStorage;
  constructor(container: ProbeContainer, storage: ProbeStorage) { this.container = container; this.storage = storage; }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  /** Serialize every filesystem operation with checkpoint/stop. */
  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      if (!this.container.running) {
        const id = await this.storage.get<string>('snapshotId');
        this.container.start({ ...(id ? { containerSnapshot: { id } } : { image: 'cloudflare/debian-trixie' }), entrypoint: ['sleep', 'infinity'], enableInternet: false });
      }
      return operation();
    });
  }
  /** Never destroy an awake container if its checkpoint or ID write fails. */
  checkpointAndStop(): Promise<{ id: string; size: number }> {
    return this.exclusive(async () => {
      if (!this.container.running) throw new Error('Sandbox is not running');
      const result = await this.container.snapshotContainer({ name: 'vibe-probe' });
      await this.storage.put('snapshotId', result.id);
      await this.container.destroy();
      return result;
    });
  }
}
