import type { RpcSource, TransportMetrics } from "./models";
import { JsonStreamDecoder } from "./jsonStream";

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
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class StreamTransport<T> {
  private controller: AbortController | null = null;
  private running = false;
  private sourceIndex = 0;
  private failures = 0;
  private reconnectTimer: number | null = null;
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
    void this.connect();
  }

  stop(): void {
    this.running = false;
    this.controller?.abort();
    this.controller = null;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.options.onStatus(null, null, this.metrics);
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    const source = this.options.sources[this.sourceIndex];
    if (source === undefined) return;
    const request = this.options.fetch ?? fetch;
    const now = this.options.now ?? Date.now;
    const controller = new AbortController();
    this.controller = controller;
    const connectedAt = now();
    this.metrics = { ...this.metrics, connects: this.metrics.connects + 1 };
    this.options.onStatus(source, null, this.metrics);
    try {
      const response = await request(`${source.baseUrl}${this.options.path}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok || response.body === null)
        throw new Error(`HTTP ${response.status}`);
      if (
        !this.running ||
        controller.signal.aborted ||
        this.controller !== controller
      )
        return;
      const reader = response.body.getReader();
      const decoder = new JsonStreamDecoder();
      while (this.running) {
        const result = await reader.read();
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
    } catch (error) {
      if (
        !this.running ||
        controller.signal.aborted ||
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
    }
  }
}
