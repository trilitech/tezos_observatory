import type {NetworkName, RpcSource} from "./models";

/** Expected chain per network; a custom source on any other chain is refused. */
export const CHAIN_IDS: Readonly<Record<NetworkName, string>> = {mainnet: "NetXdQprcVkpaWU", shadownet: "NetXsqzbfFenSTS"};
export const MAINNET_CHAIN_ID = CHAIN_IDS.mainnet;
export const NETWORK_LABELS: Readonly<Record<NetworkName, string>> = {mainnet: "Mainnet", shadownet: "Shadownet"};
/** Browser storage key holding one network's saved custom source URLs. */
export const customSourcesStorageKey = (network: NetworkName): string => `observatory:${network}:custom-rpc`;
/** `?rpc=` (or `?rpc_mainnet=`) for mainnet, `?rpc_shadownet=` for shadownet. */
export const CUSTOM_SOURCES_QUERY_PARAMETERS: Readonly<Record<NetworkName, readonly string[]>> = {mainnet: ["rpc", "rpc_mainnet"], shadownet: ["rpc_shadownet"]};
export const queryParameter = (network: NetworkName): string => CUSTOM_SOURCES_QUERY_PARAMETERS[network][0]!;

/** Where a custom source came from: the page URL or browser storage. */
export type CustomOrigin = "query" | "stored";
export interface CustomSource extends RpcSource {
  readonly custom: CustomOrigin;
}
export type UrlCheck = {readonly ok: true; readonly url: string} | {readonly ok: false; readonly reason: string};

