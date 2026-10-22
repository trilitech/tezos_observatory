# Contract reconciliation evidence inventory

Status: preliminary intake evidence; not a completed blind roster-research phase.

- `specs/observatory-v3.md:35,59,134,179,180,271,282` still prescribe 160ms/200ms motion.
- `README.md:49` documents a full visible 1200ms constant-speed journey measured from rendering; `src/cameraTiming.ts:8` exports CAMERA_DURATION_MS=1200.
- `briefs/observatory-v3-live-followup-policy.md:9` already superseded original motion with an intermediate 320ms/400ms policy; those historical decisions must not be rewritten as current acceptance.
- `briefs/observatory-v3-pragmatic-timing-disposition.md:5` retains actual failures of the former 200ms policy and explicitly declines full-contract PASS.
- `README.md:51` documents compact proposal-record history, 500 default, 25/50/100/250/500/1000/unlimited, no backfill, competing observations are not canonical uncles.
- `specs/observatory-v3.md:78,82` and foundation FR046/AC24 concern 150 full detailed session instances and separate 100/100 candidate products; these are not compact navigator retention limits.
- `tests/e2e/v3Release.ts:18` pins original V3 SHA 928e1b5a669fef3a8bf513a4c8056766cf8bbacfd266207bf757b14a2417ad7c and original foundations SHA851b2b63b9d75554825a8429fcd6405882d9d28703350dc55113e2130907a7fa. Only the V3 pin needs renewal after amendment, preserving foundational pin.
- `scripts/v3-evidence-contract.mjs:25,61,66,105` binds all contract bytes and independent receipts to exact combined hashes. Old evidence remains historical and cannot certify amended source.
- `tests/e2e/chainMotion.spec.ts:59,60,88` checks actual 1200ms WAAPI duration, linear easing, measured 1100–1450ms visible completion; current product tests already cover user timing.

Actual official claims check was fresh; expected digest050df4d86fc51e3551f09ecd2b698f505c70db869bb425f9d897e21fe1e1f2d8. Exact unmodified context output is context.manifest.json.
