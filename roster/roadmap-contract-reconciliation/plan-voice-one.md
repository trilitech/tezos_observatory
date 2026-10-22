1. Freeze the validated amendment boundary and approved normative delta. Treat this as a user-directed contract change: every rendered latest-destination chain journey is 1200ms at constant speed, with no queued intermediate journey. Preserve cancellation and no-motion/static-destination fences.

2. Amend exactly four managed normative statements in `specs/observatory-v3.md`:

   1. FR012: replace the former receipt-to-settlement 200ms obligation with the full 1200ms rendered journey.
   2. FR013: align latest-destination/no-queue and cancellation behavior with that 1200ms journey.
   3. AC02: require observable constant-speed completion over 1200ms.
   4. AC13: require rapid updates to converge on the latest destination without queueing, while retaining existing cancellation/static conditions.

3. Update only the approved mirrors for those statements: US2, Q4, and C5. Keep the timing domains explicit and separate:

   - Rendered chain journey: 1200ms.
   - Compact navigator observations: 500ms.
   - Detailed inspection instances: 150ms.
   - Candidate bounds: 100ms and 100ms.

   Do not reinterpret 500ms as the camera journey duration or merge any of these values.

4. Regenerate structured projections through the existing reconciler; never hand-edit generated KB projections. Run, in order:

   1. `claims-reconcile validate`
   2. `claims-reconcile project`
   3. `claims-reconcile check`

5. Regenerate exact-source claims and bound evidence. Update the V3 checksum consumed by `tests/e2e/v3Release.ts`; keep the foundations checksum unchanged. Renew evidence for CHECK2, CHECK13, and AC24 using the authoritative spec/build binding. Do not claim CHECK38 completion.

6. Keep execution roles distinct:

   1. Implementation: normative edits, approved mirrors, projection, checksum/binding regeneration.
   2. Review: verify exactly four managed statements changed, mirrors remain semantically identical, and unrelated V3/interval/foundation claims are untouched.
   3. QA: independently run `npm run check`, `npm test`, `npm run test:e2e`, and `npm run build` after reconciler checks.

7. Record outcomes conservatively. Historical UNRESOLVED/WAIVED failures remain historical evidence and must not be rewritten as PASS. Documentary reconciliation does not establish visual completion, CHECK38 completion, or full-roadmap completion.

Assumptions:

- `proposed-normative-delta.md` is the root-approved wording authority.
- Current `CAMERA_DURATION_MS=1200` and README observations are evidence, not substitutes for the normative amendment.
- Existing reconciler and project-authority policy fully cover regeneration.

Risks:

- Broad replacement could accidentally alter the independent 500/150/100/100 timings.
- Regeneration could create unrelated projection drift; any such drift requires investigation.
- Updating only the checksum without renewing bound evidence could conceal source/contract mismatch.
- Passing tests could be overstated as resolution of historical failures or manual critique.

Questions: none; the validated brief resolves the material policy choices.