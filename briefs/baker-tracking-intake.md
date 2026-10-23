# Intake Brief — baker-tracking

**Date:** 2026-10-22
**Status: VALIDATED**
**Type:** feature
**Trust boundary:** yes

## Goal

Add a live, read-only baker tracking page, accessible at `baker.html?baker=<address>&network=<network>`, for a Tezos delegate entered as tz1/tz2/tz3/tz4 address or selected through local alias suggestions. Show sourced identity, current staking/baking power, active state and explicitly last-seen software; recent included attestations and missed attestation rights; produced blocks and baking rights with canonical producer and round; contextual DAL counters, on-demand included DAL evidence, and per-cycle indexed rewards. Unknown, stale, ineligible and no eligible observations must remain distinct from failed participation.

The page must remain useful while open without the consensus dashboard's streams or expensive background work. This is an additive feature: preserve all existing specifications, 393 existing managed claims and existing dashboard behavior. Intermediate product decisions are delegated to the root coordinator; separate review and QA remain mandatory, and publication is a later gate.

Root validated the feature/trust-boundary classification, bounded core and global amendment on 22 October 2026: a network-wide DAL view accessible without selecting a baker (`baker.html?view=dal&network=<network>`), displaying bounded indexed applied publications and hash-pinned observed global attestation state, dynamic lag context and staleness. It shares immutable block/constants caches and lifecycle/cooldowns with baker details; it must not infer failures from zero bits or assume publication cadence. Without a baker, skip all baker-specific profile/rights/operations/produced-block/reward/counter requests. Global metadata represents newly available slots at that block, not cumulative availability or proof that an earlier publication failed.

## Scope Boundary

Out of scope: signing/wallet integration, a collector/server, mempool arrival tracking, arbitrary provider aggregation, full historical crawling, protocol bitset decoder implementation, DAL success inferred from raw bitset equality, fixed publication slot/cadence assumptions, and changes to the consensus monitor. No private incident examples or client data enter public fixtures or documentation.

## Relevant Files

| File | Role | Key snippet |
|---|---|---|
| `vite.config.ts` | Existing relative-base multipage build | `input:Object.fromEntries(...)` |
| `src/dashboardView.ts` | Existing pure accessible choice helper and dashboard entry link | `function nativeChoice(...)` |
| `src/dashboard.css` | Existing tokens, themes and choice styling | Reuse existing styling; scope baker additions |
| `src/rpc/networkData.ts` | Existing provider and alias-fetch patterns | Bounded address/alias catalog, no wildcard alias query |
| `src/rpc/guards.ts` | Existing narrowing helpers | Narrow unknown external data |
| `src/baker.html`, `src/baker.ts` | New isolated static page and lifecycle composition | Never import `main.ts` |
| `src/view/bakerView.ts` | New bounded, accessible responsive view | Explicit source/context/staleness labels |
| `src/rpc/bakerTracking.ts` | New scoped query/cache/lifecycle ownership | Coalesced promises, cancellation, bounded reads |
| `src/bakerEvidence.ts` | New pure interpretation of indexed and DAL facts | No guessed attestation target or DAL eligibility |
| `tests/unit/bakerTracking.test.ts`, `tests/e2e/bakerTracking.spec.ts` | Neutral fixtures and semantic/lifecycle checks | No production providers |

## Architecture Notes

