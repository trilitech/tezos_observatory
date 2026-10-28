---
name: roster-spec
type: spec
status: live
feature: Complete consensus correctness and session inspection foundations
brief: briefs/observatory-foundations-intake.md
date: 2026-10-14
version: 1.0.0
---

# Spec — Observatory foundations

**Status: VALIDATED contract — root review and quiz accepted; claims lifecycle active under separate delegated root authority; verification remains absent.**

Full validated intake scope retained. Root intermediate authority is `.harness/rules/project-authority.md`; publication/deployment remains maintainer-only. Fresh sequential researcher, clarifier, adversarial challenger and formalizer were executed. Source artifacts: `roster/observatory-foundations/spec-{research,clarifications,stories,challenges,resolutions,formalized}.md`. No application changes or implementation verification claimed.

## Context and scope

Fresh source evidence records same-round candidate rejection, shared provider relabelling risk, coverage-derived opposite-phase zero, context-weak rights caches, head+1 filtering, alias/pagehide cancellation gaps, five-item transient history, noninteractive committee and identity-unguarded events. This contract replaces those limitations without assuming synthetic mocks certify public provider completeness. Applied head, observed proposal/votes and calculated opportunities remain distinct. ASTRA implements later branching navigation and aesthetics; foundations expose identity/provenance/conditional rights/timer facts without a V3 visual redesign. Archived receipt timelines are deferred, while maintainer branching navigation remains mandatory later.

Cross-spec check: `specs/` did not exist before this draft; no existing Entities conflicts. Relevant KB definitions are consistent with explicit candidate identity, source-limited observation and browser-only bounded session scope. Intake appendix preserves all root-accepted policies for the fresh planner.

## External prior art

