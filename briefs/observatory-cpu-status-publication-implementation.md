# Implementation — CPU duplicate operation status publication

Date:2026-10-22. Roster route: Fast, coordinator-authorized investigation and bounded implementation. Base:`cc3d2ec`. Status: awaits independent review and QA; no publication claim.

## Mechanism and bounded change
Real StreamTransport invokes onValue and then onStatus synchronously per parsed message. The operation monitor already publishes complete data facts inside onValue; the subsequent healthy status publishes the same full facts again merely to deliver counters. Pass the current TransportMetrics as optional fourth internal onValue argument, then install these exact metrics and source before the existing full data publication.

A one-shot metadata receipt may suppress only the matching healthy status after an already-healthy same-source data publication. It contains lifecycle, head generation, source and metrics identity; no domain data or cached authority. It is consumed by the next status callback. Running/streaming, lifecycle and generation must still match. First healthy transition, errors, recovery, reconnect, source change, different metrics object and custom three-argument factories retain full publication. Other domain emissions are unchanged. No debounce, delayed vote processing, reordered packet or additional RPC.

## Scope
- `src/rpc/streamTransport.ts`: optional fourth metadata argument.
- `src/monitor/networkMonitor.ts`: exact metrics installed before data publication; one-shot duplicate-status guard.
- `tests/unit/networkMonitor.test.ts`: real stream integration and adversarial callback boundaries.

## Evidence
141 focused tests and TypeScript check pass. Real ReadableStream→StreamTransport→NetworkMonitor integration proves first data view has current counter, first healthy transition still publishes, second healthy packet has one full publication with both operations retained, and stream error publishes. Adversarial callbacks cover distinct metrics objects, source changes, errors/recovery, custom three-argument factories, head generation change and stop/restart. Existing cancellation and decoder/stream suites run unchanged.

Two matched production-minified baseline/patch profiles use the actual StreamTransport, intercepted fixture network and argument-forwarding diagnostic wrapper. Domain tracing is bypassed on both sides. Final figures appended after measurements; no universal CPU threshold is claimed.

## Handoff
Independent review/QA must inspect the exact frozen commit and lifecycle/source/metric fences before shipping. This change removes redundant publication, not the legitimate phase aggregation or all remaining workload costs.

## Matched measurements
Two pairs each reduce measured full raw materializations303→202 for101 already-healthy packets. Raw-materialization time876.3→465.6 ms and714.7→570.6 ms. Whole TaskDuration3.414→2.256 s and2.603→2.685 s; ScriptDuration0.531→0.400 s and0.393→0.450 s. The second pair regresses whole-task/script timing despite deterministically fewer materializations, so variance is explicit. Medians: task3.008→2.470 s, script0.462→0.425 s, elapsed4.409→3.950 s. Gauges remain30,000/30,000 power and50/50 signers. These per-change percentages must not be added to earlier optimization percentages or generalized to every machine. First healthy transition is separately covered by real-transport unit integration and intentionally remains published.
