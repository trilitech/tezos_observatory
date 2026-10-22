import {pendingPhaseComplete,invalidatePendingCoverage} from "../rpc/networkData";
import type {BlockProducerFact} from "../rpc/candidateProducer";
import type {AdmissionEvidence,BlockHeader,CandidateObservation,MonitoredOperation,NetworkName,ObservationEvidence,RpcSource} from "../rpc/models";
import {OperationStore,operationIdentity} from "../rpc/operationStore";
import {committeeAuthority,contextFacts,groupsFor,signerPower} from "../consensus/phaseEvidence";
import {proposalRound,type OpportunityFact,type OpportunityCaptureToken} from "../consensus/roundSchedule";
import {captureOpportunityFacts} from "../consensus/opportunityFacts";
import type {Constants,DelegateRight,TargetContext,RpcContext,PendingSnapshot} from "../rpc/networkData";
import type {ReconciliationTarget} from "./observerReconciliation";
import {headFactsKey} from "./headGeneration";

export interface ContextAdmission<T> {
  readonly head:BlockHeader;
  readonly derived:T;
  readonly context:TargetContext;
  readonly rights:readonly DelegateRight[];
  readonly constants:Constants;
  readonly observerGeneration?:number;
  readonly collectionGeneration?:number;
  readonly snapshot?:PendingSnapshot;
  readonly snapshotError?:string;
}
export interface ObservationTarget<T> {
  readonly identity:string;
  readonly target:ReconciliationTarget;
  readonly evidence:ObservationEvidence;
  readonly admission?:ContextAdmission<T>;
  readonly sourceContext?:ContextAdmission<T>;
  readonly error?:string;
  readonly contextInvalid:boolean;
  readonly coverage?:PendingCoverage;
  readonly coverageStale?:boolean;
  readonly phases?:{readonly pre?:AcceptedPhase;readonly att?:AcceptedPhase};
  readonly producer?:BlockProducerFact;
  readonly opportunities?:readonly [OpportunityFact,OpportunityFact];
}
/** Each phase is independently observed; their sum is only a choice-ranking score. */
export function observedPhasePowers(record:Pick<ObservationTarget<unknown>,"phases">):{prePower?:number;attPower?:number} {
  return {...(record.phases?.pre?{prePower:record.phases.pre.power}:{}),...(record.phases?.att?{attPower:record.phases.att.power}:{})};
}
/** Raw body operations have one owner, the canonical bounded raw store. */
export type PendingCoverage=Omit<PendingSnapshot,"operations"> & {readonly normalizedOperationCount:number};
export interface AcceptedPhase {
  readonly key:string;
  readonly phase:"pre"|"att";
  readonly maximumPower:number;
  readonly maximumTotal:number;
  readonly maximumThreshold:number;
  readonly maximumBasis:string;
  readonly maximumEvidence:ObservationEvidence;
  /** Receipt of the current phase power, distinct from first observation and peak. */
  readonly currentEvidence:ObservationEvidence;
  readonly power:number;
  readonly threshold:number;
  readonly basis:string;
  readonly quorumObserved:boolean;
  readonly crossed:boolean;
  readonly uncertain:boolean;
  readonly evidence:ObservationEvidence;
}
export interface AcceptedEvent {
  readonly identity:string;
  readonly phaseIdentity:string;
  readonly kind:"crossing"|"observed-quorum";
  readonly phase:"pre"|"att";
  readonly level:number;
  readonly round:number;
  readonly payload:string;
  readonly contextKey:string;
  readonly chainId:string;
  readonly attribution:"payload-shared";
  readonly power:number;
  readonly threshold:number;
  readonly evidence:ObservationEvidence;
}

/** Immutable accepted facts owned independently from LIVE indexes and raw retention. */
export interface SessionSnapshot<T> {
  readonly identity:string;
  readonly record:ObservationTarget<T>;
  readonly evidence:ObservationEvidence;
  readonly candidates:readonly ObservationTarget<T>[];
  readonly committee:readonly Readonly<DelegateRight>[];
  readonly currentPre:readonly string[];
  readonly currentAtt:readonly string[];
  readonly phaseCommittees:{readonly pre?:readonly Readonly<DelegateRight>[];readonly att?:readonly Readonly<DelegateRight>[]};
  readonly maximumCommittees:{readonly pre?:readonly Readonly<DelegateRight>[];readonly att?:readonly Readonly<DelegateRight>[]};
  readonly pre:readonly string[];
  readonly att:readonly string[];
  readonly unknownSlots:readonly number[];
  readonly conflicts:readonly string[];
  readonly partial:boolean;
  readonly acceptedSequence:number;
}
export interface SessionInspection<T> {
  readonly mode:"follow"|"pin";
  readonly snapshot?:SessionSnapshot<T>;
  readonly selectedIdentity?:string;
  readonly frozen:boolean;
  readonly newer:number;
  readonly newerPartial:boolean;
}

const instanceIdentity=(operation:MonitoredOperation,level:number,round:number,payload:string):string=>JSON.stringify(["instance",operation.evidence?.source.network??"unknown",operation.evidence?.source.baseUrl??"unknown",operation.evidence?.chainId??"unknown",operation.evidence?.observedHeadHash??"unknown",level,round,payload]);

/** Bounded observation products share raw records; admission never reinserts or relabels them. */
export class ObservationStore<T> {
  private readonly raw=new OperationStore(10000,Infinity);
  private readonly unresolved=new Map<string,ObservationTarget<T>>();
  private readonly acceptedCandidates=new Map<string,ObservationTarget<T>>();
  private readonly instances=new Map<string,ObservationTarget<T>>();
  private readonly bindings=new Map<string,Map<string,AdmissionEvidence>>();
  private readonly membership=new Map<string,Set<string>>();
  private readonly contexts=new Map<string,Map<number,ContextAdmission<T>>>();
  private readonly heads=new Map<string,BlockHeader>();
  private readonly configured:Set<string>;
  private readonly observerGenerations=new Map<string,number>();
  private collectionGeneration=0;
  private enabled=true;
  private expectedNetwork:RpcContext|undefined;
  private readonly phaseFacts=new Map<string,AcceptedPhase>();
  private readonly acceptedEventFacts:AcceptedEvent[]=[];
  private crossingHistoryUncertain=false;
  private readonly sessionHistory=new Map<string,SessionSnapshot<T>>();
  private selectedPin:{readonly instance:string;readonly identity:string;readonly baseline:number;readonly newer:number;readonly newerPartial:boolean}|undefined;
  private frozenPin:SessionSnapshot<T>|undefined;
  private acceptedSequence=0;
  private historyIdentityUncertain=false;
  private lastLiveSnapshot:SessionSnapshot<T>|undefined;
  private liveIdentity:string|undefined;
  private readonly selectableUnits=new Map<string,number>();

