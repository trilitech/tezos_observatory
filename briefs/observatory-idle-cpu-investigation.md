# Investigation — observatory-idle-cpu

Date: 2026-10-22. Source: `1115314`. Status: ROOT CAUSE IDENTIFIED for synthetic dense active workload; public-provider contribution unproven.

## Symptom and scope
Users report slow updates and substantial machine load while leaving the tab open. Expected: efficient foreground collection, no pointless idle/background rendering, authoritative votes unchanged. Read-only investigation authorized by the coordinator under project-authority; production source not modified during measurement. Existing productionFixture HTTPS interception ensures zero public-node traffic. The fixture wraps monitor emit for bounded diagnostic receipts, so timing is comparative evidence, not a hardware-independent product benchmark.

## Observed evidence
Chromium CDP Performance/Profiler against the built production application, 50 signers. `/var/tmp/observatory-idle-cpu-evidence/baseline.json` and CPU profiles:

- Visible idle, 10.013 s: 90.3 ms browser task, 30.4 ms script, 3,641 DOM mutations, 40 geometry reads.
- Hidden idle, 10.009 s: 31.6 ms task, 1.13 ms script, 60 mutations, zero geometry, zero RPC request increments.
- Dense retained 10,000 operations, idle 10.008 s: 196.4 ms task, 66.1 ms script, 3,653 mutations, 40 geometry reads.
- **Dense active: 10,000 retained operations plus 100 packets × 10 operations at requested 20 ms intervals**: 5.203 s elapsed, **3.874 s browser task (~74.5% elapsed)**, 0.621 s script metric, 32,098 mutations, 408 geometry reads. Heap grows 29 MB over this short sample: allocation pressure, not a proven leak. Full profile `visible-dense-burst.cpuprofile`, raw metrics `dense-stream.json`.

Profiler dense-active samples: collectGroups minified function `lo` ~840 ms, another minified store function `Me` ~479 ms, `addOperations` ~389 ms, `tryAdmission` ~173 ms, GC ~204 ms. Minified named functions were traced to source by matching inspected build/source; unnamed samples remain unattributed. The TaskDuration metric and sampled JS time are different measurements and must not be summed.

## Confirmed mechanisms
1. Every batch builds/rechecks the retained operation population: `src/monitor/observationStore.ts:180-230` builds replayIndex by scanning all retained raw operations, scans again for retained/lost support, then refreshes accepted phases. `src/monitor/observationStore.ts:479` refreshAcceptedPhases reads all raw operations and runs groupsFor for each authorized context. Dense repeated small packets multiply this work.
2. `src/monitor/networkMonitor.ts:636-665` emit constructs full rawOperations, acceptedTargets repeatedly, history, inspection and navigation before application RAF coalescing (`src/main.ts:545-552`). Coalesced paint does not coalesce those preceding allocations/calculations.
3. `src/main.ts:680-684` unconditionally schedules full render for both networks each visible second. Full render runs groupsFor (`:332`), rebuilds committee models (`:499`) and updates full dashboard. This is measurable idle churn but **the idle profile does not explain severe CPU by itself**.
4. Dashboard full update (`src/dashboardView.ts:653-795`) updates closed delegate tables (`:245-275`) and navigation layout (`:588`, layoutPath `:485-532`), triggering repetitive attributes/geometry/edge replacement, confirmed by mutation and geometry counts.
5. Hidden collection already stops, but dashboard.tick still mutates clock DOM each second (`src/main.ts:681`; dashboard tick `src/dashboardView.ts:799`). Background idle is comparatively low.

## Hypotheses
| Hypothesis | Result |
|---|---|
| Repeated full UI render causes avoidable idle churn | Confirmed observed; modest CPU alone |
| Dense small operation packets amplify full retained-state processing | Confirmed observed, substantial CPU |
| Hidden tab continues normal full collection | Refuted in bounded fixture: zero new requests, zero geometry |
| Public-node rate limits directly cause measured CPU | Not tested; all HTTP intercepted, separate RPC investigation |
| Long-session memory leak | Unproven; short allocation delta insufficient |

## Fix plan and regression gates
Fast mode, separate implementation/review/QA. First aggregate transport-operation packets before expensive state processing while preserving message ordering, source/generation/cancellation/coverage receipts, bounded buffers and genuine batch semantics. Do not aggregate across head/source/lifecycle boundaries. Measure dense active replay again. Separate cheap clock updates from full data render; preserve independent round rollover, predictionElapsed/stalled status, eligibility age and exact authority expiry (not blind interval removal). Suppress hidden clock mutations. Avoid geometry/closed committee work when presentation unchanged.

Regressions: same final admitted votes/conflict/unknown states under many chunk shapes; no lost partial stream tails; abort/source/head boundaries; idle no structural committee/path mutations while visible clocks advance; hidden zero mutations; genuine votes/head changes still update and animate at 1.2 s; pin/history semantics unchanged. Compare CDP task and mutation evidence against identical replay, without absolute cross-machine timing gates.

Coverage limits: dense fixture currently 50 signers and 10,000 operations, not 500 history records or all realistic Mainnet committee sizes. No claim that production node coverage or all reported slowdowns are solved. Durable facts handed to coordinator for KB synchronization and Fast routing.

## First bounded implementation (coordinator-authorized Fast)
`src/monitor/observationStore.ts:180`: create replay index lazily per batch and restrict its retained candidates to incoming hashes. The full replay identity already includes hash, so this is a necessary-condition prefilter, never an authority shortcut. Final source/network/hash/branch/contents identity and existing sidecar proof predicates remain unchanged. No persistent cache is introduced. Healthy scoped receipts are covered; laziness alone showed no material improvement (3.698 s task vs baseline3.874 s, noise), so it is not the claimed benefit.

Same dense scoped-stream replay after hash filtering: 4.651 s elapsed / 3.276 s TaskDuration versus baseline5.203 s / 3.874 s: ~15.4% less browser task time in this bounded run. Still substantial load: this is a partial reduction, not a complete solution to user-reported heavy CPU. Unit regression covers same-hash branch/source distinction and unchanged content/level raw-identity deduplication, first-receipt preservation and snapshot replay. Remaining transport chunk batching and repeated phase aggregation require subsequent scoped work. Idle timer/clock behavior was not changed.
