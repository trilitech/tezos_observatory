# Proposed normative delta — pending root inspection

This is a review artifact, not an active specification. The user direction “1.8s c’est beaucoup, vise1.2” supersedes the old160/200ms behavior; no earlier failure becomes PASS. Claims identifiers, structured mapping and every unrelated obligation remain intact.

## Motion obligations

FR-012 replacement:
When an eligible adjacent observed progress transition animates, the observatory MUST move the chain scene through a full1200ms rendered journey at constant speed, measured from the start of that rendered transition; this supersedes the earlier160ms default/200ms receipt-to-settlement policy.

FR-013 replacement:
When further coherent destinations arrive before a transition finishes, the observatory MUST coalesce to the latest eligible accepted destination with at most one coordinated scene transition in flight and no reenactment queue; a newly rendered destination receives its full1200ms journey from rendering, and a burst ending at the next level uses RIGHT progression. Gap, reorg, reduced-motion, pin and source/context changes retain their existing static/cancellation fences. This obligation makes no200ms receipt-to-settlement promise.

AC-02 delta:
Replace only “finite motion defaults160ms and never exceeds200ms” with “the actual chain scene travels for1200ms at constant speed from rendered start”. Keep actual UP/RIGHT destinations, two conditional branches, source-qualified relationship labels, clock-only/duplicate no-motion and focus/document-scroll assertions.

AC-13 delta:
Replace only old default160/max200/settlement200 timing with at-most-one coordinated scene transition; newest eligible rendered destination receives full1200ms constant-speed journey, no reenactment queue. Preserve final gap/reorg/reduced-motion/source/same-coordinate static handling and cancellation semantics. Do not demand proof of a platform-independent exact event-loop wall-time deadline.

Update US2/S1 and Q4/C5 normative timing mirrors consistently, without rewriting historical intake/review/evidence artifacts. Place one dated supersession note near validation context pointing to original historical policy/failures and latest accepted root decision.

## Retention clarification

Add a precise contextual paragraph by US4 scope/Entities:
Detailed inspection history remains150 full per-network session instances with accepted/unresolved candidate products bounded100/100 and one static frozen evicted pin. Compact navigator history is a distinct product:500 observed proposal records by default, selectable25/50/100/250/500/1000/unlimited; competing observed hashes count toward finite record limit, no historical RPC backfill and no claim of canonical inclusion/on-chain uncle status. Unlimited compact records may grow browser memory; rendering remains bounded. This does not substitute compact records for retained detailed evidence or relax foundation FR046/AC24.

## Amendment verification freeze

After final authoritative source text is approved and applied, run official validate/project/check and refresh task context. Foundation contract bytes and SHA remain unchanged. Renew V3 exact checksum consumer only after final contract bytes stabilize. Compare old/new extracted393claim models and require exact unchanged namespace/identifier/lifecycle/edges, exactly four changed statement texts (V3 FR012/013 AC02/13); descriptions outside claims may change only approved motion/retention mirrors. New source-bound visual bundles/receipts must be produced against amended contract; old reports stay historical/superseded.

## Minimal-freeze delivery contract, staged

Invariants: approved user timing semantics and all four IDs; no unrelated claim removal/change; fresh managed projections generated officially; historical evidence neither edited nor relabelled; real consumers reject stale exact-hash bundles. Authentic success is real V3release consumer with amended source/contract/build evidence; failclosed path is existing v3EvidenceContract unit rejection of mismatched hashes, followed by real consumer negative-bundle replay. These checks are genuine execution gates, not accepted results at draft time.

Pending: root reviews this exact normative delta; final minimal-freeze spec file must be placed under specs by owner after approval, with paired AC/CHECK entries and real exit conventions; independent review and QA remain required.
