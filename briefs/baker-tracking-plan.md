# Plan — baker-tracking

**Date:** 2026-10-23
**Status: VALIDATED**

## Sequential steps
1. **Baker selection and profile slice** — standalone entry, validated URL/delegate, bounded local alias catalog, sourced profile; fixture proves safe selection and qualified missing data.
2. **Recent activity and rewards slice** — rights/included operations/produced blocks and canonical union-level batch, plus at-most-six current/past indexed rewards; fixture proves inclusion/right separation and ceilings.
3. **DAL evidence slice** — shared contextual counters and bounded immutable included-detail consumer; fixtures prove exact supported attribution and fail-closed malformed/zero/unsupported paths.
4. **Global DAL slice** — independent no-baker route, applied publications/raw newly-available metadata and context; fixture proves no baker requests or slot verdicts.
5. **Complete integration verification** — cancellation/generations/shared cooldown/cache bounds, phone/desktop accessibility, all final checks and full Node22+ gates.
6. **Independent review then QA** — freeze candidate; separate actors consume reviewer and QA scopes. Repair and rerun affected gates before shipping consideration.

## Dependencies
Steps1–4 share acquisition lifecycle/cache ownership and are sequential under existing implementer /root/rpc_retry_cpu_audit. Shared request-budget fixtures must accompany each slice; do not defer robustness to step5. Step6 follows a frozen candidate and all implementer gates. Publication is a later separate gate.

## Identified risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Raw DAL interpreted as per-slot success/failure | High | High | Raw newly-available labels; decoder unavailable; J4/J5 explicitly deferred |
| Switching or failures bypass budget | High | High | Shared network attempt cooldown and mock-clock switch/failure tests |
| Unsupported aggregate attribution | Medium | High | Supported protocol binding, full validation, duplicate rejection |
| Alias truncation/rights caps imply exhaustive absence | Medium | High | Returned-window and capped-coverage labels |
| Empty runner selection reports success | Medium | High | Final CHECK adapter must reject missing/zero-selected tests |

## Decisions made
Single implementation owner avoids overlapping lifecycle/UI edits. Review and QA use separate actors. Preserve393 claims unchanged; add12 FR/AC/CHECK. No SDK/background streams. J4/J5 deferred. No live/public-provider QA.

## Assumptions
No new product assumptions. Final validated specification controls detailed alias/chain cache policies and acceptance-command adapters. The final specification and `briefs/baker-tracking-spec.md` were read and confirmed VALIDATED after the actual root quiz answers.

## Validation quiz
Delegated root gate requested after role files written: (1) explain why core/global share failed-attempt network cooldown across switches; (2) confirm bounded returned windows/at-most-six cycles and J4/J5 deferral; (3) reject suggestion that zero/raw metadata supports slot success/failure badges. Root provided actual delegated answers on 2026-10-23: (1) YES shared network cooldown includes failed attempts and precedes view/address switching; manual refresh and hide/show cannot bypass it. (2) YES truthful bounded rights/reward windows; no-right only with complete anchored rights evidence; current-cycle missed list on demand maximum50 with qualified coverage; J4/J5 deferred. (3) REJECT raw metadata/zero-bit per-slot success/failure badges; global metadata is newly available snapshot, not cumulative. Quiz PASSED under delegated authority.

## Process evidence
Read validated intake, supplied research and actual independent challenge; no codebase research. Two extra independent planning voices and KB ambiguity auditor have not run; do not claim them completed. Actual precheck: `rtk proxy node .harness/bin/claims-reconcile.js check --root .` exited0 with all three projections fresh; freshness867e21eec5efcfeb9ee3360139733f44174cf1f4f99a46d2ba48a78da05b5eb1 matches supplied task context manifest. Governance human-validation file and local phase hooks were absent at prescribed paths. Final gate PASS: actual root answers recorded above; final specification VALIDATED. Final additive claims precheck rerun exit0, freshness e6b8cc89371d330aa353c7d95840235eb670e3a9d852da3a85f56f847887bf9d; task manifest matches. Owner reports429 claims (393 inherited +36 additive). No implementation or QA pass is claimed.
