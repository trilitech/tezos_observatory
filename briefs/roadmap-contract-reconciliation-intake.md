# Intake Brief — roadmap-contract-reconciliation

**Date:** 2026-10-22
**Status: VALIDATED**
**Type:** docs
**Trust boundary:** yes

## Goal

Make the authoritative V3 requirements reflect the maintainer’s explicit instruction “1.8s c’est beaucoup, vise 1.2”: the rendered chain journey uses 1200ms at constant speed, replacing the old receipt-to-settlement200ms policy. This amendment records a user-directed obligation change, not weakening tests to bless implementation. Distinguish the independently retained compact500 navigator observations from the unchanged150 detailed inspection instances and100/100 candidate bounds.

## Scope Boundary

Out of scope: product source changes; altered numerical/consensus authority; RPC requests; foundation claim deletion; historical failure rewriting; claiming visual or full-roadmap completion from documentary edits. Preserve all unrelated V3 and interval claims, original check interfaces, cancellation/no-motion conditions and independent final QA.

## Relevant Files

| File | Role | Key snippet |
|---|---|---|
| `specs/observatory-v3.md` | Authoritative normative Markdown and structured records | FR012/013; AC02/13; US2/Q4/C5 timing mirrors |
| `tests/e2e/v3Release.ts` | Exact contract checksum consumer | V3 SHA928e1b5…; foundations SHA remains unchanged |
| `scripts/v3-evidence-contract.mjs` | Existing source/contract/build binding | contractCombined and boundFile |
| `src/cameraTiming.ts` | Read-only current behavior evidence | CAMERA_DURATION_MS=1200 |
| `README.md` | Current documented user behavior | full1200ms rendered journey; compact500 record history |
| `briefs/observatory-v3-pragmatic-timing-disposition.md` | Historical limitation evidence | UNRESOLVED/WAIVED, not full-contract PASS |

## Architecture Notes

Fresh official claims check passed before intake. Exact reconciler context is `roster/roadmap-contract-reconciliation/context.manifest.json`; model fd0211fa8b3037a6bbf889c930a4094a58b91ff67b3b84c27362753d1cc76ac0; freshness050df4d86fc51e3551f09ecd2b698f505c70db869bb425f9d897e21fe1e1f2d8. Existing reconciler only; no new infrastructure/library. Amend authoritative specs then official validate/project/check; never hand-edit kb projections. Root validation applies via project-authority policy. Existing mandates for separate implementation/review/QA remain. Root explicitly validated docs type, trust-boundary yes and both precise scope decisions; fresh neutral current-source research is research-current-source.md. Historical wrong-source attempt remains invalid.

## Quality Gates

```bash
node .harness/bin/claims-reconcile.js validate --root .
node .harness/bin/claims-reconcile.js project --root .
node .harness/bin/claims-reconcile.js check --root .
npm run check
npm test
npm run test:e2e
npm run build
```

Node22+, rtk prefix, Chromium/Firefox required by project policy. No separate lint command exists. Exact affected CHECK2/CHECK13 and AC24 require renewed bound evidence; CHECK38 remains independent manual critique and is not completed by this amendment.

## Open Questions

None. Root explicitly approved full1200ms rendered latestdestination journey/no queue with existing cancellation/static fences; compact500 record history is distinct from detailed150/100/100. Root approved exact proposed-normative-delta.md. Old failures stay historical and do not become PASS.
