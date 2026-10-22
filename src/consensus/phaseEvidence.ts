import type {AdmissionEvidence,BlockHeader,RpcSource, MonitoredOperation, ObservationEvidence} from "../rpc/models";
import type {Constants,DelegateRight,TargetContext} from "../rpc/networkData";
import {nonnegativeInteger} from "../rpc/guards";

export interface Group {
  readonly level: number;
  readonly round: number;
  readonly payload: string;
  readonly contextKey: string;
  readonly evidence?: ObservationEvidence;
  readonly admission?:AdmissionEvidence;
  readonly preEvidence?:ObservationEvidence;
  readonly attEvidence?:ObservationEvidence;
  readonly pre: Set<string>;
  readonly att: Set<string>;
  readonly unknownSlots: readonly number[];
  readonly conflicts: readonly string[];
}
export type CommitteeAuthority = {readonly usable:true;readonly total:number;readonly threshold:number} | {readonly usable:false;readonly reason:string};

export const contextFacts=(context:TargetContext):string=>JSON.stringify([context.key,context.level,context.protocolHash,...[context.observer,context.anchor].map(reference=>[reference.source.network,reference.source.baseUrl,reference.chainId,reference.header.hash,reference.header.level,reference.header.predecessor,reference.header.timestamp,reference.header.fitness,reference.header.proto,reference.header.payload_hash,reference.protocolHash,reference.nextProtocolHash])]);

/** The single numerical boundary used by the production inspector. */
export function committeeAuthority(rights: readonly DelegateRight[], expectedTotal?: number, threshold?: number): CommitteeAuthority {
  const contextual=rights.find(right=>right.context)?.context;
  if(contextual && rights.some(right=>!right.context || contextFacts(right.context)!==contextFacts(contextual)))return {usable:false,reason:"Mixed or incomplete committee context"};
  const addresses = new Set<string>(), slots = new Set<number>();
  let total = 0;
  for (const right of rights) {
    if (!right.address || addresses.has(right.address) || slots.has(right.slot) || !nonnegativeInteger(right.slot) || !nonnegativeInteger(right.power)) return {usable:false,reason:"Invalid or contradictory committee"};
    addresses.add(right.address); slots.add(right.slot); total += right.power;
    if (!Number.isSafeInteger(total)) return {usable:false,reason:"Unsafe cumulative committee power"};
  }
  if (total <= 0 || (expectedTotal !== undefined && (!nonnegativeInteger(expectedTotal) || expectedTotal !== total))) return {usable:false,reason:"Incomplete committee total"};
  const required = threshold ?? total;
  if (!nonnegativeInteger(required) || required === 0 || required > total) return {usable:false,reason:"Invalid quorum threshold"};
  return {usable:true,total,threshold:required};
}

export function signerPower(signers: ReadonlySet<string>, rights: readonly DelegateRight[]): number | undefined {
  if (!committeeAuthority(rights).usable) return undefined;
  let power = 0;
  for (const right of rights) if (signers.has(right.address)) {
    power += right.power;
    if (!Number.isSafeInteger(power)) return undefined;
  }
  return power;
}

export function evidenceContext(evidence?: ObservationEvidence,admission?:AdmissionEvidence): string {
  if(admission)return admission.contextKey;
  return JSON.stringify([evidence?.source.network ?? "unknown", evidence?.source.baseUrl ?? "unknown", evidence?.chainId ?? "unknown", evidence?.requestedHeadHash ?? "unknown", evidence?.observedHeadHash ?? "unknown", evidence?.predecessor ?? "unknown", evidence?.protocolLevel ?? "unknown"]);
}

export function observationContextCompatible(evidence:ObservationEvidence|undefined,context:TargetContext,admission?:AdmissionEvidence):boolean {
  const sidecar=admission!==undefined && admission.source.baseUrl===context.observer.source.baseUrl && admission.chainId===context.observer.chainId && admission.headHash===context.observer.header.hash && admission.predecessor===context.observer.header.predecessor && admission.anchorHash===context.anchor.header.hash && admission.protocolHash===context.protocolHash && admission.targetLevel===context.level && admission.contextKey===context.key;
  return evidence?.source.baseUrl===context.observer.source.baseUrl && (admission?sidecar:evidence.observedHeadHash===context.observer.header.hash) && (evidence.chainId===undefined || evidence.chainId===context.observer.chainId);
}

