---
name: roster-spec
type: spec
status: live
feature: Bounded live baker and global DAL tracking
brief: briefs/baker-tracking-intake.md
date: 2026-10-22
version: 1.0.0
---

# Baker tracking

**Status: VALIDATED**

Full additive contract; actual independent challenge is `roster/baker-tracking/spec-challenge.md`; root explicitly resolved Q1–Q5 and validated the finite corrections on 23 October 2026. Preserve all 393 inherited managed claims. This draft does not establish review, QA, provider availability or deployment approval.

## Clarifications

Root validated feature/trust-boundary yes, 25 default/50 maximum recent rows, six reward cycles, six recent baker TzKT reads per visible 30-second batch, five-minute profile/reward TTL and DAL TTL at least60 seconds. Manual refresh shares the budget. Root also validated global DAL mode with head+publication list per30 seconds, at most one hash-pinned metadata read per60 seconds and cached constants; without a baker, all baker-specific rights/operations/produced-block/profile/reward/counter calls are skipped. Peer examples may enrich supported rendering but do not change source semantics.

## User Stories

### US-1: Inspect one baker (Priority: P0)

As an observer I want a public address or locally suggested alias to open a sourced baker view, so I can inspect recent actual activity without confusing indexer facts with daemon health.

Independent test: drive the real page with neutral bounded TzKT fixtures.

1. Given a validated delegate address and profile, when opening a shareable URL, then show alias/address, active state, current staking/baking power and qualified last-seen software.
2. Given recent rights and included operations, when rendering, then preserve inclusion-level labels and show canonical block producer/proposer/round separately from scheduled rights and indexer status.
3. Given an invalid address, alias without a catalog match, malformed profile or unavailable provider, when selecting, then do not auto-select an unrelated delegate or convert missing facts to zero.

### US-2: Inspect DAL evidence without invented verdicts (Priority: P0)

As an observer I want per-baker counters and network-wide publications/global state, so I can distinguish supported participation evidence from pending or unavailable evidence.

Independent test: pure interpretation and the real on-demand detail consumer using individual/aggregate fixtures.

1. Given positive eligible DAL counters at an established hash/context, when rendering, then show their ratio, raw sufficient/denounced flags and separately conditional expected rewards.
2. Given zero eligible counters, absent DAL content or a future/pending publication, when rendering, then show the corresponding neutral state rather than a failure or100% verdict.
3. Given an aggregate with equal validated committee arrays, when opening a block detail, then attribute bits only through exact matching metadata delegate and aligned index; malformed/misaligned arrays remain unavailable.
4. Given global mode without baker, when loading, then show bounded publications plus contextual raw global state/lag/staleness and issue no baker-specific reads.

### US-3: Leave the page open comfortably (Priority: P0)

As a desktop or phone user I want bounded live updates and stable accessible sections, so the page remains useful without excessive requests or background CPU.

Independent test: mock transport/clock plus Chromium and Firefox page interactions.

1. Given visible mode, when automatic/manual refresh overlap, then coalesce requests and respect cadence/TTL without additional independent polling.
2. Given hidden/pagehide or a changed baker/network, when old requests complete, then abort/ignore their results and perform no hidden refresh work.
3. Given throttling or timeout after previous success, when updating, then preserve attributed last-good stale data, show the error and honor cooldown rather than immediate retry.
4. Given phone/desktop light/dark use, when opening controls or data refresh, then preserve readable keyboard controls, page scrolling and stable bounded section geometry.

## Challenges

Actual independent challenge completed and root resolved its finite blockers. J4 exact slot diagnosis and J5 live mempool comparison are explicitly not delivered in this first feature. Known research corrections are mandatory: alias.as silently ignored, uncovered status query rejected despite Swagger, inclusion level differs from voted target, expectedDAL counts are shards, native OS highlight is not author-controlled, aggregate arrays require alignment validation, zero eligible is not a failed duty.

## Functional Requirements