| Approach | Source and evidence | Relation to accepted scope |
|---|---|---|
| Explorus direct-node consensus/history/rights inspector | [Official Functori introduction](https://www.functori.com/blog/blog-getting-started-with-explorus.html), fetched 2026-10-14; local accepted review docs/reviews/2026-10-14-explorus-teztale.md:11–17 | Aligns with browser-only selectable observed history; no database needed. |
| Explorus prioritized backup cascade | Official introduction, Network configuration paragraph: additional node addresses are backups tried in sequence | Diverges from explicit independent comparison with no fallback cascade; justify retaining contextual primary fallback while comparison stays independent. |
| Explorus quorum/network-health and missing/finalized labels | Official introduction, latest-blocks and baking-rights sections | Diverges from source-limited observation and excluded unverified finality/network-wide inactivity; challenge scope and evidence semantics. |
| Teztale archived observation provenance and observer difference views | Local source-based review docs/reviews/2026-10-14-explorus-teztale.md:19–25; [pinned archiver](https://gitlab.com/tezos/tezos/-/tree/1727d7e192f2374edda7ad7adceef6f4ec51f71a/teztale), [pinned observer comparison](https://gitlab.com/nomadic-labs/teztale-dataviz/-/blob/d9c1eb82f6672e2c9f34ebb7da87b59261609e62/src/views/LevelDiff.tsx) | Provenance aligns; archived multi-observer history/timelines diverge from bounded session-only explicit comparison and deferred receipt timeline. GitLab fetch failed in this phase; pinned-source claims derive from supplied local review, not new fetch validation. |

## Clarifications

| Question | Answer / authority |
|---|---|
| What identifies separately inspectable candidates when level, round and payload are shared, and whose producer may be displayed? | Distinct block identities remain separate candidates even with the same level/round/payload. Replay deduplicates by identity. Producer attribution requires evidence matching that candidate; absent evidence is unknown. Competing payload power never combines. Intake acceptance 1; existing grouping is an identified gap in research concern 1. |
| What do “session history,” “active accepted,” “unresolved,” and an evicted pin mean at their boundaries? | Each network retains 150 full session instances, 100 active accepted candidates and a separate quarantine of 100 unresolved candidates. Unresolved observations cannot evict accepted candidates. Eviction is deterministic by oldest receipt, not claimed height. One separately frozen pinned snapshot per network survives history eviction and is marked outside retained session history. Collection continues independently of pinning; follow-live and pause are separate actions. Intake retention decision and acceptance 9. |
| When may a phase show measured zero or identify delegates without received phase evidence? | Zero requires a usable full validated-mempool snapshot received after establishing the exact selected instance, from the same observer with coherent head/parent/rights context. It means zero observed in that snapshot, never global completeness. Missing rights, unusable identity, absent source observations, interrupted/insufficient coverage, transport-open alone, earlier empty batches and opposite-phase votes cannot justify zero or complete missing-delegate claims. Positive received votes may show observed power with explicit partial coverage. Intake phase-zero decision and acceptance 3. |
| When may ahead observations contribute power, and what happens before context is established? | Retain ahead evidence as separately attributable unresolved observations in bounded quarantine. Count only when that same observer’s validated-block/head context establishes the target as contextual current level or context+1 with coherent rights. Neither another source’s global applied head nor a clock ceiling alone rejects it. Do not infer parent identity from level. Reconciliation allows one in-flight workflow per network/source, at most one attempt per 15 seconds for a new material context; failure stays unresolved without quorum, permanent polling or cascades. Intake ahead-evidence decision. |
| Which source changes, cache reuse and selection changes may affect historical attribution or events? | Accepted records retain immutable source, requested/observed context, receipt and freshness evidence. Current provider status cannot relabel history. Cache reuse must have justified context; reorgs, source divergence and delayed obsolete responses cannot contaminate another context. Quorum/progression comparisons require the same precise identity/context; payload, candidate, source or historical-selection changes cannot fabricate a crossing. Historical events retain provenance. Chain progress remains independent from observer health. Intake acceptance 2, 5 and 8. |
| What exactly is authorized for independent source comparison and lifecycle interruption? | An explicit request compares one different provider for the selected network/context: one in-flight workflow, at most three endpoint reads, eight-second timeout per read, no retries/cascade/periodic refresh. Compare head hash/level/round/time/network identity; optional full pending snapshot requires coherent context-pinned rights within the budget. Unproven context/rights leaves raw observations unknown-power; powers are never unioned. Pause, hidden and pagehide abort all external and auxiliary collection, including aliases/comparison; initially hidden starts none; context change also cancels comparison. Cancelled responses cannot commit after resume. Intake second-source decision and acceptance 7/11. |
| What precision, naming and architecture constraints apply before V3? | Validate actual applied level/round/time and integer consensus values, committee totals, signer counts, threshold and exact deficit against evidence. Reject nonfinite, unsafe, negative, fractional and contradictory values. Count each delegate once per phase/instance across aggregate/individual replay. Applied chain values, selected consensus and calculated opportunities remain distinct; a planned level cannot be called the applied block level. Browser session inspection is required; V3 composition/palette/assets, deployment, background collection, signing/node mutation, archival completeness, optional timelines/watch filters/confetti and unverified finality/global inactivity are excluded. Existing domain primitives are available; generic infrastructure requires checking the canonical library index first. Intake scope, numerical decision and architecture notes; project-authority policy. |
| What observable age makes eligibility or comparison “stale,” rather than fresh/unknown? | Root coordinator resolved 2026-10-14: eligibility uses a 60-second fresh TTL only with exact coherent context; invalidated context is stale immediately. Comparison remains a fetched-at snapshot fresh for at most 60 seconds for the same selected contextual identity, then stale without automatic refresh. Raw receipt time is always shown. Missing usable result is unknown/unavailable, not fabricated fresh data. |
| What is the "configured pool" once a viewer supplies a node through `?rpc=`, `?rpc_shadownet=` or a source saved in the browser? | The built-in providers plus at most four viewer-supplied sources per network; none is configured by default (FR-037, AC-19, FR-064). A viewer-supplied source is labelled as custom with its origin (link or browser storage), beside the network header and in the source pane, and is tried before the built-ins. It may establish, or be authorized under, the expected network identity only when its chain_id is that network's chain (FR-025); one whose startup check finds another chain, a non-JSON answer or an oversized body is not used for reads or streams. Monitor-stream failover across the pool is the existing transport behaviour; reconciliation and comparison still read only their exact observer or selected provider (FR-036, FR-072). Root coordinator accepted 2026-10-28 under delegated project authority (custom RPC sources review, PR #19). |

Questions asked Step 2: 1; resolved by root under delegated project authority. No OPEN items remain.

## User Stories

### US-1: Identity and exact power (Priority: P0)
As a consensus reader, I want to inspect distinct proposals and precise vote totals so that competing evidence cannot create a false quorum.

**Why this priority**: Evidence integrity is prerequisite to safe interpretation.
**Scope**: This story does NOT cover independent comparison and inspector interactions.
**Independent Test**: Feed same-round candidates and individual/aggregate replay into one source fixture.
**Acceptance Scenarios**:

1. **Given** observer A reports level 120 round 2 block hashes H1/H2 sharing payload P, **When** the reader inspects candidates, **Then** both identities remain selectable; no producer is inferred from shared payload. [US-1-S1]
2. **Given** committee has D1 power 3, D2 power 2, total 5 and threshold 4, **When** D1 arrives individually and twice through an aggregate for payload P, while D2 votes payload Q, **Then** P remains power 3, Q remains power 2; deficits are 1 and 2. [US-1-S2]
3. **Given** rights or consensus input contains NaN, Infinity, negative/fractional/unsafe integers, duplicate contradictory rights or threshold 6 for total 5, **When** data arrives, **Then** invalid evidence cannot drive gauges, signer totals, eviction or quorum. [US-1-S3]

### US-2: Attribution, coverage and independent health (Priority: P0)
As a on-call reader, I want to inspect provenance and phase availability separately from chain progress so that source silence is never mistaken for global inactivity.

**Why this priority**: Evidence integrity is prerequisite to safe interpretation.
**Scope**: This story does NOT cover history controls and secondary comparison.
**Independent Test**: Replay coherent and interrupted source snapshots while changing current transport provider.
**Acceptance Scenarios**:

1. **Given** instance 120/2/P is established from A with coherent head/parent/rights, **When** A supplies a full validated-pending snapshot afterwards with no phase votes, **Then** that phase reports source-snapshot measured zero, not global completeness. [US-2-S1]
2. **Given** only preattestation D1 has arrived or rights/identity is missing, **When** the attestation panel renders, **Then** the other phase remains unavailable/partial; positive observed power explicitly states partial coverage. [US-2-S2]
3. **Given** A reconnects while a valid head advances and old evidence came from B, **When** the panel refreshes, **Then** chain progress and observer health remain independent; old B evidence retains B requested/observed context and honest receipt/freshness. [US-2-S3]

### US-3: Context-safe auxiliary data and ahead evidence (Priority: P0)
As a consensus reader, I want to reconcile ahead observations with their observer context so that delayed heads and forks cannot corrupt counted evidence.

**Why this priority**: Evidence integrity is prerequisite to safe interpretation.
**Scope**: This story does NOT cover comparison user workflow and visual layout.
**Independent Test**: Drive same-height forks, slow responses and source-local ahead evidence in deterministic RPC fixtures.
**Acceptance Scenarios**:

1. **Given** global applied head A is 120 while B provides identifiable level 123 evidence, **When** that evidence arrives before B head/rights, **Then** retain it unresolved, with no quorum; once B coherent current 122 or 123 context establishes target and rights, count it without global clock/head rejection. [US-3-S1]
2. **Given** rights/eligibility were requested for head H1 and same-height reorg establishes H2, **When** H1 response arrives late, **Then** H1 cannot populate H2 context; eligibility exposes requested context, age, stale/unknown state; freshness lasts at most 60 seconds with exact coherent context, invalidation immediately stale; reuse requires contextual justification. [US-3-S2]
3. **Given** many unresolved observations refer to one new material context, **When** reconciliation fails or repeats, **Then** one workflow per network/source; at most one attempt per 15 seconds for new material context; no permanent polling/fallback cascade; failure stays unresolved; eligibility keeps bounded workers and no Mainnet fanout. [US-3-S3]

### US-4: Collection lifecycle (Priority: P0)
As a browser reader, I want to pause all observation work or hide the page so that privacy and resource limits apply to every external request.

**Why this priority**: Evidence integrity is prerequisite to safe interpretation.
**Scope**: This story does NOT cover pinning and comparison semantics.
**Independent Test**: Record all stream/helper/alias/comparison requests around lifecycle transitions.
**Acceptance Scenarios**:

1. **Given** document is initially hidden, **When** application initializes, **Then** no external collection or auxiliary work starts. [US-4-S1]
2. **Given** streams, rights, aliases, eligibility and comparison are in flight, **When** reader pauses or document becomes hidden or pagehide fires, **Then** all external work is cancelled and no cancelled response can commit. [US-4-S2]
3. **Given** reader resumes after repeated pause/hidden transitions, **When** new generation starts and old responses resolve, **Then** only current permitted generation commits; retries remain bounded. [US-4-S3]

### US-5: Bounded session inspection (Priority: P1)
As a investigating reader, I want to pin a candidate or past instance while collection continues so that inspection stays stable until intentionally returning live.

**Why this priority**: Makes accepted evidence usable for investigation independently of other inspection controls.
**Scope**: This story does NOT cover ASTRA composition/palette/assets and archival completeness.
**Independent Test**: Run overflow and multi-update browser fixtures with keyboard focus and nested scroll.
**Acceptance Scenarios**:

1. **Given** two accepted same-round candidates and a retained historical instance exist, **When** reader pins one and new observations arrive, **Then** pin, source/context/phase signer committee evidence, peaks, receipts, disclosures/sort/search/focus/scroll remain stable; newer-items count/action is shown. [US-5-S1]
2. **Given** 150 histories, 100 accepted candidates and 100 unresolved candidates are retained per network, **When** one additional entry arrives in each category, **Then** oldest receipt eviction enforces independent bounds; replay does not duplicate; unresolved cannot evict accepted; enormous claimed level does not determine eviction. [US-5-S2]
3. **Given** pinned history is oldest and evicted, **When** collection advances and reader chooses follow-live, **Then** one frozen snapshot per network remains clearly outside retained history until coherent follow-live; pause remains separate. [US-5-S3]

### US-6: Searchable committee evidence (Priority: P1)
As a delegate investigator, I want to search alias or address with phase-specific evidence so that participation and eligibility can be inspected without losing place.

**Why this priority**: Makes accepted evidence usable for investigation independently of other inspection controls.
**Scope**: This story does NOT cover watched-delegate filters and network-wide inactivity claims.
**Independent Test**: Search and sort a long real-page fixture across several incoming votes.
**Acceptance Scenarios**:

1. **Given** committee D1 alias Baker Alpha has power 3 of total 5 and only preattestation observed, **When** reader searches Alpha or D1 address, **Then** same delegate shows phase-specific receipt, exact power/share, eligibility and context. [US-6-S1]
2. **Given** reader sets a sort and focuses search while scrolling committee, **When** multiple operations/aliases arrive, **Then** sorting/disclosure/search/focus/scroll remain stable; new alias can match without moving inspection target unexpectedly. [US-6-S2]
3. **Given** source has interrupted coverage or missing rights/eligibility, **When** reader filters absent phase receipt, **Then** absence remains source-limited/unavailable and cannot label delegate network-wide inactive or falsely complete missing set. [US-6-S3]

### US-7: Independent bounded comparison (Priority: P1)
As a source investigator, I want to explicitly compare selected context to one different provider so that agreement and divergence are visible without pooled voting power.

**Why this priority**: Makes accepted evidence usable for investigation independently of other inspection controls.
**Scope**: This story does NOT cover automatic polling, archive and cascading fallback.
**Independent Test**: Trigger authentic browser comparison against controlled second-source endpoint fixtures.
**Acceptance Scenarios**:

1. **Given** selected A context 120/H1/2/P and compatible B head/rights are available, **When** reader triggers comparison, **Then** display independently attributed agreement/divergence/partial with head hash/level/round/time/network identity; optional pending snapshot uses only coherent rights; never sum A/B power. [US-7-S1]
2. **Given** B has wrong network, unproven rights, fails or exceeds timeout, **When** reader triggers comparison, **Then** unknown-power raw observations or unavailable are honest; at most three endpoint reads, eight seconds each, one workflow, no retry/cascade/periodic refresh. [US-7-S2]
3. **Given** comparison result or request belongs to prior selected context, **When** selection changes, pause or hidden occurs, **Then** cancel obsolete work; old result remains stale/attributed rather than agreement for new context; same-context results become stale after 60 seconds without auto-refresh and always expose receipt time. [US-7-S3]

### US-8: Identity-safe events and applied values (Priority: P0)
As a consensus reader, I want to inspect trustworthy progression and threshold events so that selection changes cannot fabricate consensus.

**Why this priority**: Evidence integrity is prerequisite to safe interpretation.
**Scope**: This story does NOT cover verified finality and timeline redesign.
**Independent Test**: Replay threshold boundaries while changing source/candidate/payload and historical selection.
**Acceptance Scenarios**:

1. **Given** same precise network/level/round/payload/candidate/source/context rises from power 3 to 4 with threshold 4, **When** the accepted observation commits, **Then** one justified threshold event retains exact identity/provenance and history. [US-8-S1]
2. **Given** old selected instance power 3 and newly selected candidate/source/history power 4, **When** reader changes selection, **Then** no fabricated crossing or progression event joins different identities or contexts. [US-8-S2]
3. **Given** applied block level 120 round 2/time T and calculated opportunity level 121 exist, **When** reader inspects current values, **Then** actual applied values remain primary and separate from selected consensus/opportunity; planned 121 cannot masquerade as applied level; exact threshold/deficit audited without percentage rounding; observed blocks expose block hash, and conditional same-level next round versus next-level round zero opportunities expose expected proposer from coherent RPC rights, source/context and protocol-prediction countdown or unavailable state; future hash stays unavailable until observed; same-level round progression is distinguished from applied next-level advancement. [US-8-S3]


## Challenges

| ID | Story | Challenge | Resolution |
|---|---|---|---|
| C-1 | US-1 S1/S2; US-8 S1 | Two block identities share level/round/payload, while consensus operations identify payload rather than block hash. What precisely associates a vote with each candidate, and what candidate-specific threshold claim is justified when that association is unavailable? “Same precise candidate” cannot silently manufacture evidence absent from the operation. | Root Q1: consensus power belongs to source/context/level/round/payload/phase. Same-payload candidates can display explicitly shared payload evidence, never candidate-specific signature/producer inference or summed duplicate power. |
| C-2 | US-1 S2/S3 | Is a delegate signing competing payloads counted once separately for each payload or rejected as contradictory evidence? The story prohibits combined payload power but does not define a conflicting delegate's per-payload receipt and power. | Root Q1: a conflicting delegate counts once independently per payload; expose conflict; never combine payloads. |
| C-3 | US-1 S3 | What is the rejection unit for a malformed rights row, contradictory duplicate, aggregate signer or threshold: the row, operation, full committee, or selected instance? Valid evidence must not disappear or remain apparently authoritative by an unspecified partial rejection policy. | Root Q1: malformed operation/aggregate rejects that whole operation. Contradictory/incomplete committee or invalid threshold invalidates numerical authority; preserve valid raw votes as uncounted evidence. |
| C-4 | US-1 S3; US-8 S3 | Individually safe integers can sum beyond the safe-integer boundary. What makes a total, cumulative power, signer count and derived deficit valid when every input passes its individual check? Are zero total/zero threshold admissible, and which timestamp formats and invalid dates are rejected? | Root Q1: totals/threshold positive safe integers, threshold<=total, safely checked cumulative arithmetic and unique signer totals/deficits. Timestamp strict RFC3339/ISO8601 with explicit timezone convertible to UTC, legitimate calendar datetime and finite date; legitimate offsets allowed, rollover malformed dates rejected. |
| C-5 | US-2 S1/S2 | After a valid zero snapshot, a source disconnects or later delivers a partial batch. Does the old phase remain a timestamped measured zero, become stale/partial, or become unavailable? The required source-limited meaning is clear; the transition of the displayed phase state is not. | Root Q1: interrupted coverage makes live zero stale/partial; retain timestamped coherent zero in historical evidence without present completeness claim. |
| C-6 | US-2 S1 | What proves that a pending response is a usable *full validated-pending snapshot* rather than an omitted field, truncated response, partial successful parse or snapshot spanning a head transition? The story requires completeness of a source snapshot without specifying its observable validation boundary. | Root Q1: successful complete validated array/body, relevant consensus entries parseable and coherent unchanged same-source context; snapshot follows identity establishment. Unrelated valid nonconsensus entries do not invalidate. Structural truncation/omitted validated/malformed relevant entry cannot certify completeness. |
| C-7 | US-2 S3 | What evidence/time rule distinguishes progressing, connected-without-progress, reconnecting-with-progress and unknown? Receipt age, head timestamp and transport state may disagree; no observable state transition boundary is specified. | Root Q1: progression from observed transitions, stall indication tied coherent protocol prediction and observed evidence; missing/disconnected observer never establishes global chain stall. Unavailable inputs give unknown; observer transport state remains independent. |
| C-8 | US-2 S3; US-3 S2 | Does “immutable freshness information” mean immutable receipt/context facts with a changing age/state, or a permanently frozen freshness label? Historical data cannot be relabelled by providers, but elapsed time must not leave an old result falsely fresh. | Root Q1: receipt/source/context facts immutable; elapsed age and current stale/partial state evolve. Monotonic elapsed age/order avoids wall clock jumps; wall timestamps remain honest receipt labels. |
| C-9 | US-3 S1/S2 | Precisely what context establishes current/current+1 across a fork: network identity, source, head hash, predecessor, protocol, target level, round and payload? What happens when the same source changes its validated head while previously accepted target evidence remains inspectable? | Root Q2: contextual facts include proven chain id, observer endpoint, requested head hash/predecessor/protocol and target level/round/payload/candidate as available. Unknown fields remain explicit; power needs necessary proven context. Reorg immediately invalidates live authority without rewriting historical provenance. No parent inference from level. |
| C-10 | US-3 S3 | “At most one attempt per 15 seconds for a new material context” does not define material equality or whether the rate limit is per source or per distinct context. Does rapidly changing context permit multiple starts within 15 seconds, and may a failed unchanged context ever be retried on a later explicit observation? | Root Q2: per network/source starts separated by >=15 seconds, one in-flight workflow and one coalesced newest material context (change in proven head/parent/protocol/target identity); failed unchanged context may retry only upon explicit fresh manual action after cooldown. No permanent polling or cascading. |
| C-11 | US-3 S3; US-4 S3 | One workflow per network/source does not bound the number of sources, queued contexts, response size or unresolved operations within a candidate. What observable resource bounds prevent a flood of source identities or same-candidate operations from bypassing the 100-candidate quarantine? | Root Q2: configured provider pool only, one queued material context per source, existing10000 stored-operation cap per network plus separate100 unresolved candidates; bounded/truncated snapshot is explicitly partial and cannot certify zero. Valid raw historical provenance remains inspectable despite unavailable numerical authority. Eligibility max3 concurrent workers and no Mainnet fanout. |
| C-12 | US-4 S2/S3 | How do manual pause, hidden visibility and pagehide combine? After a user pauses, may visibility restoration resume collection? After pagehide followed by back/forward-cache restoration, what permits a fresh generation and what still prevents external work? | Root Q2: manual pause persists across visibility/pagehide/BFCache; visible pageshow can resume only if collection remains enabled, using fresh generation. Hidden/paused starts no external work. |
| C-13 | US-4 S2 | Are aliases and cached auxiliary data allowed to update the visible inspector after cancellation without a network response committing? The story names cancellation but does not distinguish locally available permitted updates from forbidden obsolete-generation commits. | Root Q2: pure local rendering and coherent cached inspection are allowed while paused; no external reads or obsolete/cancelled-generation response commits. |
| C-14 | US-5 S1; US-6 S2 | “Pin ... evidence ... remain stable” conflicts with late evidence for the pinned identity and aliases arriving during search. Is pinned evidence an immutable snapshot, or may same-identity facts update while inspection state stays stable? Which receipt/power/eligibility/alias fields can change? | Root Q3: pin locks selected identity and reader controls; later immutable same-identity accepted evidence may update retained view. Evicted pin becomes one static explicitly frozen copy per network; selecting new pin replaces it. |
| C-15 | US-5 S2 | What uniquely identifies a full session instance versus active accepted candidate versus unresolved candidate, including multiple observers and shared payload? Does promotion remove the unresolved entry, and can the same identity consume several retention slots across categories? | Root Q3: session instance is source/context/network/level/round/payload with distinct candidate hashes retained inside it. Candidate identities include observer/chain/block hash; unresolved consensus identity never fabricates a block hash. Promotion removes quarantine duplicate. Accepted candidate and full-history products remain separately bounded. |
| C-16 | US-5 S2 | Which receipt controls oldest eviction: first observation, latest replay, latest genuine new evidence, or promotion receipt? How are equal receipts ordered? Replays must not duplicate, but unspecified receipt refresh can let repeated evidence displace newer distinct identities. | Root Q3: oldest first monotonic receipt, lexical stable identity tie; replay never refreshes eviction order. |
| C-17 | US-5 S1/S3 | What does “newer-items count” count, when does it reset, and what does its action select? What happens when follow-live finds no coherent candidate, or when an evicted frozen pin is replaced by another pin? The single frozen-snapshot bound alone does not define these user-visible outcomes. | Root Q3: newer-items uses one clearly defined selectable identity unit (distinct candidate identity, or distinct candidate-free instance if no candidate yet), never doublecounts its instance and candidate. Count first accepted arrivals after pin baseline, exclude replay/late same-identity facts. Action returns newest coherent LIVE-eligible context by receipt; no coherent current candidate yields explicit live unavailable state, never stale historical selection. |
| C-18 | US-6 S1/S2 | What constitutes an alias/address search match: substring versus exact, case sensitivity, empty input and missing/changing alias? Which explicit sort keys and tie ordering must remain stable? A test cannot assert search or ordering without these semantics. | Root Q3: trim query; case-insensitive alias/address substring; empty shows all. Explicit address/alias/power sort with address tie; reader sort order does not change automatically on receipt/alias arrival. New matches append without reordering existing rows; explicit user resort is allowed. |
| C-19 | US-6 S1/S3 | Does the searchable committee include received delegates, absent delegates, unresolved signer identities and delegates excluded by invalid rights? What phase-specific receipt states distinguish unavailable coverage, observed absence in a snapshot and later received evidence? | Root Q3: committee rows are validated-rights delegates. Unknown-rights signer observations remain separately inspectable. Per-phase receipt distinguishes received, absent in a usable source snapshot, partial/unavailable; no fabricated rights or network-wide inactivity. |
| C-20 | US-7 S1/S2 | What constitutes agreement versus divergence versus partial when B is on a later level, shares payload but has a different block hash, or cannot prove selected historical A context? A fetched current B head must not become an unsupported comparison of the selected historical instance. | Root Q4: comparison names exact proven fields/context: matching source B network/head hash/level/round/time gives head agreement only; never proves payload-vote agreement or finality. Conflicting proven fields give divergence, shared payload/different candidate hash remains divergence. Insufficient selected historical context gives partial/unavailable, with current B head separately labelled. Unknown comparison never becomes full agreement from head match alone. Within the three-read budget, coherent cached rights may be reused only with proven chain/head/protocol/target compatibility and original rights provenance retained, never relabelled as source B rights. Without compatible rights, raw unknown-power partial comparison is valid and cannot trigger extra reads. |
| C-21 | US-7 S2 | Which endpoint reads count toward three, including network identity checks, rights reuse validation, redirects and incomplete bodies? Are eight seconds measured from each request start through body parsing, and is a workflow allowed to last 24 seconds? What occurs on an explicit second click during the first workflow? | Root Q4: all RPC endpoint reads (identity/head/rights/pending included) count against3; redirect/body completion inside original read's8-second deadline, no extra follow-up beyond budget. Workflow <=24 seconds, second click disabled/coalesced with no extra reads; no retries/cascade/polling. |
| C-22 | US-7 S3 | Does the exact 60-second boundary remain fresh at age 60 seconds or stale at that instant? Which clock defines elapsed age if wall time changes? If selected context changes away and back, can the old attributed result regain freshness before its expiry, or does invalidation remain permanent? | Root Q4 and Step2: age>=60 seconds is stale using monotonic elapsed time; exact context invalidation sticky even after switching away/back; receipt wall time always shown. No auto-refresh. |
| C-23 | US-8 S1 | Is a threshold event distinct per phase, and does a first accepted observation already at quorum create an event without a prior observed below-threshold state? Can later rights correction or an observed reduction followed by recovery emit another crossing for the same identity? | Root Q1: crossing requires prior observed below threshold for identical phase/identity/context; first observation at threshold gives observed quorum without invented crossing. At most one crossing per phase identity/context; recorded maximum and identity dedup mean transport loss, selection and render cannot reset it. |
| C-24 | US-8 S1/S2 | Events must retain history, but no event retention bound or relationship to evicted session history is declared. Which identity facts survive eviction, and can repeated render/resume/reconciliation of the same accepted observation duplicate an event? | Root Q3: max12 immutable compact events per network independent of session-history eviction, retaining identity/provenance; accepted observation replay/render/resume cannot duplicate event. |
| C-25 | US-8 S3 | Which explicit conditions choose the same-level next-round and next-level round-zero opportunity branches, and can both be shown simultaneously? What evidence establishes the expected proposer when coherent RPC baking rights have missing rounds or contradictory rows? The observed block hash is mandatory; a future hash remains unavailable until observed. | Root Q4: same-level R+1 and next-level R0 conditional branches may coexist. Coherent context-pinned RPC baking rights establish expected producer; missing/conflicting rights make it unknown. Observed candidate exposes block hash; no future hash before observation. |
| C-26 | US-8 S3 | What protocol inputs, reference timestamp and clock assumptions justify the prediction countdown, and what is shown when the predicted time passes without an observed block? What exact observed change qualifies as same-level round progression versus applied next-level advancement across a reorg or skipped delivered heads? | Root Q4: coherent protocol timing/reference head timestamp justify predicted countdown, next-level timer explicitly earliest protocol boundary conditional on hypothetical production, never promised actual timestamp. Missing inputs give unavailable. Expiry says prediction elapsed/awaiting observation. Observed same-level round advance is distinct from observed/applied next-level advance; same-height reorg and skipped delivered levels explicitly labelled, no invented intermediate blocks/events. Later ASTRA can use these facts; movement/layout remain out of scope. |
| C-27 | US-7; US-3 | Prior art **Explorus prioritized backup cascade** does sequential provider fallback; stories assume an explicit independent comparison without cascade—justify divergence/adopt Y. Separately, the prior-art table mentions retaining contextual primary fallback: which primary paths may still cascade, and how are their source identities preserved? | Root Q4: retain bounded existing primary fallback only with immutable actual response source/context. Explicit comparison and reconciliation have no automatic fallback. Divergence from Explorus cascade justified by independent source-limited comparison and bounded request contract. |
| C-28 | US-2; US-6; US-8 | Prior art **Explorus quorum/network-health and missing/finalized labels** does broader health/missing/finality presentation; stories assume source-limited evidence and exclude unverified finality/network-wide inactivity—justify divergence/adopt Y. Which evidence-supported labels remain allowed so users do not infer the excluded claim from an ambiguous “missing” or “healthy” state? | Root Q4/Q1: divergence from Explorus broader labels justified by unavailable global completeness/finality evidence. Labels name selected-source observed/absent/partial/unavailable and exact compared fields; no ambiguous global healthy/missing/finalized claims. |
| C-29 | US-5; US-7 | Prior art **Teztale archived multi-observer history and observer-difference timelines** does archived multi-observer inspection; stories assume bounded browser-session history, explicit single-provider comparison and deferred receipt timelines—justify divergence/adopt Y. What session boundary and restart behavior makes loss of historical evidence explicit to a reader? This prior-art claim derives from the supplied pinned-source local review, not a fresh successful GitLab fetch. | Root Q3: Teztale archived multi-observer/timelines excluded by explicit bounded browser-session contract; session reset/reload is disclosed as nonarchival loss. Provenance and explicit independent comparison retained, no archival receipt-timeline adoption in foundations; maintainer branching navigation remains required for later ASTRA. |

All29 resolved by explicit root decisions. Clarification questions1 plus resolution questions4 exhausted the five-question elicitation budget; final validation quiz is separate.

## Functional Requirements

### US-1: Identity and exact power

- **FR-001** [US-1]: When proposals arrive, the reader MUST be able to select distinct observer/chain/block-hash candidate identities independently, including candidates sharing level, round and payload. Scenario trace: [US-1-S1].
- **FR-002** [US-1]: When replay arrives, accepted evidence MUST deduplicate by its precise identity. Scenario trace: [US-1-S1].
- **FR-003** [US-1]: When displaying candidate producer attribution, the observatory MUST require evidence matching that candidate and show unknown when it is unavailable. Scenario trace: [US-1-S1].
- **FR-004** [US-1]: When counting votes, the observatory MUST attribute power to source/context/network/level/round/payload/phase and count each delegate once across individual and aggregate replay. Scenario trace: [US-1-S2].
- **FR-005** [US-1]: When candidates share a payload, the observatory MUST label payload-only voting evidence as shared evidence without inventing candidate-specific signatures. Scenario trace: [US-1-S1].
- **FR-006** [US-1]: When a delegate votes for competing payloads, the observatory MUST expose the conflict and count that delegate once independently within each payload. Scenario trace: [US-1-S2].
- **FR-007** [US-1]: When inspecting competing payloads or sources, the observatory MUST NOT combine their powers into a quorum. Scenario trace: [US-1-S2].
- **FR-008** [US-1]: When an operation or aggregate contains malformed relevant consensus evidence, the observatory MUST reject the entire operation as counted evidence. Scenario trace: [US-1-S3].
- **FR-009** [US-1]: When committee evidence is incomplete or contradictory or its threshold is invalid, the observatory MUST withdraw numerical authority while preserving valid raw votes as uncounted inspectable evidence. Scenario trace: [US-1-S3].
- **FR-010** [US-1]: When accepting integer consensus values, the observatory MUST require finite safe integers with nonnegative levels, rounds, powers and signer counts and positive committee totals and thresholds no greater than the total. Scenario trace: [US-1-S3].
- **FR-011** [US-1]: When computing accumulated power, unique signer totals or quorum deficit, the observatory MUST check safe arithmetic and expose exact integer values independent of percentage rounding. Scenario trace: [US-1-S2; US-1-S3].
- **FR-012** [US-1]: When accepting applied timestamps, the observatory MUST require a legitimate finite calendar datetime in RFC3339/ISO8601 with an explicit timezone convertible to UTC, accepting legitimate offsets and rejecting rollover dates. Scenario trace: [US-1-S3; US-8-S3].

### US-2: Attribution, coverage and independent health

- **FR-013** [US-2]: When accepting proposals, votes, rights, eligibility, history or events, the observatory MUST retain immutable actual source, requested/observed context and honest wall receipt facts despite provider changes. Scenario trace: [US-2-S3].
- **FR-014** [US-2]: When reporting age, freshness or eviction order, the observatory MUST use monotonic elapsed time while preserving wall receipt labels. Scenario trace: [US-2-S3].
- **FR-015** [US-2]: When reporting measured phase zero, the observatory MUST require a successful complete validated-pending body with parseable relevant consensus entries, received after exact instance establishment from the same observer under unchanged coherent head/parent/rights context. Scenario trace: [US-2-S1].
- **FR-016** [US-2]: When a snapshot omits validated evidence, is structurally truncated, contains malformed relevant entries, or is bounded to partial contents, the observatory MUST NOT certify complete phase coverage or measured zero. Scenario trace: [US-2-S1; US-2-S2].
- **FR-017** [US-2]: When validating a complete snapshot, the observatory MUST allow unrelated valid nonconsensus entries without invalidating its completeness. Scenario trace: [US-2-S1].
- **FR-018** [US-2]: When rights, usable identity or sufficient phase coverage are absent, the observatory MUST show unavailable/partial rather than measured zero or a complete missing-delegate set. Scenario trace: [US-2-S2].
- **FR-019** [US-2]: When showing positive power under incomplete coverage, the observatory MUST explicitly label it observed power with partial coverage. Scenario trace: [US-2-S2].
- **FR-020** [US-2]: When coherent zero coverage becomes interrupted, the observatory MUST make live zero stale/partial while retaining its timestamped historical source-snapshot meaning. Scenario trace: [US-2-S1; US-2-S3].
- **FR-021** [US-2]: When presenting phase presence or absence, the observatory MUST identify the selected-source scope without claiming global completeness, network-wide inactivity or unverified finality. Scenario trace: [US-2-S2].
- **FR-022** [US-2]: When reporting chain progress, the observatory MUST derive progression from observed transitions independently of transport health, including connected-without-progress, reconnecting-with-progress and unknown outcomes. Scenario trace: [US-2-S3].
- **FR-023** [US-2]: When reporting a stall indication, the observatory MUST require coherent protocol prediction and observed evidence and show unknown when these inputs are unavailable. Scenario trace: [US-2-S3].
- **FR-024** [US-2]: When an observer is missing or disconnected, the observatory MUST NOT treat that alone as evidence of a global chain stall. Scenario trace: [US-2-S3].

### US-3: Context-safe auxiliary data and ahead evidence

- **FR-025** [US-3]: When attributing contextual evidence, the observatory MUST expose proven chain identity, observer endpoint, requested head hash/predecessor/protocol and target level/round/payload/candidate as available, with unknown fields explicit. Scenario trace: [US-3-S1; US-3-S2].
- **FR-026** [US-3]: When ahead evidence lacks numerical context, the observatory MUST retain it separately attributable and unresolved without counted quorum. Scenario trace: [US-3-S1].
- **FR-027** [US-3]: When admitting ahead power, the observatory MUST require the same observer's validated-block/head context to establish target current level or current level plus one with coherent rights. Scenario trace: [US-3-S1].
- **FR-028** [US-3]: When evaluating ahead observations, the observatory MUST NOT reject them solely by another observer's applied head, a clock ceiling or an arbitrary numerical future window. Scenario trace: [US-3-S1].
- **FR-029** [US-3]: When establishing context, the observatory MUST NOT infer parent identity from level alone. Scenario trace: [US-3-S1; US-3-S2].
- **FR-030** [US-3]: When reusing rights, baking rights or eligibility, the observatory MUST justify reuse against the exact coherent requested context. Scenario trace: [US-3-S2].
- **FR-031** [US-3]: When a reorg, source divergence or obsolete response invalidates context, the observatory MUST immediately withdraw its live authority without contaminating another context or rewriting historical provenance. Scenario trace: [US-3-S2].
- **FR-032** [US-3]: When displaying eligibility, the observatory MUST show context, receipt age and unknown/stale state, treating age at least 60 seconds or context invalidation as stale. Scenario trace: [US-3-S2].
- **FR-033** [US-3]: When reconciling context per network/source, the observatory MUST permit at most one in-flight workflow and one coalesced newest material context, with all starts separated by at least 15 seconds. Scenario trace: [US-3-S3].
- **FR-034** [US-3]: When deciding material context change, the observatory MUST use changes in proven head, parent, protocol or target identity. Scenario trace: [US-3-S3].
- **FR-035** [US-3]: When reconciliation fails for an unchanged context, the observatory MUST leave evidence unresolved and permit another attempt only after an explicit fresh manual action and the cooldown. Scenario trace: [US-3-S3].
- **FR-036** [US-3]: When reconciling context, the observatory MUST NOT permanently poll, cascade providers or force stored-operation duplication. Scenario trace: [US-3-S3].
- **FR-037** [US-3]: When collecting evidence, the observatory MUST restrict providers to the configured pool and retain at most 10000 stored operations per network. Scenario trace: [US-3-S3].
- **FR-038** [US-3]: When requesting eligibility, the observatory MUST limit concurrent workers to three and avoid Mainnet fanout. Scenario trace: [US-3-S3].

### US-4: Collection lifecycle

- **FR-039** [US-4]: When initialized hidden or manually paused, the observatory MUST start no external collection or auxiliary requests. Scenario trace: [US-4-S1].
- **FR-040** [US-4]: When manual pause, hidden visibility or pagehide occurs, the observatory MUST cancel all external work including streams, rights, baking rights, eligibility, aliases and comparison. Scenario trace: [US-4-S2].
- **FR-041** [US-4]: When visibility, pageshow or BFCache restoration occurs, the observatory MUST preserve manual pause and resume only if collection remains enabled and the document is visible. Scenario trace: [US-4-S3].
- **FR-042** [US-4]: When resuming permitted collection, the observatory MUST start a fresh generation without unbounded retries. Scenario trace: [US-4-S3].
- **FR-043** [US-4]: When an obsolete or cancelled-generation response resolves, the observatory MUST NOT commit it even after resume into identical context. Scenario trace: [US-4-S2; US-4-S3].
- **FR-044** [US-4]: When the reader inspects paused data, the observatory MUST permit pure local rendering and coherent cached inspection without external reads. Scenario trace: [US-4-S2].

### US-5: Bounded session inspection

- **FR-045** [US-5]: When retaining session instances, the observatory MUST distinguish source/context/network/level/round/payload identities while retaining distinct candidate block hashes inside each instance and leaving unresolved block hashes unknown. Scenario trace: [US-5-S2].
- **FR-046** [US-5]: When retention fills, the observatory MUST enforce independently per network 150 full session instances, 100 accepted candidates and 100 unresolved candidates. Scenario trace: [US-5-S2].
- **FR-047** [US-5]: When unresolved candidates arrive, the observatory MUST NOT evict accepted candidates to accommodate them. Scenario trace: [US-5-S2].
- **FR-048** [US-5]: When unresolved evidence becomes accepted, the observatory MUST remove its quarantine duplicate. Scenario trace: [US-5-S2].
- **FR-049** [US-5]: When evicting retained identities, the observatory MUST use oldest first monotonic receipt with lexical stable-identity ties, without refreshing order on replay or using claimed level. Scenario trace: [US-5-S2].
- **FR-050** [US-5]: When retaining inspection data, the observatory MUST preserve candidate identities, phase signer/committee evidence, exact peak powers, provenance, coverage and honest receipt dates. Scenario trace: [US-5-S1].
- **FR-051** [US-5]: When the reader pins an identity and later observations arrive, the observatory MUST preserve that selected identity, disclosures, sort, search, focus and scroll independently of continued collection. Scenario trace: [US-5-S1].
- **FR-052** [US-5]: When later accepted facts concern the retained pinned identity, the observatory MUST allow those immutable facts to enrich its view without moving selection or reader controls. Scenario trace: [US-5-S1].
- **FR-053** [US-5]: When pinned history is evicted, the observatory MUST retain one static frozen snapshot per network explicitly outside retained history, replacing it when the reader selects a new pin. Scenario trace: [US-5-S3].
- **FR-054** [US-5]: When displaying newer items after pinning, the observatory MUST count first accepted arrivals after the pin baseline using distinct candidate identities or candidate-free instance identities, excluding replay, late same-identity facts and instance/candidate double counting. Scenario trace: [US-5-S1].
- **FR-055** [US-5]: When the reader follows live, the observatory MUST return the newest coherent LIVE-eligible context by receipt or explicitly show live unavailable when no coherent current selection exists. Scenario trace: [US-5-S3].
- **FR-056** [US-5]: When the reader pins or follows live, the observatory MUST keep that inspection action independent from pause/resume collection. Scenario trace: [US-5-S3].
- **FR-057** [US-5]: When the session resets or reloads, the observatory MUST disclose loss of bounded browser-session history as nonarchival. Scenario trace: [US-5-S2].

### US-6: Searchable committee evidence

- **FR-058** [US-6]: When searching committee evidence, the observatory MUST trim the query and apply case-insensitive alias/address substring matching, with empty query showing all validated-rights delegates. Scenario trace: [US-6-S1].
- **FR-059** [US-6]: When displaying a committee delegate, the observatory MUST expose exact power/share, eligibility/context and separate preattestation/attestation receipt states of received, absent in a usable source snapshot or partial/unavailable. Scenario trace: [US-6-S1; US-6-S3].
- **FR-060** [US-6]: When rights do not establish an observed signer as a committee delegate, the observatory MUST keep its unknown-rights observation separately inspectable without fabricating a committee row. Scenario trace: [US-6-S3].
- **FR-061** [US-6]: When the reader sorts, the observatory MUST support explicit address, alias and power ordering with address ties. Scenario trace: [US-6-S2].
- **FR-062** [US-6]: When operations or aliases arrive, the observatory MUST preserve reader ordering, disclosures, search, focus and scroll and append new matches without reordering existing rows until explicit user resort. Scenario trace: [US-6-S2].
- **FR-063** [US-6]: When filtering absent phase receipts, the observatory MUST preserve source-limited coverage qualifications without implying network-wide inactivity or complete missing sets from unavailable evidence. Scenario trace: [US-6-S3].

### US-7: Independent bounded comparison

- **FR-064** [US-7]: When the reader explicitly requests comparison, the observatory MUST compare the selected network/context with one different configured provider independently of primary-source voting power. Scenario trace: [US-7-S1].
- **FR-065** [US-7]: When reporting comparison, the observatory MUST expose exact proven network identity, head hash, level, round and time, with agreement, divergence, partial or unavailable outcomes. Scenario trace: [US-7-S1].
- **FR-066** [US-7]: When those head fields match, the observatory MUST label head agreement only without implying payload-vote agreement or finality. Scenario trace: [US-7-S1].
- **FR-067** [US-7]: When proven fields conflict, including different candidate hashes sharing a payload, the observatory MUST report divergence. Scenario trace: [US-7-S1].
- **FR-068** [US-7]: When selected historical context is insufficient to compare, the observatory MUST report partial/unavailable and label any fetched current second-source head separately. Scenario trace: [US-7-S2].
- **FR-069** [US-7]: When optional pending evidence lacks proven network/context or coherent context-pinned rights, the observatory MUST leave raw observations unknown-power or unavailable without borrowing an incompatible committee. Scenario trace: [US-7-S2].
- **FR-070** [US-7]: When comparison is running, the observatory MUST permit one in-flight workflow with at most three endpoint reads total, including identity, head, rights and pending reads, each completed including redirects and body within eight seconds, and total workflow at most 24 seconds. Scenario trace: [US-7-S2].
- **FR-071** [US-7]: When a second comparison click occurs in flight, the observatory MUST disable or coalesce it without additional reads. Scenario trace: [US-7-S2].
- **FR-072** [US-7]: When comparing or reconciling, the observatory MUST NOT automatically retry, cascade providers or periodically refresh. Scenario trace: [US-7-S2].
- **FR-073** [US-7]: When selected context changes, pause occurs or the page becomes hidden, the observatory MUST cancel obsolete comparison work and retain any prior result only as attributed stale evidence. Scenario trace: [US-7-S3].
- **FR-074** [US-7]: When comparison age reaches 60 seconds, the observatory MUST mark it stale using monotonic age and always display its wall receipt time. Scenario trace: [US-7-S3].
- **FR-075** [US-7]: When context invalidation occurs, the observatory MUST keep comparison invalidation sticky even if the reader returns to that context before expiry. Scenario trace: [US-7-S3].
- **FR-076** [US-7]: When existing bounded primary fallback succeeds, the observatory MUST preserve actual responding source/context rather than attributing the response to the originally requested provider. Scenario trace: [US-7-S2; US-3-S2].

- **FR-090** [US-7]: When comparison reuses cached rights within its read budget, the observatory MUST prove chain/head/protocol/target compatibility and preserve those rights' original provenance without relabelling them as second-source rights. Scenario trace: [US-7-S2].

### US-8: Identity-safe events and applied values

- **FR-077** [US-8]: When recording a threshold crossing, the observatory MUST require a prior accepted below-threshold observation and subsequent threshold attainment for the identical phase and precise source/context/network/level/round/payload/candidate identity, respecting payload-only shared attribution. Scenario trace: [US-8-S1].
- **FR-078** [US-8]: When first observation is already at threshold, the observatory MUST show observed quorum without inventing a threshold crossing. Scenario trace: [US-8-S1].
- **FR-079** [US-8]: When an identity has already crossed threshold, the observatory MUST retain its exact maximum and emit at most one crossing per phase/identity/context despite rights changes, reductions/recovery, transport loss, render, replay or resume. Scenario trace: [US-8-S1; US-8-S2].
- **FR-080** [US-8]: When payload, candidate, source, context or historical selection changes, the observatory MUST NOT join unrelated observations into a quorum or progression event. Scenario trace: [US-8-S2].
- **FR-081** [US-8]: When retaining events, the observatory MUST keep at most 12 immutable compact events per network with identity/provenance independently of session-history eviction. Scenario trace: [US-8-S1].
- **FR-082** [US-8]: When displaying chain values, the observatory MUST present validated actual applied level/round/time as primary and distinguish them from selected consensus and calculated opportunities. Scenario trace: [US-8-S3].
- **FR-083** [US-8]: When displaying an observed block, the observatory MUST expose its observed block hash. Scenario trace: [US-8-S3].
- **FR-084** [US-8]: When displaying future opportunities, the observatory MUST leave future block hash unavailable until observed. Scenario trace: [US-8-S3].
- **FR-085** [US-8]: When displaying conditional opportunities, the observatory MUST distinguish same-level next-round R+1 conditional on continued same-level production from next-level round-zero conditional on next-level production, allowing both branches to coexist. Scenario trace: [US-8-S3].
- **FR-086** [US-8]: When displaying an expected proposer, the observatory MUST require coherent context-pinned RPC baking rights and show unknown for missing or conflicting rights. Scenario trace: [US-8-S3].
- **FR-087** [US-8]: When displaying an opportunity countdown, the observatory MUST expose source/context and justify both conditional branches' protocol-prediction timers from coherent timing and reference-head timestamp, labelling the next-level timer as the earliest protocol boundary conditional on hypothetical production. Scenario trace: [US-8-S3].
- **FR-088** [US-8]: When prediction inputs are missing or prediction expires without observation, the observatory MUST show unavailable or prediction elapsed/awaiting observation respectively. Scenario trace: [US-8-S3].
- **FR-089** [US-8]: When displaying progression, the observatory MUST distinguish observed same-level round advance, applied next-level advance, same-height reorg and skipped delivered levels without inventing intermediate blocks or events. Scenario trace: [US-8-S3].

### Accepted planning clarifications

- **FR-091** [US-5]: When an active candidate is evicted while its session instance remains retained, the observatory MUST preserve historical candidate inspection separately from LIVE-active membership; each snapshot retains at most 100 candidate facts, discloses partial retention at that limit and protects currently pinned selection facts. A pin freezes on history-entry eviction, not merely active-index eviction. Scenario trace: [US-5-S1; US-5-S2; US-5-S3].
- **FR-092** [US-8]: When replay concerns a retired identity outside retained or admissible LIVE context, the observatory MUST NOT recreate a live crossing; uncertain prior crossing history permits observed-quorum or raw-evidence presentation without an invented crossing. Retirement requires provenance facts, and crossing memory remains bounded without weakening at-most-once behavior. Scenario trace: [US-8-S1; US-8-S2].
- **FR-093** [US-5]: When evidence is replayed or retained, the observatory MUST bound per-record raw provenance and replay growth through the accepted 10000-operation limit and unique delegate/identity facts while preserving mandatory attribution; candidate-fact truncation MUST NOT certify complete coverage or measured zero. Scenario trace: [US-5-S2; US-2-S1].
- **FR-094** [US-7]: When explicitly comparing sources, the observatory MUST prioritize identity and head reads, then pending as the default third read; compatible cached rights retain original provenance, otherwise power remains unknown. Any data-dependent choice requires pending to be known unavailable within that workflow and the same three-read budget, without retries, cascading or a fourth read. Scenario trace: [US-7-S1; US-7-S2].

Root approved these planning clarifications on 2026-10-14. Existing acceptance checks remain mandatory; implementation must exercise same-context floods, evicted replay and proven reorg return rather than treating a proposed bounded strategy as established evidence.

## Acceptance Criteria

- AC-1 [US-1 happy path]: Given H1/H2 at 120/2 sharing P and committee D1=3,D2=2,total=5,threshold=4, when D1 arrives individually and in repeated aggregates and D2 votes Q, then both candidates remain selectable, P=3/Q=2 with deficits 1/2 and no inferred producer.
- AC-2 [US-2 happy path]: Given established A instance and coherent post-establishment full validated snapshot with zero phase votes, when inspected alongside reconnecting transport and observed head advancement, then zero is source-snapshot scoped and observer health remains independent from progress; unavailable rights/identity/coverage cannot certify zero or complete missing delegates,and positive incomplete evidence is explicitly partial.
- AC-3 [US-3 happy path]: Given A applied 120 and B target evidence 123, when B establishes coherent head 122 with appropriate rights, then previously unresolved B evidence counts under B context without global-head or clock rejection.
- AC-4 [US-4 happy path]: Given initially hidden page, when it becomes visible, pauses, hides and resumes permitted collection, then no hidden requests start, all interrupted work cancels and only fresh permitted generation responses commit.
- AC-5 [US-5 happy path]: Given selectable candidates and retained history, when reader pins one and multiple updates arrive, then candidate identities,phase signer/committee evidence,exact peaks,provenance,coverage and receipt dates remain inspectable, reader controls stay stable, newer-items appears and follow-live returns coherent current context independently of pause.
- AC-6 [US-6 happy path]: Given D1 alias Baker Alpha,power 3/5 and preattestation only, when searching Alpha or D1, then the same delegate shows exact share, phase-specific receipts, eligibility/context and stable controls.
- AC-7 [US-7 happy path]: Given selected A 120/H1/2/P and compatible B head/context, when explicitly compared, then exact fields and limited agreement/divergence are independently attributed without pooled power; optional pending evidence lacking proven network/context/rights remains unknown-power or unavailable.
- AC-8 [US-8 happy path]: Given identical phase identity/context power rises 3 to threshold 4, when accepted, then exactly one justified attributed crossing appears, with applied values separate from opportunities.
- AC-9 [US-1, C-1]: Given H1/H2 share P and a payload-only vote, when displaying power, then explicitly shared payload evidence appears without candidate-specific signature/producer inference or duplicate power.
- AC-10 [US-1, C-2]: Given D1 signs P and Q, when inspecting each payload, then D1 counts once in each, conflict is exposed and totals remain separate.
- AC-11 [US-1, C-3]: Given one malformed signer in an aggregate or contradictory/incomplete committee or invalid threshold, when admitted, then the whole malformed operation is uncounted and invalid committee authority is withdrawn while valid raw votes remain inspectable.
- AC-12 [US-1, C-4]: Given unsafe cumulative arithmetic, zero total/threshold, threshold exceeding total, malformed rollover date or missing timezone, when validated, then numerical authority is rejected; legitimate explicit-offset dates and exact safe totals/signers/deficits remain valid.
- AC-13 [US-2, C-5]: Given coherent zero followed by disconnected/partial coverage, when live view updates, then zero becomes stale/partial while historical timestamped source zero remains inspectable without current completeness claim.
- AC-14 [US-2, C-6]: Given snapshots preceding instance establishment, omitting validated data, truncated bodies, malformed relevant entries or spanning context change, when inspected, then none certifies zero; coherent complete later snapshot containing unrelated valid nonconsensus entries may certify source zero.
- AC-15 [US-2, C-7]: Given transport connected without observed transitions or reconnecting during independently observed advancement, when reporting health, then those states remain distinct; stall requires coherent prediction/evidence and missing inputs yield unknown.
- AC-16 [US-2, C-8]: Given historical B evidence, provider switch and wall-clock jump, when age advances, then B receipt/context stays immutable and monotonic age/current stale state evolves without reordered receipts.
- AC-17 [US-3, C-9]: Given H1 requested chain/source/head/predecessor/protocol/target context and same-height H2 reorg, when H1 responds late, then it cannot authorize H2; H1 live authority is invalidated, historical provenance persists and unknown context is explicit without inferred parent.
- AC-18 [US-3, C-10]: Given rapidly changing material contexts for one source and a failed unchanged context, when proven head,parent,protocol or target identity changes and reconciliation occurs, then only one workflow/one newest queued context exists and starts stay at least 15 seconds apart; failed unchanged context remains unresolved without quorum and needs explicit fresh manual action after cooldown; no permanent polling,cascade or forced stored-operation duplication occurs.
- AC-19 [US-3, C-11]: Given source and operation floods or oversized snapshots, when collected, then only configured providers participate, storage stays at 10000 operations and 100 unresolved candidates per network, bounded snapshots are partial and eligibility uses at most three workers without Mainnet fanout.
- AC-20 [US-4, C-12]: Given manual pause before visibility/pagehide/BFCache restoration, when pageshow becomes visible, then pause persists; only enabled visible collection resumes with fresh generation.
- AC-21 [US-4, C-13]: Given cancelled alias/rights/comparison responses and coherent cached data while paused, when local view renders and old responses finish after resume, then local inspection works without external reads and cancelled responses never commit.
- AC-22 [US-5, C-14]: Given pinned retained identity, when late same-identity facts arrive then inspection identity/controls remain stable while evidence may enrich; after eviction its one separately marked frozen copy stays static and a new pin replaces it. Active-index eviction alone preserves historical candidate inspection; freezing occurs on history eviction.
- AC-23 [US-5, C-15]: Given same-payload candidates from multiple observers and unresolved target without block hash, when retaining/promoting, then instances and candidates retain distinct stated identities, no hash is invented and promotion removes quarantine duplicate under independent product bounds.
- AC-24 [US-5, C-16]: Given 151 histories,101 accepted and101 unresolved candidates with equal receipt ties and repeated oldest identity, when trimming, then unresolved entries cannot evict accepted entries and oldest first monotonic receipt with lexical identity ties enforces150/100/100, replay cannot refresh eviction and enormous claimed level has no preference. Each snapshot retains at most 100 candidate facts, explicitly qualifies partial fact retention, protects the pinned selection and bounds raw replay growth through the 10000-operation limit and unique evidence facts; truncation cannot certify zero or completeness.
- AC-25 [US-5, C-17]: Given pin baseline, replay,late same-identity facts and first accepted distinct candidates/candidate-free instances, when counting newer items, then only defined distinct selectable units count without double counting; action returns newest coherent live context or explicit live unavailable.
- AC-26 [US-6, C-18]: Given whitespace/case-varied substring query, explicit address/alias/power sort and arriving aliases, when matches update, then trim/case-insensitive substring semantics apply, empty shows all, address ties are deterministic and new matches append without reordering existing rows or moving focus/scroll until explicit resort.
- AC-27 [US-6, C-19]: Given valid-rights delegate,unknown-rights signer and incomplete opposite phase, when inspected, then committee contains only validated-rights delegates, unknown signer stays separately inspectable and each phase distinguishes received,snapshot-absent,partial/unavailable without fabricated rights/global inactivity.
- AC-28 [US-7, C-20]: Given equal proven head fields,different candidate hashes sharing payload,or insufficient historical context, when compared, then equality proves head agreement only,hash conflict gives divergence and historical uncertainty gives partial/unavailable with current B head separately labelled,never full vote agreement/finality.
- AC-29 [US-7, C-21]: Given slow identity/head/rights/pending endpoints,redirects,incomplete bodies and second click, when comparison runs, then all reads count toward three, each original read including redirects/body completes within eight seconds,total is at most24 seconds and second click adds no reads,retries,cascade or polling.
- AC-30 [US-7, C-22]: Given fetched comparison and eligibility under exact coherent context, when monotonic age reaches60 seconds or context invalidates, then state is stale immediately at boundary/invalidation,comparison invalidation stays sticky on return,receipt wall time remains shown and no auto-refresh occurs.
- AC-31 [US-8, C-23]: Given first observation at quorum or below-to-threshold transition, when accepted, then first reports observed quorum without crossing and latter emits at most one crossing per phase/identity/context; corrections,reduction/recovery,selection,transport loss/render cannot reset maximum/dedup. Evicted or retired replay and proven reorg return must preserve at-most-once behavior with bounded memory; uncertain prior crossing history reports observed quorum or raw state without an invented crossing, and retirement is justified by provenance rather than the clock alone.
- AC-32 [US-8, C-24]: Given more than12 events,history eviction and replay/render/resume, when events retained, then no more than12 immutable attributed events per network survive independently of history without duplicate accepted-observation events or fabricated crossings/progression from changed payload,candidate,source,context or historical selection.
- AC-33 [US-8, C-25]: Given conditional same-level R+1 and next-level R0 branches, when inspected, then both may coexist with explicit conditions; expected producer requires coherent context-pinned baking rights,conflicting/missing rights yield unknown,observed hash is shown and future hash unavailable.
- AC-34 [US-8, C-26]: Given coherent timing/reference head or missing inputs,expired prediction,reorg and skipped delivered levels, when displaying applied values,opportunities/progression, then actual applied level/round/time remains primary and separate from selected consensus/plans,countdowns for both conditional branches are qualified protocol predictions,next-level boundary conditional on hypothetical production,missing is unavailable,expiry awaiting observation,and transitions are distinguished without invented blocks/events.
- AC-35 [US-7, C-27]: Given existing bounded primary fallback to B and explicit comparison/reconciliation failure, when displaying results, then primary result retains actual B source/context and comparison/reconciliation performs no automatic fallback.
- AC-36 [US-2, C-28]: Given source-limited positive/absent/partial/unavailable evidence and compared fields, when labels appear, then labels name that scope and do not imply global healthy/missing/finalized status; unavailable global completeness/finality evidence explains the narrower claims.
- AC-37 [US-5, C-29]: Given bounded session history and explicit single-provider comparison, when session reload/reset occurs, then nonarchival history loss is disclosed and no archive completeness or archival observer-difference timeline is promised in foundations; maintainer branching navigation remains required for later ASTRA.
- AC-38 [US-7, C-9, C-20, C-21]: Given identity/head/pending consume the three-read comparison budget, when rights cannot be fetched, then cached rights may authorize power only with proven chain/head/protocol/target compatibility and original rights provenance; otherwise raw unknown-power remains valid partial comparison without extra reads or fabricated second-source rights, and fetched current B head stays distinct from selected historical context. Identity and head precede pending as the default third read; no default rights-first or hidden fourth read is allowed, and any data-dependent alternative requires pending to be known unavailable within the same explicit workflow and budget.

## Edge Cases

- EC-1 [US-1, C-1]: Same payload P in H1/H2, one payload-only vote → Separate candidates share explicitly payload-level evidence; no invented candidate signature/producer or duplicated combined power.
- EC-2 [US-1, C-3]: Duplicate aggregate signer and later individual replay → Valid operations count unique delegate power; any malformed relevant aggregate member invalidates the operation, not valid raw evidence elsewhere.
- EC-3 [US-2, C-6]: Full empty snapshot one millisecond before establishment → Cannot certify zero; coherent complete relevant post-establishment snapshot may certify only source-snapshot zero.
- EC-4 [US-2, C-7]: Connected source without new head and another observer advances → Keep observer transport and observed chain progress independent; no global stall claim from source failure.
- EC-5 [US-3, C-9]: H1 to H2 same-height reorg with one-second-old H1 eligibility → Live authority immediately stale, immutable old-context history retained; cannot populate H2.
- EC-6 [US-3, C-9]: A120, B122 with level123 evidence → B coherent current+1 context/rights admits; A head or clock cannot alone reject.
- EC-7 [US-4, C-12]: Initially hidden, manual pause, then visible/BFCache restore → No requests initially; manual pause remains until explicit resume; permitted resume starts fresh generation.
- EC-8 [US-4, C-13]: Aborted response arrives after resume even same head → No obsolete-generation commit including aliases/comparison.
- EC-9 [US-5, C-16]: Categories overflow at equal receipt times including pin → Independent bounds, oldest first receipt plus identity lexical tie; one static frozen pin/network.
- EC-10 [US-5, C-17]: Follow-live while newest observations unresolved or old-context late → Select only coherent live-eligible context or explicit unavailable live state; never latest stale historic receipt.
- EC-11 [US-6, C-18]: Arriving alias makes row newly match → Append new match without reordering existing rows; query/focus/scroll stay stable, explicit user resort allowed.
- EC-12 [US-6, C-19]: Missing rights but observed signer and empty other phase → Unknown-rights signer evidence separately searchable/inspectable; phase unavailable/partial, no complete missing set.
- EC-13 [US-7, C-20]: Wrong-network B committee syntactically valid → No counted power; unknown/unavailable independently attributed result.
- EC-14 [US-7, C-22]: Comparison exactly60 seconds old or wall clock jumps → Age>=60 stale using monotonic elapsed clock; no auto refresh, honest receipt timestamp retained.
- EC-15 [US-8, C-23]: First observation already at threshold → Observed quorum state allowed, crossing requires actual prior below state; no invented crossing.
- EC-16 [US-8, C-26]: Later same-level round without next-level block → Distinct observed same-level progression; future blockhash unknown, no fabricated next-level advance.
- EC-17 [US-8, C-25/C-26]: Missing rights/timing or prediction expired → Proposer/timer unavailable when unproven; expired prediction awaits observation; bothbranches conditional, nextleveltime earliest boundary not actual promise.

## Runnable Checks

The following exact standalone semantic commands are REQUIRED IMPLEMENTATION DELIVERABLES and are currently absent/unexecuted. Their absence is not a behavioral red result or passing evidence. Each check exits 0 only for asserted success, 1 only when its specified behavioral assertion fires, and >=2 for import/setup/runtime/timeout/incomplete execution. No raw Vitest/Playwright exit is substituted for this convention. The implementation may reuse existing test support; generic infrastructure requires prior library-index search and upstream reuse/extension. All cases must reach the real product consumers, not detached copies of calculations. Browser checks exercise production `/` in BOTH Chromium and Firefox with controlled RPC observations; missing scenarios or skipped browsers are execution errors. Browser-support invocation is a deliverable interface, not a claim that the baseline already supports it.

- CHECK-1 [AC-1]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-1` → expected: exit 0 verifies AC-1 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-2 [AC-2]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-2` → expected: exit 0 verifies AC-2 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-3 [AC-3]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-3` → expected: exit 0 verifies AC-3 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-4 [AC-4]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-4 --browsers chromium,firefox` → expected: exit 0 verifies AC-4 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-5 [AC-5]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-5 --browsers chromium,firefox` → expected: exit 0 verifies AC-5 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-6 [AC-6]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-6 --browsers chromium,firefox` → expected: exit 0 verifies AC-6 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-7 [AC-7]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-7 --browsers chromium,firefox` → expected: exit 0 verifies AC-7 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-8 [AC-8]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-8 --browsers chromium,firefox` → expected: exit 0 verifies AC-8 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-9 [AC-9]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-9` → expected: exit 0 verifies AC-9 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-10 [AC-10]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-10` → expected: exit 0 verifies AC-10 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-11 [AC-11]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-11` → expected: exit 0 verifies AC-11 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-12 [AC-12]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-12` → expected: exit 0 verifies AC-12 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-13 [AC-13]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-13 --browsers chromium,firefox` → expected: exit 0 verifies AC-13 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-14 [AC-14]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-14` → expected: exit 0 verifies AC-14 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-15 [AC-15]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-15 --browsers chromium,firefox` → expected: exit 0 verifies AC-15 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-16 [AC-16]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-16` → expected: exit 0 verifies AC-16 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-17 [AC-17]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-17` → expected: exit 0 verifies AC-17 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-18 [AC-18]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-18` → expected: exit 0 verifies AC-18 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-19 [AC-19]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-19` → expected: exit 0 verifies AC-19 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-20 [AC-20]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-20 --browsers chromium,firefox` → expected: exit 0 verifies AC-20 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-21 [AC-21]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-21 --browsers chromium,firefox` → expected: exit 0 verifies AC-21 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-22 [AC-22]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-22 --browsers chromium,firefox` → expected: exit 0 verifies AC-22 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-23 [AC-23]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-23` → expected: exit 0 verifies AC-23 at actual observation/admission/accounting consumer boundary; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-24 [AC-24]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-24 --browsers chromium,firefox` → expected: exit 0 verifies AC-24 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-25 [AC-25]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-25 --browsers chromium,firefox` → expected: exit 0 verifies AC-25 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-26 [AC-26]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-26 --browsers chromium,firefox` → expected: exit 0 verifies AC-26 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-27 [AC-27]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-27 --browsers chromium,firefox` → expected: exit 0 verifies AC-27 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-28 [AC-28]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-28 --browsers chromium,firefox` → expected: exit 0 verifies AC-28 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-29 [AC-29]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-29 --browsers chromium,firefox` → expected: exit 0 verifies AC-29 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-30 [AC-30]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-30 --browsers chromium,firefox` → expected: exit 0 verifies AC-30 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-31 [AC-31]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-31 --browsers chromium,firefox` → expected: exit 0 verifies AC-31 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-32 [AC-32]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-32 --browsers chromium,firefox` → expected: exit 0 verifies AC-32 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-33 [AC-33]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-33 --browsers chromium,firefox` → expected: exit 0 verifies AC-33 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-34 [AC-34]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-34 --browsers chromium,firefox` → expected: exit 0 verifies AC-34 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-35 [AC-35]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-35 --browsers chromium,firefox` → expected: exit 0 verifies AC-35 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-36 [AC-36]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-36 --browsers chromium,firefox` → expected: exit 0 verifies AC-36 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-37 [AC-37]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-37 --browsers chromium,firefox` → expected: exit 0 verifies AC-37 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.
- CHECK-38 [AC-38]: `rtk proxy node scripts/check-observatory-foundations.mjs AC-38 --browsers chromium,firefox` → expected: exit 0 verifies AC-38 at authentic browser consumer boundary, Chromium + Firefox; exit 1 only for its behavioral assertion, >=2 for execution error. Status: planned deliverable, not executed.

## Verification and evidence limits

Standalone commands in the draft spec are required implementation deliverables, currently absent and unexecuted. Every semantic check exits0 only after exercising/asserting its specified behavior,1 only for a behavioral assertion,>=2 for setup/import/runtime/timeout/incomplete execution. No raw test-runner exit1 is treated as a red assertion. Success must not be produced by missing/empty scenarios or skipped browsers. Browser boundary cases exercise actual production `/` through both Chromium and Firefox; RPC fixtures control evidence, not bypass the product boundary. Self-contained entrypoints may reuse existing project test support; before introducing generic infrastructure recheck library index and extend selected upstream capability instead of rebuilding it locally.

Library search performed 2026-10-14 against canonical /home/mathias/dev/library-index/data/INDEX.md: existing Roster engineering workflow and engineering-harness entries relevant; no additional library selected. Root already recorded Roster consumer use in index commit485cafd. No generic harness built in specification phase.

Exact supplementary gates on Node22: `rtk npm ci`, `rtk npm run check`, `rtk npm test`, `rtk npm run test:e2e`, `rtk npm run build`. Both Chromium and Firefox required. These do not replace semantic assertion/error distinction or independent actual integer numerical audit. Bounded live-origin checks reported separately and cannot establish global coverage/finality. ASTRA visual acceptance later.

## Claims Metadata

```claims
{"record":"claims-header","schema_version":1,"namespace":"observatory-foundations","spec_lifecycle":"active"}
{"record":"requirement","id":"FR-001","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-002","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-003","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-004","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-005","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-006","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-007","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-008","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-009","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-010","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-011","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-012","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-013","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-014","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-015","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-016","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-017","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-018","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-019","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-020","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-021","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-022","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-023","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-024","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-025","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-026","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-027","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-028","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-029","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-030","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-031","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-032","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-033","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-034","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-035","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-036","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-037","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-038","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-039","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-040","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-041","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-042","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-043","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-044","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-045","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-046","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-047","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-048","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-049","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-050","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-051","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-052","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-053","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-054","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-055","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-056","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-057","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-058","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-059","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-060","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-061","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-062","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-063","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-064","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-065","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-066","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-067","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-068","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-069","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-070","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-071","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-072","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-073","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-074","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-075","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-076","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-090","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-077","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-078","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-079","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-080","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-081","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-082","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-083","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-084","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-085","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-086","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-087","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-088","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-089","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-091","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-092","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-093","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"requirement","id":"FR-094","lifecycle":"active","external_sources":[],"depends_on":[]}
{"record":"acceptance-criterion","id":"AC-1","for":["FR-001","FR-002","FR-003","FR-004","FR-007","FR-011"]}
{"record":"acceptance-criterion","id":"AC-2","for":["FR-015","FR-018","FR-019","FR-021","FR-022"]}
{"record":"acceptance-criterion","id":"AC-3","for":["FR-025","FR-026","FR-027","FR-028","FR-029"]}
{"record":"acceptance-criterion","id":"AC-4","for":["FR-039","FR-040","FR-041","FR-042","FR-043"]}
{"record":"acceptance-criterion","id":"AC-5","for":["FR-050","FR-051","FR-054","FR-055","FR-056"]}
{"record":"acceptance-criterion","id":"AC-6","for":["FR-058","FR-059"]}
{"record":"acceptance-criterion","id":"AC-7","for":["FR-007","FR-064","FR-065","FR-066","FR-069"]}
{"record":"acceptance-criterion","id":"AC-8","for":["FR-077","FR-079"]}
{"record":"acceptance-criterion","id":"AC-9","for":["FR-001","FR-003","FR-004","FR-005","FR-007"]}
{"record":"acceptance-criterion","id":"AC-10","for":["FR-004","FR-006","FR-007"]}
{"record":"acceptance-criterion","id":"AC-11","for":["FR-008","FR-009"]}
{"record":"acceptance-criterion","id":"AC-12","for":["FR-010","FR-011","FR-012"]}
{"record":"acceptance-criterion","id":"AC-13","for":["FR-020"]}
{"record":"acceptance-criterion","id":"AC-14","for":["FR-015","FR-016","FR-017"]}
{"record":"acceptance-criterion","id":"AC-15","for":["FR-022","FR-023","FR-024"]}
{"record":"acceptance-criterion","id":"AC-16","for":["FR-013","FR-014"]}
{"record":"acceptance-criterion","id":"AC-17","for":["FR-025","FR-029","FR-030","FR-031"]}
{"record":"acceptance-criterion","id":"AC-18","for":["FR-026","FR-033","FR-034","FR-035","FR-036"]}
{"record":"acceptance-criterion","id":"AC-19","for":["FR-016","FR-037","FR-038","FR-046"]}
{"record":"acceptance-criterion","id":"AC-20","for":["FR-039","FR-041","FR-042"]}
{"record":"acceptance-criterion","id":"AC-21","for":["FR-040","FR-043","FR-044"]}
{"record":"acceptance-criterion","id":"AC-22","for":["FR-050","FR-051","FR-052","FR-053","FR-091"]}
{"record":"acceptance-criterion","id":"AC-23","for":["FR-001","FR-045","FR-046","FR-048"]}
{"record":"acceptance-criterion","id":"AC-24","for":["FR-002","FR-046","FR-047","FR-049","FR-091","FR-093"]}
{"record":"acceptance-criterion","id":"AC-25","for":["FR-054","FR-055"]}
{"record":"acceptance-criterion","id":"AC-26","for":["FR-058","FR-061","FR-062"]}
{"record":"acceptance-criterion","id":"AC-27","for":["FR-018","FR-059","FR-060","FR-063"]}
{"record":"acceptance-criterion","id":"AC-28","for":["FR-065","FR-066","FR-067","FR-068"]}
{"record":"acceptance-criterion","id":"AC-29","for":["FR-070","FR-071","FR-072"]}
{"record":"acceptance-criterion","id":"AC-30","for":["FR-014","FR-030","FR-032","FR-073","FR-074","FR-075"]}
{"record":"acceptance-criterion","id":"AC-31","for":["FR-077","FR-078","FR-079","FR-092"]}
{"record":"acceptance-criterion","id":"AC-32","for":["FR-080","FR-081"]}
{"record":"acceptance-criterion","id":"AC-33","for":["FR-083","FR-084","FR-085","FR-086"]}
{"record":"acceptance-criterion","id":"AC-34","for":["FR-082","FR-085","FR-087","FR-088","FR-089"]}
{"record":"acceptance-criterion","id":"AC-35","for":["FR-036","FR-072","FR-076"]}
{"record":"acceptance-criterion","id":"AC-36","for":["FR-019","FR-021","FR-063","FR-066"]}
{"record":"acceptance-criterion","id":"AC-37","for":["FR-057","FR-064"]}
{"record":"acceptance-criterion","id":"AC-38","for":["FR-013","FR-030","FR-068","FR-069","FR-070","FR-090","FR-094"]}
{"record":"check","id":"CHECK-1","for":["AC-1"]}
{"record":"check","id":"CHECK-2","for":["AC-2"]}
{"record":"check","id":"CHECK-3","for":["AC-3"]}
{"record":"check","id":"CHECK-4","for":["AC-4"]}
{"record":"check","id":"CHECK-5","for":["AC-5"]}
{"record":"check","id":"CHECK-6","for":["AC-6"]}
{"record":"check","id":"CHECK-7","for":["AC-7"]}
{"record":"check","id":"CHECK-8","for":["AC-8"]}
{"record":"check","id":"CHECK-9","for":["AC-9"]}
{"record":"check","id":"CHECK-10","for":["AC-10"]}
{"record":"check","id":"CHECK-11","for":["AC-11"]}
{"record":"check","id":"CHECK-12","for":["AC-12"]}
{"record":"check","id":"CHECK-13","for":["AC-13"]}
{"record":"check","id":"CHECK-14","for":["AC-14"]}
{"record":"check","id":"CHECK-15","for":["AC-15"]}
{"record":"check","id":"CHECK-16","for":["AC-16"]}
{"record":"check","id":"CHECK-17","for":["AC-17"]}
{"record":"check","id":"CHECK-18","for":["AC-18"]}
{"record":"check","id":"CHECK-19","for":["AC-19"]}
{"record":"check","id":"CHECK-20","for":["AC-20"]}
{"record":"check","id":"CHECK-21","for":["AC-21"]}
{"record":"check","id":"CHECK-22","for":["AC-22"]}
{"record":"check","id":"CHECK-23","for":["AC-23"]}
{"record":"check","id":"CHECK-24","for":["AC-24"]}
{"record":"check","id":"CHECK-25","for":["AC-25"]}
{"record":"check","id":"CHECK-26","for":["AC-26"]}
{"record":"check","id":"CHECK-27","for":["AC-27"]}
{"record":"check","id":"CHECK-28","for":["AC-28"]}
{"record":"check","id":"CHECK-29","for":["AC-29"]}
{"record":"check","id":"CHECK-30","for":["AC-30"]}
{"record":"check","id":"CHECK-31","for":["AC-31"]}
{"record":"check","id":"CHECK-32","for":["AC-32"]}
{"record":"check","id":"CHECK-33","for":["AC-33"]}
{"record":"check","id":"CHECK-34","for":["AC-34"]}
{"record":"check","id":"CHECK-35","for":["AC-35"]}
{"record":"check","id":"CHECK-36","for":["AC-36"]}
{"record":"check","id":"CHECK-37","for":["AC-37"]}
{"record":"check","id":"CHECK-38","for":["AC-38"]}
```

## Entities

- `ObserverContext`: immutable actual source endpoint and proven network chain id, requested/observed head hash/predecessor/protocol and target facts, with unknown fields explicit.
- `ConsensusInstance`: source/context/network/level/round/payload identity carrying separate phase evidence and candidate block identities.
- `Candidate`: distinct source/chain/block-hash observed proposal identity, including shared-payload siblings; producer is known only from matching evidence.
- `UnresolvedObservation`: attributable bounded evidence lacking sufficient coherent identity/rights authority for power, with no invented block hash.
- `PhaseEvidence`: unique delegate observations, coherent committee/threshold authority, exact observed power/deficit and source-qualified coverage for one phase/instance.
- `SessionSnapshot`: retained full instance evidence with candidate identities, phase committee/signers, exact peaks, provenance and honest receipt facts.
- `PinnedInspection`: selected identity and reader controls independent of collection; retained same-identity facts may enrich it until eviction freezes one static copy per network.
- `ComparisonSnapshot`: explicit bounded different-provider contextual observations with exact compared fields, provenance, fetched-at age and independent power authority.
- `ConditionalOpportunity`: same-level next round or next-level round-zero expected proposer/timing from coherent rights/protocol evidence, with future hash unavailable and prediction not observation.
- `ConsensusEvent`: bounded immutable attributed same-identity phase crossing or observed progression facts, never fabricated by selection, source change or a conditional prediction.
