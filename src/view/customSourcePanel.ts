import type {NetworkName} from "../rpc/models";
import {
  CHAIN_IDS,
  CUSTOM_SOURCES_QUERY_PARAMETERS,
  CUSTOM_STREAM_IDLE_MS,
  MAX_CUSTOM_SOURCES,
  NETWORK_LABELS,
  aclConfigSnippet,
  queryParameter,
  classifyErrorMessage,
  diagnose,
  displayText,
  normalizeRpcUrl,
  probeSource,
  readStoredUrls,
  unusableFailure,
  writeStoredUrls,
  type CustomSource,
  type CustomSourceSet,
  type Diagnosis,
  type DiagnosisContext,
  type ProbeOutcome,
} from "../rpc/customSources";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
};
let diagnosisCount = 0;

/** Precise, actionable failure explanation; shared by the add probe, startup probes and runtime stream errors. */
export function diagnosisElement(diagnosis: Diagnosis, sourceUrl: string): HTMLElement {
  const root = el("div", "source-diagnosis"), title = el("strong", "diagnosis-title", diagnosis.title);
  title.id = `source-diagnosis-title-${++diagnosisCount}`;
  root.dataset.class = diagnosis.class; root.setAttribute("role", "group"); root.setAttribute("aria-labelledby", title.id);
  root.append(title, el("p", "diagnosis-summary", diagnosis.summary));
  const list = (heading: string, items: readonly string[], ordered: boolean): void => {
    if (items.length === 0) return;
    root.append(el("h5", "", heading)); const node = el(ordered ? "ol" : "ul", "diagnosis-list");
    for (const item of items) node.append(el("li", "", item)); root.append(node);
  };
  list("How to check", diagnosis.checks, true);
  list("How to fix", diagnosis.fixes, false);
  if (diagnosis.class === "acl") {
    let address = "<public-address>:8732";
    try {const url = new URL(sourceUrl); address = `<public-address>:${url.port || "8732"}`;} catch { /* Keep placeholder. */ }
    const config = el("details", "diagnosis-acl"); config.append(el("summary", "", "config.json ACL allowing only the Observatory's RPCs"), el("pre", "", aclConfigSnippet(address)));
    root.append(config);
  }
  return root;
}

export interface CustomSourcePanelOptions {
  readonly network: NetworkName;
  readonly set: CustomSourceSet;
  readonly pageOrigin: string;
  readonly href: string;
  readonly storage: Storage | undefined;
  readonly fetch?: typeof fetch;
  /** Applies a new source list by loading `href` (the runtimes take their sources at startup). */
  readonly navigate: (href: string) => void;
  /** Probe active custom sources once at startup. */
  readonly probeOnStart?: boolean;
  /** A startup probe proved this source unusable for the network (wrong chain, not JSON, oversized answers). */
  readonly onUnusable?: (source: CustomSource) => void;
}
export interface CustomSourcePanel {
  readonly root: HTMLElement;
  /** Persistent notice for the network header; undefined when no custom source is active. */
  readonly notice: HTMLElement | undefined;
  report(url: string, path: string, message: string | null): void;
}
type Probe = (url: string) => Promise<ProbeOutcome>;
type PageContext = (sourceUrl: string, path: string) => DiagnosisContext;

const originLabel = (source: CustomSource): string => source.custom === "query" ? `from ?${queryParameter(source.network)}=` : "saved in this browser";
const sameUrl = (url: string) => (value: string): boolean => {const checked = normalizeRpcUrl(value); return checked.ok && checked.url === url;};

/** Status line of a successful probe; an open but silent stream is a warning because streams will fail over from it. */
function probeStatus(label: string, outcome: Extract<ProbeOutcome, {ok: true}>): {readonly text: string; readonly state: "ok" | "warning"} {
  if (outcome.stream === "value") return {text: `${label} ✓ · ${outcome.version} · head stream delivering`, state: "ok"};
  return {text: `${label} ⚠ · ${outcome.version} · head stream open but no block within 10 s; streams switch to the next source after ${CUSTOM_STREAM_IDLE_MS / 1000} s without a message`, state: "warning"};
}

/** `href` without `url` among this network's query values, the remaining values kept in order. */
function withoutQueryValue(href: string, network: NetworkName, url: string): string {
  const next = new URL(href), kept: string[] = [];
  for (const name of CUSTOM_SOURCES_QUERY_PARAMETERS[network]) {
    for (const value of next.searchParams.getAll(name)) for (const part of value.split(",")) if (part.trim() !== "" && !sameUrl(url)(part)) kept.push(part.trim());
    next.searchParams.delete(name);
  }
  for (const value of kept) next.searchParams.append(queryParameter(network), value);
  return next.href;
}

