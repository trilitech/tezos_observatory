# Baker tracking: independent specification challenge

2026-10-22. Advisory challenge voice, not a validated specification or pipeline completion. Read validated intake, source research, installed roster-spec and project authority rules. The first pass preceded the draft; the exact draft was subsequently reviewed below. No application changes or provider queries. Peer journeys are untrusted operator examples; V/H labels do not make them normative. Existing 393 managed claims remain authoritative and unchanged.

## Verdict

A bounded indexed baker view and a network DAL observation view can satisfy the intake. They cannot honestly satisfy every peer journey. Explicitly accepting those limitations is a product decision; displaying an unknown label does not by itself complete a promised per-slot diagnosis or live node-consistency feature.

## Challenges and bounded acceptance

| ID | Journey/story | Challenge | Bounded acceptance / resolution required |
|---|---|---|---|
| C-1 | J1 identity | Alias catalog is capped; no match may mean incomplete coverage. A syntactically valid address need not be a delegate. | Validate selected addresses through delegate endpoint; retain direct address entry and catalog-coverage text. No unrelated automatic selection. Cached catalog has network/source identity and bounded lifetime/size. |
| C-2 | J1 attesting now | Latest N included operations are not last N levels. Absence from that list cannot establish a missed right or no right. Inclusion level is not vote target. | Show bounded sourced included operations and separately sourced missed rights. Classify a level as no-right only with complete rights evidence for that level; otherwise unknown. Never join operation inclusion level to a right as a vote-target match. State indexed freshness rather than claiming current daemon health. |
| C-3 | J1 current-cycle misses | A 25/50-row list cannot prove a complete cycle count. Independently fetched lists can be from different heads. | Display returned-window counts with bounds; a full current-cycle total requires an explicit bounded count contract. Anchor queries to one head and distinguish partial, empty and unavailable. Rights beyond anchor stay future. |
| C-4 | J2 block diagnosis | Canonical producer, proposer, right holder and round are different facts. Canonical history cannot reveal a competing predecessor or explain why a right was missed. | Show each right/status/round and one bounded canonical block batch. Show canonical producer/proposer/block round only when returned. No causal race/fault verdict; competing blocks and live observations are outside this feature. A predecessor-round column requires including predecessor levels in the same explicitly bounded batch; otherwise omit it. |
| C-5 | J3 DAL performance | Counter ratio, sufficient flag, denunciation and conditional reward are not interchangeable. Fixed 64% is not a verified protocol-independent rule. | Positive-denominator attested/attestable ratio only; 0/0 means no eligible observations. Raw sufficient/denounced values remain independently attributed. Draw a threshold only if verified for the anchored protocol, otherwise omit it. Shard expectations never supply a slot denominator. |
| C-6 | J3 historical cycles | Reading lastLevel-1 silently may omit final eligible evidence and mislabel the cycle. Future reward rows can exhaust a limit of six before six historical rows exist. | Six bounded returned reward cycles, excluding future rows, honestly permits fewer than six. Promise six past cycles only with a bounded supported filter/query. Do not promise full-cycle historical RPC counters without a verified final-state contract; lastLevel-1 is not a generic fallback. |
| C-7 | J4 missed published slot | Counter deltas and raw bitsets do not identify a missed slot. Dynamic lag prevents settlement-minus-five mapping. Historical binary search creates unbounded provider work. | Included hash-pinned individual/aggregate raw evidence is useful but does not deliver J4. Exact published level/index/outcome requires a verified protocol decoder plus dynamic-lag evidence contract. Mark J4 diagnostic outcome deferred/unmet, not completed by a raw bitset panel. No binary search or per-slot crawl. |
| C-8 | J5 node consistency | Included aggregate operations are not mempool operations. Matching raw values does not prove per-slot participation or full-cycle consistency. Committee non-zero power needs exact protocol/committee alignment and denominator. | This feature can show included evidence only. Live mempool timing, node consistency verdict and committee-share tiles remain outside scope. Never call absent DAL content failed participation, infer failure from zero, or imply aggregate mempool absence is baker absence. |
| C-9 | Global DAL | Publication absence, waiting, settled success and settled failure require different evidence; raw metadata alone establishes none of their per-slot joins. Capped indexed absence cannot prove normal absence. | Independent no-baker route shows bounded indexed publications and hash-pinned raw global attestation metadata, constants/lag context, source/update time and explicit decoding unavailable. Empty list means no publications returned in covered window only when coverage is known; otherwise empty returned list. No success/failure slot badges or countdown until dynamic-lag mapping is verified. |
| C-10 | Global summaries | Last-hour totals, last publication, all-bakers-below-threshold and cadence anomalies imply coverage or fleet reads the budget does not buy. | Only window-qualified returned publication counts and age of newest returned publication. No all-baker scan, publication-cadence alarm, settled-slot success ratio or power-share total without separately accepted evidence and bounded budget. |
| C-11 | DAL attribution | Equal array length alone does not prove matching aggregate order. Unsupported protocol, malformed middle entries, duplicate delegate entries or missing power may invalidate attribution. | Require exact supported protocol alignment, equal lengths and every relevant structure validated; refuse partial zip. Preserve raw global observation if individual attribution fails. Never equate consensus key with delegate without supported metadata. Define duplicate-entry behavior before aggregation. |
| C-12 | All views | Stale profile, fresh rights and older DAL can visually appear one snapshot. Reorgs can leave immutable hash evidence valid for an orphan yet irrelevant to canonical status. | Per-section source/hash/level/cycle/time/staleness. Immutable evidence remains historical; canonical claim must be tied to current anchor. No cross-network/address late result adoption. Do not silently reinterpret prior hash evidence as current. |

