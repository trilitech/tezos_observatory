# Spec — roadmap contract reconciliation

**Profile: minimal-freeze**
**Status: DRAFT — root final spec quiz pending**

## Invariants

- The amendment preserves all393 existing managed claim identifiers, lifecycle states and relation edges, changes only approved V3 FR012/013 AC02/13 statement text and approved timing/retention mirrors, and records the explicit maintainer1200ms authority. Existing detailed150/100/100 retention remains separate from compact500 proposal-record navigation. Historical old-policy failures remain historical, not retrospective PASS.
- Managed KB views originate only from the existing official reconciler; source/contract/build acceptance remains bound to exact bytes. Documentary reconciliation itself is not release acceptance.
- The authentic existing contract consumer must accept the fresh authoritative model, and the existing release evidence loader must fail closed on an absent evidence bundle rather than manufacture successful acceptance.

## Runnable Checks

- CHECK-1 [AC-1] (authentic-success-path): `node .harness/bin/claims-reconcile.js validate --root .` then `node .harness/bin/claims-reconcile.js check --root .` → real managed-source consumer validates model and projection freshness; assertion mismatch1, tool/runtime failure>=2. Existing CLI freshness failure1 and validation error2 remain meaningful.
- CHECK-2 [AC-2] (fail-closed-path): `node --input-type=module -e 'import assert from "node:assert/strict"; import {loadV3Evidence} from "./scripts/v3-evidence-contract.mjs"; try {assert.throws(()=>loadV3Evidence(undefined), /V3_RELEASE_EVIDENCE/)} catch (error) {process.exitCode=error instanceof assert.AssertionError?1:2; console.error(error)}'` → the real loader rejects missing evidence; check0 means rejection proved, assertion1, runtime/import>=2. Do not inject a bundle through environment in this check.
- CHECK-3 [AC-3]: independent exact extracted-model before/after comparison plus full source diff review → same393IDs/edges/lifecycles, only approved four statements changed and only approved mirrors; retained oldfailure files identical. This is an independent manual evidence review with bound input hashes, not a synthetic PASS.

## Acceptance Criteria

- AC-1 ↔ CHECK-1: authentic current managedsource validates and projection is fresh after official project.
- AC-2 ↔ CHECK-2: missing evidence cannot be treated as accepted release.
- AC-3 ↔ CHECK-3: exact bounded amendment and historical-preservation delta reviewed independently, with no product changes and no unsupported completion claim.
