# Reviewer Brief — baker-tracking

**Status: VALIDATED**

## Goal
Independently review the frozen implementation against the additive contract and report GO/NO-GO with concrete file/line evidence. Do not treat draft scenarios or a green runner with no selected tests as completed acceptance.

## Files
Audit diff for `src/rpc/bakerTracking.ts`, `src/bakerEvidence.ts`, `src/baker.ts`, `src/view/bakerView.ts`, `src/baker.html`, `src/dashboardView.ts`, `src/dashboard.css`, `vite.config.ts`, `tests/unit/bakerTracking.test.ts`, `tests/e2e/bakerTracking.spec.ts`. Read `briefs/baker-tracking-intake.md`, `specs/baker-tracking.md`, `roster/baker-tracking/spec-challenge.md` and the implementer handoff. No write ownership over application files.

## Out of Scope
- Preserve all 393 inherited managed claims and consensus dashboard behavior. Add only the 12 new FR/AC/CHECK contracts.
- No SDK, collector, consensus streams, mempool tracking, protocol decoder, per-slot verdict, fixed slot/cadence or P+5 assumption.
- J4 exact missed-slot localization and J5 live node consistency remain deferred.

## Completion Criteria
- [ ] Each final FR/AC/CHECK is traced to an implementation and authentic consumer test, or a blocking gap is named.
- [ ] Bounds hold across failed requests, view/address switches, manual spam, cache eviction and hidden/visible churn; no per-row fetch loop or implicit background monitor exists.
- [ ] Included-operation level, supported aggregate alignment, duplicate rejection, zero-eligible meaning, per-section context and applied publications/newly-available global semantics are verified.
- [ ] Exact existing393 claims remain unchanged; new contract addition is additive.
- [ ] Review output records candidate revision/diff scope and GO/NO-GO; unrelated pre-existing issues are identified separately.

## References
- Goal
- Scope Boundary
- Architecture Notes
- Quality Gates
- Open Questions
