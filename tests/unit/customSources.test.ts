import {describe, expect, it} from "vitest";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {join} from "node:path";
import {
  BUILT_IN_REASON,
  CHAIN_IDS,
  MAINNET_CHAIN_ID,
  customSourcesStorageKey,
  queryParameter,
  REQUIRED_RPCS,
  aclConfigSnippet,
  aclRuleMatches,
  classifyErrorMessage,
  classifyFetchError,
  customSourceName,
  diagnose,
  isCustomSource,
  normalizeRpcUrl,
  probeSource,
  readStoredUrls,
  resolveCustomSources,
  rpcQueryValues,
  writeStoredUrls,
  type RpcFailure,
} from "../../src/rpc/customSources";

describe("custom source URL validation", () => {
  it.each([
    ["https://node.example.org:8732", "https://node.example.org:8732"],
    ["https://node.example.org:8732/", "https://node.example.org:8732"],
    ["  http://10.0.0.5:8732///  ", "http://10.0.0.5:8732"],
    ["https://Proxy.Example.org/mainnet/", "https://proxy.example.org/mainnet"],
    ["https://node.example.org:443/", "https://node.example.org"],
    ["HTTP://[::1]:8732", "http://[::1]:8732"],
  ])("accepts %s as %s", (input, url) => {
    expect(normalizeRpcUrl(input)).toEqual({ok: true, url});
  });
  it.each([
    ["", /Enter a node RPC URL/],
    ["node.example.org:8732", /include the scheme/],
    ["ftp://node.example.org", /Only http/],
    ["javascript:alert(1)", /Only http/],
    ["ws://node.example.org:8732", /Only http/],
    ["https://user:secret@node.example.org", /Credentials/],
    ["https://user@node.example.org", /Credentials/],
    ["https://node.example.org/?x=1", /query string/],
    ["https://node.example.org/#top", /query string or fragment/],
    ["https://node.example.org/?", /query string/],
    ["http://", /not a valid URL|no host/],
  ])("refuses %j", (input, reason) => {
    const result = normalizeRpcUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });
  it("reads repeated and comma-separated values from each network's own parameters", () => {
    const search = "?rpc=https://a:8732&rpc=https://b, https://c/&other=1&rpc=&rpc_mainnet=https://m&rpc_shadownet=https://s1,https://s2";
    expect(rpcQueryValues(search, "mainnet")).toEqual(["https://a:8732", "https://b", "https://c/", "https://m"]);
    expect(rpcQueryValues(search, "shadownet")).toEqual(["https://s1", "https://s2"]);
    expect(rpcQueryValues("", "mainnet")).toEqual([]);
    expect([queryParameter("mainnet"), queryParameter("shadownet")]).toEqual(["rpc", "rpc_shadownet"]);
  });
  it("orders query then stored sources, dedupes and reports built-ins as rejected", () => {
    const set = resolveCustomSources("mainnet", {query: ["https://q.example:8732", "https://bad@q.example", "https://mainnet.smartpy.io/"], stored: ["https://q.example:8732/", "http://stored.example:8732"]}, ["https://mainnet.smartpy.io"]);
    expect(set.sources.map(source => [source.baseUrl, source.custom])).toEqual([["https://q.example:8732", "query"], ["http://stored.example:8732", "stored"]]);
    expect(set.sources.every(source => source.network === "mainnet" && isCustomSource(source))).toBe(true);
    expect(set.sources[0]?.name).toBe(customSourceName("https://q.example:8732"));
    expect(set.sources[0]?.name).toBe("Custom · q.example:8732");
    expect(set.rejected).toEqual([expect.objectContaining({input: "https://bad@q.example", origin: "query"}), {input: "https://mainnet.smartpy.io/", origin: "query", reason: BUILT_IN_REASON}]);
    expect(set.builtIn).toEqual(["https://mainnet.smartpy.io"]);
    expect(isCustomSource({network: "mainnet", name: "SmartPy", baseUrl: "https://mainnet.smartpy.io"})).toBe(false);
    expect(resolveCustomSources("shadownet", {query: ["https://s.example"], stored: []}, []).sources[0]?.network).toBe("shadownet");
  });
  it("keeps one storage key per network and survives missing, malformed and throwing storage", () => {
    expect(customSourcesStorageKey("mainnet")).toBe("observatory:mainnet:custom-rpc");
    expect(customSourcesStorageKey("shadownet")).toBe("observatory:shadownet:custom-rpc");
    const keys: string[] = [];
    readStoredUrls({getItem: key => {keys.push(key); return null;}}, "shadownet");
    expect(keys).toEqual(["observatory:shadownet:custom-rpc"]);
    expect(readStoredUrls(undefined, "mainnet")).toEqual([]);
    expect(readStoredUrls({getItem: () => "{not json"}, "mainnet")).toEqual([]);
    expect(readStoredUrls({getItem: () => JSON.stringify(["https://a", 3, null])}, "mainnet")).toEqual(["https://a"]);
    expect(readStoredUrls({getItem: () => {throw new Error("SecurityError");}}, "mainnet")).toEqual([]);
    expect(writeStoredUrls({setItem: () => {throw new Error("QuotaExceededError");}}, "mainnet", ["https://a"])).toBe(false);
    let saved = "";
    expect(writeStoredUrls({setItem: (_key, value) => {saved = value;}}, "mainnet", ["https://a", "https://a", "https://b"])).toBe(true);
    expect(JSON.parse(saved)).toEqual(["https://a", "https://b"]);
  });
});

