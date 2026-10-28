---
status: live-doctrine
schema-version: 2
last-updated: 2026-10-14
superseded-by: null
---

# Architecture and verification boundaries

`src/index.html` loads production `src/main.ts`. Main orchestrates two network runtimes, data enrichment, selection and dashboard models. `src/dashboardView.ts` owns production DOM updates; `src/dashboard.css` owns responsive presentation. `src/fixtures/` exercises component fixtures and is not the production dashboard.

`src/monitor/networkMonitor.ts` coordinates head, validated-proposal and mempool streams, generation checks and bounded fallback polling; `headGeneration.ts` rejects obsolete head work. `src/rpc/streamTransport.ts` manages stream/fallback behavior; `jsonStream.ts` decodes streamed JSON; `guards.ts` validates RPC input; `operationStore.ts` bounds and deduplicates retained operations. `models.ts` carries shared RPC types. `networkData.ts` retrieves protocol constants, contextual rights, aliases and eligibility. `customSources.ts` validates, probes and diagnoses viewer-supplied sources per network (`?rpc=`, `?rpc_shadownet=`, browser storage), which `networkData.ts` lists before the built-ins; `src/view/customSourcePanel.ts` renders them.

`src/consensus/roundSchedule.ts`, `activityRound.ts`, `proposalPlan.ts` and `delegateStatus.ts` compute schedule, selection and participant views. `src/view/` holds reusable delegate/opportunity elements. These modules must preserve the [properties](properties.md) across V3 structural changes; the current singleton proposal/selection model is a known boundary to revisit.

`tests/unit/` uses Vitest for deterministic protocol/transport/model cases. `tests/e2e/` uses Playwright Chromium/Firefox and deterministic RPC streams on production `/` plus fixtures. `.github/workflows/quality.yml` runs clean Node 22 checks. Vite emits only the static site into `dist/`, with relative asset URLs. Deployment revision is injected at build time from Git; rebuild after the release commit. Browser observations depend on each served origin's actual CORS/provider access.

No framework migration or server infrastructure is assumed. Reuse indexed maintainer libraries before new infrastructure; preserve dependency/pinning policies. TypeScript is strict. Required commands and authority are in [project policy](../.harness/rules/project-authority.md).
