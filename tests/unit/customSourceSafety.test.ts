import {afterEach, describe, expect, it, vi} from "vitest";
import type {BlockHeader, ObservationEvidence, RpcSource} from "../../src/rpc/models";
import {
  CHAIN_IDS,
  MAX_CUSTOM_SOURCES,
  MAX_RPC_URL_LENGTH,
  classifyErrorMessage,
  classifyFetchError,
  diagnose,
  displayText,
  normalizeRpcUrl,
  probeSource,
  resolveCustomSources,
  unusableFailure,
} from "../../src/rpc/customSources";
import {BodyTooLargeError, PROBE_BODY_LIMIT, RPC_BODY_LIMIT, readJsonWithin} from "../../src/rpc/boundedBody";
import {SourceExclusions} from "../../src/rpc/sourceExclusion";
import {StreamTransport} from "../../src/rpc/streamTransport";

afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules();});

/** Loads networkData/observationStore as a page opened with `search` would. */
async function pageModules(search: string, stored: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubGlobal("location", {search});
  vi.stubGlobal("localStorage", {getItem: (key: string) => stored[key] ?? null, setItem: () => undefined});
  const data = await import("../../src/rpc/networkData");
  const store = await import("../../src/monitor/observationStore");
  return {...data, ...store};
}

describe("custom sources come first and built-ins are reported, not dropped", () => {
  it("orders custom sources before built-ins in sources, streamSources and rawStreamSources (once each)", async () => {
    const {sources, streamSources, rawStreamSources} = await pageModules("?rpc=https://c1.example,https://c2.example&rpc_shadownet=https://s.example", {"observatory:mainnet:custom-rpc": JSON.stringify(["https://stored.example"])});
    const custom = ["https://c1.example", "https://c2.example", "https://stored.example"];
    expect(sources.mainnet.slice(0, 3).map(source => source.baseUrl)).toEqual(custom);
    expect(streamSources.mainnet.slice(0, 3).map(source => source.baseUrl)).toEqual(custom);
    expect(rawStreamSources.mainnet.slice(0, 3).map(source => source.baseUrl)).toEqual(custom);
    for (const url of custom) expect(rawStreamSources.mainnet.filter(source => source.baseUrl === url)).toHaveLength(1);
    expect(rawStreamSources.mainnet.length).toBeGreaterThan(3);
    expect(sources.shadownet[0]?.baseUrl).toBe("https://s.example");
    expect(rawStreamSources.shadownet[0]?.baseUrl).toBe("https://s.example");
    expect(sources.shadownet.length).toBeGreaterThan(1);
  });
  it("reports every built-in provider given as a custom URL as rejected, from one shared list", async () => {
    const {streamSources, customSources} = await pageModules("");
    for (const network of ["mainnet", "shadownet"] as const) {
      const builtIns = streamSources[network].map(source => source.baseUrl);
      expect(builtIns.length).toBeGreaterThan(0);
      expect(customSources[network].builtIn).toEqual(builtIns);
      const set = resolveCustomSources(network, {query: builtIns.map(url => `${url}/`), stored: []}, customSources[network].builtIn);
      expect(set.sources).toEqual([]);
      expect(set.rejected.map(item => item.reason)).toEqual(builtIns.map(() => "Already a built-in provider: it is used without being added."));
    }
    const {customSources: page} = await pageModules("?rpc=https://rpc.tzkt.io/mainnet/");
    expect(page.mainnet.rejected).toEqual([{input: "https://rpc.tzkt.io/mainnet/", origin: "query", reason: "Already a built-in provider: it is used without being added."}]);
  });
});