describe("failure classification", () => {
  it("maps fetch rejections", () => {
    expect(classifyFetchError(new TypeError("Failed to fetch"))).toEqual({kind: "network", message: "Failed to fetch"});
    expect(classifyFetchError(new DOMException("signal timed out", "TimeoutError"))).toEqual({kind: "timeout"});
    expect(classifyFetchError(new DOMException("aborted", "AbortError"))).toEqual({kind: "timeout"});
    expect(classifyFetchError(new SyntaxError("Unexpected token <"))).toEqual({kind: "not-json"});
  });
  it.each<[string, RpcFailure | undefined]>([
    ["HTTP 403", {kind: "http", status: 403}],
    ["Octez public: HTTP 404", {kind: "http", status: 404}],
    ["Failed to fetch", {kind: "network", message: "Failed to fetch"}],
    ["NetworkError when attempting to fetch resource.", {kind: "network", message: "NetworkError when attempting to fetch resource."}],
    ["Load failed", {kind: "network", message: "Load failed"}],
    ["RPC stream closed", {kind: "stream-closed"}],
    ["signal timed out", {kind: "timeout"}],
    ["RPC returned an invalid number", undefined],
  ])("classifies %j", (message, failure) => {
    expect(classifyErrorMessage(message)).toEqual(failure);
  });
});