  constructor(readonly network:NetworkName,sources:readonly RpcSource[]){this.configured=new Set(sources.filter(source=>source.network===network).map(source=>source.baseUrl));}
  private allowed(source:RpcSource|undefined):source is RpcSource {return source!==undefined && source.network===this.network && this.configured.has(source.baseUrl);}

  networkIdentity():RpcContext|undefined {return this.expectedNetwork;}
  establishNetworkIdentity(context:RpcContext):boolean {
    if(!this.allowed(context.source) || !context.chainId || context.header.chainId!==context.chainId || context.evidence.chainId!==context.chainId || context.evidence.requestedHeadHash!==context.header.hash || context.evidence.source.baseUrl!==context.source.baseUrl)throw new Error("Unproven expected network identity");
    if(this.expectedNetwork)return this.expectedNetwork.chainId===context.chainId;
    this.expectedNetwork=context;
    for(const source of this.contexts.keys()){const proof=this.contexts.get(source)?.values().next().value;if(proof)this.recheck(proof.context.observer.source);}
    return true;
  }
  contextAuthorized(context:TargetContext):boolean {
    const proof=this.contexts.get(context.observer.source.baseUrl)?.get(context.level);
    return this.expectedNetwork?.chainId===context.observer.chainId && proof!==undefined && contextFacts(proof.context)===contextFacts(context);
  }

  start():void {this.enabled=true;}
  interrupt(source:RpcSource):void {for(const product of [this.unresolved,this.acceptedCandidates,this.instances])for(const [identity,record] of product)if(record.target.source.baseUrl===source.baseUrl && record.coverage)product.set(identity,Object.freeze({...record,coverageStale:true}));}
  stop():void {this.enabled=false;this.collectionGeneration++;for(const product of [this.unresolved,this.acceptedCandidates,this.instances])for(const [identity,record] of product)if(record.coverage)product.set(identity,Object.freeze({...record,coverageStale:true}));}
  generation(source:RpcSource):{readonly observerGeneration:number;readonly collectionGeneration:number} {return {observerGeneration:this.observerGenerations.get(source.baseUrl)??0,collectionGeneration:this.collectionGeneration};}
  private headerKey(head:BlockHeader):string {return headFactsKey(head);}
  observeHead(head:BlockHeader):void {
    const source=head.evidence?.source;if(!this.allowed(source))return;
    const old=this.heads.get(source.baseUrl);
    if(!old || this.headerKey(old)!==this.headerKey(head))this.observerGenerations.set(source.baseUrl,(this.observerGenerations.get(source.baseUrl)??0)+1);
    this.heads.set(source.baseUrl,head);
    const contexts=this.contexts.get(source.baseUrl);
    if(contexts)for(const [level,admission] of contexts){
      const proven=admission.context.observer.header;
      if(head.hash!==proven.hash || head.level!==proven.level || head.predecessor!==proven.predecessor || (head.chainId!==undefined && head.chainId!==admission.context.observer.chainId) || (head.proto!==undefined && head.proto!==proven.proto) || (head.payload_hash!==undefined && head.payload_hash!==proven.payload_hash) || head.timestamp!==proven.timestamp || JSON.stringify(head.fitness)!==JSON.stringify(proven.fitness))contexts.delete(level);
    }
    this.recheck(source);
  }

  observerHead(source:RpcSource):BlockHeader|undefined {return this.heads.get(source.baseUrl);}

  addCandidate(candidate:CandidateObservation):ObservationTarget<T>|undefined {
    if(!this.allowed(candidate.evidence.source))return undefined;
    const identity=candidate.identity,existing=this.find(identity)??this.historicalTarget(identity);if(existing)return existing;
    const round=proposalRound(candidate.header.fitness,candidate.header.level),payload=candidate.header.payload_hash;
    if(round===undefined)return undefined;
    const observerHead=this.observerHead(candidate.evidence.source);
    const target:ReconciliationTarget=Object.freeze({...this.generation(candidate.evidence.source),source:candidate.evidence.source,level:candidate.header.level,round,...(payload?{payload}:{}),candidate,...(observerHead?{observerHead}:{})});
    const record:ObservationTarget<T>=Object.freeze({identity,target,evidence:candidate.evidence,contextInvalid:false});
    this.unresolved.set(identity,record);this.tryAdmission(record);this.trim(this.unresolved,100);this.trim(this.acceptedCandidates,100);this.pruneSelectableUnits();return this.find(identity);
  }

