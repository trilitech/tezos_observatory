---
status: historical
schema-version: 2
last-updated: 2026-10-28
---

# Unresolved baseline risks

This onboarding record separates reproduced observations from hypotheses. It does not claim fixes have shipped.

| Finding | Evidence status and location | Required follow-up |
| --- | --- | --- |
| Distinct same-round proposal discarded | Reproduced in isolated unit scenario; `src/monitor/networkMonitor.ts:335` rejects equal rounds and retains one proposal | Preserve candidate identities; regression with two same-round candidates |
| Proposal label can describe another payload | Reproduced production Chromium scenario; `src/dashboardView.ts:220` matches level/round without payload, `src/main.ts:243` omits payload in proposal view | Exact selected candidate/producer attribution; competing-payload browser regression |
| Individual vote without payload admitted and pooled | Reproduced malformed input; `src/rpc/guards.ts` individual branch and `src/main.ts:82` unknown fallback | Reject unusable identity; this is validation hardening, no real malformed provider response observed |
| Coverage and health lack adequate context | Source review candidate; `src/main.ts:196` coverage and status composition | Prove per-instance/source usable coverage, independent progress/observer states and honest zero |
| Rights cache may reuse incompatible head context | Source review candidate; `src/rpc/networkData.ts:127` protocol/level key | Establish stability or contextual invalidation; real divergent rights not demonstrated |
| Pin/follow-live inspector absent | Baseline feature gap in main/view selection | Stable history selection, independent collection pause, newer-items count |
| Mobile masthead overlaps at 390px | Reported rendered baseline observation despite horizontal-overflow tests passing; `src/dashboard.css` masthead/control constraints | Rendered geometry checks, long text and keyboard/touch in both themes |
| Auxiliary work/eligibility/event provenance | Audit candidates in `networkData.ts`, `main.ts`, `dashboardView.ts` | Cancellation, context/age labels and exact event identity tests |

## Viewer-supplied (link-supplied) RPC sources

A `?rpc=` or `?rpc_shadownet=` link, or a URL saved from a source panel, makes a node chosen by whoever wrote the link the first source for RPC reads and monitor streams. That node is untrusted: it can report another chain, withhold or delay data, answer slowly or with very large bodies, and learn the viewer's IP address, origin and request timing (requests omit credentials). Mitigations in place: no custom source by default; at most four per network and URLs up to 2048 characters; an origin label in the source pane plus a notice beside the network header ("Using a custom RPC source … from this link · Review"); chain-id gating in `ObservationStore` so a custom source never fixes or joins another chain's identity; exclusion from reads and streams after a startup probe finds another chain, non-JSON or an oversized body; a 60 s idle deadline on custom streams; capped response bodies; node-controlled text truncated and stripped of control and bidi characters. Residual: a custom node on the right chain can still withhold operations or serve a stale head (source-limited observation already applies), the startup probe and first stream requests contact the linked host before the viewer reviews it, a private-network host can be probed from the viewer's browser, and `SourceComparison` (`src/rpc/sourceComparison.ts`) still reads response bodies without a byte cap. No consent step is required before a link-supplied source is used.

Public RPC CORS, buffering and stream gaps can prevent observations. One bounded Shadownet request succeeded; Mainnet verification requests returned 403 in the audit environment. This does not certify other origins or provider completeness. The suspected missing `/header` hash defect was disproved by documentation and configured Shadownet response; do not introduce a bootstrap fix for it.

External design critiques are opinions or bounded observational comparisons, not authorship detectors. Beautiful screenshots and existing passing tests do not establish original composition, complete requirements or live correctness. Keep all definite V3 obligations and explicitly adopted optional features in the final acceptance audit.

## Roster runtime compatibility

Onboarding exposed an upstream compatibility defect: an ESM consumer root treated distributed CommonJS `.js` tools as modules. The maintained upstream feature branch now distributes a SHA-tracked scripts module scope and projects the harness runtime scope, preserving the app root module policy. Installed review-bundle 1.8.0 verification, QA convergence and claims audit execute successfully. Independent review/QA passed 70 focused integration cases; upstream changes are proposed in draft PR #86, not merged. This repair is infrastructure work and does not complete the product roadmap.