describe("H1: chain identity is pinned for custom sources", () => {
  const head = (level: number): BlockHeader => ({chainId: "NetFixture", level, hash: `H${level}`, predecessor: `H${level - 1}`, timestamp: "2026-01-01T00:00:00Z", fitness: ["02", level.toString(16).padStart(8, "0"), "", "ffffffff", "00000000"]});
  const evidence = (source: RpcSource, at = 1): ObservationEvidence => ({source, receivedAt: at, receivedMonotonic: at});
  const operation = (hash: string, source: RpcSource) => ({hash, evidence: evidence(source), contents: [{kind: "preattestation" as const, level: 123, round: 0, slot: 0, block_payload_hash: "P"}]});
  /** Built-ins serve the e2e fixture chain; each custom host serves its own chain. */
  const installRpc = (chains: Record<string, string>) => vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input)), level = Number(url.searchParams.get("level")), chain = chains[url.origin] ?? "NetFixture", current = head(122);
    if (url.pathname.endsWith("/header")) {const hash = url.pathname.split("/blocks/")[1]?.split("/")[0]; const observed = hash === "head" || hash === current.hash ? current : {...head(121), hash: current.predecessor}; return Response.json({...observed, chain_id: chain});}
    if (url.pathname.endsWith("/protocols")) return Response.json({protocol: "PFixture", next_protocol: "PFixture"});
    return Response.json(url.pathname.includes("attestation_rights") ? [{level, delegates: [{delegate: "D1", first_slot: 0, attesting_power: 3}, {delegate: "D2", first_slot: 1, attesting_power: 2}]}] : {minimal_block_delay: "6", delay_increment_per_round: "3", consensus_threshold_size: 4, consensus_committee_size: 5});
  });
  it("a wrong-chain custom source cannot establish the identity; the built-in then does and the custom data stays refused", async () => {
    const {ObservationStore, NetworkData, sources} = await pageModules("?rpc=https://ghost.example");
    installRpc({"https://ghost.example": CHAIN_IDS.shadownet});
    const custom = sources.mainnet[0]!, builtIn = sources.mainnet[1]!;
    expect(custom.baseUrl).toBe("https://ghost.example");
    const store = new ObservationStore("mainnet", sources.mainnet), data = new NetworkData("mainnet"), signal = new AbortController().signal;
    const ghost = store.addOperations([operation("ghost", custom)])[0]!;
    store.accept(await data.reconcile(ghost.target, signal));
    expect(store.networkIdentity()).toBeUndefined();
    expect(store.target(ghost.identity)?.admission).toBeUndefined();
    const genuine = store.addOperations([operation("genuine", builtIn)])[0]!;
    store.accept(await data.reconcile(genuine.target, signal));
    expect(store.networkIdentity()?.source.baseUrl).toBe(builtIn.baseUrl);
    expect(store.target(genuine.identity)?.admission).toBeDefined();
    expect(store.target(ghost.identity)?.admission).toBeUndefined();
    expect(store.target(ghost.identity)?.error).toMatch(/contradicts expected network identity/);
  });
  it("a custom source whose chain equals the built-ins' but not the network's chain is never authorized", async () => {
    const {ObservationStore, NetworkData, sources} = await pageModules("?rpc=https://fixture-chain.example");
    installRpc({});
    const custom = sources.mainnet[0]!, builtIn = sources.mainnet[1]!;
    const store = new ObservationStore("mainnet", sources.mainnet), data = new NetworkData("mainnet"), signal = new AbortController().signal;
    const genuine = store.addOperations([operation("genuine", builtIn)])[0]!;
    store.accept(await data.reconcile(genuine.target, signal));
    expect(store.networkIdentity()?.chainId).toBe("NetFixture");
    const lookalike = store.addOperations([operation("lookalike", custom)])[0]!;
    const proof = await data.reconcile(lookalike.target, signal);
    store.accept(proof);
    expect(store.target(lookalike.identity)?.admission).toBeUndefined();
    expect(store.contextAuthorized(proof.context)).toBe(false);
    expect(store.establishNetworkIdentity(proof.context.observer)).toBe(false);
  });
  it("a custom source on the network's own chain may establish the identity", async () => {
    const {ObservationStore, NetworkData, sources} = await pageModules("?rpc=https://mine.example");
    installRpc({"https://mine.example": CHAIN_IDS.mainnet});
    const store = new ObservationStore("mainnet", sources.mainnet), data = new NetworkData("mainnet");
    const mine = store.addOperations([operation("mine", sources.mainnet[0]!)])[0]!;
    store.accept(await data.reconcile(mine.target, new AbortController().signal));
    expect(store.networkIdentity()?.chainId).toBe(CHAIN_IDS.mainnet);
    expect(store.target(mine.identity)?.admission).toBeDefined();
  });
});

