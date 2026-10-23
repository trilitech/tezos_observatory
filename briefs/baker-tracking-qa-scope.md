# QA Brief — baker-tracking

**Status: VALIDATED**

## Goal
Independently verify the frozen candidate using neutral deterministic fixtures and browser scenarios; report actual executions and GO/NO-GO. No production provider requests or private incident fixtures.

## Files
Run `tests/unit/bakerTracking.test.ts` and `tests/e2e/bakerTracking.spec.ts`; inspect `src/baker.html`, `src/baker.ts`, `src/view/bakerView.ts`, `src/rpc/bakerTracking.ts`, `src/bakerEvidence.ts` only to diagnose failures. Read `specs/baker-tracking.md`, `briefs/baker-tracking-intake.md` and implementer handoff. No application write ownership.

## Out of Scope
- Preserve all 393 inherited managed claims and consensus dashboard behavior. Add only the 12 new FR/AC/CHECK contracts.
- No SDK, collector, consensus streams, mempool tracking, protocol decoder, per-slot verdict, fixed slot/cadence or P+5 assumption.
- J4 exact missed-slot localization and J5 live node consistency remain deferred.

## Completion Criteria
- [ ] `rtk npm run check` passes under Node22+.
- [ ] `rtk npm test` passes.
- [ ] `rtk npm run test:e2e` passes in Chromium and Firefox.
- [ ] `rtk npm run build` passes and includes standalone baker page.
- [ ] Execute each final CHECK-1..12 exactly; assert tests exist and zero-selected tests fail.
- [ ] Open baker URL with valid, invalid, malicious alias, cross-network alias and non-delegate fixtures; expected selection remains safe and coverage qualified.
- [ ] Verify profile nullable fields, included-level vs rights distinction, producer/proposer/round separation and future-cycle/large-mutez rewards.
- [ ] Exercise DAL positive/0/0/missing/cross-chain counters; valid individual/supported aggregate and malformed/duplicate/unsupported aggregate evidence. No fabricated verdict appears.
- [ ] Open global URL without baker; verify applied publications/raw newly-available metadata and zero baker-specific reads.
- [ ] Mock clock/fetch: overlapping refresh, failed attempt,429/Retry-After, hidden/pagehide, rapid address/view/network switches, late abort-insensitive completion, concurrent detail opens and eviction all respect final numeric limits.
- [ ] Chromium/Firefox phone/desktop light/dark keyboard, focus, scrolling and geometry scenarios pass.
- [ ] Report exact candidate revision and actual commands/results; do not claim skipped checks as passed.

## References
- Goal
- Scope Boundary
- Architecture Notes
- Quality Gates
- Open Questions
