---
status: live-doctrine
schema-version: 2
last-updated: 2026-10-28
superseded-by: null
---

# Architecture and verification boundaries

`src/index.html` loads production `src/main.ts`. Main orchestrates two network runtimes, data enrichment, selection and dashboard models. `src/dashboardView.ts` owns production DOM updates; `src/dashboard.css` owns responsive presentation. `src/fixtures/` exercises component fixtures and is not the production dashboard.

`src/monitor/networkMonitor.ts` coordinates head, validated-proposal and mempool streams, generation checks and bounded fallback polling; `headGeneration.ts` rejects obsolete head work. `src/rpc/streamTransport.ts` manages stream/fallback behavior; `jsonStream.ts` decodes streamed JSON; `guards.ts` validates RPC input; `operationStore.ts` bounds and deduplicates retained operations. `models.ts` carries shared RPC types. `networkData.ts` retrieves protocol constants, contextual rights, aliases and eligibility. `customSources.ts` validates, probes and diagnoses viewer-supplied sources per network (`?rpc=`, `?rpc_shadownet=`, browser storage; at most four, URLs up to 2048 characters); `src/view/customSourcePanel.ts` renders them and the notice beside each network header.

Custom sources are resolved once at page load and lead `sources`, `streamSources` and `rawStreamSources`, so they are tried first for RPC reads and every monitor stream; adding or removing one reloads the page (apply-on-reload). Trust is gated by chain, not by order: `ObservationStore` lets a custom source establish, or be authorized under, the expected network identity only when its `chain_id` equals `CHAIN_IDS[network]`, while built-ins keep first-proven identity. A startup probe that finds another chain, a non-JSON answer or an oversized body adds the source to `sourceExclusions` (`src/rpc/sourceExclusion.ts`): `NetworkData` reads skip it and `StreamTransport` leaves it at once. Custom streams also have a 60 s idle deadline (`CUSTOM_STREAM_IDLE_MS`) that fails over with a classifiable "RPC stream idle" error; built-in streams have none. `boundedBody.ts` caps probe (1 MiB) and `NetworkData` (32 MiB) response bodies. `main.ts` builds the streams through `reportingStreamFactory`, which reports each custom source's stream errors and recovery to its panel row.

`src/consensus/roundSchedule.ts`, `activityRound.ts`, `proposalPlan.ts` and `delegateStatus.ts` compute schedule, selection and participant views. `src/view/` holds reusable delegate/opportunity elements. These modules must preserve the [properties](properties.md) across V3 structural changes; the current singleton proposal/selection model is a known boundary to revisit.

`tests/unit/` uses Vitest for deterministic protocol/transport/model cases. `tests/e2e/` uses Playwright Chromium/Firefox and deterministic RPC streams on production `/` plus fixtures. `.github/workflows/quality.yml` runs clean Node 22 checks. Vite emits only the static site into `dist/`, with relative asset URLs. Deployment revision is injected at build time from Git; rebuild after the release commit. Browser observations depend on each served origin's actual CORS/provider access.

No framework migration or server infrastructure is assumed. Reuse indexed maintainer libraries before new infrastructure; preserve dependency/pinning policies. TypeScript is strict. Required commands and authority are in [project policy](../.harness/rules/project-authority.md).
