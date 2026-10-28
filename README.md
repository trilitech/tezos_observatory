# Tezos Observatory

Monitor Tezos consensus from a browser: Mainnet and Shadownet heads, observed
preattestations and attestations, voting power, proposal opportunities, and
delegates not observed by the selected RPC source.

This is a static TypeScript application. RPC connections run only while a viewer
has the page visible. It needs no background collector or systemd service.

Open **Baker & DAL** for the standalone `baker.html` page. Share a baker with
`baker.html?network=mainnet&baker=<tz-address>`, or use
`baker.html?network=mainnet&view=dal` for network-wide applied publications and
raw, hash-pinned DAL observations. The page refreshes bounded indexed windows
while visible, retains source timestamps for cached profile/rewards, and reads
included block details on demand. Raw DAL bitsets do not establish per-slot
success or failure; exact missed-slot diagnosis and live mempool comparison are
outside this first view.

## Develop and verify

Use Node.js 22 or newer, then:

```sh
npm ci
npm run dev
```

Open the printed Vite URL. The production entrypoint is `src/main.ts`, loaded by
`src/index.html`; fixtures are not the production dashboard.

```sh
npm run check
npm test
npm run test:e2e
npm run build
```

Playwright requires installed Chromium and Firefox browsers. The end-to-end suite
tests both components and the real `/` page with deterministic browser RPC
streams. It covers streamed vote updates, duplicate votes, obsolete head data,
unknown observations, independent network failure, layout at desktop/mobile
widths, pause/resume, persistent disclosures and stable list scroll/focus.

Ordinary `npm run test:e2e` verifies the served production behavior in both engines. Release acceptance additionally requires the source-bound V3 configuration (`playwright.v3.config.ts`), all guarded foundation/V3/metric commands and independent manual review. The five release-evidence consumers are discovered explicitly by that configuration; missing bundle or independent receipts remains an execution error, never an ordinary CI success claim. See [release evidence scopes](roster/observatory-v3/evidence-format.md).

## Interpret the display

The applied head level and round describe the last head reported by the node.
Observed consensus and scheduled opportunities are separate. The selected level,
round and payload identify received proposal or validated-mempool evidence;
votes can already concern the next level. A clock-derived opportunity alone
does not establish a proposal or justify a zero-participation gauge. Missing
usable observations are shown as unavailable. Competing payloads remain separate;
the display selects the strongest by combined voting power and reports alternatives.
Recent consensus rows retain peak power observed during this browser session:
they are historical observations, not current-round participation or a chain archive.

Adjacent observed block and round changes move the chain cards and connectors together for a full visible 1200ms journey at a constant speed. This follow-up user policy starts motion at rendering, replacing the earlier receipt-to-settlement budget; newly coherent destinations start their full journey when rendered. While current proof is pending, the navigator retains its last coherent scene with an explicit as-of label; live authority stays separate. Votes-only adjacent levels may move the camera while their predecessor relationship remains context-only. Bursts coalesce, and reduced motion, pins or observation gaps remain stationary.

History length retains 25, 50, 100, 250, 500 (default), 1000, or unlimited compact observed proposal records from this browser session, including competing hashes and qualified payload-only observations. Finite limits count all records, not levels; unlimited grows browser memory. The shared preference survives reload, while observations accumulate locally without historical backfill. Observed alternatives can be inspected in a paginated local list; they are not claims of canonical-chain inclusion or on-chain uncles. Observed cards keep their own pre/att peak backgrounds; unknown phases stay unknown, and future cards remain transparent. Drag or use the camera arrows to explore left and down in any order, then Return to live. Camera browsing leaves collection running and makes no history RPC requests.

Each gauge sums committee voting power once per delegate, using attestation
rights pinned to the observed head hash. A signer count is not an operation count
or a token balance. The quorum marker comes from the protocol constants.

Calculated rounds and countdowns are scheduled opportunities, not promises that a
block will be produced. Round zero starts one predecessor-round duration after
the predecessor timestamp; later boundaries add the successive round durations.
`roundSchedule.test.ts` checks cumulative timing and exact boundaries.

Missing delegates means expected rights minus signers observed by this source.
It does not establish inactivity across the network. Unknown rights, unavailable
mempool data, and an observed zero are distinct states. Aliases come from TzKT;
their absence does not change consensus health. Shadownet eligibility is checked
with bounded concurrency and cached for a minute. Mainnet eligibility is shown
as unknown rather than querying hundreds of delegates every block.

## Transport and failures

Mainnet vote streams use the public TzKT RPC, which allows browser CORS for monitors;
head streams use the other public providers because TzKT head delivery can lag
its mempool by multiple blocks. The
protocol helper lookups use separate RPC providers because TzKT restricts those
routes. `NetworkMonitor` opens `/monitor/heads/main`,
`/chains/main/mempool/monitor_operations`, and an optional
`/monitor/validated_blocks?chain=main` proposal monitor as streamed JSON. It deduplicates votes,
rejects obsolete asynchronous responses, and retains only current/next-level
operations, bounded to 10,000 entries. A normal mempool stream ending at a head
flush reconnects to the same source without activating error fallback. Aggregate
consensus operations expand into signer slots before power is counted.
Long rounds do not expire valid votes
merely because two minutes have passed.

