# Implementer Brief — baker-tracking

**Status: VALIDATED**

## Goal
Implement bounded, anonymous baker tracking plus independent global DAL observation mode through vertical data/evidence/view slices. Owner is /root/rpc_retry_cpu_audit. Work in the shared checkout; you are not alone, preserve others' edits. Use the final validated additive specification, never strengthen raw observations into participation verdicts.

## Files
Modify/create: `src/baker.html`, `src/baker.ts`, `src/view/bakerView.ts`, `src/rpc/bakerTracking.ts`, `src/bakerEvidence.ts`, `tests/unit/bakerTracking.test.ts`, `tests/e2e/bakerTracking.spec.ts`. Narrow integration edits only: `vite.config.ts`, `src/dashboardView.ts`, `src/dashboard.css`. Read existing patterns: `src/rpc/networkData.ts`, `src/rpc/guards.ts`. Read contracts: `briefs/baker-tracking-intake.md`, `specs/baker-tracking.md`, `roster/baker-tracking/research.md`, `roster/baker-tracking/spec-challenge.md`.

Contract snippets: `baker.html?baker=<address>&network=<network>` and `baker.html?view=dal&network=<network>`; never import `main.ts`. Reuse pure `nativeChoice` via narrow export when needed. All external responses enter as unknown and are narrowed; no new any/non-null assertions.

Implementation order:
1. Deliver address/URL/locally cached alias selection and sourced profile through the standalone page. Validate delegate response. Catalog cap10000, explicit capped coverage, no alias.as query.
2. Provide a separately on-demand current-cycle missed-right list capped50, with explicit partial/covered-window qualifiers; a no-right classification requires complete anchored rights for that level. Deliver bounded sourced rights/included-operation/produced-block/reward sections. Default25/max50 recent rows; six returned current/past reward cycles at most. One head anchor and union-level canonical block batch, no per-row reads. Inclusion level is not voted target. Preserve unknown statuses; separate producer/proposer/round from rights.
3. Deliver contextual DAL counters and on-demand included evidence with shared acquisition/cache ownership. Positive denominator ratio only; 0/0 means no eligible observations. Exact delegate and supported protocol/aligned complete validated committees required; reject duplicates/malformed middle entries. Raw evidence cannot diagnose missed published slots.
4. Deliver global mode with applied-only bounded publications and hash-pinned raw newly-available metadata, dynamic lag/context and explicit outcome unavailable. Without a baker, issue no profile/rights/operations/produced-block/reward/counter reads.
5. Complete fixture-driven lifecycle/error/request-budget and accessibility verification before handoff.

Budget invariants: visible recent baker core at most6 TzKT reads per30s; global only shared head+one publication list/30s, global metadata/60s; profile/rewards5min; DAL counters>=60s. Shared network cooldown survives address/view switches and failed attempts; Retry-After minimum30s, honoring longer server waits; local default backoff cap5min. Coalesce manual/automatic work; cancel hidden/pagehide and discard old generation completion. Detail shared immutable cache64entries/4MiB, response cap256KiB, concurrency2, at most4 reads/30s. Cache by network/chain/hash/protocol and preserve last-good attributed stale data. Follow final spec for exact cache/chain validation/alias TTL keys and defaults.

## Out of Scope
- Preserve all 393 inherited managed claims and consensus dashboard behavior. Add only the 12 new FR/AC/CHECK contracts.
- No SDK, collector, consensus streams, mempool tracking, protocol decoder, per-slot verdict, fixed slot/cadence or P+5 assumption.
- J4 exact missed-slot localization and J5 live node consistency remain deferred.

## Completion Criteria
- [ ] `rtk npm run check` passes under Node22+.
- [ ] `rtk npm test` passes.
- [ ] `rtk npm run test:e2e` passes in Chromium and Firefox.
- [ ] `rtk npm run build` passes and includes standalone baker page.
- [ ] Every final CHECK-1..12 selects real tests; absent/zero-selected tests fail rather than pass.
- [ ] Fixtures prove cross-chain/malformed/obsolete rejection, aggregate success and fail-closed paths, request ceilings including failed attempts/switches/detail eviction, and stale retention.
- [ ] Global no-baker route issues zero baker-specific requests; hidden page schedules no work; no consensus startup.
- [ ] Phone/desktop light/dark keyboard/focus and stable bounded geometry verified.

## References
- Goal
- Scope Boundary
- Architecture Notes
- Quality Gates
- Open Questions