- Base revision is `adc59acfb959c4121dc2190f0d887ae9e461d4dd`, isolated branch `feat/baker-tracking`. Claims check is fresh: model `71362681320549efd2fb76d4fd88a53d34b025bfe0ba4bd82468e3b680d67abe`, freshness `867e21eec5efcfeb9ee3360139733f44174cf1f4f99a46d2ba48a78da05b5eb1`. Exact context manifest is retained with research.
- Reuse the existing pure `nativeChoice` helper via a narrow export if necessary; no new choice widget, SDK or background monitor. Library-index search found no directly reusable browser TypeScript Tezos client. Direct bounded fetch is sufficient.
- Default 25 recent rows, maximum 50; six reward cycles. One visible-only coalesced recent batch per 30 seconds: head anchor, attestation rights, baking rights, included attestation operations, produced blocks, then one union-of-right-levels canonical block batch (at most six TzKT reads). Profile/rewards use five-minute TTL. Manual refresh shares cooldown and in-flight work; no overlap, immediate retry loops or per-row producer queries.
- Alias search uses one cached catalog of at most 10,000 delegate address/alias entries and local matching, with a capped-coverage qualifier. `/delegates?alias.as=...` silently ignores the filter and is forbidden. Selected addresses are validated by the delegate endpoint. Suggested account endpoint exists but is not needed.
- DAL counters have at least 60-second TTL, one in flight, hash-pinned context and cached provider chain-ID validation against the indexed head. Bind network/source/hash/level/cycle/time. Visible-only refresh and user refresh share the same work. Hide/pagehide stops timers and aborts outstanding requests; generation checks reject obsolete results after network/address changes. Retain attributed last-good results as stale on error/429, never replace failures with zero.
- Included DAL detail is requested only when a row is expanded, with coalesced immutable hash-keyed operations/0, metadata and constants reads. Ordinary attestations without DAL are not failed DAL participation. Individual evidence requires exact metadata delegate; aggregates require equal committee lengths, validated entries and protocol-supported index alignment before attributing bits. Raw bitsets stay raw; dynamic lag/slot constants are contextual information, not an invented success percentage.
- TzKT attestations' level is the inclusion level. Baking rights and actual canonical producer/proposer/blockRound remain separate. Query only supported rights types `baking`/`attestation` and statuses `future`/`realized`/`missed`; preserve unknown response status neutrally. Future cycles are excluded from settled/history reward presentation. `expectedDalAttestations` measures expected shards, not a slot denominator; deprecated `expectedDalShards` is the same measure. Last-seen software is not proof of a currently running daemon.
- DAL positive-denominator ratio uses delegate attested/attestable counters only; denominator zero is no eligible observations, neither 0% nor 100%. Raw sufficient/denounced flags and conditional expected rewards are separately labeled. Do not silently substitute a previous block at cycle boundaries.
- Use current themes/palettes, keyboard/focus behavior, stable bounded tables and ordinary phone page scrolling. Each section exposes update time and source/context. Inputs and aliases render as text, not HTML. URL contains public address/network only.
- Primary sources: current [TzKT OpenAPI](https://api.tzkt.io/v1/swagger.json), official [TzKT controllers/models](https://github.com/baking-bad/tzkt), [DAL support](https://octez.tezos.com/docs/active/dal_support.html), and [U025 aggregate application](https://github.com/tezos/tezos-mirror/blob/master/src/proto_025_PsUshuai/lib_protocol/apply.ml#L2453). Research refuted stale Swagger `uncovered` query support and peer alias-filter assumptions. Our research made two public documentation GETs, no production data/RPC calls.

## Quality Gates

Run with Node 22 or newer:

```bash
rtk npm run check
rtk npm test
rtk npm run test:e2e
rtk npm run build
```

No separate lint command exists. Focused unit and Chromium/Firefox tests must establish malformed/cross-chain/obsolete rejection, exact aggregate attribution, zero/unknown distinctions, request ceilings, coalescing, cooldown/error/backoff, hidden cancellation, rewards cycle filtering, URL/delegate selection, keyboard operation, light/dark readability and stable phone/desktop geometry. Build output must include the standalone page without starting consensus streams. Separate actors review and QA the frozen candidate.

## Open Questions

Root validated global budget: one indexed applied-publication list plus shared head per30-second batch and at most one hash-pinned global metadata read per60 seconds (shared when already requested), constants once per protocol/context. Exact lag decoding remains unavailable until a supported decoder contract is verified; expose raw state honestly meanwhile. Journey refinements (last-N complete rights window and bounded current-cycle missed list) are under actual independent spec challenge; fresh planner and additive specification remain gates, neither claimed completed.