On cold startup, one head RPC bootstraps the view alongside the streams so a
quiet stream cannot leave the page empty. If public RPCs reject or fail their streams, a watchdog enables bounded fallback
reads: heads every 15 seconds and the mempool every 30 seconds. Successful streams
stop their corresponding polling. Committee rights are cached by protocol and
level, successor committees are prefetched, and protocol constants are reused
across head changes. Missing auxiliary data is retried with bounded delays. The page
retains coherent values during reconnects, labels their age and source errors,
and cancels work when paused or hidden. Public RPC CORS policies and availability
can still prevent observations; a successful UI build cannot guarantee access.

Network health and RPC coverage are separate observations. The delayed-level
heuristic flags proposal rounds of 3 or more, or a block older than the larger
of 30 seconds and five minimum block delays. It is an operational indicator,
not an independent verification of consensus or finality.

## Custom RPC sources

A viewer can use any Octez node of the selected network as an RPC source,
without rebuilding the site:

| Network | URL parameter | Expected `chain_id` |
| --- | --- | --- |
| Mainnet | `?rpc=https://your-node.example` (alias `rpc_mainnet`) | `NetXdQprcVkpaWU` |
| Shadownet | `?rpc_shadownet=https://your-node.example` | `NetXsqzbfFenSTS` |

Each parameter can be repeated or hold comma-separated URLs, and both can be
combined, for example
`?rpc=https://mainnet-node.example&rpc_shadownet=https://shadownet-node.example`.
Each network's "Sources & limits" pane also has a **Check & add** control that
saves the URL in this browser (`localStorage`, one list per network) and a
**Remove** button, which removes the URL from both the page link and browser
storage. Custom sources are labelled `Custom · host` and are tried before the
built-in providers for RPC reads and the head, mempool and proposal monitor
streams; the existing failover is unchanged. While a custom source is active, a
notice beside the network header names it and its origin ("from this link" or
"saved in this browser") with a **Review** button that moves to the panel.
Adding or removing a source reloads the page. No custom source is configured by
default.

Only `http(s)` URLs of at most 2048 characters, without credentials, query or
fragment, are accepted; trailing slashes and a trailing dot in the host name
are removed. At most four custom sources per network are used; further values,
and URLs of built-in providers, are listed as ignored with the reason. Each custom source is probed on load and before
it is added: `GET /chains/main/blocks/head/header` (reachability, CORS, JSON and
the network's `chain_id`), `GET /version` for a label only (reverse proxies
often do not forward it), then a short read of `/monitor/heads/main`. A failing
source gets a diagnosis with checks and fixes:

- browser network error: unreachable host or port, firewall, node bound to
  `127.0.0.1`, missing CORS, TLS failure, or mixed content when an `https`
  page calls an `http` node (the browser reports all of these identically,
  except mixed content, which the page can detect);
- HTTP 403: the node's RPC ACL;
- HTTP 404/405: wrong path prefix or endpoint not forwarded;
- non-JSON answer, a body over 1 MiB, or a `chain_id` of another network.

A custom source is trusted for a network only on that network's chain: it can
establish the network identity, or contribute evidence under it, only when its
`chain_id` is the expected one, whatever the built-ins report. A source whose
startup check finds another chain, a non-JSON answer or an oversized body is
marked "Not used for reads or streams" and skipped by both. A head stream that
opens but sends no block during the check is shown as a warning (⚠), not a
check mark: a custom monitor stream that delivers no message for 60 seconds
(ten blocks at round 0 with the current 6-second minimal block delay on both
networks, and more than the 42 seconds a round-3 block can take) is abandoned for the next source with the error "RPC stream
idle". RPC read bodies are limited to 32 MiB, and text taken from a node
(`chain_id`, `/version` fields, error messages) is shortened and stripped of
control and bidirectional-override characters before display.

A node serving the Observatory needs, for example:

```sh
octez-node run --rpc-addr <public-address>:8732 \
  --cors-origin '<Observatory origin>' --cors-header 'Content-Type' \
  --rpc-tls <cert.pem>,<key.pem>    # or a TLS reverse proxy, when the page is https
```

On a non-loopback listening address Octez applies a restrictive default ACL
(`src/lib_rpc_http/RPC_server.ml`) that refuses the streams and rights helpers.
`--allow-all-rpc <public-address>:8732` opens every RPC (discouraged); an
explicit `acl` whitelist in `config.json` can allow just the RPCs the
Observatory sends:

```
GET /version                                        (optional)
GET /chains/*/chain_id
GET /chains/*/blocks/*/header
GET /chains/*/blocks/*/protocols
GET /chains/*/blocks/*/metadata
GET /chains/*/blocks/*/context/constants
GET /chains/*/blocks/*/context/delegates/*/**
GET /chains/*/mempool/pending_operations
GET /chains/*/blocks/*/helpers/attestation_rights   *
GET /chains/*/blocks/*/helpers/baking_rights        *
GET /monitor/heads/*                                *
GET /chains/*/mempool/monitor_operations            *
GET /monitor/validated_blocks                       *
```

