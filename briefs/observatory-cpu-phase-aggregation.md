# Dense active CPU — phase aggregation follow-up

Source base: `ad00345`. Coordinator authorized separate Fast implementation after read-only profile. No public RPC; existing productionFixture intercepts all HTTPS. Separate worktree `/var/tmp/observatory-cpu-phase`.

## Remaining root cause
Unminified production diagnostic profile (same dense 10k retained operations +100 packets of10): collectGroups accounts for ~975 ms sampled CPU, rawOperations callback ~884 ms, operationIdentity ~502 ms, tryAdmission ~327 ms. Static location `src/consensus/phaseEvidence.ts:89`: every operation serializes the same [contextKey,round,payload] tuple even when10k receipts share a group. The local group index needs tuple equality, not JSON allocation.

## Bounded change
Replace only per-invocation group lookup with nested Map(context→round→payload), plus explicit first-seen group array. No persistent cache or authority memoization; per-operation admission/context/rights compatibility, phase receipt selection, unknown slots, signer dedup and conflict membership remain unchanged. Non-finite round values share the prior JSON-null identity; Map preserves prior signed-zero identity. First-seen order is retained explicitly. Membership index stays unchanged.

## Evidence
136 focused tests pass, including new interleaved source/phase/round/payload and receipt priority regression plus non-finite numeric identity. Private differential against exact base implementation:100 deterministic adversarial workloads ×250 operations, identical complete normalized outputs (including Set insertion order, all group properties and evidence objects). Differential reference/probe are private untracked diagnostics, not shipped duplicate production code.

Unminified localized collectGroups samples fall ~975→252 ms (~74%); this does not establish whole-application improvement and sampling variance applies. First single minified sample was inconclusive (task3.449 s vs earlier3.276 s), so a three-pair alternating base/patch comparison was started. Diagnostic fixture monitor.emit tracing is explicitly bypassed on both sides to avoid attributing test harness receipts to production. Paired evidence is private under `/var/tmp/observatory-cpu-phase-evidence/paired-*-*.json`. Final comparison appended below after all live runs complete. Substantial residual allocation work in rawOperations/operationIdentity remains; this change is not a declaration that user-reported CPU is fully solved.

## Matched production-minified evidence (three alternating pairs)
With fixture emit tracing bypassed on both sides, dense-active TaskDuration base→patch:5.184→3.195 s;3.921→4.065 s;4.057→3.112 s. Median4.057→3.195 s (~21.3% lower). ScriptDuration:0.905→0.487;0.702→0.575;0.749→0.463 s, median0.749→0.487 (~35.0% lower). Median elapsed5.256→4.685 s (~10.9% lower). One pair regressed task time ~3.7%, so system contention/variance remains and these are bounded scenario results, not universal performance guarantees. Recorded gauge text where enabled remains matching. Exact normalized semantic outputs separately match100 adversarial differential workloads. Final profiles/JSON and `paired-summary.json` reside in the private evidence directory. No claim that full CPU problem is solved.