describe("diagnostics text", () => {
  const https = {sourceUrl: "https://node.example.org:8732", path: "/monitor/heads/main", pageOrigin: "https://observatory.example"};
  it("says a network failure can be unreachable, firewalled, not listening publicly or CORS, with checks and flags", () => {
    const diagnosis = diagnose({kind: "network", message: "Failed to fetch"}, https);
    expect(diagnosis.class).toBe("unreachable-or-cors");
    const text = [diagnosis.summary, ...diagnosis.checks, ...diagnosis.fixes].join("\n");
    expect(diagnosis.summary).toMatch(/cannot tell/);
    expect(text).toContain("curl -sS --max-time 5 https://node.example.org:8732/chains/main/chain_id");
    expect(text).toContain("-H 'Origin: https://observatory.example'");
    expect(text).toMatch(/Connection refused.*--rpc-addr/s);
    expect(text).toMatch(/firewall/);
    expect(text).toContain("--rpc-addr <public-address>:8732");
    expect(text).toContain("--cors-origin 'https://observatory.example' (or '*') --cors-header 'Content-Type'");
    expect(text).toMatch(/certificate/);
  });
  it("identifies mixed content for an http node on an https page, except loopback", () => {
    const mixed = diagnose({kind: "network", message: "Failed to fetch"}, {...https, sourceUrl: "http://203.0.113.7:8732"});
    expect(mixed.class).toBe("mixed-content");
    expect(mixed.fixes.join("\n")).toContain("--rpc-tls <cert.pem>,<key.pem>");
    expect(mixed.fixes.join("\n")).toMatch(/reverse proxy/);
    expect(diagnose({kind: "network", message: "x"}, {...https, sourceUrl: "http://127.0.0.1:8732"}).class).toBe("unreachable-or-cors");
    expect(diagnose({kind: "network", message: "x"}, {...https, sourceUrl: "http://localhost:8732"}).class).toBe("unreachable-or-cors");
    expect(diagnose({kind: "network", message: "x"}, {...https, pageOrigin: "http://127.0.0.1:5173", sourceUrl: "http://203.0.113.7:8732"}).class).toBe("unreachable-or-cors");
  });
  it("flags a private-network node seen from a public page", () => {
    const text = diagnose({kind: "network", message: "x"}, {...https, sourceUrl: "https://192.168.1.20:8732"}).checks.join("\n");
    expect(text).toMatch(/private network/);
  });
  it("explains HTTP 403 as the node ACL with --allow-all-rpc and the exact missing paths", () => {
    const diagnosis = diagnose({kind: "http", status: 403}, {...https, path: "/chains/main/mempool/monitor_operations?validated=true&version=1"});
    expect(diagnosis.class).toBe("acl");
    expect(diagnosis.title).toBe("HTTP 403: the node's RPC ACL refuses /chains/main/mempool/monitor_operations");
    const fixes = diagnosis.fixes.join("\n");
    expect(fixes).toContain("--allow-all-rpc <public-address>:8732");
    for (const rule of ["GET /monitor/heads/*", "GET /chains/*/mempool/monitor_operations", "GET /monitor/validated_blocks", "GET /chains/*/blocks/*/helpers/attestation_rights", "GET /chains/*/blocks/*/helpers/baking_rights"])
      expect(fixes).toContain(rule);
  });
  it.each([404, 405])("explains HTTP %i as an unexposed endpoint or wrong prefix", status => {
    const diagnosis = diagnose({kind: "http", status}, https);
    expect(diagnosis.class).toBe("not-exposed");
    expect(diagnosis.checks.join("\n")).toMatch(/prefix/);
  });
  it("explains other HTTP statuses, wrong chain, non-JSON, timeouts and closed streams", () => {
    expect(diagnose({kind: "http", status: 401}, https).summary).toMatch(/authentication/);
    expect(diagnose({kind: "http", status: 502}, https).class).toBe("http");
    const chain = diagnose({kind: "wrong-chain", chainId: "NetXsqzbfFenSTS"}, https);
    expect([chain.class, chain.title]).toEqual(["wrong-network", "Wrong chain: NetXsqzbfFenSTS is not Tezos mainnet"]);
    expect(chain.summary).toContain(MAINNET_CHAIN_ID);
    expect(chain.summary).toContain("add it to the Shadownet panel instead");
    const shadow = diagnose({kind: "wrong-chain", chainId: MAINNET_CHAIN_ID}, {...https, network: "shadownet"});
    expect(shadow.title).toBe("Wrong chain: NetXdQprcVkpaWU is not Tezos shadownet");
    expect(shadow.summary).toContain(CHAIN_IDS.shadownet);
    expect(shadow.summary).toContain("add it to the Mainnet panel instead");
    expect(shadow.fixes).toEqual(["Use a node started with --network shadownet."]);
    expect(diagnose({kind: "not-json"}, https).class).toBe("not-octez");
    expect(diagnose({kind: "timeout"}, https).class).toBe("timeout");
    expect(diagnose({kind: "stream-closed"}, https).fixes.join()).toMatch(/proxy_buffering off/);
  });
});

