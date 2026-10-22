# Research — roadmap-contract-reconciliation

_Generated: 2026-10-22T05:58:59.898175+00:00_
_Mode: fast; direct documentarian execution as assigned (no nested agents)_
_Online research: enabled; official browser/tool documentation only_
_Input: questions.manifest.json; manifest-neutral validation passed_

## Question 1: Where are the current animation timing values defined, and how do they propagate into rendered behavior?

**Finding:** The navigator camera uses a 160 ms Web Animations transform with cubic-bezier(.2,.7,.2,1), translating from −32px vertically or +48px horizontally to zero. A UI delivery receipt preserves the original monotonic emission timestamp for an unchanged identity. Main passes this receipt only when it matches the displayed observation. cameraElapsed permits animation only for elapsed times from 0 inclusive to 160 exclusive; the document timeline start is backdated by elapsed time. Camera updates cancel the previous animation, and enabling reduced motion cancels it immediately. Direction depends on coherent, continuous source/chain/protocol observations and adjacent round or verified next-level relationships.

**References:**
- `src/cameraTiming.ts:3` — receipt identity and timestamp preservation.
- `src/cameraTiming.ts:8` — elapsed-time validity and 160 ms cutoff.
- `src/main.ts:589` — receipt creation from emitted observation view.
- `src/main.ts:202` — matching receipt enters dashboard model.
- `src/dashboardView.ts:370` — cancellation, continuity, direction, transform duration and timeline origin through line 395.
- `src/dashboard.css:53` — reduced-motion CSS disables transitions and animations.
- `tests/e2e/dashboard.spec.ts:1062` — browser test reads live animation timing and computed transform; line 1068 checks duration 160.
- `tests/e2e/dashboard.spec.ts:1143` — requestAnimationFrame captures actual animations and transforms; line 1149 asserts accepted-observation-to-settlement elapsed ≤200 ms.
- `tests/e2e/burstTiming.ts:4` — elapsed measurement subtracts matching coherent admission timestamp from first sampled zero-animation frame; missing evidence throws.

## Question 2: How are retention limits defined and applied across the existing navigator and detailed views?

**Finding:** ObservationStore maintains separate raw, unresolved, accepted-candidate and instance products. Raw storage is capped at 10,000 without a finite age limit. Unresolved and accepted candidates are trimmed to 100; instances to 150. Trimming orders by original monotonic receipt then identity. Session history separately evicts beyond 150 and preserves an evicted selected pin as a frozen snapshot. Session snapshots bound candidates at 100 while protecting the selected candidate and mark partial retention; unique fact unions and current phase arrays cap at 10,000. Phase crossing facts separately cap at 500. The session controls disclose the 150/100/100/10,000 limits and reload reset. The retained navigator list uses session.instances. Compact history data and rendering both take five items; the event list renders the latest twelve.

**References:**
- `src/monitor/observationStore.ts:104` — raw OperationStore(10000, Infinity).
- `src/monitor/observationStore.ts:172` — unresolved/candidate caps.
- `src/monitor/observationStore.ts:218` — unresolved/instance caps.
- `src/monitor/observationStore.ts:333` — receipt-ordered trim.
- `src/monitor/observationStore.ts:420` — snapshot candidate cap/protected pin.
- `src/monitor/observationStore.ts:428` — bounded facts and phase arrays.
- `src/monitor/observationStore.ts:443` — session eviction and frozen pin.
- `src/monitor/observationStore.ts:489` — crossing-fact cap.
- `src/dashboardView.ts:443` — user-visible counts and retention disclosure; line 445 builds retained navigator membership.
- `src/main.ts:145` — compact history slice(0,5).
- `src/dashboardView.ts:143` — compact rendered history slice(0,5).
- `src/dashboardView.ts:517` — rendered events slice(-12).

## Question 3: How does the current evidence workflow preserve failed results and bind claims to their source, build, and hash?

**Finding:** The V3 criterion runner writes raw Playwright stdout and stderr into a fresh temporary directory before checking process errors or classifying results, and prints the report path and SHA256. Classification distinguishes completed assertion failures (exit 1) from incomplete/runtime/fixture errors (exit 2). sourceBindings records git revision and per-file SHA256 maps for sources, contracts and every production dist file, with combined hashes. Packaging compares captured revision/source/contract/production bindings against current bindings, inventories artifact hashes, and rejects failed matrix records. Loading requires exhaustive source and production inventories, verifies every file hash, checks render measurement PASS and matrix identity, verifies source/contract/build agreement, and compares screenshot hashes. Observable matrix captures write FAIL when measured failures exist; packaging does not convert those captures into acceptance.