describe("H1: sources excluded after a failed startup probe", () => {
  const custom = {network: "mainnet", name: "Custom · ghost.example", baseUrl: "https://ghost.example", custom: "query"} as const;
  const builtIn: RpcSource = {network: "mainnet", name: "SmartPy", baseUrl: "https://mainnet.smartpy.io"};
  it("excludes only sources proven unusable, not transient failures", () => {
    expect([{kind: "wrong-chain", chainId: "NetX"}, {kind: "not-json"}, {kind: "too-large", limit: 1}].every(failure => unusableFailure(failure as never))).toBe(true);
    expect([{kind: "network", message: "x"}, {kind: "timeout"}, {kind: "http", status: 403}, {kind: "stream-closed"}, {kind: "stream-idle"}].some(failure => unusableFailure(failure as never))).toBe(false);
  });
  it("keys exclusions by network and notifies subscribers once", () => {
    const exclusions = new SourceExclusions(), seen: string[] = [];
    const stop = exclusions.subscribe(source => seen.push(`${source.network} ${source.baseUrl}`));
    exclusions.exclude(custom); exclusions.exclude(custom);
    expect(exclusions.has(custom)).toBe(true);
    expect(exclusions.has({...custom, network: "shadownet"})).toBe(false);
    expect(exclusions.has(builtIn)).toBe(false);
    stop(); exclusions.exclude({...custom, baseUrl: "https://other.example"});
    expect(seen).toEqual(["mainnet https://ghost.example"]);
  });
  it("a stream skips an excluded source and leaves one that becomes excluded at once", async () => {
    vi.useFakeTimers(); vi.stubGlobal("window", globalThis);
    const calls: string[] = [], exclusions = new SourceExclusions();
    const fetchStub = (async (url: string, init?: RequestInit) => {calls.push(url); return new Response(new ReadableStream<Uint8Array>({start(controller) {init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));}}));}) as unknown as typeof fetch;
    const transport = new StreamTransport({sources: [custom, builtIn], path: "/monitor/heads/main", parse: value => value, onValue: () => undefined, onStatus: () => undefined, fetch: fetchStub, exclusions});
    transport.start(); await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["https://ghost.example/monitor/heads/main"]);
    exclusions.exclude(custom); await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["https://ghost.example/monitor/heads/main", "https://mainnet.smartpy.io/monitor/heads/main"]);
    transport.stop();
    const later = new StreamTransport({sources: [custom, builtIn], path: "/monitor/heads/main", parse: value => value, onValue: () => undefined, onStatus: () => undefined, fetch: fetchStub, exclusions});
    later.start(); await vi.advanceTimersByTimeAsync(0);
    expect(calls.at(-1)).toBe("https://mainnet.smartpy.io/monitor/heads/main");
    later.stop();
  });
  it("NetworkData reads skip an excluded custom source", async () => {
    const {NetworkData, sources, sourceExclusions} = {...await pageModules("?rpc=https://ghost.example"), ...await import("../../src/rpc/sourceExclusion")};
    const reads: string[] = [];
    vi.stubGlobal("fetch", async (input: string) => {reads.push(new URL(input).origin); return Response.json({minimal_block_delay: "6"});});
    const data = new NetworkData("mainnet");
    await data.request("/chains/main/blocks/head/context/constants");
    expect(reads).toEqual(["https://ghost.example"]);
    sourceExclusions.exclude(sources.mainnet[0]!);
    await data.request("/chains/main/blocks/head/context/constants");
    expect(reads.at(-1)).toBe(new URL(sources.mainnet[1]!.baseUrl).origin);
  });
});

describe("M1: idle deadline for custom streams", () => {
  const custom = {network: "mainnet", name: "Custom · quiet.example", baseUrl: "https://quiet.example", custom: "query"} as const;
  const builtIn: RpcSource = {network: "mainnet", name: "SmartPy", baseUrl: "https://mainnet.smartpy.io"};
  const silent = (calls: string[], controllers: ReadableStreamDefaultController<Uint8Array>[] = []) => (async (url: string, init?: RequestInit) => {
    calls.push(url);
    return new Response(new ReadableStream<Uint8Array>({start(controller) {controllers.push(controller); init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));}}));
  }) as unknown as typeof fetch;
  it("fails over from a source that sends nothing before the deadline, with a classifiable error", async () => {
    vi.useFakeTimers(); vi.stubGlobal("window", globalThis);
    const calls: string[] = [], errors: (string | null)[] = [];
    const transport = new StreamTransport({sources: [custom, builtIn], path: "/monitor/heads/main", parse: value => value, onValue: () => undefined, onStatus: (source, error) => {if (source?.baseUrl === custom.baseUrl && error) errors.push(error);}, fetch: silent(calls), idleTimeoutMs: source => source === custom ? 60_000 : undefined});
    transport.start();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(errors).toEqual(["RPC stream idle: no message within 60 s"]);
    expect(classifyErrorMessage(errors[0]!)).toEqual({kind: "stream-idle"});
    expect(diagnose({kind: "stream-idle"}, {sourceUrl: "https://quiet.example", path: "/monitor/heads/main", pageOrigin: "https://o.example"}).class).toBe("stream");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(calls).toEqual(["https://quiet.example/monitor/heads/main", "https://mainnet.smartpy.io/monitor/heads/main"]);
    // Built-ins keep the previous behaviour: no deadline.
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(calls).toHaveLength(2);
    transport.stop();
  });
  it("resets the deadline on every message", async () => {
    vi.useFakeTimers(); vi.stubGlobal("window", globalThis);
    const calls: string[] = [], controllers: ReadableStreamDefaultController<Uint8Array>[] = [], values: unknown[] = [];
    const transport = new StreamTransport({sources: [custom, builtIn], path: "/monitor/heads/main", parse: value => value, onValue: value => values.push(value), onStatus: () => undefined, fetch: silent(calls, controllers), idleTimeoutMs: () => 60_000});
    transport.start();
    for (let index = 0; index < 5; index++) {await vi.advanceTimersByTimeAsync(50_000); controllers[0]?.enqueue(new TextEncoder().encode(`{"n":${index}}\n`));}
    await vi.advanceTimersByTimeAsync(0);
    expect(values).toHaveLength(5);
    expect(calls).toHaveLength(1);
    transport.stop();
  });
});

