import type {RpcSource} from "./models";

type SourceKey = Pick<RpcSource, "network" | "baseUrl">;
const key = (source: SourceKey): string => JSON.stringify([source.network, source.baseUrl]);

/**
 * Custom sources whose startup probe proved them unusable for their network (wrong
 * chain, not JSON, oversized answers). Reads and monitor streams skip them; built-in
 * providers are never excluded, so a transport always keeps a usable source.
 */
export class SourceExclusions {
  private readonly excluded = new Set<string>();
  private readonly listeners = new Set<(source: SourceKey) => void>();
  exclude(source: SourceKey): void {
    if (this.excluded.has(key(source))) return;
    this.excluded.add(key(source));
    for (const listener of [...this.listeners]) listener(source);
  }
  has(source: SourceKey): boolean {return this.excluded.has(key(source));}
  /** Returns the unsubscribe function. */
  subscribe(listener: (source: SourceKey) => void): () => void {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  }
}

/** The page's registry, fed by the custom source panels' startup probes. */
export const sourceExclusions = new SourceExclusions();