  addOperations(batch:readonly MonitoredOperation[],snapshotContext?:TargetContext):readonly ObservationTarget<T>[] {
    if(snapshotContext && !this.contextAuthorized(snapshotContext))throw new Error("Unproven snapshot replay context");
    const replayIdentity=(operation:MonitoredOperation):string=>JSON.stringify([operation.evidence?.source.network,operation.evidence?.source.baseUrl,operation.hash,operation.branch??null,operation.contents]);
    // Ordinary unscoped stream receipts cannot use replay proofs. Build the
    // retained-operation index only when a scoped receipt actually needs it.
    // Keep this local to the batch: bindings and source ownership may change.
    const replayHashes=new Set(batch.map(operation=>operation.hash));
    let replayIndex:Map<string,MonitoredOperation[]>|undefined;
    const replayMembers=(operation:MonitoredOperation):readonly MonitoredOperation[]=>{
      if(!replayIndex){
        replayIndex=new Map();
        for(const retained of this.raw.values()){if(!replayHashes.has(retained.hash))continue;const key=replayIdentity(retained),members=replayIndex.get(key)??[];members.push(retained);replayIndex.set(key,members);}
      }
      return replayIndex.get(replayIdentity(operation))??[];
    };
    const fresh=batch.filter(operation=>{
      if(!this.allowed(operation.evidence?.source) || this.raw.get(operation))return false;
      const evidence=operation.evidence;
      if(snapshotContext && replayMembers(operation).some(original=>{
        const proof=this.bindings.get(operationIdentity(original))?.get(snapshotContext.key);
        return proof!==undefined && proof.source.baseUrl===evidence.source.baseUrl && proof.chainId===snapshotContext.observer.chainId && proof.headHash===snapshotContext.observer.header.hash && proof.protocolHash===snapshotContext.protocolHash && (evidence.chainId===undefined || evidence.chainId===proof.chainId) && (evidence.observedHeadHash===undefined || evidence.observedHeadHash===proof.headHash);
      }))return false;
      if(evidence.observedHeadHash===undefined)return true;
      return !replayMembers(operation).some(original=>{
        const proofs=this.bindings.get(operationIdentity(original));
        const observed=this.observerHead(evidence.source);
        if(!proofs?.size && original.evidence?.observedHeadHash===undefined && original.evidence?.requestedHeadHash===undefined && observed && observed.hash===evidence.observedHeadHash && (original.evidence?.chainId===undefined || original.evidence.chainId===observed.chainId))return true;
        return proofs && [...proofs.values()].some(proof=>proof.headHash===evidence.observedHeadHash && (evidence.chainId===undefined || evidence.chainId===proof.chainId) && (evidence.requestedHeadHash===undefined || evidence.requestedHeadHash===proof.headHash));
      });
    });
    const priorOperations=this.raw.values();this.raw.add(fresh);
    const created:ObservationTarget<T>[]=[],visited=new Set<string>(),touched=new Set<string>();
    for(const submitted of fresh){
      const operation=this.raw.get(submitted);if(!operation)continue;
      const operationKey=operationIdentity(operation);if(visited.has(operationKey))continue;visited.add(operationKey);
      const evidence=operation.evidence;if(!evidence || !this.allowed(evidence.source))continue;
      for(const content of operation.contents){
        if(!content.block_payload_hash)continue;
        const identity=instanceIdentity(operation,content.level,content.round,content.block_payload_hash);
        let members=this.membership.get(identity);if(!members){members=new Set();this.membership.set(identity,members);}members.add(operationKey);
        let record=this.find(identity);
        if(!record){
          const observerHead=this.observerHead(evidence.source);
          const target:ReconciliationTarget=Object.freeze({...this.generation(evidence.source),source:evidence.source,level:content.level,round:content.round,payload:content.block_payload_hash,...(observerHead?{observerHead}:{})});
          record=Object.freeze({identity,target,evidence,contextInvalid:false});this.unresolved.set(identity,record);created.push(record);
        }
        touched.add(identity);
      }
    }
    // A full snapshot may contain 10000 operations for one payload. Build its
    // membership once, then bind once per distinct target rather than revisiting
    // the growing member prefix for every operation.
    for(const identity of touched){const record=this.find(identity);if(record)this.tryAdmission(record);}
    this.trim(this.unresolved,100);this.trim(this.instances,150);
    const retained=new Set(this.raw.values().map(operationIdentity));
    const lostSupport=new Set<string>();
    for(const operation of priorOperations){
      const operationKey=operationIdentity(operation);if(retained.has(operationKey))continue;
      for(const proof of this.bindings.get(operationKey)?.values()??[])for(const content of operation.contents)if(content.level===proof.targetLevel && content.block_payload_hash)lostSupport.add(JSON.stringify([proof.contextKey,content.level,content.round,content.block_payload_hash]));
    }
    if(lostSupport.size>0)this.crossingHistoryUncertain=true;
    // Compact coverage still depends on its retained consensus facts. Losing
    // those facts cannot turn an earlier positive snapshot into a fresh zero.
    for(const product of [this.acceptedCandidates,this.instances])for(const [identity,record] of product){
      if(!record.coverage || !record.admission || !lostSupport.has(JSON.stringify([record.admission.context.key,record.target.level,record.target.round,record.target.payload])))continue;
      product.set(identity,Object.freeze({...record,coverageStale:true,coverage:invalidatePendingCoverage(record.coverage,"Supporting snapshot consensus facts evicted")}));
    }
    for(const key of this.bindings.keys())if(!retained.has(key))this.bindings.delete(key);
    for(const [identity,members] of this.membership){for(const key of members)if(!retained.has(key))members.delete(key);if(members.size===0)this.membership.delete(identity);}
    this.refreshAcceptedPhases(fresh.length>0);
    this.pruneSelectableUnits();
    return created.map(record=>this.find(record.identity)).filter((record):record is ObservationTarget<T>=>record!==undefined);
  }

  accept(admission:ContextAdmission<T>):void {
    const context=admission.context,source=context.observer.source;
    const observed=context.observer.header,anchor=context.anchor,head=admission.head;
    const matchingHead=observed.hash===head.hash && observed.level===head.level && observed.predecessor===head.predecessor && observed.timestamp===head.timestamp && JSON.stringify(observed.fitness)===JSON.stringify(head.fitness) && (head.chainId===undefined || head.chainId===context.observer.chainId) && (head.proto===undefined || head.proto===observed.proto) && (head.payload_hash===undefined || head.payload_hash===observed.payload_hash);
    const matchingObserver=anchor.source.network===source.network && anchor.source.baseUrl===source.baseUrl && anchor.chainId===context.observer.chainId && observed.chainId===context.observer.chainId && anchor.header.chainId===anchor.chainId;
    const matchingTarget=context.level===head.level
      ? anchor.header.hash===head.predecessor && anchor.header.level===head.level-1 && anchor.nextProtocolHash===context.observer.protocolHash
      : context.level===head.level+1 && anchor.header.hash===head.hash && anchor.header.level===head.level && anchor.header.predecessor===observed.predecessor && anchor.header.timestamp===observed.timestamp && JSON.stringify(anchor.header.fitness)===JSON.stringify(observed.fitness) && anchor.protocolHash===context.observer.protocolHash && anchor.nextProtocolHash===context.observer.nextProtocolHash;
    if(!matchingHead || !matchingObserver || !matchingTarget || context.protocolHash!==anchor.nextProtocolHash)throw new Error("Contradictory admission context facts");
    const current=this.generation(source),latest=this.heads.get(source.baseUrl);
    if(!this.enabled || (admission.collectionGeneration===undefined && current.collectionGeneration!==0) || (admission.observerGeneration===undefined && current.observerGeneration!==0) || (admission.collectionGeneration!==undefined && admission.collectionGeneration!==current.collectionGeneration) || (admission.observerGeneration!==undefined && admission.observerGeneration!==current.observerGeneration) || (admission.observerGeneration===undefined && latest!==undefined && this.headerKey(latest)!==this.headerKey(admission.head)))throw new Error("Admission belongs to an obsolete observer generation");
    if(!this.allowed(source) || context.observer.header.hash!==admission.head.hash || !committeeAuthority(admission.rights,admission.constants.committee,admission.constants.quorum).usable || context.level!==context.observer.header.level && context.level!==context.observer.header.level+1)throw new Error("Incoherent observer admission");
    if(admission.rights.some(right=>!right.context || contextFacts(right.context)!==contextFacts(context)) || !admission.constants.context || contextFacts(admission.constants.context)!==contextFacts(context))throw new Error("Rights/constants do not prove the admission context");
    if(admission.snapshot){
      const snapshot=admission.snapshot;
      if(snapshot.evidence.source.baseUrl!==source.baseUrl || snapshot.evidence.source.network!==source.network || contextFacts(snapshot.contextBefore)!==contextFacts(context) || contextFacts(snapshot.contextAfter)!==contextFacts(context) || (snapshot.complete && snapshot.reasons.length!==0) || snapshot.operations.some(operation=>operation.evidence?.source.baseUrl!==source.baseUrl || operation.evidence.source.network!==source.network || operation.evidence.receivedMonotonic!==snapshot.evidence.receivedMonotonic))throw new Error("Incoherent source snapshot admission");
    }
    if(!this.expectedNetwork)this.establishNetworkIdentity(context.observer);
    if(admission.head.evidence?.source.baseUrl===source.baseUrl && admission.head.evidence.observedHeadHash===admission.head.hash)this.observeHead(admission.head);
    let contexts=this.contexts.get(source.baseUrl);if(!contexts){contexts=new Map();this.contexts.set(source.baseUrl,contexts);}
    for(const [level,old] of contexts)if(old.head.hash!==admission.head.hash)contexts.delete(level);
    const {snapshot,...retainedAdmission}=admission;
    contexts.set(context.level,Object.freeze(retainedAdmission));this.recheck(source);
    this.refreshAcceptedPhases(false);
    if(snapshot){
      this.addOperations(snapshot.operations,context);
      const operationKey=(operation:MonitoredOperation)=>JSON.stringify([operation.hash,operation.branch??null,operation.contents]);
      const retained=new Set(this.raw.values().filter(operation=>this.bindings.get(operationIdentity(operation))?.has(context.key)).map(operationKey));
      const truncated=snapshot.operations.some(operation=>operation.contents.some(content=>content.level===context.level) && !retained.has(operationKey(operation)));
      const {operations,...facts}=snapshot;
      const coverage:PendingCoverage=Object.freeze({...facts,normalizedOperationCount:operations.length,...(truncated?invalidatePendingCoverage(facts,"Snapshot consensus facts partially retained"):facts)});
      this.recheck(source,coverage);this.refreshAcceptedPhases(false);
    }
    if(admission.snapshotError)this.interrupt(source);
    this.pruneSelectableUnits();
  }

