import type {NetworkName} from "../rpc/models";
import {
  CHAIN_IDS,
  CUSTOM_SOURCES_QUERY_PARAMETERS,
  NETWORK_LABELS,
  aclConfigSnippet,
  queryParameter,
  classifyErrorMessage,
  diagnose,
  normalizeRpcUrl,
  probeSource,
  readStoredUrls,
  writeStoredUrls,
  type CustomSource,
  type CustomSourceSet,
  type Diagnosis,
  type ProbeOutcome,
} from "../rpc/customSources";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
};

/** Precise, actionable failure explanation; shared by the add probe, startup probes and runtime stream errors. */
export function diagnosisElement(diagnosis: Diagnosis, sourceUrl: string): HTMLElement {
  const root = el("div", "source-diagnosis"); root.dataset.class = diagnosis.class; root.setAttribute("role", "group"); root.setAttribute("aria-label", diagnosis.title);
  root.append(el("strong", "diagnosis-title", diagnosis.title), el("p", "diagnosis-summary", diagnosis.summary));
  const list = (title: string, items: readonly string[], ordered: boolean): void => {
    if (items.length === 0) return;
    root.append(el("h5", "", title)); const node = el(ordered ? "ol" : "ul", "diagnosis-list");
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
}

const originLabel = (source: CustomSource): string => source.custom === "query" ? `from ?${queryParameter(source.network)}=` : "saved in this browser";

export function customSourcePanel(options: CustomSourcePanelOptions): {readonly root: HTMLElement; report(url: string, path: string, message: string | null): void} {
  const network = options.network, label = NETWORK_LABELS[network], parameter = queryParameter(network);
  const root = el("section", "custom-sources"); root.setAttribute("aria-label", `Custom ${label} RPC sources`); root.dataset.network = network;
  root.append(el("h4", "", `Custom ${label} RPC sources`),
    el("p", "table-note", `Use any Tezos ${network} Octez node (chain ${CHAIN_IDS[network]}): add it here or open this page with ?${parameter}=https://your-node.example (repeatable or comma-separated). Custom sources are tried first for RPC reads and monitor streams; adding or removing one reloads the page.`));
  const list = el("ul", "custom-source-list"); root.append(list);
  const rows = new Map<string, {readonly runtimeRoot: HTMLElement; readonly runtime: Map<string, {readonly message: string; readonly node: HTMLElement}>}>();
  const pageContext = (sourceUrl: string, path: string) => ({sourceUrl, path, pageOrigin: options.pageOrigin, network});
  const probe = (url: string, signal?: AbortSignal): Promise<ProbeOutcome> => probeSource(url, {expectedChainId: CHAIN_IDS[network], ...(options.fetch ? {fetch: options.fetch} : {}), ...(signal ? {signal} : {})});
  const showProbe = (url: string, outcome: ProbeOutcome, status: HTMLElement, target: HTMLElement): void => {
    if (outcome.ok) {
      status.textContent = `${label} ✓ · ${outcome.version} · head stream ${outcome.stream === "value" ? "delivering" : "open, no block yet"}`;
      status.dataset.state = "ok"; target.replaceChildren();
    } else {
      const diagnosis = diagnose(outcome.failure, pageContext(url, outcome.path));
      status.textContent = `Failed at ${outcome.path} · ${diagnosis.title}`; status.dataset.state = "failed";
      target.replaceChildren(diagnosisElement(diagnosis, url));
    }
  };
  const withoutQueryValue = (url: string): string => {
    const next = new URL(options.href), kept: string[] = [];
    for (const name of CUSTOM_SOURCES_QUERY_PARAMETERS[network]) {
      for (const value of next.searchParams.getAll(name)) for (const part of value.split(",")) {
        const checked = normalizeRpcUrl(part); if (part.trim() !== "" && !(checked.ok && checked.url === url)) kept.push(part.trim());
      }
      next.searchParams.delete(name);
    }
    for (const value of kept) next.searchParams.append(parameter, value);
    return next.href;
  };
  for (const source of options.set.sources) {
    const item = el("li", "custom-source"); item.dataset.url = source.baseUrl;
    const head = el("div", "custom-source-head"); head.append(el("strong", "", source.name), el("span", "custom-badge", `custom · ${originLabel(source)}`));
    const status = el("p", "custom-source-status table-note", options.probeOnStart === false ? "Not checked" : "Checking…");
    const runtime = el("div", "custom-source-runtime"), diagnosis = el("div", "custom-source-diagnosis");
    {
      const remove = el("button", "control-button", "Remove"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${source.name}`);
      remove.addEventListener("click", () => {
        if (source.custom === "stored") {writeStoredUrls(options.storage, network, readStoredUrls(options.storage, network).filter(value => {const checked = normalizeRpcUrl(value); return !(checked.ok && checked.url === source.baseUrl);})); options.navigate(options.href);}
        else options.navigate(withoutQueryValue(source.baseUrl));
      });
      head.append(remove);
    }
    item.append(head, status, diagnosis, runtime); list.append(item);
    rows.set(source.baseUrl, {runtimeRoot: runtime, runtime: new Map()});
    if (options.probeOnStart !== false) void probe(source.baseUrl).then(outcome => showProbe(source.baseUrl, outcome, status, diagnosis));
  }
  for (const rejected of options.set.rejected) {
    const item = el("li", "custom-source rejected"); item.append(el("strong", "", rejected.input), el("p", "custom-source-status table-note", `Ignored (${rejected.origin}): ${rejected.reason}`)); list.append(item);
  }
  if (options.set.sources.length === 0 && options.set.rejected.length === 0) list.append(el("li", "empty-state", "No custom source. Built-in public providers are used."));

  const form = el("form", "custom-source-form"), field = el("label", "", `${label} node RPC URL`), input = el("input");
  input.type = "url"; input.name = parameter; input.placeholder = "https://your-node.example"; input.spellcheck = false; field.append(input);
  const add = el("button", "control-button", "Check & add"); add.type = "submit";
  const result = el("div", "custom-source-result"); // Not role=status: the page keeps a single global status region for narration.
  result.setAttribute("aria-live", "polite");
  form.append(field, add); root.append(form, result);
  let probing: AbortController | undefined;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const checked = normalizeRpcUrl(input.value);
    if (!checked.ok) {result.dataset.state = "invalid"; result.replaceChildren(el("p", "custom-source-error", checked.reason)); return;}
    if (rows.has(checked.url)) {result.dataset.state = "invalid"; result.replaceChildren(el("p", "custom-source-error", `${checked.url} is already a custom source.`)); return;}
    probing?.abort(); const controller = new AbortController(); probing = controller;
    result.dataset.state = "probing"; result.replaceChildren(el("p", "table-note", `Checking ${checked.url}: head header and ${network} chain_id, then the head monitor stream…`)); add.disabled = true;
    void probe(checked.url, controller.signal).then(outcome => {
      if (probing !== controller) return;
      add.disabled = false;
      if (!outcome.ok) {
        const diagnosis = diagnose(outcome.failure, pageContext(checked.url, outcome.path));
        result.dataset.state = "failed";
        result.replaceChildren(el("p", "custom-source-error", `Not added: ${checked.url} failed at ${outcome.path}.`), diagnosisElement(diagnosis, checked.url));
        return;
      }
      result.dataset.state = "ok"; result.replaceChildren(el("p", "table-note", `Added ${checked.url} · ${outcome.version}. Reloading…`));
      if (writeStoredUrls(options.storage, network, [...readStoredUrls(options.storage, network), checked.url])) options.navigate(options.href);
      else {const next = new URL(options.href); next.searchParams.append(parameter, checked.url); options.navigate(next.href);}
    });
  });
  return {root, report(url, path, message) {
    const row = rows.get(url); if (!row) return;
    const previous = row.runtime.get(path);
    if ((previous?.message ?? null) === message) return;
    previous?.node.remove();
    if (message === null) {row.runtime.delete(path); return;}
    // Live errors stay collapsed: the stream fails over to other sources meanwhile.
    const failure = classifyErrorMessage(message), node = el("details", "custom-source-live");
    node.append(el("summary", "custom-source-error", `Live error on ${path.split("?")[0]}: ${message}`), ...(failure ? [diagnosisElement(diagnose(failure, pageContext(url, path)), url)] : [el("p", "table-note", "Unclassified error; see the browser console.")]));
    row.runtimeRoot.append(node); row.runtime.set(path, {message, node});
  }};
}