## Lifecycle and budget acceptance to freeze

- One coalesced recent batch per visible 30-second window, including manual refresh, capped at six TzKT reads for baker core. Global publications add at most one list read per window, not one per row. Specify whether view switching shares the window or starts a new one; recommended shared network session cooldown.
- DAL counters/global metadata share a 60-second cooldown where applicable; detail opens coalesce operations/0, metadata and constants by network, chain, block hash and protocol. Constants immutable only for the validated protocol/context. Provider chain-ID verification itself needs cache identity/TTL and a counted request budget.
- A hard bound is needed for immutable cache entries, expanded detail requests, simultaneous detail expansions and total concurrency. A request ceiling per refresh does not bound memory or a rapid expand/close session. Choose limits before implementation; eviction may refetch only through cooldown/budget rules.
- Hide/pagehide aborts transport, clears scheduled retries and prevents new requests; generation checks reject already-resolved old promises. Closing a detail must not abort shared transport still needed by another visible subscriber. Showing the page again permits at most one eligible coalesced refresh, never a catch-up queue.
- Error/429 retains last-good attribution as stale, never zero. Cooldown must advance on attempts/failure, not only success. Honour bounded Retry-After where supported and define invalid/missing-header fallback; manual refresh and hide/show cannot bypass it. A bad endpoint must not trigger provider rotation loops.
- Profile/reward TTL five minutes; aliases require an explicit cache policy. Clear obsolete UI immediately on selection change while retaining cache by context; do not flash the previous baker as the new baker.

## Required adversarial scenarios

1. Same alias on two networks; capped catalog miss; invalid address; account which is not delegate; malicious alias text.
2. Empty operation list with unavailable rights; rights window truncation; included level differs from target; unknown response status; future and missed rights mixed.
3. Missed right at round zero with another canonical producer at round one; no predecessor block; produced block where proposer differs from producer; reorg after detail expansion.
4. DAL 0/0, missing denominator, malformed negative/non-integer counters, ordinary attestation without DAL, denounced true with sufficient true, conditional reward with absent version.
5. Equal aggregate lengths but unsupported protocol; unequal lengths; malformed middle entry; exact delegate absent; duplicate delegate entries; non-zero raw global bitset alongside zero individual raw bitset.
6. Publications at irregular intervals or multiple slots; list cap reached; no returned publication; protocol transition with lag changes; raw global metadata missing. None creates an invented failure or fixed settlement date.
7. Manual refresh spam, rapid view/network/address switches, repeated hide/show, stalled fetch, 429 then click, multiple detail opens, cache eviction. Assert ceilings and no obsolete repaint, including late abort-insensitive resolution.