  fail(identity:string,error:unknown,coverage:"invalidate"|"preserve-received-phase"="invalidate"):void {
    const record=this.find(identity);if(!record)return;
    const product=this.unresolved.has(identity)?this.unresolved:this.acceptedCandidates.has(identity)?this.acceptedCandidates:this.instances;
    product.set(identity,Object.freeze({...record,error:String(error),...(record.coverage&&coverage==="invalidate"?{coverageStale:true}:{})}));
  }

  private recheck(source:RpcSource,snapshot?:PendingCoverage):void {
    for(const record of [...this.unresolved.values(),...this.acceptedCandidates.values(),...this.instances.values()])if(record.target.source.baseUrl===source.baseUrl)this.tryAdmission(record,snapshot);
    this.trim(this.acceptedCandidates,100);this.trim(this.instances,150);
    this.pruneSelectableUnits();
  }

  private tryAdmission(record:ObservationTarget<T>,snapshot?:PendingCoverage):boolean {
    const admission=this.contexts.get(record.target.source.baseUrl)?.get(record.target.level);
    const candidate=record.target.candidate;
    if(admission && this.expectedNetwork?.chainId!==admission.context.observer.chainId){
      const updated=Object.freeze({...record,sourceContext:admission,error:this.expectedNetwork?"Source chain contradicts expected network identity":"Expected network identity unavailable",contextInvalid:record.admission!==undefined || this.expectedNetwork!==undefined});
      const product=record.admission?(candidate?this.acceptedCandidates:this.instances):this.unresolved;
      product.set(record.identity,updated);return false;
    }
    const incompatibleReceipt=admission!==undefined && record.evidence.observedHeadHash!==undefined && record.evidence.observedHeadHash!==admission.context.observer.header.hash && (record.evidence.observedHeadLevel===undefined || record.target.level<=record.evidence.observedHeadLevel+1);
    const staleInstance=!candidate && record.admission!==undefined && admission!==undefined && record.admission.context.key!==admission.context.key;
    if(incompatibleReceipt || staleInstance || !admission || (record.evidence.chainId!==undefined && record.evidence.chainId!==admission.context.observer.chainId) || (candidate && candidate.header.predecessor!==admission.context.anchor.header.hash)){
      if(record.admission){const product=candidate?this.acceptedCandidates:this.instances;product.set(record.identity,Object.freeze({...record,contextInvalid:true,...(record.coverage?{coverageStale:true}:{})}));}
      return false;
    }
    const compatibleSnapshot=snapshot && snapshot.evidence.source.network===record.target.source.network && snapshot.evidence.source.baseUrl===record.target.source.baseUrl && snapshot.evidence.requestedHeadHash===undefined && snapshot.evidence.receivedMonotonic>=record.evidence.receivedMonotonic && snapshot.evidence.receivedMonotonic>=snapshot.startedMonotonic && contextFacts(snapshot.contextBefore)===contextFacts(admission.context) && contextFacts(snapshot.contextAfter)===contextFacts(admission.context);
    const freshSnapshot=compatibleSnapshot && (!record.coverage || snapshot.evidence.receivedMonotonic>record.coverage.evidence.receivedMonotonic);
    const coverage=freshSnapshot?snapshot:record.coverage;
    const opportunities=!record.contextInvalid && record.admission && contextFacts(record.admission.context)===contextFacts(admission.context)?record.opportunities:undefined;
    const producer=!record.contextInvalid && record.admission && contextFacts(record.admission.context)===contextFacts(admission.context)?record.producer:undefined;
    const phase=(value:"pre"|"att")=>this.phaseFacts.get(JSON.stringify([contextFacts(admission.context),record.target.level,record.target.round,record.target.payload,"payload-shared",value]));
    const pre=phase("pre"),att=phase("att");
    const updated:ObservationTarget<T>=Object.freeze({identity:record.identity,target:record.target,evidence:record.evidence,admission,sourceContext:admission,contextInvalid:false,...(pre||att?{phases:Object.freeze({...(pre?{pre}:{}),...(att?{att}:{})})}:{}),...(producer?{producer}:{}),...(opportunities?{opportunities}:{}),...(coverage?{coverage,coverageStale:freshSnapshot?false:record.coverageStale??true}:{})});
    this.unresolved.delete(record.identity);
    const product=candidate?this.acceptedCandidates:this.instances;product.set(record.identity,updated);
    this.captureHistory(updated);
    const instanceRecords=candidate?[...this.unresolved.values(),...this.instances.values()].filter(instance=>!instance.contextInvalid && (!instance.admission || instance.admission.context.key===admission.context.key) && instance.target.source.baseUrl===record.target.source.baseUrl && instance.target.level===record.target.level && instance.target.round===record.target.round && instance.target.payload===record.target.payload):[record];
    const members=new Set(instanceRecords.flatMap(instance=>[...(this.membership.get(instance.identity)??[])]));
    for(const operationKey of members){
      const operation=this.raw.getByIdentity(operationKey);if(!operation)continue;
      if(operation.evidence?.source.baseUrl!==record.target.source.baseUrl)continue;
      if(!operation.contents.some(content=>content.level===record.target.level && content.round===record.target.round && content.block_payload_hash===record.target.payload))continue;
      const evidence=operation.evidence,context=admission.context;
      if(evidence.chainId!==undefined && evidence.chainId!==context.observer.chainId)continue;
      if(evidence.observedHeadHash!==undefined && evidence.observedHeadHash!==context.observer.header.hash && (evidence.observedHeadLevel===undefined || record.target.level<=evidence.observedHeadLevel+1))continue;
      const key=operationIdentity(operation);let proofs=this.bindings.get(key);if(!proofs){proofs=new Map();this.bindings.set(key,proofs);}if(proofs.has(context.key))continue;
      proofs.set(context.key,Object.freeze({source:context.observer.source,chainId:context.observer.chainId,headHash:context.observer.header.hash,predecessor:context.observer.header.predecessor,protocolHash:context.protocolHash,targetLevel:context.level,contextKey:context.key,anchorHash:context.anchor.header.hash,...(admission.rights[0]?.evidence?.collectionGeneration===undefined?{}:{proofGeneration:admission.rights[0].evidence.collectionGeneration}),provedAt:Date.now(),provedMonotonic:performance.now()}));
    }
    return true;
  }

