# Implementation — CPU raw publication reuse

Date:2026-10-22. Roster route: Fast (investigated active CPU regression; coordinator authorized bounded implementation). Base source:`b38c0380155a2864b14faf10298a46744ed4d3a9`. Status: awaiting independent review and QA; no publication authorized by this artifact.

## Problem and result
Each operation publication materialized the same retained raw operation sidecars twice synchronously: once for HeadGeneration synchronization and again immediately for NetworkMonitorView emission. Dense production-fixture sampling counted404 rawOperations calls across101 packets: phase refresh, publication synchronization, publication emit, and per-message transport status emit. No fixture domain-trace work was included in CPU sampling.

The publication now captures one operation buffer, synchronizes current generation (or stores initial generation-zero buffer), and immediately emits that captured buffer. Other emits continue reading the store independently. No persistent cache, delayed processing, new request, changed identity or authority shortcut was introduced. Publication has no await or asynchronous gap.

## Scope
- `src/monitor/networkMonitor.ts`: publishOperations captures once; private emit accepts optional captured operation buffer.
- `tests/unit/networkMonitor.test.ts`: actual rawOperations call counts, generation-zero and after-head publication, stable prior snapshot, matching current snapshot operations, independent fresh status read.
- `tests/e2e/productionFixture.ts`: existing emit diagnostic wrapper forwards arguments. Previously original.call(this) silently discarded optional parameters; forwarding is required to observe actual production behavior.

## Safety and corrected hypotheses
OperationStore consumers in ObservationStore and HeadGeneration use Infinity TTL. An initial test assuming120-second expiry failed and was corrected after inspecting those constructors. This change preserves existing retention and does not invent expiry behavior. Advancing the monotonic clock in the regression still yields a fresh independent array with the retained facts unchanged. Source/head/generation/pause ownership logic remains untouched.

The first benchmark after product change incorrectly showed404 calls because the diagnostic emit wrapper dropped the captured argument. That run is invalid evidence about the optimization. After forwarding, actual303 calls are observed, a deterministic25% reduction in those full materializations for this101-packet scenario. Both sides of final paired measurements use the same forwarding wrapper and bypass domain trace allocations.

## Validation
137 focused unit tests pass. TypeScript check and production build pass. Private paired fixture evidence and counters are retained by the coordinator; final paired figures appended after completion. No claim of a universal CPU percentage or complete resolution of heavy-user workloads.

## Handoff
Implementation is ready only after its frozen commit is independently reviewed and QA is recorded. Remaining dense costs include phase refresh/operation identities/sidecar wrapping elsewhere and per-message status emission. They are not silently declared resolved.

## Final matched measurement
Two alternating production-minified pairs with identical argument-forwarding diagnostics:404→303 materializations in eachpair. Raw-materialization time866.6→663.7 ms and888.8→678.9 ms (median~23.5% lower). Whole browserTaskDuration2.640→2.483 s and2.706→2.554 s (median~5.8% lower); elapsed4.154→3.984 s and4.225→4.047 s. ScriptDuration0.384→0.398 s and0.393→0.399 s did not improve in these samples; those metrics differ in scope and are reported separately. Gauges match30,000/30,000 power and50/50 signers. Materialization reduction is deterministic; whole-performance timings are bounded observations with variance, not a universal guarantee.
