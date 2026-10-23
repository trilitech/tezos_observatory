# Baker tracking: primary-source API research

Checked 22 October 2026. Read-only research; no application edits, incidents or user-specific investigations. Current official TzKT OpenAPI reports version1.17.5. Endpoint descriptions are evidence of contracts, not guarantees of any public provider availability/CORS.

## Corrections required before implementation

1. **Alias wildcard claim is false for `/v1/delegates`.** Current controller has no alias parameter. Two bounded neutral requests, one with an impossible alias and another with `nomadic`, both returned the same unrelated first delegate. The API silently ignores this parameter. Use a cached bounded list of delegate address/alias pairs with local search; disclose any pagination limit. Alternatively the official source implements `/v1/suggest/accounts/{search}?limit=20` (maximum100), but this is OpenApiIgnore and returns named accounts generally: validate the selected address as a delegate. Never auto-select an unrelated result.

   Source: [DelegatesController](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Controllers/DelegatesController.cs), [SuggestController](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Controllers/SuggestController.cs).

2. **`uncovered` is stale Swagger metadata, not a supported status query.** The current status parser accepts only future/realized/missed. A neutral `/v1/rights?status=uncovered&limit=0` returns400. Preserve unknown response states defensively rather than silently turning them into missed.

   Source: [BakingRightStatuses](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Repositories/Enums/BakingRightStatuses.cs).

3. **DAL reward expected fields are aliases, not independent measures.** `ExpectedDalShards => ExpectedDalAttestations` is explicitly deprecated. The latter describes expected shards, so neither is a denominator for a slot participation percentage. Keep reward amounts distinct from participation counters.

   Source: [BakerRewards.cs](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Models/Baking/BakerRewards.cs), lines174 and334.

## TzKT request shapes

Base URL is per-network. Suggested bounded shapes, with encoded address/filter values and validated response fields:

- `GET /v1/delegates?select=address,alias&limit=10000`: local alias search cache; no alias filter. Pagination needed if the result reaches the bound.
- `GET /v1/delegates/{address}`: profile and last-seen software.
- `GET /v1/rights?baker={address}&type=baking&sort.desc=level&limit=20&select=level,round,status,timestamp`.
- `GET /v1/rights?baker={address}&type=attestation&status=missed&sort.desc=level&limit=20`.
- `GET /v1/blocks?producer={address}&sort.desc=level&limit=1` for last-produced block; use bounded level.in batches to inspect canonical blocks corresponding to displayed rights, rather than per-row fetches.
- `GET /v1/operations/attestations?delegate={address}&sort.desc=id&limit=20`.
- `GET /v1/rewards/bakers/{address}?sort.desc=cycle&limit=6`, with future cycles explicitly separated from current/past cycles.

Source: [current official OpenAPI](https://api.tzkt.io/v1/swagger.json). No numeric free-tier rate limit is assumed. HTTP429 means unavailable/throttled; retain attributed stale results instead of retry storms. Required TzKT attribution should be visible.

### Field semantics

`stakingBalance` is deprecated. Current baking power is `bakingPower`; own/external staked amounts and delegated amounts are different quantities. `totalStakedBalance` equals own staked plus external staked, in mutez. `software` is nullable **last seen** software, with update level/time: it does not prove the daemon currently running. `software.version` may be absent.

Source: [Delegate model](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Models/Accounts/Delegate.cs) and current OpenAPI schema `Delegate`.

Baking rights use an integer round; attestation rights have null round and use slots. Canonical block proposer and producer are separate fields. A right marked missed requires contextual interpretation against actual canonical block and round; a future/unreached right is not failure. Included attestation `level` is the inclusion block level, not automatically the attested block level. The documented TzKT attestation model does not expose DAL bitsets.

Source: [AttestationOperation.cs](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Models/Operations/AttestationOperation.cs), [RightsController](https://github.com/baking-bad/tzkt/blob/master/Tzkt.Api/Controllers/RightsController.cs).

## DAL protocol counters

Use `GET /chains/main/blocks/{verified-block}/context/delegates/{delegate}/dal_participation`. The prose DAL page omits `context` in one example; generated reference and actual source include it. Bind the result to network, provider, block/protocol and actual cycle. Read `delegate_attested_dal_slots` and `delegate_attestable_dal_slots`; ratio is available only with a positive denominator. Zero denominator is not zero performance or100% performance. Protocol `sufficient_dal_participation` can be true with no globally attested slots; rewards also depend on consensus participation and denunciation status. `expected_dal_rewards` is a mutez decimal string, conditional rather than a guaranteed payout.

Source: [U025 delegate RPC source](https://github.com/tezos/tezos-mirror/blob/master/src/proto_025_PsUshuai/lib_plugin/delegate_services.ml), encoding186-226 and dal_participation service; [generated RPC reference](https://octez.tezos.com/docs/active/rpc.html).

Use at least60seconds DAL TTL, at most one in flight, and visible/collection-enabled lifecycle with cancellation. This is the coordinator-approved request budget; this research did not locate a literal computational-expense warning in the current generated RPC description, so do not attribute that wording to a verified source. TzKT refresh batch30seconds while visible; immutable block-hash reads can be reused without pretending current-head freshness.

## DAL operations and aggregate alignment

For individual included `attestation_with_dal`, take the baker from `metadata.delegate` and raw DAL content from `contents[i].dal_attestation`. An ordinary attestation without DAL data is not evidence that the delegate missed an attestable slot.

For `attestations_aggregate`, operation `committee[k]` contains slot and optional DAL bitset; metadata `committee[k]` carries delegate/consensus_pkh/power. Index alignment is proven by U025 application code: it folds the operation committee in sequence, prepends each metadata record, then reverses once. Require matching lengths and valid structures, never zip unrelated arrays or use aggregate total power as the individual delegate power. These aggregates are constructed at baking and rejected in mempool mode, so absence from a mempool stream is not baker absence.

Source: [U025 apply.ml](https://github.com/tezos/tezos-mirror/blob/master/src/proto_025_PsUshuai/lib_protocol/apply.ml#L2453), lines2453-2509; [operation representation](https://github.com/tezos/tezos-mirror/blob/master/src/proto_025_PsUshuai/lib_protocol/operation_repr.ml#L1220).

DAL content is a protocol-dependent multi-lag bitset. The supported lags come from constants, not a fixed publication slot/cadence or a single max-lag subtraction. Decode with a compatible protocol implementation or `/helpers/decode_dal_attestation/{decimal-bitset}`; otherwise show raw qualified data only. Equality of one delegate raw bitset with block metadata does not establish full-cycle participation or complete publication coverage. Published slots can become available before maximum lag after enough attestations accumulate.

Source: [DAL integration](https://octez.tezos.com/docs/active/dal_support.html#dal-attestation-payloads).

## Unverified assumptions to keep out of product logic

- Slot8/every15levels was an observation in peer notes, never a protocol constant.
- Last-cycle-level counters resetting0/0 and using lastLevel-1 are empirical and not established here as a universal complete-cycle query. Bind cycle via block metadata and keep unavailable/ambiguous history honest; use indexed settled rewards for past-cycle financial totals.
- Receipt time and indexer data do not prove present daemon health or a global network verdict.
- Mempool slot-to-delegate resolution needs the exact level/protocol committee; no extra polling implementation is required to deliver this bounded indexed view.