describe("RPC paths and ACL", () => {
  it("matches Octez ACL patterns segment by segment", () => {
    expect(aclRuleMatches("GET /monitor/heads/*", "GET", "/monitor/heads/main")).toBe(true);
    expect(aclRuleMatches("GET /monitor/heads/*", "GET", "/monitor/heads")).toBe(false);
    expect(aclRuleMatches("GET /monitor/validated_blocks", "GET", "/monitor/validated_blocks?chain=main")).toBe(true);
    expect(aclRuleMatches("GET /chains/*/blocks/*/context/delegates/*/**", "GET", "/chains/main/blocks/X/context/delegates/tz1/is_forbidden")).toBe(true);
    expect(aclRuleMatches("GET /chains/*/blocks/*/header", "POST", "/chains/main/blocks/head/header")).toBe(false);
    expect(aclRuleMatches("GET /chains/*/blocks/*/header", "GET", "/chains/main/blocks/head/header/shell")).toBe(false);
  });
  /** Node RPC path literals in src/: quoted ("/chains/…", base + "/network/…") or after a leading `${base}` in a template. */
  const nodePathLiterals = (text: string): string[] => {
    const roots = "chains|monitor|version|network|injection|protocols|workers|stats|config|describe|errors|private|fetch_protocol";
    const joined = text.replace(/`\s*\+\s*`/g, "");
    return [
      ...[...joined.matchAll(new RegExp(`["'\`](\\/(?:${roots})(?:[/?][^"'\`]*)?)["'\`]`, "g"))].map(match => match[1]!),
      ...[...joined.matchAll(new RegExp(`\`\\$\\{[^}]*\\}(\\/(?:${roots})(?:[/?][^\`]*)?)\``, "g"))].map(match => match[1]!),
    ].map(path => path.replace(/\$\{[^}]*\}/g, "X"));
  };
  it("finds node paths however the URL string is built", () => {
    expect(nodePathLiterals("fetch(`${base}/chains/main/blocks/${hash}/header`)")).toEqual(["/chains/main/blocks/X/header"]);
    expect(nodePathLiterals('fetch(base + "/network/peers")')).toEqual(["/network/peers"]);
    expect(nodePathLiterals("request(`/chains/main/` + `mempool/x`)")).toEqual(["/chains/main/mempool/x"]);
    expect(nodePathLiterals('fetch(`${tzkt}/v1/delegates`); url.endsWith("/header")')).toEqual([]);
  });
  it("covers every RPC path the production source sends", () => {
    const files: string[] = [];
    // Baker tracking reads fixed public endpoints only (src/rpc/bakerTracking.ts), never a custom source.
    const walk = (dir: string): void => {for (const name of readdirSync(dir)) {const path = join(dir, name); if (statSync(path).isDirectory()) {if (name !== "fixtures") walk(path);} else if (path.endsWith(".ts") && name !== "bakerTracking.ts") files.push(path);}};
    walk(join(__dirname, "../../src"));
    const paths = new Set<string>();
    for (const file of files) for (const path of nodePathLiterals(readFileSync(file, "utf8"))) paths.add(path);
    expect(paths.size).toBeGreaterThan(10);
    const uncovered = [...paths].filter(path => !REQUIRED_RPCS.some(rpc => aclRuleMatches(rpc.rule, "GET", path)));
    expect(uncovered).toEqual([]);
  });
  it("emits a whitelist config for one listening address", () => {
    const config = JSON.parse(aclConfigSnippet("203.0.113.7:8732")) as {rpc: {"listen-addrs": string[]; "cors-origin": string[]; "cors-headers": string[]; acl: {address: string; whitelist: string[]}[]}};
    expect(config.rpc["listen-addrs"]).toEqual(["203.0.113.7:8732"]);
    expect(config.rpc["cors-headers"]).toEqual(["Content-Type"]);
    expect(config.rpc.acl).toEqual([{address: "203.0.113.7:8732", whitelist: REQUIRED_RPCS.map(rpc => rpc.rule)}]);
  });
});