/** Accept only plain http(s) base URLs without credentials, query or fragment; strip trailing slashes. */
export function normalizeRpcUrl(input: string): UrlCheck {
  const text = input.trim();
  if (text === "") return {ok: false, reason: "Enter a node RPC URL such as https://node.example.org:8732."};
  if (!/^https?:\/\//i.test(text)) return {ok: false, reason: "Only http:// and https:// URLs are accepted; include the scheme, e.g. https://node.example.org:8732."};
  let url: URL;
  try {url = new URL(text);} catch {return {ok: false, reason: `"${text}" is not a valid URL.`};}
  if (url.protocol !== "http:" && url.protocol !== "https:") return {ok: false, reason: "Only http:// and https:// URLs are accepted."};
  if (url.username !== "" || url.password !== "")
    return {ok: false, reason: "Credentials in the URL (user:password@host) are refused: they would be stored in this browser and sent with every request. Put authentication in a reverse proxy instead."};
  if (url.hostname === "") return {ok: false, reason: "The URL has no host."};
  if (url.search !== "" || url.hash !== "" || /[?#]/.test(text))
    return {ok: false, reason: "Remove the query string or fragment: the Observatory appends RPC paths such as /version to this base URL."};
  const path = url.pathname.replace(/\/+$/, "");
  return {ok: true, url: `${url.protocol}//${url.host}${path}`};
}

/** `?rpc=a&rpc=b` and `?rpc=a,b` are both accepted; each network has its own parameter names. */
export function rpcQueryValues(search: string, network: NetworkName): string[] {
  const parameters = new URLSearchParams(search);
  return CUSTOM_SOURCES_QUERY_PARAMETERS[network].flatMap(name => parameters.getAll(name)).flatMap(value => value.split(",")).map(value => value.trim()).filter(value => value !== "");
}

export function readStoredUrls(storage: Pick<Storage, "getItem"> | undefined, network: NetworkName): string[] {
  try {
    const raw = storage?.getItem(customSourcesStorageKey(network));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {return [];}
}

/** Returns false when storage is unavailable (private mode, blocked site data). */
export function writeStoredUrls(storage: Pick<Storage, "setItem"> | undefined, network: NetworkName, urls: readonly string[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(customSourcesStorageKey(network), JSON.stringify([...new Set(urls)]));
    return true;
  } catch {return false;}
}

export const customSourceName = (url: string): string => `Custom · ${url.replace(/^https?:\/\//, "")}`;

export interface CustomSourceSet {
  readonly sources: readonly CustomSource[];
  readonly rejected: readonly {readonly input: string; readonly origin: CustomOrigin; readonly reason: string}[];
}

/** Query sources first (explicit for this view), then stored; built-ins are not duplicated. */
export function resolveCustomSources(network: NetworkName, inputs: {readonly query: readonly string[]; readonly stored: readonly string[]}, builtIn: readonly string[]): CustomSourceSet {
  const seen = new Set(builtIn), sources: CustomSource[] = [], rejected: {input: string; origin: CustomOrigin; reason: string}[] = [];
  const candidates: [string, CustomOrigin][] = [
    ...inputs.query.map(value => [value, "query"] as [string, CustomOrigin]),
    ...inputs.stored.map(value => [value, "stored"] as [string, CustomOrigin]),
  ];
  for (const [input, origin] of candidates) {
    const checked = normalizeRpcUrl(input);
    if (!checked.ok) {rejected.push({input, origin, reason: checked.reason}); continue;}
    if (seen.has(checked.url)) continue;
    seen.add(checked.url);
    sources.push(Object.freeze({network, name: customSourceName(checked.url), baseUrl: checked.url, custom: origin}));
  }
  return {sources, rejected};
}

export const isCustomSource = (source: RpcSource | null | undefined): source is CustomSource =>
  source !== null && source !== undefined && "custom" in source;

/* ---------- RPC paths and the node ACL ---------- */

export interface RequiredRpc {
  readonly rule: string;
  readonly purpose: string;
  /** Allowed by Octez's hard-coded `secure` ACL for non-loopback listening addresses. */
  readonly defaultAcl: boolean;
}
/** Every RPC the Observatory sends to a node, as Octez ACL matchers (src/lib_rpc_http/RPC_server.ml). */
export const REQUIRED_RPCS: readonly RequiredRpc[] = [
  {rule: "GET /version", purpose: "version label (optional)", defaultAcl: true},
  {rule: "GET /chains/*/chain_id", purpose: "source comparison", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/header", purpose: "heads, chain check", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/protocols", purpose: "protocol context", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/metadata", purpose: "block producer", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/context/constants", purpose: "quorum, round durations", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/context/delegates/*/**", purpose: "delegate eligibility", defaultAcl: true},
  {rule: "GET /chains/*/mempool/pending_operations", purpose: "mempool fallback reads", defaultAcl: true},
  {rule: "GET /chains/*/blocks/*/helpers/attestation_rights", purpose: "committee rights", defaultAcl: false},
  {rule: "GET /chains/*/blocks/*/helpers/baking_rights", purpose: "next proposers", defaultAcl: false},
  {rule: "GET /monitor/heads/*", purpose: "head stream", defaultAcl: false},
  {rule: "GET /chains/*/mempool/monitor_operations", purpose: "consensus operation stream", defaultAcl: false},
  {rule: "GET /monitor/validated_blocks", purpose: "proposal stream", defaultAcl: false},
];

/** Octez ACL path matching: `*` is one whole segment, a trailing `**` any suffix; the query string is ignored. */
export function aclRuleMatches(rule: string, method: string, path: string): boolean {
  const [ruleMethod, rulePath] = rule.includes(" ") ? rule.split(" ", 2) as [string, string] : ["", rule];
  if (ruleMethod !== "" && ruleMethod !== method) return false;
  const want = rulePath.split("/").filter(Boolean), have = (path.split("?")[0] ?? "").split("/").filter(Boolean);
  for (let index = 0; index < want.length; index++) {
    const part = want[index];
    if (part === "**") return true;
    if (have[index] === undefined) return false;
    if (part !== "*" && part !== have[index]) return false;
  }
  return want.length === have.length;
}

/** Config-file ACL that allows exactly the Observatory's RPCs on one listening address. */
export function aclConfigSnippet(address: string): string {
  return JSON.stringify({rpc: {"listen-addrs": [address], "cors-origin": ["*"], "cors-headers": ["Content-Type"], acl: [{address, whitelist: REQUIRED_RPCS.map(rpc => rpc.rule)}]}}, null, 2);
}

/* ---------- Failure classification and diagnostics ---------- */

export type RpcFailure =
  | {readonly kind: "network"; readonly message: string}
  | {readonly kind: "timeout"}
  | {readonly kind: "http"; readonly status: number}
  | {readonly kind: "not-json"}
  | {readonly kind: "wrong-chain"; readonly chainId: string | undefined}
  | {readonly kind: "stream-closed"};

const errorName = (error: unknown): string => typeof error === "object" && error !== null && "name" in error ? String((error as {name: unknown}).name) : "";
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** A rejected fetch is a TypeError for refused connections, DNS, TLS, CORS and mixed content alike. */
export function classifyFetchError(error: unknown): RpcFailure {
  const name = errorName(error);
  if (name === "AbortError" || name === "TimeoutError") return {kind: "timeout"};
  if (error instanceof SyntaxError) return {kind: "not-json"};
  return {kind: "network", message: errorText(error)};
}

/** Recover a failure class from a transport error string (stream status, auxiliary read). */
export function classifyErrorMessage(message: string): RpcFailure | undefined {
  const status = /\bHTTP (\d{3})\b/.exec(message);
  if (status) return {kind: "http", status: Number(status[1])};
  if (/RPC stream closed/i.test(message)) return {kind: "stream-closed"};
  if (/timed? ?out|timeout|aborted/i.test(message)) return {kind: "timeout"};
  if (/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(message)) return {kind: "network", message};
  if (/JSON/i.test(message)) return {kind: "not-json"};
  return undefined;
}

export type DiagnosisClass = "mixed-content" | "unreachable-or-cors" | "acl" | "not-exposed" | "not-octez" | "wrong-network" | "timeout" | "stream" | "http";
export interface Diagnosis {
  readonly class: DiagnosisClass;
  readonly title: string;
  readonly summary: string;
  /** How to tell the possible causes apart from outside the browser. */
  readonly checks: readonly string[];
  /** Concrete node / deployment changes. */
  readonly fixes: readonly string[];
}
export interface DiagnosisContext {
  readonly sourceUrl: string;
  /** Path that failed, relative to the source URL. */
  readonly path: string;
  /** `location.origin` of the page running the Observatory. */
  readonly pageOrigin: string;
  /** Network the source was added for; defaults to mainnet. */
  readonly network?: NetworkName;
}

const loopback = (hostname: string): boolean => hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || /^127\./.test(hostname);
const privateAddress = (hostname: string): boolean => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname) || /^\[f[cd]/i.test(hostname) || hostname.endsWith(".local");
const hostPort = (url: URL): string => `${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;

export function diagnose(failure: RpcFailure, context: DiagnosisContext): Diagnosis {
  let source: URL, page: URL | undefined;
  try {source = new URL(context.sourceUrl);} catch {source = new URL("http://invalid.invalid");}
  try {page = new URL(context.pageOrigin);} catch {page = undefined;}
  const origin = page ? page.origin : "<Observatory origin>";
  const listen = `<public-address>:${source.port || "8732"}`;
  const target = `${context.sourceUrl}${context.path}`;
  const cors = `--cors-origin '${origin}' (or '*') --cors-header 'Content-Type'`;
  const aclFix = [
    `Allow the Observatory's RPCs on that listening address. Either --allow-all-rpc ${listen} (must equal the --rpc-addr value; exposes every RPC, discouraged on a public address), or an explicit "acl" whitelist in config.json for exactly: ${REQUIRED_RPCS.map(rpc => rpc.rule).join(", ")}.`,
    `Octez's default ACL for non-loopback addresses does not include: ${REQUIRED_RPCS.filter(rpc => !rpc.defaultAcl).map(rpc => rpc.rule).join(", ")}. A whitelist replaces the default list, so list every path above.`,
  ];
  switch (failure.kind) {
    case "network": {
      const mixed = page?.protocol === "https:" && source.protocol === "http:" && !loopback(source.hostname);
      if (mixed) return {
        class: "mixed-content",
        title: "Blocked: http:// node from an https:// page (mixed content)",
        summary: `This page is served over HTTPS, so the browser refuses plain-HTTP requests to ${source.host} before they leave the browser. Other causes (unreachable port, CORS) may also apply once this is fixed.`,
        checks: [
          "The browser console shows a \"Mixed Content\" error for this URL.",
          `Confirm the node itself answers: curl -sS ${context.sourceUrl}/chains/main/chain_id`,
        ],
        fixes: [
          `Serve the node RPC over HTTPS: octez-node run --rpc-addr ${listen} --rpc-tls <cert.pem>,<key.pem> ${cors}, then add https://${source.host}${source.pathname.replace(/\/$/, "")}.`,
          "Or put a TLS reverse proxy (nginx, Caddy) in front of the node, with response buffering disabled so monitor streams flow (nginx: proxy_buffering off).",
          "Or open the Observatory itself over http:// (for example a local npm run dev) when the node is on your own network.",
        ],
      };
      return {
        class: "unreachable-or-cors",
        title: `Request to ${source.host} failed in the browser (unreachable or CORS)`,
        summary: "The browser reports a refused connection, an unreachable host, a TLS failure and a missing CORS header identically, so this page cannot tell which one happened. Check each in turn.",
        checks: [
          `Reachability: curl -sS --max-time 5 ${context.sourceUrl}/chains/main/chain_id from the machine running this browser. "Connection refused" means nothing listens on ${hostPort(source)} (the node only binds --rpc-addr; 127.0.0.1/localhost is not reachable from other machines). A timeout means a firewall or wrong host.`,
          `CORS: curl -sS -o /dev/null -D - -H 'Origin: ${origin}' ${context.sourceUrl}/chains/main/chain_id must print access-control-allow-origin: * or ${origin}. If it is missing, the node runs without --cors-origin.`,
          ...(source.protocol === "https:" ? [`TLS: curl must not report a certificate error; a self-signed certificate must be trusted by this browser (open ${context.sourceUrl}/chains/main/chain_id in a tab once).`] : []),
          "The browser console names the cause: a CORS message, net::ERR_CONNECTION_REFUSED, ERR_NAME_NOT_RESOLVED or a certificate error.",
          ...(privateAddress(source.hostname) && page && !privateAddress(page.hostname) && !loopback(page.hostname) ? ["This node is on a private network address while the page is public: the browser may ask for, or block, local network access."] : []),
        ],
        fixes: [
          `Listen on a reachable address: octez-node run --rpc-addr ${listen} (not 127.0.0.1), and open that TCP port in the firewall.`,
          `Enable CORS: ${cors}. In config.json: "rpc": {"cors-origin": ["${origin}"], "cors-headers": ["Content-Type"]}.`,
          "Behind a reverse proxy, the proxy must forward or add Access-Control-Allow-Origin.",
        ],
      };
    }
    case "http":
      if (failure.status === 403) return {
        class: "acl",
        title: `HTTP 403: the node's RPC ACL refuses ${context.path.split("?")[0]}`,
        summary: "The node is reachable and CORS works, but its access control list rejects this endpoint. A node listening on a non-loopback --rpc-addr applies a restrictive default ACL that allows block headers and chain_id but not the monitor streams or the rights helpers.",
        checks: [`curl -sS -o /dev/null -w '%{http_code}\\n' '${target}' returns 403.`],
        fixes: aclFix,
      };
      if (failure.status === 404 || failure.status === 405) return {
        class: "not-exposed",
        title: `HTTP ${failure.status}: ${context.path.split("?")[0]} is not exposed at this URL`,
        summary: "Something answered, but not with this RPC. The base URL may have a wrong path prefix, a reverse proxy may only forward some paths, or the node version may not serve this RPC.",
        checks: [
          `The base URL must be the RPC root: ${context.sourceUrl}/chains/main/chain_id must return the quoted chain id.`,
          "If a reverse proxy adds a prefix (e.g. /mainnet), include it in the URL and make the proxy forward /chains/, /monitor/ and /version.",
          "Monitor streams (/monitor/heads/main, /chains/main/mempool/monitor_operations?version=1, /monitor/validated_blocks) need a current Octez release.",
        ],
        fixes: [`Use the exact RPC root URL, forward these paths through the proxy: ${REQUIRED_RPCS.map(rpc => rpc.rule.replace(/^GET /, "")).join(", ")}.`],
      };
      return {
        class: "http",
        title: `HTTP ${failure.status} from ${source.host}`,
        summary: failure.status === 401 || failure.status === 407
          ? "The server requires authentication. Credentials cannot be stored in a custom source URL; expose an unauthenticated read-only endpoint (for example a reverse proxy restricted by ACL) instead."
          : failure.status >= 500 ? "The node or its proxy failed while answering; it may be bootstrapping, overloaded or misconfigured." : "The server rejected the request.",
        checks: [`curl -sS -i '${target}'`, "Check the node log and the reverse proxy log for this request."],
        fixes: ["Retry once the node is bootstrapped (GET /chains/main/is_bootstrapped).", ...(failure.status === 429 ? ["A proxy rate limit is active; raise it for this page's origin."] : [])],
      };
    case "not-json":
      return {
        class: "not-octez",
        title: "Not an Octez node RPC: the response is not JSON",
        summary: "The URL answered with something other than RPC JSON, such as a web page, a proxy error page or another service.",
        checks: [`curl -sS ${context.sourceUrl}/chains/main/chain_id must print a quoted chain id such as "${CHAIN_IDS[context.network ?? "mainnet"]}".`],
        fixes: ["Point to the octez-node RPC root (default port 8732) or to the proxy path that forwards to it."],
      };
    case "wrong-chain": {
      const network = context.network ?? "mainnet", expected = CHAIN_IDS[network];
      return {
        class: "wrong-network",
        title: `Wrong chain: ${failure.chainId ?? "no chain_id"} is not Tezos ${network}`,
        summary: `This node does not serve ${network} (chain_id ${expected}); a ${NETWORK_LABELS[network]} custom source must be a ${network} node.${failure.chainId === CHAIN_IDS[network === "mainnet" ? "shadownet" : "mainnet"] ? ` It is a ${network === "mainnet" ? "shadownet" : "mainnet"} node: add it to the ${network === "mainnet" ? "Shadownet" : "Mainnet"} panel instead.` : ""}`,
        checks: [`curl -sS ${context.sourceUrl}/chains/main/chain_id must print "${expected}".`],
        fixes: [`Use a node started with --network ${network}.`],
      };
    }
    case "timeout":
      return {
        class: "timeout",
        title: `No answer from ${source.host} in time`,
        summary: "The request neither succeeded nor failed before the deadline: a firewall silently dropping packets, a wrong host, or an overloaded or still-bootstrapping node.",
        checks: [`curl -sS --max-time 10 ${context.sourceUrl}/chains/main/chain_id`, "Check the node is bootstrapped: GET /chains/main/is_bootstrapped."],
        fixes: [`Open the RPC port (${hostPort(source)}) in the firewall, or point to a node that has finished bootstrapping.`],
      };
    case "stream-closed":
      return {
        class: "stream",
        title: `Monitor stream ${context.path.split("?")[0]} closed or sent nothing`,
        summary: "The node accepted the request but the streamed response ended or stayed empty. Reverse proxies often buffer or cut chunked responses.",
        checks: [`curl -sS -N --max-time 20 '${target}' must print a JSON object every block.`],
        fixes: ["In a reverse proxy, disable response buffering and long read timeouts for /monitor/ and /chains/main/mempool/monitor_operations (nginx: proxy_buffering off; proxy_read_timeout 1h)."],
      };
  }
}

/* ---------- Probe ---------- */

export type ProbeOutcome =
  | {readonly ok: true; readonly chainId: string; readonly version: string; readonly stream: "value" | "open-no-data"}
  | {readonly ok: false; readonly path: string; readonly failure: RpcFailure};

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

function versionText(value: JsonRecord): string {
  const version = record(value["version"]) ? value["version"] : {};
  const network = record(value["network_version"]) ? value["network_version"] : {};
  const info = version["additional_info"];
  const suffix = typeof info === "string" ? (info === "release" ? "" : `-${info}`) : record(info) ? Object.entries(info).map(([key, item]) => `~${key}${String(item)}`).join("") : "";
  const name = typeof network["chain_name"] === "string" ? ` · ${network["chain_name"]}` : "";
  return `Octez ${String(version["major"] ?? "?")}.${String(version["minor"] ?? "?")}${suffix}${name}`;
}

/**
 * One-off probe of a candidate source: the head header (reachability, CORS, chain_id),
 * /version for a label, then a short head-monitor read.
 */
export async function probeSource(baseUrl: string, options: {readonly expectedChainId?: string; readonly fetch?: typeof fetch; readonly timeoutMs?: number; readonly streamMs?: number; readonly signal?: AbortSignal} = {}): Promise<ProbeOutcome> {
  const request = options.fetch ?? fetch, timeoutMs = options.timeoutMs ?? 8000, streamMs = options.streamMs ?? 10_000;
  const signal = (ms: number): AbortSignal => AbortSignal.any([AbortSignal.timeout(ms), ...(options.signal ? [options.signal] : [])]);
  const json = async (path: string): Promise<{ok: true; value: unknown} | {ok: false; failure: RpcFailure}> => {
    let response: Response;
    try {response = await request(`${baseUrl}${path}`, {cache: "no-store", credentials: "omit", signal: signal(timeoutMs), headers: {accept: "application/json"}});}
    catch (error) {return {ok: false, failure: classifyFetchError(error)};}
    if (!response.ok) return {ok: false, failure: {kind: "http", status: response.status}};
    try {return {ok: true, value: await response.json() as unknown};}
    catch (error) {return {ok: false, failure: errorName(error) === "AbortError" || errorName(error) === "TimeoutError" ? {kind: "timeout"} : {kind: "not-json"}};}
  };
  // The head header is decisive: reachability, CORS, JSON and chain_id. /version is
  // informational only; proxies often do not forward it (nor add CORS to their 404).
  const headerPath = "/chains/main/blocks/head/header";
  const header = await json(headerPath);
  if (!header.ok) return {ok: false, path: headerPath, failure: header.failure};
  const chainId = record(header.value) && typeof header.value["chain_id"] === "string" ? header.value["chain_id"] : undefined;
  if (chainId !== (options.expectedChainId ?? MAINNET_CHAIN_ID)) return {ok: false, path: headerPath, failure: {kind: "wrong-chain", chainId}};
  const versionRead = await json("/version");
  const versionLabel = versionRead.ok && record(versionRead.value) && record(versionRead.value["version"]) ? versionText(versionRead.value) : "version unavailable (/version not exposed)";
  const streamPath = "/monitor/heads/main";
  const controller = new AbortController(), stop = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
  const timer = setTimeout(() => controller.abort(), streamMs);
  try {
    let response: Response;
    try {response = await request(`${baseUrl}${streamPath}`, {cache: "no-store", credentials: "omit", signal: stop, headers: {accept: "application/json"}});}
    catch (error) {return {ok: false, path: streamPath, failure: controller.signal.aborted ? {kind: "timeout"} : classifyFetchError(error)};}
    if (!response.ok) return {ok: false, path: streamPath, failure: {kind: "http", status: response.status}};
    if (response.body === null) return {ok: false, path: streamPath, failure: {kind: "stream-closed"}};
    const reader = response.body.getReader();
    try {
      // Race the read with our deadline: a fetch shim may ignore the abort signal.
      const aborted = new Promise<never>((_resolve, reject) => {const fail = () => reject(new DOMException("Probe window elapsed", "AbortError")); if (stop.aborted) fail(); else stop.addEventListener("abort", fail, {once: true});});
      const first = await Promise.race([reader.read(), aborted]);
      if (first.done) return {ok: false, path: streamPath, failure: {kind: "stream-closed"}};
      return {ok: true, chainId, version: versionLabel, stream: "value"};
    } catch (error) {
      // Our own deadline: the stream opened but no block arrived in the window.
      if (controller.signal.aborted) return {ok: true, chainId, version: versionLabel, stream: "open-no-data"};
      return {ok: false, path: streamPath, failure: classifyFetchError(error)};
    } finally {void reader.cancel().catch(() => undefined);}
  } finally {clearTimeout(timer); controller.abort();}
}