/** Short notice placed beside the network header: a link can make a viewer-supplied node the first source. */
function sourceNotice(sources: readonly CustomSource[], label: string, review: () => void): HTMLElement | undefined {
  if (sources.length === 0) return undefined;
  const notice = el("p", "custom-source-notice"); notice.setAttribute("role", "note");
  const hosts = sources.map(source => `${displayText(source.baseUrl.replace(/^https?:\/\//, ""), 60)} (${source.custom === "query" ? "from this link" : "saved in this browser"})`).join(", ");
  const button = el("button", "custom-source-review", "Review"); button.type = "button"; button.setAttribute("aria-label", `Review custom ${label} RPC sources`);
  button.addEventListener("click", review);
  notice.append(`${sources.length === 1 ? "Using a custom RPC source" : `Using ${sources.length} custom RPC sources`}: ${hosts} · `, button);
  return notice;
}

/** Removes `source` from storage and from the page URL in one reload; a failed storage write is shown, not reloaded. */
function removeSource(options: CustomSourcePanelOptions, source: CustomSource, item: HTMLElement): void {
  const stored = readStoredUrls(options.storage, options.network), kept = stored.filter(value => !sameUrl(source.baseUrl)(value));
  if (kept.length !== stored.length && !writeStoredUrls(options.storage, options.network, kept)) {
    item.querySelector(".custom-source-remove-error")?.remove();
    const alert = el("p", "custom-source-error custom-source-remove-error", `${source.baseUrl} could not be removed from this browser's storage (storage is unavailable or full). Clear this site's data in the browser settings to remove it.`);
    alert.setAttribute("role", "alert"); item.append(alert); return;
  }
  options.navigate(withoutQueryValue(options.href, options.network, source.baseUrl));
}