describe("probe", () => {
  const header = {chain_id: MAINNET_CHAIN_ID, level: 1, hash: "B"};
  const version = {version: {major: 24, minor: 1, additional_info: "release"}, network_version: {chain_name: "TEZOS_MAINNET_2018-06-30T16:07:32Z"}};
  const stream = (chunks: string[]): Response => new Response(new ReadableStream<Uint8Array>({start(controller) {for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));}}));
  const fetcher = (routes: Record<string, () => Response | Promise<Response>>): typeof fetch => (async (input: RequestInfo | URL) => {
    const url = String(input), route = Object.entries(routes).find(([path]) => url.endsWith(path));
    if (!route) throw new TypeError("Failed to fetch");
    return route[1]();
  }) as typeof fetch;
  it("accepts a mainnet node whose head stream delivers", async () => {
    const outcome = await probeSource("https://n", {fetch: fetcher({"/version": () => Response.json(version), "/header": () => Response.json(header), "/monitor/heads/main": () => stream(['{"hash":"B"}\n'])})});
    expect(outcome).toEqual({ok: true, chainId: MAINNET_CHAIN_ID, version: "Octez 24.1 · TEZOS_MAINNET_2018-06-30T16:07:32Z", stream: "value"});
  });
  it("reports where it failed and why", async () => {
    expect(await probeSource("https://n", {fetch: fetcher({})})).toEqual({ok: false, path: "/chains/main/blocks/head/header", failure: {kind: "network", message: "Failed to fetch"}});
    expect(await probeSource("https://n", {fetch: fetcher({"/header": () => new Response("<html>", {status: 200})})})).toEqual({ok: false, path: "/chains/main/blocks/head/header", failure: {kind: "not-json"}});
    expect(await probeSource("https://n", {fetch: fetcher({"/header": () => Response.json({...header, chain_id: "NetXsqzbfFenSTS"})})})).toEqual({ok: false, path: "/chains/main/blocks/head/header", failure: {kind: "wrong-chain", chainId: "NetXsqzbfFenSTS"}});
    expect(await probeSource("https://n", {fetch: fetcher({"/header": () => Response.json({level: 1})})})).toEqual({ok: false, path: "/chains/main/blocks/head/header", failure: {kind: "wrong-chain", chainId: undefined}});
    expect(await probeSource("https://n", {fetch: fetcher({"/version": () => Response.json(version), "/header": () => Response.json(header), "/monitor/heads/main": () => new Response("forbidden", {status: 403})})})).toEqual({ok: false, path: "/monitor/heads/main", failure: {kind: "http", status: 403}});
    expect(await probeSource("https://n", {fetch: fetcher({"/version": () => Response.json(version), "/header": () => Response.json(header), "/monitor/heads/main": () => stream([])}), streamMs: 50})).toEqual({ok: true, chainId: MAINNET_CHAIN_ID, version: expect.any(String), stream: "open-no-data"});
  });
  it("treats /version as optional: a proxy may not forward it or add CORS to its 404", async () => {
    const routes = {"/version": () => Response.json({error: "not found"}, {status: 404}), "/header": () => Response.json(header), "/monitor/heads/main": () => stream(['{"hash":"B"}\n'])};
    expect(await probeSource("https://n", {fetch: fetcher(routes)})).toEqual({ok: true, chainId: MAINNET_CHAIN_ID, version: "version unavailable (/version not exposed)", stream: "value"});
    const {"/version": _dropped, ...noVersion} = routes;
    expect(await probeSource("https://n", {fetch: fetcher(noVersion)})).toMatchObject({ok: true, version: "version unavailable (/version not exposed)"});
  });
  it("checks the expected chain per network", async () => {
    const routes = {"/version": () => Response.json(version), "/header": () => Response.json({...header, chain_id: CHAIN_IDS.shadownet}), "/monitor/heads/main": () => stream(['{"hash":"B"}\n'])};
    expect(await probeSource("https://n", {fetch: fetcher(routes), expectedChainId: CHAIN_IDS.shadownet})).toMatchObject({ok: true, chainId: CHAIN_IDS.shadownet});
    expect(await probeSource("https://n", {fetch: fetcher(routes)})).toMatchObject({ok: false, failure: {kind: "wrong-chain", chainId: CHAIN_IDS.shadownet}});
  });
  it("reports a stream that ends at once as closed", async () => {
    const closed = new Response(new ReadableStream<Uint8Array>({start(controller) {controller.close();}}));
    expect(await probeSource("https://n", {fetch: fetcher({"/version": () => Response.json(version), "/header": () => Response.json(header), "/monitor/heads/main": () => closed})})).toEqual({ok: false, path: "/monitor/heads/main", failure: {kind: "stream-closed"}});
  });
});