Entries marked `*` are outside the default ACL. A whitelist replaces the
default list, so it must name all of them. `REQUIRED_RPCS` in
`src/rpc/customSources.ts` is the source of truth; a unit test scans `src/` for
node RPC path literals (quoted, or after a leading `${base}` in a template) and
checks that each one matches an entry. Paths assembled in other ways are not
seen by that test. Baker tracking, aliases and block intervals never use custom
sources: aliases and block intervals read TzKT, and baker tracking reads TzKT
indexers with the TzKT RPC on Mainnet and the Teztnets RPC on Shadownet.

## Completed-block intervals

Each network has three empirical means: **1 week, 24 hours and 1 hour**
(604800, 86400 and 3600 seconds). These use TzKT historical REST endpoints,
independently of RPC consensus observations and protocol countdowns. They are
**TzKT-reported indexed spans**: endpoint consistency is checked, but the browser
does not download intermediate blocks or independently verify their ancestry,
completeness or genesis.

At one batch-start instant `T`, capture the latest indexed endpoint `E` at or
before `T`. For each cutoff `C = T − requested duration`, take the latest
level-ordered endpoint `S` at or before `C`, bounded to `E.level`. The formula is
`mean seconds = (E.timestamp − S.timestamp) / 1000 / (E.level − S.level)` when
timestamps are in milliseconds. Two endpoint blocks one level apart give **one
completed interval**. The entire interval crossing the cutoff counts, including
a long stall; no fractional weighting or requested-duration substitution occurs.
Actual measured coverage can exceed the nominal window. Skipped browser
observations, proposal rounds and protocol delay changes do not change the formula.

Only an empty valid floor lookup permits one shared earliest-available lookup.
A valid newer start yields explicitly **partial available history**, with its
actual start/span/count; it proves neither genesis nor a complete requested week.
Malformed nonempty responses cannot use this fallback. Valid endpoints with no
positive safe elapsed span/count, or an indexed endpoint at/before the cutoff,
produce insufficient data. Invalid fields or contradictory selection facts are
unavailable. Positive means retain arithmetic precision and display two decimals;
values below 0.005 seconds display `<0.01 s`.

Each network attempt uses at most five anonymous projected GET reads, or six
when the shared earliest lookup is needed, and at most two concurrent reads.
Each complete fetch/body is limited to eight seconds and 16 KiB of streamed
bytes; the whole attempt is limited to 24 seconds. Credentials are omitted,
caching disabled and redirects forbidden. There is no pagination, retry,
archival RPC fallback, provider cascade or extra metadata lookup. The last read
checks the captured `E` by fixed level/hash/normalized timestamp. Ordinary indexer
advance is allowed; shared head/recheck/deadline failure commits no new batch.
An individual floor failure affects its window only after shared validation.
A failed new window never borrows an older batch's number.

Collection starts on permitted initial/resume, accepted material applied-head
changes or the network's native **Refresh block intervals** action, with at least
60 seconds between starts. Ineligible triggers are dropped without a deferred
timer. At most one newest eligible trigger can queue during an active attempt.
Time ticks, votes, estimates, theme changes, tabs, searches, disclosures and
history selection start no interval reads. Pause, hidden pages, pagehide and
stop cancel/fence work and clear the queue; BFCache restoration preserves manual
pause and cooldown. Proven applied branch replacement also fences active work.
Only the latest committed three-window batch and bounded pending work remain in
browser memory; no persistent block dataset or background collector is added.

Old values remain attributed while refreshing. Whole-attempt failure retains
them stale with the attempted receipt and reason. Fetch freshness starts at
successful completion and becomes stale at 120 seconds, or immediately on
interruption. Selected indexed-endpoint age is separately computed from captured
`T`, its block timestamp and monotonic elapsed time since batch start. Wall-clock
jumps cannot rewrite old means, timestamps or monotonic ages. Indexer lag uses
only coherent initial-response `Tzkt-Known-Level − Tzkt-Level` metadata;
the timestamp-filtered `E.level` is not the indexed level. Missing or malformed
metadata gives unknown lag, with synchronization timestamp validity independent.
None of these means, ages or provider failures asserts chain health or stall.
The region exposes actual coverage/source and native evidence details, including
full endpoint hashes, UTC times/levels, formula and separate receipts.

## Publish

`npm run build` emits the static site in `dist/`, with relative asset URLs for
deployment below a path such as `/observatory/`. Publish the entire directory,
including `assets/` and `favicon.svg`, with `index.html` as the directory index.
Keep prior hashed assets during rollout so already-open pages can finish loading.

The [comparative product review](docs/reviews/2026-10-14-explorus-teztale.md)
records interface principles and proposed improvements inspired by Explorus and
Teztale. Recommendations are not a promise that every feature is implemented.
No server-side polling is introduced by this deployment.

The [V3 design anti-checklist](docs/reviews/2026-10-14-v3-anti-generic-design.md)
sets task-based criteria for an original, usable interface and distinguishes
design critiques from evidence about how a website was produced.