- **FR-001** [US-1]: Page MUST validate tz1/tz2/tz3/tz4 address shape and delegate response, support public URL address/network state and use bounded cached local alias matching without ignored wildcard filters or unrelated automatic selection.
- **FR-002** [US-1]: Profile MUST distinguish staking balances, baking power, active state and nullable last-seen software with actual source/time/context; missing fields MUST remain unavailable.
- **FR-003** [US-1]: Recent activity MUST query and validate a complete anchored last25/50-level rights window before saying no indexed right; incomplete/capped windows MUST remain coverage-unknown. Included operations remain a separate inclusion list. Current-cycle missed rights are an explicit on-demand max50 list with observed/partial count, not a complete cycle total. Recent activity MUST preserve indexed inclusion-level semantics and separate scheduled rights/status from actual canonical producer, proposer and rounds, with25 default/50 maximum rows.
- **FR-004** [US-1]: Rewards MUST show at most six current/past cycles with mutez-safe amounts and conditional/current-cycle qualifiers, excluding future cycles; expected DAL shards MUST NOT become a slot percentage denominator.
- **FR-005** [US-2]: DAL counters MUST bind provider/network/chain/hash/level/cycle and show a ratio only for positive eligible denominator; zero eligible, unavailable and stale MUST remain distinct, with raw sufficient/denounced flags and conditional rewards separate.
- **FR-006** [US-2]: Included DAL detail MUST be on demand, immutable-hash-coalesced and attributed through exact metadata delegate; aggregate committees MUST have validated equal lengths and explicitly supported protocol-bound aligned indices or remain unavailable. A malformed middle entry or duplicate delegate MUST reject the whole aggregate attribution, never shift indices or double count.
- **FR-007** [US-2]: Global DAL mode MUST work without baker, show bounded applied-only publications and hash-pinned newly-available-at-that-block metadata/context/staleness (never cumulative availability), and MUST NOT infer failure/publication cadence/full participation from zeros or raw bitset equality.
- **FR-008** [US-3]: Acquisition MUST enforce the root-approved per-mode30-second batch budgets, five-minute profile/rewards TTL, at least60-second DAL TTL, coalesced manual/automatic work and cached immutable constants/context; immutable cache MUST cap64 entries and4MiB approximate UTF8, each response256KiB, detail concurrency2 and at most4 detail reads per30-second batch. Keys MUST bind network/provider/chain/hash/resource and delegate where applicable. Failed attempts consume a shared per-network30-second cooldown across view/address switches; Retry-After extends it, never less than30seconds and never earlier than a valid longer server wait; five-minute cap applies only to local default backoff, and visibility/manual actions cannot bypass it; global-only mode MUST skip all baker-specific reads.
- **FR-009** [US-3]: Hidden/pagehide MUST stop timers/abort acquisition, and baker/network generation changes MUST reject obsolete completion; no consensus streams, collector, provider fanout or immediate retry loop may start.
- **FR-010** [US-3]: Errors/429/timeouts/malformed/cross-chain facts MUST remain attributed failures or unavailable states, preserving clearly stale last-good results and bounded cooldown, never committing invented zeros or incoherent contexts.
- **FR-011** [US-3]: Page MUST preserve accessible labels, focus/keyboard operation, readable light/dark palettes, smartphone page scrolling and stable bounded table/section geometry across refresh/control opening.
- **FR-012** [US-1, US-2, US-3]: Static build MUST include the standalone page with direct anonymous reads and safe text rendering, preserve inherited contracts and introduce no wallet/signing/private incident fixtures or consensus monitor side effects.

## Acceptance Criteria

- **AC-1**: Valid/invalid address, URL and capped local alias fixtures exercise FR-001 through real page selection.
- **AC-2**: Nullable/malformed and complete profile fixtures establish qualified profile labels (FR-002).
- **AC-3**: Produced/missed/future rights and inclusion-level fixtures establish separate actual/scheduled facts and row caps (FR-003).
- **AC-4**: Future-cycle, current-cycle and large exact-money fixtures establish six-cycle filtering and DAL unit semantics (FR-004).
- **AC-5**: Positive, zero-eligible, missing and cross-chain counter fixtures establish exact contextual states (FR-005).
- **AC-6**: Real detail consumer accepts valid individual/aggregate bindings and rejects malformed/misaligned/unrelated delegates (FR-006).
- **AC-7**: Global URL fixtures render publications/raw state without fabricated verdict and issue no baker reads (FR-007).
- **AC-8**: Mock clock/fetch counts establish each mode budget, TTL, coalescing and cached context (FR-008).
- **AC-9**: Hidden/pagehide/change-generation tests establish no background timer work or obsolete commits (FR-009).
- **AC-10**: 429/abort/timeout/malformed completion tests establish cooldown, stale retention and rejection (FR-010).
- **AC-11**: Chromium/Firefox phone/desktop light/dark keyboard/geometry tests establish usability (FR-011).
- **AC-12**: Unit/build/import checks establish standalone output, no monitor startup and preservation of inherited gates (FR-012).

## Runnable Checks

Each named focused test is implemented before acceptance; an absent test is not a passing check. Run with Node22+.