describe("M2: bounded number and length of custom sources", () => {
  it("keeps at most MAX_CUSTOM_SOURCES per network and reports the rest", () => {
    const urls = Array.from({length: MAX_CUSTOM_SOURCES + 3}, (_, index) => `https://n${index}.example`);
    const set = resolveCustomSources("mainnet", {query: urls.slice(0, 3), stored: urls.slice(3)}, []);
    expect(MAX_CUSTOM_SOURCES).toBe(4);
    expect(set.sources.map(source => source.baseUrl)).toEqual(urls.slice(0, 4));
    expect(set.rejected.map(item => [item.input, item.origin])).toEqual(urls.slice(4).map(url => [url, "stored"]));
    expect(set.rejected[0]?.reason).toMatch(/at most 4 custom sources per network/);
  });
  it("bounds the rejected list a crafted link can produce", () => {
    const set = resolveCustomSources("mainnet", {query: Array.from({length: 500}, (_, index) => `https://h${index}.victim.example`), stored: []}, []);
    expect(set.sources).toHaveLength(4);
    expect(set.rejected.length).toBeLessThanOrEqual(17);
    expect(set.rejected.at(-1)?.reason).toMatch(/480 more values ignored/);
  });
  it("refuses URLs longer than MAX_RPC_URL_LENGTH", () => {
    expect(MAX_RPC_URL_LENGTH).toBe(2048);
    const long = `https://n.example/${"p".repeat(MAX_RPC_URL_LENGTH)}`;
    const checked = normalizeRpcUrl(long);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {expect(checked.reason).toMatch(/longer than 2048 characters/); expect(checked.reason.length).toBeLessThan(200);}
    expect(normalizeRpcUrl(`https://n.example/${"p".repeat(MAX_RPC_URL_LENGTH - 40)}`).ok).toBe(true);
  });
});

