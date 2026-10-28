import type { RpcSource, TransportMetrics } from "./models";
import { JsonStreamDecoder } from "./jsonStream";
import type { SourceExclusions } from "./sourceExclusion";

export interface StreamTransportOptions<T> {
  readonly sources: readonly RpcSource[];
  readonly path: string;
  readonly parse: (value: unknown) => T;
  readonly onValue: (value: T, source: RpcSource, latencyMs: number, metrics?:TransportMetrics) => void;
  readonly onStatus: (
    source: RpcSource | null,
    error: string | null,
    metrics: TransportMetrics,
  ) => void;
  readonly fetch?: typeof fetch;
  readonly random?: () => number;
  readonly now?: () => number;
  /** Mempool monitors end normally when the prevalidator flushes on a new head. */
  readonly reconnectOnEnd?: boolean;
  /** Per-source deadline for the next message; a source silent that long fails over. Undefined: no deadline. */
  readonly idleTimeoutMs?: (source: RpcSource) => number | undefined;
  /** Sources to skip; the current one is left as soon as it becomes excluded. */
  readonly exclusions?: SourceExclusions;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class StreamTransport<T> {
  private controller: AbortController | null = null;
  private running = false;
  private sourceIndex = 0;
  private failures = 0;
  private reconnectTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private metrics: TransportMetrics = {
    connects: 0,
    messages: 0,
    reconnects: 0,
    bytes: 0,
    lastLatencyMs: null,
  };

  constructor(private readonly options: StreamTransportOptions<T>) {
    if (options.sources.length === 0)
      throw new Error("StreamTransport needs a source");
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.options.exclusions?.subscribe((excluded) => {
      const current = this.options.sources[this.sourceIndex];
      if (!this.running || current?.network !== excluded.network || current.baseUrl !== excluded.baseUrl) return;
      this.controller?.abort();
      this.controller = null;
      if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      void this.connect();
    }) ?? null;
    void this.connect();
  }

  stop(): void {
    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.controller?.abort();
    this.controller = null;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.options.onStatus(null, null, this.metrics);
  }

  /** Moves past excluded sources; keeps the current one when every source is excluded. */
  private skipExcluded(): void {
    const sources = this.options.sources, exclusions = this.options.exclusions;
    for (let tried = 0; exclusions && tried < sources.length; tried++) {
      const source = sources[this.sourceIndex];
      if (source === undefined || !exclusions.has(source)) return;
      this.sourceIndex = (this.sourceIndex + 1) % sources.length;
    }
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    this.skipExcluded();
    const source = this.options.sources[this.sourceIndex];
    if (source === undefined) return;
    const request = this.options.fetch ?? fetch;
    const now = this.options.now ?? Date.now;
    const controller = new AbortController();
    this.controller = controller;
    const connectedAt = now();
    this.metrics = { ...this.metrics, connects: this.metrics.connects + 1 };
    this.options.onStatus(source, null, this.metrics);
    const idleMs = this.options.idleTimeoutMs?.(source);
    let idle: Error | null = null, idleTimer: number | null = null, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const armIdle = (): void => {
      if (idleMs === undefined) return;
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (this.controller !== controller) return;
        idle = new Error(`RPC stream idle: no message within ${Math.round(idleMs / 1000)} s`);
        controller.abort();
        void reader?.cancel().catch(() => undefined);
      }, idleMs);
    };
    armIdle();
    try {
      const response = await request(`${source.baseUrl}${this.options.path}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (idle) throw idle;
      if (!response.ok || response.body === null)
        throw new Error(`HTTP ${response.status}`);
      if (
        !this.running ||
        controller.signal.aborted ||
        this.controller !== controller
      )
        return;
      reader = response.body.getReader();
      const decoder = new JsonStreamDecoder();
      while (this.running) {
        const result = await reader.read();
        if (idle) throw idle;
        if (
          !this.running ||
          controller.signal.aborted ||
          this.controller !== controller
        )
          return;
        if (result.done) {
          if (!this.options.reconnectOnEnd)
            throw new Error("RPC stream closed");
          this.metrics = {
            ...this.metrics,
            reconnects: this.metrics.reconnects + 1,
          };
          this.options.onStatus(source, null, this.metrics);
          this.reconnectTimer = window.setTimeout(
            () => void this.connect(),
            now() - connectedAt >= 1000 ? 50 : 1000,
          );
          return;
        }
        this.metrics = {
          ...this.metrics,
          bytes: this.metrics.bytes + result.value.byteLength,
        };
        for (const raw of decoder.push(result.value)) {
          const latency = now() - connectedAt;
          const value = this.options.parse(raw);
          armIdle();
          this.failures = 0;
          this.metrics = {
            ...this.metrics,
            messages: this.metrics.messages + 1,
            lastLatencyMs: latency,
          };
          this.options.onValue(value, source, latency, this.metrics);
          this.options.onStatus(source, null, this.metrics);
        }
      }
    } catch (caught) {
      const error: unknown = idle ?? caught;
      if (
        !this.running ||
        (controller.signal.aborted && idle === null) ||
        this.controller !== controller
      )
        return;
      this.failures += 1;
      this.sourceIndex = (this.sourceIndex + 1) % this.options.sources.length;
      this.metrics = {
        ...this.metrics,
        reconnects: this.metrics.reconnects + 1,
      };
      this.options.onStatus(source, message(error), this.metrics);
      const random = this.options.random ?? Math.random;
      const base = Math.min(
        30_000,
        1_000 * 2 ** Math.min(5, this.failures - 1),
      );
      const delay = Math.round(base * (0.8 + random() * 0.4));
      this.reconnectTimer = window.setTimeout(() => void this.connect(), delay);
    } finally {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
    }
  }
}