export function customSourcePanel(options: CustomSourcePanelOptions): CustomSourcePanel {
  const network = options.network, label = NETWORK_LABELS[network], parameter = queryParameter(network);
  const root = el("section", "custom-sources"); root.setAttribute("aria-label", `Custom ${label} RPC sources`); root.dataset.network = network;
  const heading = el("h4", "", `Custom ${label} RPC sources`); heading.tabIndex = -1;
  root.append(heading,
    el("p", "table-note", `Use any Tezos ${network} Octez node (chain ${CHAIN_IDS[network]}): add it here or open this page with ?${parameter}=https://your-node.example (repeatable or comma-separated, at most ${MAX_CUSTOM_SOURCES}). Custom sources are tried first for RPC reads and monitor streams; one on another chain is not used. Adding or removing one reloads the page.`));
  const list = el("ul", "custom-source-list"); root.append(list);
  const rows = new Map<string, {readonly runtimeRoot: HTMLElement; readonly runtime: Map<string, {readonly message: string; readonly node: HTMLElement}>}>();
  const pageContext: PageContext = (sourceUrl, path) => ({sourceUrl, path, pageOrigin: options.pageOrigin, network});
  const probe: Probe = url => probeSource(url, {expectedChainId: CHAIN_IDS[network], ...(options.fetch ? {fetch: options.fetch} : {})});
  const showStartupProbe = (source: CustomSource, outcome: ProbeOutcome, status: HTMLElement, target: HTMLElement): void => {
    if (outcome.ok) {const shown = probeStatus(label, outcome); status.textContent = shown.text; status.dataset.state = shown.state; target.replaceChildren(); return;}
    const diagnosis = diagnose(outcome.failure, pageContext(source.baseUrl, outcome.path)), unusable = unusableFailure(outcome.failure);
    status.textContent = `Failed at ${outcome.path} · ${diagnosis.title}${unusable ? " · Not used for reads or streams" : ""}`; status.dataset.state = "failed";
    target.replaceChildren(diagnosisElement(diagnosis, source.baseUrl));
    if (unusable) options.onUnusable?.(source);
  };
  for (const source of options.set.sources) {
    const item = el("li", "custom-source"); item.dataset.url = source.baseUrl;
    const head = el("div", "custom-source-head"); head.append(el("strong", "", source.name), el("span", "custom-badge", `custom · ${originLabel(source)}`));
    const status = el("p", "custom-source-status table-note", options.probeOnStart === false ? "Not checked" : "Checking…");
    const runtime = el("div", "custom-source-runtime"), diagnosis = el("div", "custom-source-diagnosis");
    const remove = el("button", "control-button", "Remove"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${source.name}`);
    remove.addEventListener("click", () => removeSource(options, source, item));
    head.append(remove);
    item.append(head, status, diagnosis, runtime); list.append(item);
    rows.set(source.baseUrl, {runtimeRoot: runtime, runtime: new Map()});
    if (options.probeOnStart !== false) void probe(source.baseUrl).then(outcome => showStartupProbe(source, outcome, status, diagnosis));
  }
  for (const rejected of options.set.rejected) {
    const item = el("li", "custom-source rejected"); item.append(el("strong", "", displayText(rejected.input)), el("p", "custom-source-status table-note", `Ignored (${rejected.origin}): ${rejected.reason}`)); list.append(item);
  }
  if (options.set.sources.length === 0 && options.set.rejected.length === 0) list.append(el("li", "empty-state", "No custom source. Built-in public providers are used."));
  root.append(addForm(options, rows, probe, pageContext));
  const review = (): void => {
    for (let node = root.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true;
    root.scrollIntoView({block: "start"}); heading.focus({preventScroll: true});
  };
  return {root, notice: sourceNotice(options.set.sources, label, review), report(url, path, message) {
    const row = rows.get(url); if (!row) return;
    const previous = row.runtime.get(path);
    if ((previous?.message ?? null) === message) return;
    previous?.node.remove();
    if (message === null) {row.runtime.delete(path); return;}
    // Live errors stay collapsed: the stream fails over to other sources meanwhile.
    const failure = classifyErrorMessage(message), node = el("details", "custom-source-live");
    node.append(el("summary", "custom-source-error", `Live error on ${path.split("?")[0]}: ${displayText(message, 200)}`), ...(failure ? [diagnosisElement(diagnose(failure, pageContext(url, path)), url)] : [el("p", "table-note", "Unclassified error; see the browser console.")]));
    row.runtimeRoot.append(node); row.runtime.set(path, {message, node});
  }};
}

/** "Check & add": refuses invalid, built-in, duplicate URLs and a full list before probing; then saves and reloads. */
function addForm(options: CustomSourcePanelOptions, rows: ReadonlyMap<string, unknown>, probe: Probe, pageContext: PageContext): HTMLElement {
  const network = options.network, parameter = queryParameter(network);
  const form = el("form", "custom-source-form"), field = el("label", "", `${NETWORK_LABELS[network]} node RPC URL`), input = el("input");
  input.type = "url"; input.name = parameter; input.placeholder = "https://your-node.example"; input.spellcheck = false; field.append(input);
  // aria-disabled, not disabled: the focused button keeps focus while the probe runs.
  const add = el("button", "control-button", "Check & add"); add.type = "submit"; add.setAttribute("aria-disabled", "false");
  // Short announcements only, the diagnosis beside them. Not role=status: the page keeps a single global status region.
  const message = el("p", "custom-source-message"); message.id = `custom-source-message-${network}`; message.setAttribute("aria-live", "polite");
  const details = el("div", "custom-source-details"), result = el("div", "custom-source-result"); result.append(message, details);
  form.append(field, add);
  const show = (state: string, text: string, invalid: boolean, diagnosis?: HTMLElement): void => {
    result.dataset.state = state; message.textContent = text; message.classList.toggle("custom-source-error", invalid);
    details.replaceChildren(...(diagnosis ? [diagnosis] : []));
    if (invalid) {input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", message.id);}
    else {input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby");}
  };
  let probing = false;
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (probing) return;
    const checked = normalizeRpcUrl(input.value);
    if (!checked.ok) return show("invalid", checked.reason, true);
    if (options.set.builtIn.includes(checked.url)) return show("invalid", `${checked.url} is already a built-in provider: it is used without being added.`, true);
    if (rows.has(checked.url)) return show("invalid", `${checked.url} is already a custom source.`, true);
    if (rows.size >= MAX_CUSTOM_SOURCES) return show("invalid", `At most ${MAX_CUSTOM_SOURCES} custom ${NETWORK_LABELS[network]} sources are used; remove one first.`, true);
    probing = true; add.setAttribute("aria-disabled", "true");
    show("probing", `Checking ${checked.url}: head header and ${network} chain_id, then the head monitor stream…`, false);
    void probe(checked.url).then(outcome => {
      probing = false; add.setAttribute("aria-disabled", "false");
      if (!outcome.ok) {
        const diagnosis = diagnose(outcome.failure, pageContext(checked.url, outcome.path));
        return show("failed", `Not added: ${checked.url} failed at ${outcome.path}: ${displayText(diagnosis.title, 80)}`, true, diagnosisElement(diagnosis, checked.url));
      }
      show("ok", `Added ${checked.url} · ${outcome.version}. Reloading…`, false);
      if (writeStoredUrls(options.storage, network, [...readStoredUrls(options.storage, network), checked.url])) options.navigate(options.href);
      else {const next = new URL(options.href); next.searchParams.append(parameter, checked.url); options.navigate(next.href);}
    });
  });
  const wrapper = el("div", "custom-source-add"); wrapper.append(form, result);
  return wrapper;
}