describe("M3: bounded response bodies", () => {
  const big = (bytes: number, headers: Record<string, string> = {}) => new Response(new ReadableStream<Uint8Array>({start(controller) {for (let sent = 0; sent < bytes; sent += 65_536) controller.enqueue(new Uint8Array(Math.min(65_536, bytes - sent)).fill(32)); controller.enqueue(new TextEncoder().encode("1")); controller.close();}}), {headers});
  it("parses a body within the cap", async () => {
    expect(await readJsonWithin(Response.json({a: 1}), 100)).toEqual({a: 1});
    await expect(readJsonWithin(new Response("<html>"), 100)).rejects.toBeInstanceOf(SyntaxError);
  });
  it("rejects early on a declared Content-Length above the cap without reading", async () => {
    let pulled = 0;
    const response = new Response(new ReadableStream<Uint8Array>({pull(controller) {pulled++; if (pulled > 1000) controller.close(); else controller.enqueue(new Uint8Array(10).fill(32));}}), {headers: {"content-length": "1000"}});
    await expect(readJsonWithin(response, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled).toBeLessThanOrEqual(1);
  });
  it("stops reading once the cap is passed when no length is declared", async () => {
    let pulled = 0;
    // 2 MiB of whitespace: a reader without a cap would pull all of it.
    const endless = new Response(new ReadableStream<Uint8Array>({pull(controller) {pulled++; if (pulled > 2048) controller.close(); else controller.enqueue(new Uint8Array(1024).fill(32));}}));
    const error = await readJsonWithin(endless, 10_000).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BodyTooLargeError);
    expect((error as Error).message).toBe("RPC response too large: over 10000 bytes");
    expect(pulled).toBeLessThan(15);
    expect(await readJsonWithin(big(9_000), 10_000)).toBe(1);
  });
  it("classifies an oversized body as its own diagnosable failure", () => {
    expect(classifyFetchError(new BodyTooLargeError(PROBE_BODY_LIMIT))).toEqual({kind: "too-large", limit: PROBE_BODY_LIMIT});
    expect(classifyErrorMessage(`Custom · x: RPC response too large: over ${RPC_BODY_LIMIT} bytes`)).toEqual({kind: "too-large", limit: RPC_BODY_LIMIT});
    const diagnosis = diagnose({kind: "too-large", limit: PROBE_BODY_LIMIT}, {sourceUrl: "https://n.example", path: "/version", pageOrigin: "https://o.example"});
    expect(diagnosis.class).toBe("oversized");
    expect(diagnosis.title).toBe("Response from n.example is larger than 1 MiB");
  });
  it("the probe refuses an oversized header or /version", async () => {
    const fetcher = (huge: string) => (async (input: string) => {
      const url = String(input);
      if (url.endsWith(huge)) return big(PROBE_BODY_LIMIT + 1);
      if (url.endsWith("/header")) return Response.json({chain_id: CHAIN_IDS.mainnet});
      if (url.endsWith("/version")) return Response.json({version: {major: 24, minor: 1}});
      return new Response(new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(new TextEncoder().encode("{}\n"));}}));
    }) as unknown as typeof fetch;
    expect(await probeSource("https://n", {fetch: fetcher("/header")})).toEqual({ok: false, path: "/chains/main/blocks/head/header", failure: {kind: "too-large", limit: PROBE_BODY_LIMIT}});
    expect(await probeSource("https://n", {fetch: fetcher("/version")})).toEqual({ok: false, path: "/version", failure: {kind: "too-large", limit: PROBE_BODY_LIMIT}});
  });
  it("NetworkData reads refuse a body above RPC_BODY_LIMIT", async () => {
    const {NetworkData} = await pageModules("");
    vi.stubGlobal("fetch", async () => new Response("[]", {headers: {"content-length": String(RPC_BODY_LIMIT + 1)}}));
    await expect(new NetworkData("mainnet").request("/chains/main/blocks/head/context/constants")).rejects.toThrow(/RPC response too large/);
  });
});

describe("L1: node-controlled text is bounded and sanitized", () => {
  it("strips control and bidi characters and truncates", () => {
    expect(displayText("a\u0000b\u001fc\u007fd\u009fe‎f‏g‪h‮i⁦j⁩k\nl")).toBe("abcdefghijkl");
    expect(displayText("x".repeat(500))).toBe(`${"x".repeat(119)}…`);
    expect(displayText("short", 3)).toBe("sh…");
  });
  it("bounds the chain_id in a wrong-chain title", () => {
    const title = diagnose({kind: "wrong-chain", chainId: `‮${"X".repeat(200_000)}`}, {sourceUrl: "https://n", path: "/h", pageOrigin: "https://o"}).title;
    expect(title.length).toBeLessThan(200);
    expect(title).not.toContain("‮");
  });
  it("keeps /version text from spoofing the probe line", async () => {
    const version = {version: {major: "24‮".repeat(100), minor: 1, additional_info: {dev: "x".repeat(10_000)}}, network_version: {chain_name: "TEZOS_MAINNET · official Tezos Foundation node"}};
    const outcome = await probeSource("https://n", {fetch: (async (input: string) => {
      const url = String(input);
      if (url.endsWith("/header")) return Response.json({chain_id: CHAIN_IDS.mainnet});
      if (url.endsWith("/version")) return Response.json(version);
      return new Response(new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(new TextEncoder().encode("{}\n"));}}));
    }) as unknown as typeof fetch});
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.version.length).toBeLessThanOrEqual(200);
    expect(outcome.version).not.toMatch(/[‪-‮]/);
    expect(outcome.version).toContain('chain_name "TEZOS_MAINNET · official Tezos Foundation node"');
    expect(outcome.version).not.toContain("· TEZOS_MAINNET ·");
  });
  it("bounds the echo of an unparsable URL in its reason", () => {
    const checked = normalizeRpcUrl(`https://[${"y".repeat(1000)}`);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason.length).toBeLessThan(200);
  });
});

describe("L2: trailing dot in the host", () => {
  it("normalizes h.example. to h.example and dedupes both", () => {
    expect(normalizeRpcUrl("https://h.example.:8732/")).toEqual({ok: true, url: "https://h.example:8732"});
    expect(resolveCustomSources("mainnet", {query: ["https://h.example."], stored: ["https://h.example"]}, []).sources).toHaveLength(1);
    expect(resolveCustomSources("mainnet", {query: ["https://mainnet.smartpy.io."], stored: []}, ["https://mainnet.smartpy.io"]).rejected).toHaveLength(1);
  });
});
