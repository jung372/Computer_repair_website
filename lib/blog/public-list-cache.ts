type CacheEntry<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

export class PublicListCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly options: {
    freshMs?: number;
    staleMs?: number;
    now?: () => number;
  };

  constructor(options: {
    freshMs?: number;
    staleMs?: number;
    now?: () => number;
  } = {}) {
    this.options = options;
  }

  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const now = (this.options.now || Date.now)();
    const entry = this.entries.get(key);
    if (entry && now < entry.freshUntil) return entry.value;
    const running = this.inFlight.get(key);
    if (running) return running;

    const request = (async () => {
      try {
        const value = await loader();
        const loadedAt = (this.options.now || Date.now)();
        const freshMs = this.options.freshMs ?? 10 * 60_000;
        const staleMs = this.options.staleMs ?? 24 * 60 * 60_000;
        this.entries.set(key, {
          value,
          freshUntil: loadedAt + freshMs,
          staleUntil: loadedAt + staleMs,
        });
        return value;
      } catch (error) {
        if (entry && now < entry.staleUntil) return entry.value;
        throw error;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, request);
    return request;
  }

  clear(key?: string) {
    if (key) this.entries.delete(key);
    else this.entries.clear();
  }
}
