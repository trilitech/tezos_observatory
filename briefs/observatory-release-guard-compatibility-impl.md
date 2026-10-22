# Implementation Brief — observatory-release-guard-compatibility

**Date:** 2026-10-22
**Mode:** fast
**Status:** COMPLETED

## Modified files

- `scripts/check-observatory-v3.mjs`: native JSON output file; retain stdout, stderr and exact report SHA before classification.
- `roster/observatory-v3/check-scenarios.json`: four references to one renamed camera scenario; unchanged scenario counts and engine coverage.
- `tests/unit/v3CheckRunner.test.ts`: real configured discovery matrix and direct-file transport regression tests.

## Decisions made

No application, contract, numerical or assertion-threshold changes. Historical commit `2c23b17` renamed the scenario when moving animation onto observed cards. The current body still verifies upward camera coordinates, negative vertical travel, duplicate stability and reduced-motion cancellation, now with the separately requested 1200 ms. All manifest references select that existing scenario. Actual Playwright discovery verifies every required title in both engines.

Playwright writes complete JSON attachments directly to a unique file via `PLAYWRIGHT_JSON_OUTPUT_FILE`; stdout is diagnostic only. Missing/empty/malformed reports, interruption, inconsistent process status and runtime failures remain errors (2); completed matcher failures remain 1. Exact completeness classification is unchanged.

Library-index was searched with its configured data directory. No new infrastructure or dependency was selected; existing Playwright reporter and Node APIs are reused.

## Quality Gates

- Node 22 TypeScript check and build pass.
- Full unit suite: 450 tests pass. Seven runner tests include real discovery, >50 MB transport, retained exact file bytes/stderr, missing/empty/malformed files, nonzero status, interruption and runtime precedence.
- Actual AC-02: PASS, five scenarios in each of two engines.
- Actual AC-13: PASS, five scenarios in each of two engines; complete 53 MiB JSON retained without ENOBUFS.
- `git diff --check` passes.

## Review attention and evidence

Private evidence: `/var/tmp/observatory-release-guard-evidence`. Baseline native RED artifacts were retained from the coordinator's previous execution, with original source and a newly reproduced discovery RED showing exactly four missing title references. This is baseline evidence, not a claim of global RED on changed source.

Native successful report SHA-256:
- AC-02: `cb63a14f1905ec04b9f05f547563d2adc4111348e6a67fe06f2fb3842c7281b0`.
- AC-13: `9f57813781da4d4eabd07a4a1e5571ee89357c7e319eb6c59b8ebcaa353e6f35`.

No full V3 release, amended-contract acceptance or roadmap completion is claimed. Independent review and QA remain required. The full browser matrix was not rerun for this focused harness-only repair. Generated screenshots were restored before handoff.