- CHECK-1 [AC-1]: `node scripts/check-baker-tracking.mjs 1` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-2 [AC-2]: `node scripts/check-baker-tracking.mjs 2` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-3 [AC-3]: `node scripts/check-baker-tracking.mjs 3` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-4 [AC-4]: `node scripts/check-baker-tracking.mjs 4` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-5 [AC-5]: `node scripts/check-baker-tracking.mjs 5` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-6 [AC-6]: (authentic-success-path, fail-closed-path) `node scripts/check-baker-tracking.mjs 6` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-7 [AC-7]: `node scripts/check-baker-tracking.mjs 7` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-8 [AC-8]: `node scripts/check-baker-tracking.mjs 8` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-9 [AC-9]: `node scripts/check-baker-tracking.mjs 9` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-10 [AC-10]: `node scripts/check-baker-tracking.mjs 10` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-11 [AC-11]: `node scripts/check-baker-tracking.mjs 11` → pass0, assertion1, execution/missing-evidence error2.
- CHECK-12 [AC-12]: `node scripts/check-baker-tracking.mjs 12` → pass0, assertion1, execution/missing-evidence error2.

## Edge Cases

No catalog alias; catalog cap; invalid/checksum-unverified address; non-delegate account; software null; unsafe numeric/money field; unsupported rights status; rights beyond anchor; changed canonical block; indexer lag; future rewards; zero eligible DAL; cycle edge; malformed aggregate lengths/delegate; no DAL content; raw bitsets without compatible decoder; provider chain mismatch; stalled response;429; hidden/visible churn; network/address change; storage unavailable; small viewport/long aliases.

## Entities

PublicBakerSelection; AttributedIndexedHead; DelegateProfile; IndexedRight; IncludedAttestation; CanonicalBlock; CycleRewards; ContextualDalCounters; IncludedDalEvidence; GlobalDalPublication; AttributedFreshness. External responses remain unknown until narrowed; no new any or non-null assertions.

## Claims Metadata

```claims
{"record": "claims-header", "schema_version": 1, "namespace": "baker-tracking", "spec_lifecycle": "active"}
{"record": "requirement", "id": "FR-001", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-002", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-003", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-004", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-005", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-006", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-007", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-008", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-009", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-010", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-011", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "requirement", "id": "FR-012", "lifecycle": "active", "external_sources": [], "depends_on": []}
{"record": "acceptance-criterion", "id": "AC-1", "for": ["FR-001"]}
{"record": "check", "id": "CHECK-1", "for": ["AC-1"]}
{"record": "acceptance-criterion", "id": "AC-2", "for": ["FR-002"]}
{"record": "check", "id": "CHECK-2", "for": ["AC-2"]}
{"record": "acceptance-criterion", "id": "AC-3", "for": ["FR-003"]}
{"record": "check", "id": "CHECK-3", "for": ["AC-3"]}
{"record": "acceptance-criterion", "id": "AC-4", "for": ["FR-004"]}
{"record": "check", "id": "CHECK-4", "for": ["AC-4"]}
{"record": "acceptance-criterion", "id": "AC-5", "for": ["FR-005"]}
{"record": "check", "id": "CHECK-5", "for": ["AC-5"]}
{"record": "acceptance-criterion", "id": "AC-6", "for": ["FR-006"]}
{"record": "check", "id": "CHECK-6", "for": ["AC-6"]}
{"record": "acceptance-criterion", "id": "AC-7", "for": ["FR-007"]}
{"record": "check", "id": "CHECK-7", "for": ["AC-7"]}
{"record": "acceptance-criterion", "id": "AC-8", "for": ["FR-008"]}
{"record": "check", "id": "CHECK-8", "for": ["AC-8"]}
{"record": "acceptance-criterion", "id": "AC-9", "for": ["FR-009"]}
{"record": "check", "id": "CHECK-9", "for": ["AC-9"]}
{"record": "acceptance-criterion", "id": "AC-10", "for": ["FR-010"]}
{"record": "check", "id": "CHECK-10", "for": ["AC-10"]}
{"record": "acceptance-criterion", "id": "AC-11", "for": ["FR-011"]}
{"record": "check", "id": "CHECK-11", "for": ["AC-11"]}
{"record": "acceptance-criterion", "id": "AC-12", "for": ["FR-012"]}
{"record": "check", "id": "CHECK-12", "for": ["AC-12"]}
```

The scoped checker reuses existing metric runner classifiers, requires explicit selected inventory and actual assertion counters, and rejects zero-selected or malformed execution evidence.