## Questions for root's delegated product gate

Q1. Accept J1 as two bounded sourced lists rather than a last-N-level attested/not-attested verdict and exhaustive current-cycle missed count? If the latter is required, specify complete anchored rights coverage/count within budget.

Q2. Accept J4 exact missed-slot diagnosis and J5 live node consistency as unmet/out of this feature, while included raw evidence ships? They must not be reported as completed journeys.

Q3. Accept global view as publication/observation explorer with explicit unavailable slot outcome, rather than the peer five-state per-slot dashboard? If five states are core, decoder/dynamic-lag contract is a blocker rather than a label choice.

Q4. What concrete immutable cache entry/byte bound, expanded-detail concurrency cap, and shared view-switch cooldown should the contract freeze? Recommended small deterministic limits, including failed requests in the budget.

Q5. Are fewer than six historical cycles and bounded-window miss/publication counts acceptable when six returned reward records contain future entries or rows hit the cap? Otherwise require supported filtered query/count semantics before promising totals.

## Limits of this report

No runtime or primary-source claims were independently rechecked; source research was taken as supplied evidence. This is a fresh semantic/lifecycle challenge, not code review, QA, or a full roster-spec phase. The phase owner retains state ledger, friction log, claims validation, full prior-art resolution and delegated validation. No public incident data is included.

## Exact first-draft review

Reviewed specs/baker-tracking.md after author notification (12 FR/12 AC draft).

- FR-003/AC-3 do not yet establish complete anchored last-N-level rights coverage or exhaustive cycle misses. They accurately promise bounded recent facts; root must resolve Q1 before strengthening them.
- US-2 scenario 2 says future/pending publication has a corresponding neutral state. Pending is a temporal claim: without verified dynamic-lag mapping, use outcome unavailable rather than a known waiting classification. Global metadata is newly available at its pinned block, not cumulative network DAL state; label that distinction in FR-007/AC-7. Publications must be applied-only; rejected operations do not establish published headers.
- FR-006 needs supported protocol binding explicitly, not merely supported aligned indices. Add duplicate-entry semantics and malformed middle-entry rejection to AC-6.
- FR-008 leaves core request budgets as an external phrase (root-approved) and immutable caches/concurrency unbounded. Freeze numeric budgets and keys/limits in the specification itself. Global no-baker rule is clear and accepted. The now-approved global head+publication30s/metadata60s budget resolves the earlier provisional extra-read question.
- FR-010 cooldown lacks failed-attempt, manual bypass and Retry-After semantics. AC-10 must prove failure attempts consume the cooldown and manual/hide-show cannot defeat it.
- FR-004 says at most six, which resolves Q5 for rewards if the UI does not promise six complete cycles. AC-4 should say at-most-six rather than six-cycle filtering.
- CHECK-1..12 use test-runner exits; roster-spec explicitly requires 0 pass /1 assertion />=2 error red commands. The tests are appropriate acceptance execution, but cannot be asserted to meet that red-command convention without a self-contained adapter/check. Missing test names and zero selected tests must fail as errors. CHECK-12 shell chaining also makes error identity ambiguous; retain full suite as quality gates and give AC-12 its deterministic consumer/import check.
- Claims metadata is absent; owner must add one metadata record per final FR/AC/CHECK and validate before projection. This report does not alter claims authority or existing statements.
- The document has no explicit journey limits yet. Add accepted J4/J5 deferral and global unavailable-outcome scope so reviewers cannot accidentally treat all peer journey expectations as delivered.

Recommendation: resolve Q1–Q4 with root, incorporate this finite delta and validate the resulting additive contract; no fresh provider research is needed for these semantic corrections.