export interface ComparisonAuthorityProof {
  readonly source:RpcSource;
  readonly chainId:string;
  readonly head:BlockHeader;
  readonly producingProtocolHash:string;
  readonly context:TargetContext;
  readonly constants:Constants;
  readonly headEvidence:ObservationEvidence;
  readonly pendingEvidence:ObservationEvidence;
  readonly configuredSources:readonly RpcSource[];
}
const sameHeader=(a:BlockHeader,b:BlockHeader):boolean=>a.hash===b.hash&&a.level===b.level&&a.predecessor===b.predecessor&&a.timestamp===b.timestamp&&JSON.stringify(a.fitness)===JSON.stringify(b.fitness)&&(a.chainId===undefined||b.chainId===undefined||a.chainId===b.chainId)&&(a.proto===undefined||b.proto===undefined||a.proto===b.proto)&&(a.payload_hash===undefined||b.payload_hash===undefined||a.payload_hash===b.payload_hash);
/** Comparison proves compatibility without claiming that A's helper came from B. */
export function comparisonAuthorityUsable(rights:readonly DelegateRight[],level:number,proof:ComparisonAuthorityProof):boolean {
  const {context,head,source,chainId,constants}=proof,observer=context.observer,anchor=context.anchor;
  if(!proof.configuredSources.some(configured=>configured.network===source.network&&configured.baseUrl===observer.source.baseUrl))return false;
  if(!committeeAuthority(rights,constants.committee,constants.quorum).usable||!constants.context||contextFacts(constants.context)!==contextFacts(context)||rights.some(right=>!right.context||contextFacts(right.context)!==contextFacts(context)))return false;
  if(context.level!==level||!chainId||head.chainId!==chainId||observer.chainId!==chainId||anchor.chainId!==chainId||observer.header.chainId!==chainId||anchor.header.chainId!==chainId||observer.source.network!==source.network||anchor.source.baseUrl!==observer.source.baseUrl||anchor.source.network!==source.network||context.protocolHash!==anchor.nextProtocolHash)return false;
  const receiptCompatible=(receipt:ObservationEvidence|undefined)=>receipt!==undefined&&receipt.source.network===source.network&&(receipt.source.baseUrl===observer.source.baseUrl||proof.configuredSources.some(configured=>configured.network===source.network&&configured.baseUrl===receipt.source.baseUrl)===true)&&receipt.chainId===chainId&&receipt.requestedHeadHash===anchor.header.hash&&receipt.contextHeadHash===observer.header.hash&&receipt.protocolHash===context.protocolHash&&receipt.targetLevel===level;
  if(!receiptCompatible(constants.evidence)||rights.some(right=>!receiptCompatible(right.evidence)))return false;
  if(!proof.producingProtocolHash||proof.headEvidence.source.baseUrl!==source.baseUrl||proof.pendingEvidence.source.baseUrl!==source.baseUrl||proof.headEvidence.source.network!==source.network||proof.pendingEvidence.source.network!==source.network||!Number.isFinite(proof.pendingEvidence.receivedMonotonic)||proof.pendingEvidence.receivedMonotonic<proof.headEvidence.receivedMonotonic)return false;
  if(level===head.level){
    if(anchor.header.hash!==head.predecessor||anchor.header.level!==head.level-1||context.protocolHash!==proof.producingProtocolHash)return false;
    return observer.header.hash===head.hash?sameHeader(observer.header,head)&&observer.protocolHash===proof.producingProtocolHash:sameHeader(observer.header,anchor.header)&&observer.nextProtocolHash===proof.producingProtocolHash;
  }
  return level===head.level+1&&sameHeader(observer.header,head)&&sameHeader(anchor.header,head)&&observer.protocolHash===proof.producingProtocolHash&&context.protocolHash===observer.nextProtocolHash;
}
export function groupsFor(operations: readonly MonitoredOperation[], rights: readonly DelegateRight[], level: number): Group[] {return collectGroups(operations,rights,level);}
export function comparisonGroupsFor(operations:readonly MonitoredOperation[],rights:readonly DelegateRight[],level:number,proof:ComparisonAuthorityProof):Group[] {return collectGroups(operations,rights,level,proof);}
function collectGroups(operations: readonly MonitoredOperation[], rights: readonly DelegateRight[], level: number,comparison?:ComparisonAuthorityProof): Group[] {
  const authorityContext=rights[0]?.context;
  const compared=comparison!==undefined&&comparisonAuthorityUsable(rights,level,comparison);
  const bySlot = committeeAuthority(rights).usable && authorityContext!==undefined ? new Map(rights.map(right => [right.slot,right.address])) : new Map<number,string>();
  type AccumulatedGroup = Omit<Group,"unknownSlots"|"conflicts"|"preEvidence"|"attEvidence"> & {unknownSlots:Set<number>;conflicts:Set<string>;preEvidence?:ObservationEvidence;attEvidence?:ObservationEvidence};
  // A local tuple index avoids serializing the same context/payload for every
  // receipt. Keep insertion order separately; no result outlives this call.
  const groups:AccumulatedGroup[]=[];
  const groupIndex=new Map<string,Map<number|null,Map<string,AccumulatedGroup>>>();
  // Each unique signer/phase/group enters one membership. Conflict marking visits
  // those memberships once, rather than comparing every payload pair.
  const memberships = new Map<string,{address:string;groups:Set<AccumulatedGroup>}>();
  for (const operation of operations) for (const content of operation.contents) {
    if (content.level !== level || !content.block_payload_hash) continue;
    const admission=comparison?undefined:operation.admissions?.find(proof=>proof.contextKey===authorityContext?.key && proof.targetLevel===content.level)??operation.admissions?.find(proof=>proof.targetLevel===content.level)??(operation.admission?.targetLevel===content.level?operation.admission:undefined);
    const receipt=operation.evidence;
    const compatibleCompared=compared&&comparison!==undefined&&receipt!==undefined&&receipt.source.baseUrl===comparison.source.baseUrl&&receipt.source.network===comparison.source.network&&receipt.receivedMonotonic===comparison.pendingEvidence.receivedMonotonic&&receipt.receivedAt===comparison.pendingEvidence.receivedAt&&(receipt.chainId===undefined||receipt.chainId===comparison.chainId)&&(receipt.observedHeadHash===undefined||receipt.observedHeadHash===comparison.head.hash)&&(receipt.requestedHeadHash===undefined||receipt.requestedHeadHash===comparison.head.hash);
    const contextKey = compatibleCompared?JSON.stringify(['comparison',comparison.source.baseUrl,comparison.chainId,comparison.head.hash,comparison.head.predecessor,comparison.context.protocolHash,level]):evidenceContext(operation.evidence,admission);
    let rounds=groupIndex.get(contextKey);
    if(!rounds){rounds=new Map();groupIndex.set(contextKey,rounds);}
    // Match JSON tuple identity for non-finite numeric inputs as well.
    const roundKey=Number.isFinite(content.round)?content.round:null;
    let payloads=rounds.get(roundKey);
    if(!payloads){payloads=new Map();rounds.set(roundKey,payloads);}
    let group = payloads.get(content.block_payload_hash);
    if (!group) {
      group = {level,round:content.round,payload:content.block_payload_hash,contextKey,pre:new Set(),att:new Set(),unknownSlots:new Set(),conflicts:new Set(),...(operation.evidence ? {evidence:operation.evidence} : {}),...(admission?{admission}:{})};
      payloads.set(content.block_payload_hash,group);groups.push(group);
    }
    const compatible=comparison?compatibleCompared:authorityContext!==undefined && (authorityContext.level===content.level && observationContextCompatible(operation.evidence,authorityContext,admission));
    const address = compatible ? bySlot.get(content.slot) : undefined;
    if (!address) {group.unknownSlots.add(content.slot);continue;}
    const phase = content.kind === "preattestation" ? "pre" : "att";
    if (group[phase].has(address)) continue;
    group[phase].add(address);
    const phaseReceipt=phase==="pre"?"preEvidence":"attEvidence";
    const previousReceipt=group[phaseReceipt];
    if(operation.evidence && (!previousReceipt || operation.evidence.receivedMonotonic>previousReceipt.receivedMonotonic))group[phaseReceipt]=operation.evidence;
    const membershipKey = JSON.stringify([contextKey,content.round,phase,address]);
    let membership = memberships.get(membershipKey);
    if (!membership) {
      membership = {address,groups:new Set()};memberships.set(membershipKey,membership);
    }
    membership.groups.add(group);
  }
  for (const membership of memberships.values()) {
    if (membership.groups.size < 2) continue;
    for (const group of membership.groups) group.conflicts.add(membership.address);
  }
  return groups.map(group => ({...group,conflicts:[...group.conflicts].sort(),unknownSlots:[...group.unknownSlots].sort((a,b)=>a-b)}));
}
