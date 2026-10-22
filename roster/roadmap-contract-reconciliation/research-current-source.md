# Fresh neutral research — current source

Actor: /root/neutral_current_source_research, fork_turns=none. Parent transcribed returned factual findings; researcher performed read-only inspection, no browser execution. Explicit absolute checkout /var/tmp/observatory-roadmap-closure, verified HEAD11153141958c56808c3a9b5b31f21de6fe268322. Received only four neutral questions and source path; no amendment intent/intake/history.

## Timing
src/cameraTiming.ts:8 defines CAMERA_DURATION_MS=1200. dashboardView.ts:1 imports it; moveCamera:591 checks coherent adjacent transition, following camera and reduced-motion fences (:603,:614). stage.animate at633 uses duration constant and linear easing; finish635 removes departure copies and relayouts. Reduced-motion handler590 cancels motion. main.ts244 passes cameraAcceptedMonotonic. cameraElapsed receipt-age helper has no current production consumer found outside unit tests; actual journey starts when rendered.

## Distinct retention products
navigatorPath.ts14-16 declares25/50/100/250/500/1000/unlimited and default500; trimming88-99 preserves selected record and tracks truncation. dashboardView.ts323,458-460 persists preference; proposal dialog438-440 paginates10records. ObservationStore108 raw10000; unresolved100/instances150 at223; accepted candidates100 at289; session history150/frozenselected at472; captured unique facts10000 at457-463. dashboardView689 labels separate detailed limits. Unlimited navigator does not relax underlying detailed limits.

## Failure preservation and binding
check-observatory-v3.mjs40-43 creates unique report directory, persists complete JSON stdout/stderr before parsing/classification and reports SHA256. evidence-format.md13/25 preserves failed historical runs and inline traces. v3-evidence-contract.mjs22-28 inventories source/contracts/actualdist and hashes; loader62-83 verifies artifacts/inventories/screenshot bindings, receipts105 bind different actor to identical source/contracts/build. package-v3-evidence.mjs7/13 rejects mismatched or failed measurements. Packaging19 in evidence-format is PACKAGED_NOT_ACCEPTED, not independent acceptance.

## Browser measurement tooling
playwright.v3.config.ts2 builds Vite and serves emitteddist5188. dashboard.spec.ts1089-1096 reads getAnimations timing and computed transforms. Burst1171 samples requestAnimationFrame/performance.now/transform/animationcount/focus/scroll;1176-1177 attaches frames/admission-to-settlement and tests1100-1450ms visible journey including delayed rendering. Domain traces attached29. v3Evidence.ts17 source.json and69 measurement includes revision/source/contract/production hashes and screenshotSHA.

Qualification: individual camera trace attachment bodies do not visibly include source/build hashes; association depends on durable report and packaging. Tool capabilities/source inspection are not new executed browser acceptance or validation of any existing bundle. Previous wrong-checkout report remains invalid and is not replaced by a retrospective PASS.