**References:**
- `scripts/check-observatory-v3.mjs:41` — report and stderr persistence before process/classification checks.
- `scripts/check-observatory-v3.mjs:9` — classification completeness, assertion and runtime distinctions through line 31.
- `scripts/check-observatory-v3.mjs:44` — PASS versus ASSERTION_FAILED output; line 45 returns execution error 2.
- `scripts/v3-evidence-contract.mjs:5` — SHA256 helper.
- `scripts/v3-evidence-contract.mjs:22` — source, contract, production and git binding.
- `scripts/package-v3-evidence.mjs:6` — captured/current bindings compared.
- `scripts/package-v3-evidence.mjs:13` — artifact hashes and failed matrix rejection.
- `scripts/package-v3-evidence.mjs:16` — packaging result is PACKAGED_NOT_ACCEPTED.
- `scripts/v3-evidence-contract.mjs:54` — inventory, hash, matrix and screenshot validation through line 83.
- `tests/e2e/v3Evidence.ts:58` — capture status derives from measurement failures and document geometry.

## Question 4: [ecosystem] How do existing browser tools measure rendered-animation timing and associate measurements with the tested source and build?

**Finding:** Chrome DevTools Performance exposes an Animations track and per-frame duration, plus screenshots associated with the recorded timeline. Web Animations exposes currentTime in milliseconds and computed effect timing; MDN documents reduced timer precision. performance.now uses a monotonic time origin. Playwright traces can include screenshots, DOM snapshots, network activity and action source files. Playwright Test tracing also includes test assertions, whereas browser-context tracing does not. Playwright captureGitInfo can store commit information and diff in test configuration metadata. The cited documentation describes these trace/source/git associations; it does not establish an automatic cryptographic binding between arbitrary deployed production assets and a measurement.

**References:**
- [Chrome DevTools Performance features reference](https://developer.chrome.com/docs/devtools/performance/reference#animations) — Animations track, frame durations and timeline screenshots; Chrome for Developers, Kayce Basques and Sofia Emelianova, accessed 2026-10-22.
- [Animation.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime) — animation time and reduced precision; MDN, accessed 2026-10-22.
- [AnimationEffect.getComputedTiming](https://developer.mozilla.org/en-US/docs/Web/API/AnimationEffect/getComputedTiming) — effect timing; MDN, accessed 2026-10-22.
- [Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) — monotonic timing; MDN, accessed 2026-10-22.
- [Playwright Tracing](https://playwright.dev/docs/api/class-tracing) — trace contents, sources option, assertion distinction; Microsoft Playwright, accessed 2026-10-22.
- [Playwright captureGitInfo](https://playwright.dev/docs/api/class-testconfig#test-config-capture-git-info) — commit and diff metadata; Microsoft Playwright, accessed 2026-10-22.

## Patterns found

| Pattern | File | Lines | Notes |
|---|---|---|---|
| Timestamp-preserving camera receipt | `src/cameraTiming.ts` | 3–11 | Same identity preserves receipt; elapsed consumes timeline |
| Independent bounded products | `src/monitor/observationStore.ts` | 333–336 | Original receipt orders eviction |
| Persist before classify | `scripts/check-observatory-v3.mjs` | 41–45 | Raw reports survive assertion/runtime failure |
| Content binding | `scripts/v3-evidence-contract.mjs` | 22–28,54–83 | Hash inventories and render/source/build agreement |

## External prior art

| Tool / Approach | Source | Key finding |
|---|---|---|
| Chrome Performance | Chrome documentation cited above | Recorded animations, frames and screenshots |
| Web Animations | MDN documentation cited above | Effect timeline in milliseconds |
| Playwright | Official documentation cited above | Trace source files and git metadata |

## Coverage gaps

- No live browser measurement was executed: this is documentary research of existing workflow and APIs.
- Official sources above document source/git association; automatic production-asset cryptographic binding was not established from those sources.