  private find(identity:string):ObservationTarget<T>|undefined {return this.unresolved.get(identity)??this.acceptedCandidates.get(identity)??this.instances.get(identity);}
  target(identity:string):ObservationTarget<T>|undefined {return this.find(identity)??this.historicalTarget(identity);}
  unresolvedTargets():readonly ObservationTarget<T>[] {return [...this.unresolved.values()];}
  acceptedTargets():readonly ObservationTarget<T>[] {return [...this.acceptedCandidates.values(),...this.instances.values()];}
  acceptedEvents():readonly AcceptedEvent[] {return [...this.acceptedEventFacts];}
  crossingState():{readonly retained:number;readonly uncertain:boolean} {return {retained:this.phaseFacts.size,uncertain:this.crossingHistoryUncertain};}
  rawOperations():readonly MonitoredOperation[] {return this.raw.values().map(operation=>{const proofs=this.bindings.get(operationIdentity(operation)),admissions=proofs?[...proofs.values()]:[],admission=admissions[0];return admission?Object.freeze({...operation,admission,admissions:Object.freeze(admissions)}):operation;});}
  private trim(product:Map<string,ObservationTarget<T>>,maximum:number):void {
    if(product.size<=maximum)return;
    const ordered=[...product.values()].sort((a,b)=>a.evidence.receivedMonotonic-b.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));
    for(const record of ordered.slice(0,product.size-maximum)){product.delete(record.identity);if(!this.find(record.identity)){this.membership.delete(record.identity);if(record.admission)this.crossingHistoryUncertain=true;}}
  }

  private sessionIdentity(record:ObservationTarget<T>):string {return JSON.stringify([contextFacts(record.admission!.context),record.target.level,record.target.round,record.target.payload??null]);}
  private historicalTarget(identity:string):ObservationTarget<T>|undefined {
    for(const snapshot of [...this.sessionHistory.values(),...(this.frozenPin?[this.frozenPin]:[])]){if(snapshot.record.identity===identity)return snapshot.record;const candidate=snapshot.candidates.find(record=>record.identity===identity);if(candidate)return candidate;}
    return undefined;
  }
  history():readonly SessionSnapshot<T>[] {return [...this.sessionHistory.values()].sort((a,b)=>b.evidence.receivedMonotonic-a.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));}
  opportunityToken(identity:string):OpportunityCaptureToken|undefined {
    const record=this.target(identity);if(!this.enabled||!record?.admission||record.contextInvalid||!this.contextAuthorized(record.admission.context))return undefined;
    return Object.freeze({...this.generation(record.target.source),contextFacts:contextFacts(record.admission.context)});
  }
  captureOpportunities(identity:string,token:OpportunityCaptureToken,facts:readonly [OpportunityFact,OpportunityFact]):boolean {
    // A frozen pin is a copy, never a retained enrichment owner.
    const historical=[...this.sessionHistory.values()].flatMap(snapshot=>[snapshot.record,...snapshot.candidates]).find(record=>record.identity===identity);
    const record=this.find(identity)??historical;
    if(!this.enabled||!record?.admission||record.contextInvalid||!this.contextAuthorized(record.admission.context))return false;
    const generation=this.generation(record.target.source);
    if(token.collectionGeneration!==generation.collectionGeneration||token.observerGeneration!==generation.observerGeneration||token.contextFacts!==contextFacts(record.admission.context))return false;
    const captured=captureOpportunityFacts(facts,record.admission.context,record.target.level,record.target.round,source=>this.allowed(source),record.target.candidate?.header??record.admission.head);
    if(!captured)return false;
    const update=(value:ObservationTarget<T>):ObservationTarget<T>=>value.identity===identity?Object.freeze({...value,opportunities:captured}):value;
    for(const product of [this.acceptedCandidates,this.instances]){const value=product.get(identity);if(value)product.set(identity,update(value));}
    const snapshotUpdate=(snapshot:SessionSnapshot<T>):SessionSnapshot<T>=>Object.freeze({...snapshot,record:update(snapshot.record),candidates:Object.freeze(snapshot.candidates.map(update))});
    for(const [key,snapshot] of this.sessionHistory)if(snapshot.record.identity===identity||snapshot.candidates.some(value=>value.identity===identity))this.sessionHistory.set(key,snapshotUpdate(snapshot));
    if(this.lastLiveSnapshot&&(this.lastLiveSnapshot.record.identity===identity||this.lastLiveSnapshot.candidates.some(value=>value.identity===identity)))this.lastLiveSnapshot=snapshotUpdate(this.lastLiveSnapshot);
    return true;
  }

  captureProducer(identity:string,token:OpportunityCaptureToken,fact:BlockProducerFact):boolean {
    const retained=[...this.sessionHistory.values()].flatMap(snapshot=>[snapshot.record,...snapshot.candidates]).find(record=>record.identity===identity);
    const record=this.find(identity)??retained,context=record?.admission?.context,candidate=record?.target.candidate;
    if(!this.enabled||!record||!context||!candidate||record.contextInvalid||!this.contextAuthorized(context))return false;
    const generation=this.generation(record.target.source),proof=fact.evidence;
    if(token.collectionGeneration!==generation.collectionGeneration||token.observerGeneration!==generation.observerGeneration||token.contextFacts!==contextFacts(context))return false;
    if(fact.identity!==identity||fact.hash!==candidate.header.hash||fact.protocol!==context.protocolHash||proof.requestedHeadHash!==fact.hash||proof.source.baseUrl!==record.target.source.baseUrl||proof.source.network!==record.target.source.network||proof.chainId!==context.observer.chainId||proof.contextHeadHash!==context.observer.header.hash||proof.predecessor!==context.anchor.header.hash||proof.protocolHash!==context.protocolHash||!this.allowed(proof.source))return false;
    const captured:BlockProducerFact=Object.freeze({...fact,evidence:Object.freeze({...proof,source:Object.freeze({...proof.source})})});
    const update=(value:ObservationTarget<T>):ObservationTarget<T>=>value.identity===identity?Object.freeze({...value,producer:captured}):value;
    const active=this.acceptedCandidates.get(identity);if(active)this.acceptedCandidates.set(identity,update(active));
    const snapshotUpdate=(snapshot:SessionSnapshot<T>):SessionSnapshot<T>=>Object.freeze({...snapshot,record:update(snapshot.record),candidates:Object.freeze(snapshot.candidates.map(update))});
    for(const [key,snapshot] of this.sessionHistory)if(snapshot.record.identity===identity||snapshot.candidates.some(value=>value.identity===identity))this.sessionHistory.set(key,snapshotUpdate(snapshot));
    if(this.lastLiveSnapshot&&(this.lastLiveSnapshot.record.identity===identity||this.lastLiveSnapshot.candidates.some(value=>value.identity===identity)))this.lastLiveSnapshot=snapshotUpdate(this.lastLiveSnapshot);
    return true;
  }

  pin(identity:string):boolean {
    const frozen=this.frozenPin;
    if(frozen && (frozen.identity===identity || frozen.record.identity===identity || frozen.candidates.some(candidate=>candidate.identity===identity))){
      if(this.selectedPin?.identity!==identity)this.selectedPin=Object.freeze({instance:frozen.identity,identity,baseline:this.acceptedSequence,newer:0,newerPartial:this.historyIdentityUncertain});
      return true;
    }
    let snapshot=[...this.sessionHistory.values()].find(value=>value.identity===identity||value.record.identity===identity||value.candidates.some(candidate=>candidate.identity===identity));
    if(!snapshot){
      // Raw receipt identities can change after their observer head is learned.
      // Resolve an accepted alias only through the same fully proven session.
      const record=this.instances.get(identity),admission=record?.admission;
      const captured=record&&admission&&!record.contextInvalid&&this.contextAuthorized(admission.context)?this.sessionHistory.get(this.sessionIdentity(record)):undefined;
      const capturedAdmission=captured?.record.admission;
      if(capturedAdmission&&admission&&capturedAdmission.collectionGeneration===admission.collectionGeneration&&capturedAdmission.observerGeneration===admission.observerGeneration)snapshot=captured;
    }
    if(!snapshot)return false;
    this.selectedPin=Object.freeze({instance:snapshot.identity,identity,baseline:this.acceptedSequence,newer:0,newerPartial:this.historyIdentityUncertain});this.frozenPin=undefined;return true;
  }
  followLive():void {this.selectedPin=undefined;this.frozenPin=undefined;}
  latest():boolean {const live=this.liveSelection(false);if(!live){this.followLive();return false;}this.selectedPin=undefined;this.frozenPin=undefined;if(this.pin(live.record.identity))return true;this.selectedPin=Object.freeze({instance:live.snapshot.identity,identity:live.record.identity,baseline:this.acceptedSequence,newer:0,newerPartial:this.historyIdentityUncertain});this.frozenPin=live.snapshot;return true;}
  private liveSelection(strongest=true):{readonly snapshot:SessionSnapshot<T>;readonly record:ObservationTarget<T>}|undefined {
    const accepted=this.acceptedTargets().filter(record=>record.admission&&!record.contextInvalid&&this.contextAuthorized(record.admission.context));
    const represented=new Set(accepted.filter(record=>record.target.candidate).map(record=>this.sessionIdentity(record)));
    const records=accepted.filter(record=>record.target.candidate||!represented.has(this.sessionIdentity(record))).sort((a,b)=>b.target.level-a.target.level||b.target.round-a.target.round||b.evidence.receivedMonotonic-a.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));
    if(!strongest){
      records.sort((a,b)=>b.evidence.receivedMonotonic-a.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));
      for(const record of records){const identity=this.sessionIdentity(record),snapshot=this.sessionHistory.get(identity)??(this.lastLiveSnapshot?.identity===identity?this.lastLiveSnapshot:undefined);if(snapshot)return {snapshot,record};}
      return undefined;
    }
    const newest=records[0];if(!newest?.admission)return undefined;
    const current=records.find(record=>record.identity===this.liveIdentity&&record.target.level===newest.target.level&&record.target.round===newest.target.round);
    const context=(current??newest).admission?.context;if(!context)return undefined;
    const ranked=records.filter(record=>record.target.level===newest.target.level&&record.target.round===newest.target.round&&record.admission&&contextFacts(record.admission.context)===contextFacts(context));
    const score=(record:ObservationTarget<T>):number=>{const power=observedPhasePowers(record);return (power.prePower??0)+(power.attPower??0);};
    ranked.sort((a,b)=>score(b)-score(a)||Number(b.identity===this.liveIdentity)-Number(a.identity===this.liveIdentity)||b.evidence.receivedMonotonic-a.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));
    for(const record of ranked){const identity=this.sessionIdentity(record),snapshot=this.sessionHistory.get(identity)??(this.lastLiveSnapshot?.identity===identity?this.lastLiveSnapshot:undefined);if(snapshot){this.liveIdentity=record.identity;return {snapshot,record};}}
    return undefined;
  }
  inspection():SessionInspection<T> {
    const pin=this.selectedPin;if(!pin){const live=this.liveSelection();return Object.freeze({mode:"follow",...(live?{snapshot:live.snapshot,selectedIdentity:live.record.identity}:{}),frozen:false,newer:0,newerPartial:false});}
    const snapshot=this.frozenPin??this.sessionHistory.get(pin.instance);
    return Object.freeze({mode:"pin",...(snapshot?{snapshot}:{}),selectedIdentity:pin.identity,frozen:this.frozenPin!==undefined||!this.sessionHistory.has(pin.instance),newer:pin.newer,newerPartial:pin.newerPartial});
  }
  /** Bounded navigation authority; promotion preserves its unit sequence, never its hash receipt. */
  navigationUnits():readonly Readonly<{identity:string;sequence:number}>[] {
    return Object.freeze([...this.selectableUnits].map(([identity,sequence])=>Object.freeze({identity,sequence})));
  }
  private pruneSelectableUnits():void {
    const retained=new Set([...this.sessionHistory.values()].flatMap(value=>value.candidates.length?value.candidates.map(candidate=>candidate.identity):[value.identity]));
    for(const record of this.acceptedTargets())if(record.admission){if(record.target.candidate)retained.add(record.identity);else if(!this.sessionHistory.get(this.sessionIdentity(record))?.candidates.length)retained.add(this.sessionIdentity(record));}
    for(const key of this.selectableUnits.keys())if(!retained.has(key)){this.selectableUnits.delete(key);this.historyIdentityUncertain=true;}
    if(this.historyIdentityUncertain && this.selectedPin && !this.selectedPin.newerPartial)this.selectedPin=Object.freeze({...this.selectedPin,newerPartial:true});
  }
  private captureHistory(record:ObservationTarget<T>,group?:ReturnType<typeof groupsFor>[number]):void {
    if(!record.admission || record.contextInvalid)return;
    const identity=this.sessionIdentity(record),old=this.sessionHistory.get(identity);
    const candidates=[...(old?.candidates??[])],candidate=record.target.candidate;
    const candidateIndex=candidates.findIndex(value=>value.identity===record.identity);
    if(candidate){if(candidateIndex<0)candidates.push(record);else candidates[candidateIndex]=record;}
    let partial=old?.partial??false;
    if(candidates.length>100){partial=true;candidates.sort((a,b)=>a.evidence.receivedMonotonic-b.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));const removable=candidates.findIndex(value=>value.identity!==this.selectedPin?.identity);candidates.splice(removable<0?0:removable,1);}
    const unit=candidate?record.identity:identity;
    if(!this.selectableUnits.has(unit) && candidateIndex<0 && (candidate || candidates.length===0)){
      const represented=candidate?this.selectableUnits.get(identity):undefined;
      if(candidate)this.selectableUnits.delete(identity);
      const sequence=represented??++this.acceptedSequence;this.selectableUnits.set(unit,sequence);
      if(this.selectedPin && !this.historyIdentityUncertain && represented===undefined)this.selectedPin=Object.freeze({...this.selectedPin,newer:this.selectedPin.newer+1});
    }
    const union=<V>(before:readonly V[]|undefined,after:Iterable<V>|undefined):readonly V[]=>{const facts=[...new Set([...(before??[]),...(after??[])])];if(facts.length>10000)partial=true;return Object.freeze(facts.slice(0,10000));};
    const pre=union(old?.pre,group?.pre),att=union(old?.att,group?.att),unknownSlots=union(old?.unknownSlots,group?.unknownSlots),conflicts=union(old?.conflicts,group?.conflicts);
    const phases=record.phases??old?.record.phases;
    const phaseCommittees:{pre?:readonly Readonly<DelegateRight>[];att?:readonly Readonly<DelegateRight>[]}={};
    for(const phase of ["pre","att"] as const)if(phases?.[phase])phaseCommittees[phase]=old?.record.phases?.[phase]?.basis===phases[phase].basis&&old.phaseCommittees[phase]?old.phaseCommittees[phase]:Object.freeze(record.admission.rights.map(right=>Object.freeze({...right})));
    const currentPre=record.phases?.pre&&record.phases.pre!==old?.record.phases?.pre?Object.freeze([...(group?.pre??[])].slice(0,10000)):old?.currentPre??Object.freeze([]);
    const currentAtt=record.phases?.att&&record.phases.att!==old?.record.phases?.att?Object.freeze([...(group?.att??[])].slice(0,10000)):old?.currentAtt??Object.freeze([]);
    const maximumCommittees:{pre?:readonly Readonly<DelegateRight>[];att?:readonly Readonly<DelegateRight>[]}={};
    for(const phase of ["pre","att"] as const)if(phases?.[phase])maximumCommittees[phase]=old?.record.phases?.[phase]?.maximumBasis===phases[phase].maximumBasis&&old.maximumCommittees[phase]?old.maximumCommittees[phase]:Object.freeze(record.admission.rights.map(right=>Object.freeze({...right})));
    const capturedCoverage=record.coverage??old?.record.coverage,capturedCoverageStale=record.coverage?record.coverageStale:old?.record.coverageStale;
    const representative=Object.freeze({...record,...(capturedCoverage?{coverage:capturedCoverage,...(capturedCoverageStale===undefined?{}:{coverageStale:capturedCoverageStale})}:{}),...(phases?{phases}:{}),...(partial&&capturedCoverage?{coverage:invalidatePendingCoverage(capturedCoverage,"Historical inspection facts partially retained")}:{})});
    if(partial)for(let index=0;index<candidates.length;index++){const value=candidates[index]!;if(value.coverage)candidates[index]=Object.freeze({...value,coverage:invalidatePendingCoverage(value.coverage,"Historical inspection facts partially retained")});}
    const snapshot:SessionSnapshot<T>=Object.freeze({identity,record:representative,evidence:old && old.evidence.receivedMonotonic<=record.evidence.receivedMonotonic?old.evidence:record.evidence,candidates:Object.freeze(candidates),maximumCommittees:Object.freeze(maximumCommittees),phaseCommittees:Object.freeze(phaseCommittees),currentPre,currentAtt,committee:Object.freeze(record.admission.rights.map(right=>Object.freeze({...right}))),pre,att,unknownSlots,conflicts,partial,acceptedSequence:old?.acceptedSequence??this.acceptedSequence});
    this.sessionHistory.set(identity,snapshot);
    if(partial)for(const product of [this.acceptedCandidates,this.instances])for(const [key,value] of product)if(value.coverage && value.admission && this.sessionIdentity(value)===identity)product.set(key,Object.freeze({...value,coverage:invalidatePendingCoverage(value.coverage,"Historical inspection facts partially retained")}));
    if(this.sessionHistory.size>150){const oldest=[...this.sessionHistory.values()].sort((a,b)=>a.evidence.receivedMonotonic-b.evidence.receivedMonotonic||a.identity.localeCompare(b.identity))[0]!;if(this.selectedPin?.instance===oldest.identity && !this.frozenPin)this.frozenPin=oldest;this.sessionHistory.delete(oldest.identity);}
    const priorLive=this.lastLiveSnapshot?.record;
    if(!priorLive || !this.find(priorLive.identity) || !priorLive.admission || !this.contextAuthorized(priorLive.admission.context) || record.evidence.receivedMonotonic>=priorLive.evidence.receivedMonotonic)this.lastLiveSnapshot=snapshot;
  }

  /** Numerical facts change only at admitted observations, never from rendering. */
  private refreshAcceptedPhases(newVoteEvidence:boolean):void {
    const records=this.acceptedTargets(),operations=this.rawOperations();
    const key=(record:ObservationTarget<T>,phase:"pre"|"att")=>JSON.stringify([contextFacts(record.admission!.context),record.target.level,record.target.round,record.target.payload,"payload-shared",phase]);
    const retained=new Set(records.filter(record=>record.admission).flatMap(record=>[key(record,"pre"),key(record,"att")]));
    for(const identity of this.phaseFacts.keys())if(!retained.has(identity)){this.phaseFacts.delete(identity);this.crossingHistoryUncertain=true;}
    const historicalPhases=new Map([...this.sessionHistory.values()].flatMap(snapshot=>[snapshot.record.phases?.pre,snapshot.record.phases?.att].filter((phase):phase is AcceptedPhase=>phase!==undefined).map(phase=>[phase.key,phase] as const)));
    const handled=new Set<string>(),acceptedGroups=new Map<string,ReturnType<typeof groupsFor>[number]>();
    for(const admissions of this.contexts.values())for(const admission of admissions.values()){
      if(!this.contextAuthorized(admission.context))continue;
      const groups=groupsFor(operations,admission.rights,admission.context.level);
      const groupIndex=new Map(groups.map(group=>[JSON.stringify([group.round,group.payload,group.contextKey]),group]));
      for(const group of groups)acceptedGroups.set(JSON.stringify([contextFacts(admission.context),admission.context.level,group.round,group.payload]),group);
      const owned=records.filter(record=>!record.contextInvalid && record.admission && contextFacts(record.admission.context)===contextFacts(admission.context));
      const basis=JSON.stringify([admission.constants.committee,admission.constants.quorum,admission.rights.map(right=>[right.address,right.slot,right.power])]);
      for(const record of owned){
        const group=groupIndex.get(JSON.stringify([record.target.round,record.target.payload,admission.context.key]));
        for(const phase of ["pre","att"] as const){
          const identity=key(record,phase);if(handled.has(identity))continue;handled.add(identity);
          const signers=group?.[phase],snapshot=record.coverage;
          const complete=!!snapshot && pendingPhaseComplete(snapshot,phase) && !record.coverageStale;
          if(!signers?.size && !complete)continue;
          const power=signerPower(signers??new Set(),admission.rights);if(power===undefined)continue;
          const evidence=(phase==="pre"?group?.preEvidence:group?.attEvidence)??snapshot?.evidence;if(!evidence)continue;
          const old=this.phaseFacts.get(identity)??historicalPhases.get(identity),sameBasis=old?.basis===basis;
          const crossing=!!old && sameBasis && newVoteEvidence && !old.uncertain && !old.quorumObserved && old.maximumPower<admission.constants.quorum && power>=admission.constants.quorum;
          const firstQuorum=power>=admission.constants.quorum && !old?.quorumObserved;
          const newMaximum=!old || power>old.maximumPower;
          const currentEvidence=evidence;
          const state:AcceptedPhase=Object.freeze({key:identity,phase,power,currentEvidence,maximumPower:Math.max(old?.maximumPower??0,power),maximumTotal:newMaximum?admission.constants.committee:old.maximumTotal,maximumThreshold:newMaximum?admission.constants.quorum:old.maximumThreshold,maximumBasis:newMaximum?basis:old.maximumBasis,maximumEvidence:newMaximum?evidence:old.maximumEvidence,threshold:admission.constants.quorum,basis,quorumObserved:old?.quorumObserved===true||firstQuorum,crossed:old?.crossed===true||crossing,uncertain:old?.uncertain??this.crossingHistoryUncertain,evidence:old?.evidence??evidence});
          this.phaseFacts.set(identity,state);
          const eventIdentity=JSON.stringify([identity,crossing?"crossing":"observed-quorum"]);
          // Retired phase/event owners cannot prove this quorum was never emitted.
          // Keep its attributed positive phase fact, but publish no reconstructed event.
          if((crossing || (!old && firstQuorum && !state.uncertain)) && !this.acceptedEventFacts.some(event=>event.phaseIdentity===identity)){
            this.acceptedEventFacts.push(Object.freeze({identity:eventIdentity,phaseIdentity:identity,kind:crossing?"crossing":"observed-quorum",phase,level:record.target.level,round:record.target.round,payload:record.target.payload!,contextKey:admission.context.key,chainId:admission.context.observer.chainId,attribution:"payload-shared",power,threshold:admission.constants.quorum,evidence}));
            this.acceptedEventFacts.splice(0,Math.max(0,this.acceptedEventFacts.length-12));
          }
        }
      }
    }
    if(this.phaseFacts.size>500){this.crossingHistoryUncertain=true;const ordered=[...this.phaseFacts.values()].sort((a,b)=>a.evidence.receivedMonotonic-b.evidence.receivedMonotonic||a.key.localeCompare(b.key));for(const state of ordered.slice(0,this.phaseFacts.size-500))this.phaseFacts.delete(state.key);}
    for(const product of [this.acceptedCandidates,this.instances])for(const [identity,record] of product)if(record.admission){
      const pre=this.phaseFacts.get(key(record,"pre")),att=this.phaseFacts.get(key(record,"att"));
      if(pre || att){const updated=Object.freeze({...record,phases:Object.freeze({...(pre?{pre}:{}),...(att?{att}:{})})});product.set(identity,updated);this.captureHistory(updated,acceptedGroups.get(this.sessionIdentity(updated)));}
    }
  }
}
