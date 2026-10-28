import {recentConsensus} from './consensus/recentConsensus';
import {cameraReceipt,type CameraReceipt} from './cameraTiming';
import {phaseProof} from './phaseProvenance';
import {BlockIntervals} from './rpc/blockIntervals';
import {observationMeaning} from './observationMeaning';
import {CandidateProducers} from './rpc/candidateProducer';
import "./dashboard.css";
import {customSourcePanel} from "./view/customSourcePanel";
import {CUSTOM_STREAM_IDLE_MS,isCustomSource} from "./rpc/customSources";
import {sourceExclusions} from "./rpc/sourceExclusion";
import {StreamTransport,type StreamTransportOptions} from "./rpc/streamTransport";
import {observedPhasePowers,type ObservationTarget} from "./monitor/observationStore";
import {SourceComparison,type ComparisonSelection} from "./rpc/sourceComparison";
import {captureOpportunityFacts,observedHeaderMatches} from './consensus/opportunityFacts';
import {groupsFor, committeeAuthority, signerPower, observationContextCompatible,contextFacts} from "./consensus/phaseEvidence";
import {headFactsKey} from "./monitor/headGeneration";
import {
  createDashboard,
  type NetworkViewModel,
  type DelegateView,
} from "./dashboardView";
import {
  NetworkMonitor,
  type NetworkMonitorView,
} from "./monitor/networkMonitor";
import {
  NetworkData,
  pendingPhaseComplete,
  sources,
  streamSources,
  customSources,
  rawStreamSources,
  type Derived,
  type DelegateRight,
  type TargetContext,
} from "./rpc/networkData";
import type {
  NetworkName,
  BlockHeader,
} from "./rpc/models";
import { proposalRound, roundSchedule, conditionalRoundBoundary,protocolRoundStart,type OpportunityFact } from "./consensus/roundSchedule";
declare const __APP_REVISION__: string;

const dashboardRoot = document.getElementById("app");
if (!dashboardRoot) throw new Error("Missing dashboard root");
const root:HTMLElement=dashboardRoot;
let userPaused = false;
let pageActive = true;
const collectionAllowed = (): boolean => pageActive && !userPaused && !document.hidden;
const runtimes = new Map<NetworkName, Runtime>();
let storage:Storage|undefined;try{storage=localStorage;}catch{ /* Storage is optional. */ }
const navigate=(href:string):void=>{if(href===location.href)location.reload();else location.assign(href);};
const panelFor=(network:NetworkName)=>customSourcePanel({network,set:customSources[network],pageOrigin:location.origin,href:location.href,storage,navigate,onUnusable:source=>sourceExclusions.exclude(source)});
const customPanels={mainnet:panelFor("mainnet"),shadownet:panelFor("shadownet")};
/**
 * Monitor streams for one network: custom sources get an idle deadline and are skipped once
 * excluded; each custom source's stream errors, and their recovery, are reported to its panel row.
 */
function reportingStreamFactory(network:NetworkName){
  return <V>(settings:StreamTransportOptions<V>):StreamTransport<V>=>{
    let delivered=0;
    const onStatus:StreamTransportOptions<V>["onStatus"]=(source,error,metrics)=>{
      if(isCustomSource(source)){
        if(error!==null)customPanels[network].report(source.baseUrl,settings.path,error);
        else if(metrics.messages>delivered)customPanels[network].report(source.baseUrl,settings.path,null);
      }
      delivered=metrics.messages;
      settings.onStatus(source,error,metrics);
    };
    return new StreamTransport<V>({...settings,onStatus,exclusions:sourceExclusions,idleTimeoutMs:source=>isCustomSource(source)?CUSTOM_STREAM_IDLE_MS:undefined});
  };
}
const dashboard = createDashboard(root, {
  sourceControls:{mainnet:customPanels.mainnet.root,shadownet:customPanels.shadownet.root},
  sourceNotices:{...(customPanels.mainnet.notice?{mainnet:customPanels.mainnet.notice}:{}),...(customPanels.shadownet.notice?{shadownet:customPanels.shadownet.notice}:{})},
  revision: __APP_REVISION__,
  onNetworkChange(){for(const runtime of runtimes.values())syncCollection(runtime);},
  onReadEligibility(network){const runtime=runtimes.get(network);if(runtime)void readEligibility(runtime);},
  onPauseChange(paused) {
    userPaused = paused;
    for (const runtime of runtimes.values()) syncCollection(runtime);
  },
  onSelect(network, identity) {
    const runtime = runtimes.get(network);
    if (!runtime) return;
    const instance=runtime.view?.history.find(snapshot=>snapshot.identity===identity);
    identity=instance?(instance.candidates[0]?.identity??instance.record.identity):identity;
    runtime.followLiveSelection=false;runtime.selectedIdentity = identity;
    if(!runtime.monitor.pinObservation(identity))runtime.monitor.followLive();
    fenceComparisonSelection(runtime);
    scheduleRender(runtime);
  },
  onPin(network){const runtime=runtimes.get(network),identity=runtime?.selectedIdentity??runtime?.view?.inspection.selectedIdentity;if(runtime&&identity){runtime.monitor.pinObservation(identity);fenceComparisonSelection(runtime);}},
  onFollow(network){const runtime=runtimes.get(network);if(runtime){delete runtime.selectedIdentity;runtime.followLiveSelection=true;runtime.monitor.followLive();fenceComparisonSelection(runtime);}},
  onLatest(network){const runtime=runtimes.get(network);if(runtime){delete runtime.selectedIdentity;runtime.followLiveSelection=!runtime.monitor.latestObservation();fenceComparisonSelection(runtime);}},
  onRetry(network,identity){if(collectionAllowed())runtimes.get(network)?.monitor.reconcileObservation(identity);},
  onRefreshIntervals(network){void runtimes.get(network)?.intervals.refresh();},
  onCompare(network,url){const runtime=runtimes.get(network),source=streamSources[network].find(value=>value.baseUrl===url);if(!runtime||!source||!collectionAllowed()||[...runtimes.values()].some(value=>value.comparison.running))return;const selection=comparisonSelection(runtime);if(selection)void runtime.comparison.compare(selection,source);},
  onReconnect() {
    if (collectionAllowed()) for (const runtime of runtimes.values()) {
      stopCollection(runtime);syncCollection(runtime);runtime.monitor.refreshDerived();
    }
  },
});

interface Runtime {
  network: NetworkName;
  collectionActive: boolean;
  selectedIdentity?: string;
  followLiveSelection:boolean;
  data: NetworkData;
  comparison:SourceComparison;
  producers:CandidateProducers;
  intervals:BlockIntervals;
  monitor: NetworkMonitor<Derived>;
  view: NetworkMonitorView<Derived> | null;
  opportunityFacts?:readonly [OpportunityFact,OpportunityFact];
  opportunityKey: string;
  opportunityController: AbortController;
  eligibilityHead: string;
  eligibilityLoading:boolean;
  eligibilityController:AbortController;
  requestFrame: number | null;
  cameraReceipt:CameraReceipt|undefined;
}


function stopCollection(runtime:Runtime):void {
  runtime.intervals.setEnabled(false);
  runtime.collectionActive=false;runtime.producers.stop();runtime.comparison.pause();runtime.monitor.stop();runtime.data.pause();runtime.opportunityController.abort();runtime.eligibilityController.abort();runtime.eligibilityLoading=false;
}

function syncAuxiliary(runtime:Runtime):void {
 const foreground=collectionAllowed()&&runtime.collectionActive&&root.dataset.selected===runtime.network;
 runtime.intervals.setEnabled(foreground);
 if(foreground)void runtime.data.loadAliases().then(()=>scheduleRender(runtime));
 else {runtime.opportunityController.abort();runtime.opportunityKey="";runtime.eligibilityController.abort();runtime.eligibilityHead="";runtime.eligibilityLoading=false;}
}

function eligibilitySelection(runtime:Runtime){
 if(runtime.network!=="shadownet"||root.dataset.selected!==runtime.network||!collectionAllowed()||!runtime.collectionActive||runtime.view?.inspection.mode==='pin')return undefined;
 const snapshot=runtime.view?.snapshot,head=snapshot?.head,rights=head?snapshot?.derived?.rights.get(head.level):undefined;
 if(!head||!rights?.length)return undefined;
 return {head,rights,key:JSON.stringify([head.evidence?.source.baseUrl,head.hash,rights.map(right=>right.address)])};
}

async function readEligibility(runtime:Runtime):Promise<void>{
 const selected=eligibilitySelection(runtime);if(!selected||selected.key===runtime.eligibilityHead||runtime.eligibilityLoading)return;
 runtime.eligibilityController.abort();const controller=new AbortController();runtime.eligibilityController=controller;
 runtime.eligibilityHead=selected.key;runtime.eligibilityLoading=true;scheduleRender(runtime);
 try {await runtime.data.loadEligibility(selected.head,selected.rights,controller.signal);}
 finally {if(runtime.eligibilityController===controller){runtime.eligibilityLoading=false;scheduleRender(runtime);}}
}

function syncCollection(runtime:Runtime):void {
  if(!collectionAllowed()||root.dataset.selected!==runtime.network) {
    if(runtime.collectionActive)stopCollection(runtime);
  } else if(!runtime.collectionActive) {
    runtime.collectionActive=true;runtime.producers.start();runtime.comparison.resume();runtime.data.resume();
    runtime.opportunityController=new AbortController();runtime.opportunityKey="";runtime.eligibilityHead="";
    runtime.monitor.start();
  }
  syncAuxiliary(runtime);
  scheduleRender(runtime);
}

function comparisonSelection(runtime:Runtime):ComparisonSelection|undefined {
 const view=runtime.view;if(!view)return undefined;
 const inspection=view.inspection,history=inspection.mode==='pin'?inspection.snapshot:undefined;
 const selected=runtime.selectedIdentity??inspection.selectedIdentity;
 const record=history?(history.candidates.find(candidate=>candidate.identity===inspection.selectedIdentity)??history.record):[...view.observationTargets,...view.unresolvedTargets].find(value=>value.identity===selected);
 const admission=record?.admission,header=record?.target.candidate?.header??(record?undefined:view.snapshot?.head),source=record?.target.source??header?.evidence?.source??view.headStream.source;
 if(!source)return undefined;
 const level=record?.target.level??header?.level,round=record?.target.round??(header?proposalRound(header.fitness,header.level):undefined);if(level===undefined||round===undefined)return undefined;
 const derived=record?undefined:view.snapshot?.derived,provenContext=derived?.contexts.get(level),context=admission?.context??(provenContext?.observer.header.hash===header?.hash?provenContext:undefined),rights=admission?.rights??derived?.rights.get(level),constants=admission?.constants??derived?.constantsByLevel.get(level);
 const key=JSON.stringify([selected??header?.hash,source.baseUrl,context?.key,record?.contextInvalid??false,view.snapshot?.head.hash,inspection.mode,history?.evidence.receivedMonotonic]);
 const chainId=context?.observer.chainId??header?.chainId;
 return {key,source,level,round,historical:inspection.mode==='pin',coherent:!record?.contextInvalid&&(record?admission!==undefined:true),...(header?{header}:{}),...(chainId?{chainId}:{}),...(record?.target.payload?{payload:record.target.payload}:{}),...(context&&rights&&constants?{context,rights,constants}:{})};
}
/** User selection changes fence work synchronously, before the next animation frame. */
function fenceComparisonSelection(runtime:Runtime):void {
 const selection=comparisonSelection(runtime);
 runtime.comparison.setSelection(selection?.key??JSON.stringify(['unavailable-selection',runtime.selectedIdentity,runtime.view?.inspection.mode]));
 const key=opportunitySelection(runtime)?.key??'unavailable';
 if(runtime.opportunityKey&&runtime.opportunityKey!==key){runtime.opportunityController.abort();runtime.opportunityKey='';delete runtime.opportunityFacts;}
}
function comparisonModel(runtime:Runtime):NonNullable<NetworkViewModel['comparison']>{
 const selection=comparisonSelection(runtime);fenceComparisonSelection(runtime);
 return {providers:streamSources[runtime.network].filter(source=>source.baseUrl!==selection?.source.baseUrl).map(source=>({name:source.name,url:source.baseUrl})),enabled:collectionAllowed()&&selection!==undefined,running:[...runtimes.values()].some(value=>value.comparison.running),result:()=>runtime.comparison.result()};
}
function sessionModel(runtime:Runtime):NonNullable<NetworkViewModel["session"]> {
 const view=runtime.view;if(!view)return {mode:"follow",frozen:false,newer:0,newerPartial:false,canPin:false,accepted:0,unresolved:0,raw:0,instances:[]};const selected=runtime.selectedIdentity??view.inspection.selectedIdentity;
 const choices=view.navigationUnits.flatMap(unit=>{
   const snapshot=view.history.find(value=>value.identity===unit.identity||value.candidates.some(record=>record.identity===unit.identity));
   if(!snapshot)return [];
   const record=snapshot.candidates.find(value=>value.identity===unit.identity)??snapshot.record;
   return [{identity:record.identity,received:unit.sequence===snapshot.acceptedSequence?snapshot.evidence.receivedMonotonic:record.evidence.receivedMonotonic}];
 }).sort((a,b)=>b.received-a.received||a.identity.localeCompare(b.identity));
 const choiceIndex=choices.findIndex(record=>record.identity===selected),previous=!view.inspection.frozen&&choiceIndex>=0?choices[choiceIndex+1]?.identity:undefined;
 return {...(previous?{previous}:{}),mode:view.inspection.mode,frozen:view.inspection.frozen,newer:view.inspection.newer,newerPartial:view.inspection.newerPartial,...(view.inspection.snapshot?{selected:view.inspection.snapshot.identity}:{}),canPin:selected!==undefined&&view.observationTargets.some(record=>record.identity===selected),accepted:view.observationTargets.filter(record=>record.target.candidate).length,unresolved:view.unresolvedTargets.length,raw:view.rawOperations.length,instances:view.history.map(snapshot=>({identity:snapshot.identity,level:snapshot.record.target.level,round:snapshot.record.target.round,source:snapshot.record.target.source.name,received:snapshot.evidence.receivedAt,receivedMonotonic:snapshot.evidence.receivedMonotonic,partial:snapshot.partial,candidates:snapshot.candidates.length,label:`${snapshot.record.target.source.name} · ${snapshot.record.target.level}/${snapshot.record.target.round} · ${snapshot.record.target.payload??"payload unknown"} · ${snapshot.candidates.length} candidates`}))};
}
function capturedEvents(runtime:Runtime):NonNullable<NetworkViewModel["events"]> {const view=runtime.view;return view?view.acceptedEvents.map(event=>({identity:event.identity,observedAt:event.evidence.receivedAt,description:`${event.phase==="pre"?"Preattestation":"Attestation"} ${event.kind==="crossing"?"crossing":"observed quorum"} · level ${event.level} · round ${event.round} · payload ${event.payload} · power ${event.power} · threshold ${event.threshold} · source ${event.evidence.source.baseUrl} · chain ${event.chainId} · payload-shared attribution`})):[];}
function capturedRecent(runtime:Runtime):NonNullable<NetworkViewModel["recentConsensus"]> {
 return recentConsensus(runtime.view?.history??[]);
}
/** Present already-admitted source facts; no view-level admission or clock authority. */
function navigatorObservation(record:ObservationTarget<Derived>):NonNullable<NetworkViewModel['observation']>{
 const context=record.admission?.context,candidate=record.target.candidate,anchor=context?.anchor.header;
 const parentRound=anchor?proposalRound(anchor.fitness,anchor.level):undefined;
 const parent=anchor&&anchor.level===record.target.level-1&&parentRound!==undefined&&(!candidate||candidate.header.predecessor===anchor.hash)?{hash:anchor.hash,parentHash:anchor.predecessor,...(anchor.payload_hash?{payload:anchor.payload_hash}:{}),level:anchor.level,round:parentRound,relation:candidate?'ancestry' as const:'context' as const}:undefined;
 return {identity:record.identity,level:record.target.level,round:record.target.round,source:record.target.source.baseUrl,coherent:!!context&&!record.contextInvalid,receivedAt:record.evidence.receivedAt,receivedMonotonic:record.evidence.receivedMonotonic,...(record.target.payload?{payload:record.target.payload}:{}),...(candidate?{hash:candidate.header.hash}:{}),...(context?{contextHead:context.observer.header.hash,contextParent:context.anchor.header.hash,chain:context.observer.chainId,protocol:context.protocolHash}:{}),...(parent?{predecessor:parent}:{})};
}
function applyIndependentClock(runtime:Runtime,model:NetworkViewModel):void {
 const snapshot=runtime.view?.snapshot,appliedHead=snapshot?.head,appliedRound=appliedHead?proposalRound(appliedHead.fitness,appliedHead.level):undefined;
 const paused=!collectionAllowed()||!runtime.collectionActive,degraded=runtime.view?.headStream.error!==null,now=Date.now();
  const clockParameters=appliedHead?snapshot?.derived?.constantsByLevel.get(appliedHead.level+1):undefined,clockContext=clockParameters?.context;
  if(appliedHead&&!paused&&!degraded&&appliedRound!==undefined&&clockParameters&&clockParameters.evidence&&clockContext&&runtime.monitor.contextAuthorized(clockContext)&&clockContext.protocolHash===clockContext.observer.protocolHash&&clockContext.observer.source.baseUrl===appliedHead.evidence?.source.baseUrl&&observedHeaderMatches(clockContext.observer.header,appliedHead)){
    const boundary=conditionalRoundBoundary({referenceTimestamp:Date.parse(appliedHead.timestamp),referenceRound:appliedRound,branch:'next-level',minimum:clockParameters.minimum,increment:clockParameters.increment,roundBasis:'proven'});
    if(boundary!==undefined){const clock=roundSchedule(boundary,clockParameters.minimum,clockParameters.increment,now);if(clock)model.timing={...clock,level:appliedHead.level+1,nextRound:clock.round+1,evidence:`applied reference ${appliedHead.hash} · observer ${clockContext.observer.source.baseUrl} · parameters responder ${clockParameters.evidence?.source.baseUrl??"unavailable"} · target ${clockContext.level} · execution protocol ${clockContext.protocolHash}`};}
  }
}
function applyProducer(runtime:Runtime,model:NetworkViewModel):void {
 const pin=runtime.view?.inspection;
 const records=pin?.mode==="pin"&&pin.snapshot?[pin.snapshot.record,...pin.snapshot.candidates]:runtime.view?.observationTargets??[];
 const fact=records.find(record=>record.identity===model.selectedIdentity)?.producer;
 if(fact&&fact.identity===model.selectedIdentity){
   model.producer=fact.baker;
   if(model.candidateEvidence)model.candidateEvidence=model.candidateEvidence.replace('Producer unknown',`Block producer / baker ${fact.baker} · metadata requested hash ${fact.hash} · metadata source ${fact.evidence.source.baseUrl} · metadata chain ${fact.evidence.chainId} · metadata context ${fact.evidence.contextHeadHash} · metadata protocol ${fact.protocol} · metadata received ${new Date(fact.evidence.receivedAt).toISOString()}`);
 }
 if(runtime.producers.state.saturated)model.note+=' Producer metadata attempt window full (100); new identities remain unknown until proven source advancement.';
}
function supportedChoices(records:readonly ObservationTarget<Derived>[],context:TargetContext|undefined,level:number,round:number|undefined,selectedIdentity?:string):NonNullable<NetworkViewModel['candidates']>{
 if(!context||round===undefined)return [];
 const coherent=records.filter(record=>record.admission&&!record.contextInvalid&&record.target.level===level&&record.target.round===round&&contextFacts(record.admission.context)===contextFacts(context));
 const represented=new Set(coherent.filter(record=>record.target.candidate).map(record=>record.target.payload));
 const choices=[...new Map(coherent.filter(record=>record.target.candidate||!represented.has(record.target.payload)).flatMap(record=>{
  const support=observedPhasePowers(record);if((support.prePower??0)+(support.attPower??0)<=0)return [];
  return [[record.identity,{identity:record.identity,level,round,...support,source:record.target.source.baseUrl,payloadShared:true,...(record.target.candidate?{hash:record.target.candidate.header.hash}:{}),...(record.target.payload?{payload:record.target.payload}:{})}] as const];
 })).values()];
 return choices.sort((a,b)=>(b.prePower??0)+(b.attPower??0)-(a.prePower??0)-(a.attPower??0)||Number(b.identity===selectedIdentity)-Number(a.identity===selectedIdentity)||a.identity.localeCompare(b.identity));
}
function renderPinned(runtime:Runtime):boolean {
 const view=runtime.view,pin=view?.inspection;if(!view||!pin||pin.mode!=="pin")return false;const snapshot=pin.snapshot,applied=view.snapshot?.head;
 if(!snapshot){updateDashboard(runtime,{status:"unknown",note:"Pinned session facts unavailable",session:sessionModel(runtime)});return true;}
 const record=snapshot.record,candidate=snapshot.candidates.find(value=>value.identity===pin.selectedIdentity)?.target.candidate,context=record.admission?.context;
 const phaseComplete=(phase:"pre"|"att"):boolean=>record.coverage!==undefined&&pendingPhaseComplete(record.coverage,phase)&&!snapshot.partial&&!record.coverageStale&&!record.contextInvalid;
 const complete=phaseComplete("pre")&&phaseComplete("att");
 const original=candidate?.evidence??snapshot.evidence;
 const capturedCommittee=committeeAuthority(snapshot.committee,record.admission?.constants.committee,record.admission?.constants.quorum);
 const live=view.observationTargets.find(value=>value.identity===pin.selectedIdentity),liveState=!live?"outside LIVE-active index":!collectionAllowed()||live.contextInvalid||live.coverageStale?"stale/unavailable":"coherent under last proven observer context";
 const selectablePinned=supportedChoices([...snapshot.candidates,record],context,record.target.level,record.target.round,pin.selectedIdentity);
 const delegate=(right:Readonly<DelegateRight>):DelegateView=>({address:right.address,power:right.power,...(runtime.data.alias(right.address)?{alias:`${runtime.data.alias(right.address)} · TzKT`,searchAlias:runtime.data.alias(right.address)!}:{}),eligibility:"unavailable",eligibilityNote:"Historical eligibility was not captured; current helper state is not substituted"});
 const model:NetworkViewModel={status:view.headStream.error?"degraded":"unknown",...(capturedCommittee.usable?{committeeTotal:capturedCommittee.total}:{}),session:sessionModel(runtime),level:record.target.level,consensusLevel:record.target.level,round:record.target.round,activityRound:record.target.round,roundSource:"observed",...(pin.selectedIdentity?{selectedIdentity:pin.selectedIdentity}:{}),...(record.target.payload?{payload:record.target.payload}:{}),...(applied?{appliedLevel:applied.level,...(proposalRound(applied.fitness,applied.level)===undefined?{}:{appliedRound:proposalRound(applied.fitness,applied.level)!}),hash:applied.hash,blockTimestamp:Date.parse(applied.timestamp),...(applied.evidence?{observedAt:applied.evidence.receivedAt,observedMonotonic:applied.evidence.receivedMonotonic}:{}),snapshotMonotonic:snapshot.evidence.receivedMonotonic}:{}),candidates:selectablePinned,provenanceCandidates:snapshot.candidates.flatMap(value=>value.target.candidate?[{identity:value.identity,hash:value.target.candidate.header.hash,level:value.target.level,round:value.target.round}]:[]),...(candidate?{observedProposal:{level:candidate.header.level,round:record.target.round,...(candidate.header.payload_hash?{payload:candidate.header.payload_hash}:{}),at:candidate.evidence.receivedAt}}:{}),candidateEvidence:`${candidate?`Observed block hash ${candidate.header.hash}`:"Candidate hash unavailable"} · Producer unknown · Shared payload evidence; signatures are not candidate-specific · Source ${original.source.baseUrl} · requested head ${original.requestedHeadHash??"unknown"} · observed head ${original.observedHeadHash??"unknown"} · observed head parent ${original.predecessor??"unknown"} · original chain ${original.chainId??"unknown"} · protocol-level counter ${original.protocolLevel??"unknown"} · candidate parent ${candidate?.header.predecessor??"unknown"} · first received ${new Date(snapshot.evidence.receivedAt).toISOString()} · selected fact received ${new Date(original.receivedAt).toISOString()}${snapshot.partial?" · Historical inspection facts partially retained":""}${snapshot.unknownSlots.length?` · Unknown-rights signer slots: ${snapshot.unknownSlots.join(", ")}`:""}`,contextEvidence:context?`Captured source/context · Rights responder ${record.admission?.rights[0]?.evidence?.source.baseUrl??"unknown"} · authority observer ${context.observer.source.baseUrl} · chain ${context.observer.chainId} · context head ${context.observer.header.hash} · requested anchor ${context.anchor.header.hash} · target ${context.level} · execution protocol ${context.protocolHash} · parent ${context.observer.header.predecessor} · rights requested anchor ${record.admission?.rights[0]?.evidence?.requestedHeadHash??"unknown"} · rights received ${record.admission?.rights[0]?.evidence?new Date(record.admission.rights[0].evidence.receivedAt).toISOString():"unknown"}`:"Historical context unavailable",recentConsensus:capturedRecent(runtime),connection:collectionAllowed()?"Collection continues independently":"Paused",source:record.target.source.name,note:`${pin.frozen?"Pinned frozen snapshot outside retained history":"Pinned retained session instance"} · Current selected identity ${liveState} · As of ${new Date(record.phases?.pre?.maximumEvidence.receivedAt??snapshot.evidence.receivedAt).toISOString()} · ${complete?"Captured source-snapshot coverage; no global completeness claim":"Historical coverage partial/unavailable"}. ${record.coverage?`Source snapshot received ${new Date(record.coverage.evidence.receivedAt).toISOString()} · source ${record.coverage.evidence.source.baseUrl} · ${record.coverage.reasons.join("; ")||"complete validated category as received"}. `:""}Historical opportunity facts unavailable until captured; current timing and rights are not substituted.`,events:capturedEvents(runtime),sources:[]};
 for(const phase of ["pre","att"] as const){const fact=record.phases?.[phase],committee=snapshot.phaseCommittees[phase],addresses=phase==="pre"?snapshot.currentPre:snapshot.currentAtt;if(!fact||!committee)continue;const total=signerPower(new Set(committee.map(right=>right.address)),committee);if(total===undefined||total<=0||(fact.power===0&&!phaseComplete(phase)))continue;const value={count:addresses.length,expected:committee.length,power:fact.power,total,threshold:fact.threshold,proof:phaseProof(fact.currentEvidence,context,committee,phaseComplete(phase),true)};if(phase==="pre")model.preattestations=value;else model.attestations=value;model.quorum=fact.threshold;model.committeePower=total;}
 if(phaseComplete("pre"))model.missingPre=snapshot.committee.filter(right=>!snapshot.currentPre.includes(right.address)).map(delegate);
 if(phaseComplete("att"))model.missingAtt=snapshot.committee.filter(right=>!snapshot.currentAtt.includes(right.address)).map(delegate);
 if((phaseComplete("pre")&&model.preattestations?.power===0)||(phaseComplete("att")&&model.attestations?.power===0))model.note+=" Source-snapshot measured zero for captured phases without received votes; historical as-of evidence only.";
 model.committee=snapshot.committee.map(right=>({...delegate(right),preReceipt:snapshot.currentPre.includes(right.address)?"Received":phaseComplete("pre")?"Absent in selected source snapshot":"Partial / unavailable",attReceipt:snapshot.currentAtt.includes(right.address)?"Received":phaseComplete("att")?"Absent in selected source snapshot":"Partial / unavailable",contextNote:context?`Source ${context.observer.source.baseUrl} (observer) · rights responder ${right.evidence?.source.baseUrl??"unknown"} · chain ${context.observer.chainId} · head ${context.observer.header.hash} · target ${context.level} · protocol ${context.protocolHash}`:"Historical context unavailable"}));
 model.unknownConsensus=snapshot.unknownSlots.map(slot=>`slot ${slot} · source ${record.target.source.baseUrl} · level ${record.target.level} · round ${record.target.round} · payload ${record.target.payload??"unknown"} · unknown power`);
 const opportunityRecord=snapshot.candidates.find(value=>value.identity===pin.selectedIdentity)??record;
 if(opportunityRecord.opportunities){model.opportunityFacts=opportunityRecord.opportunities;model.opportunitiesHistorical=true;if(model.note)model.note=model.note.replace("Historical opportunity facts unavailable until captured; current timing and rights are not substituted.","Captured historical opportunities; current timing and rights are not substituted.");}
 model.observation=navigatorObservation(snapshot.candidates.find(value=>value.identity===pin.selectedIdentity)??record);
 if(live&&(live.error||live.coverageStale)){model.retryIdentity=live.identity;model.canRetry=collectionAllowed();}
 if(!candidate)model.note+=` Observed votes · level ${record.target.level.toLocaleString("en-US")} · round ${record.target.round} · historical as-of.`;
 if(!complete)model.note+=' Captured partial positive observations; unavailable phases do not imply zero.';
 if(view.crossingHistoryPartial)model.note+=' Crossing history partial.';
 Object.assign(model,observationMeaning(view,model.observation));applyIndependentClock(runtime,model);applyProducer(runtime,model);model.comparison=comparisonModel(runtime);updateDashboard(runtime,model);return true;
}

function updateDashboard(runtime:Runtime,model:NetworkViewModel):void {
 const progress=runtime.view?.progression;
 const discontinuity=progress&&(progress.kind!=='next-level'&&progress.kind!=='same-level-round'||progress.from.source.baseUrl!==progress.to.source.baseUrl||progress.from.chainId!==progress.to.chainId||progress.from.protocolHash!==progress.to.protocolHash)?JSON.stringify([progress.evidence.source.baseUrl,progress.evidence.receivedMonotonic,progress.to.header.hash]):undefined;
 dashboard.update(runtime.network,{...model,...(discontinuity?{navigatorDiscontinuity:discontinuity}:{}),...(!runtime.collectionActive?{status:"paused" as const,connection:root.dataset.selected!==runtime.network?"Paused · select network to resume":"Paused"}:{}),unresolvedObservations:(runtime.view?.unresolvedTargets??[]).map(record=>({identity:record.identity,level:record.target.level,round:record.target.round,source:record.target.source.baseUrl,...(record.target.payload?{payload:record.target.payload}:{}),...(record.target.candidate?{hash:record.target.candidate.header.hash}:{})})),eligibilityLoading:runtime.eligibilityLoading,eligibilityAvailable:eligibilitySelection(runtime)!==undefined,...(model.observation?.identity===runtime.cameraReceipt?.identity&&runtime.cameraReceipt?{cameraAcceptedMonotonic:runtime.cameraReceipt.emittedMonotonic}:{}),blockIntervals:runtime.intervals.view()});}

function render(runtime: Runtime): void {
  const view = runtime.view;
  const snapshot = view?.snapshot;
  if (!view) {
    updateDashboard(runtime, {
      status: "loading",
      connection: !collectionAllowed() ? "Paused" : "Connecting",
      sources: sources[runtime.network].map((s) => ({
        name: s.name,
        url: s.baseUrl,
        status: "Standby",
      })),
    });
    return;
  }
  if(!runtime.followLiveSelection&&runtime.selectedIdentity&&view.inspection.mode!=="pin")runtime.monitor.pinObservation(runtime.selectedIdentity);
  if(renderPinned(runtime))return;
  const appliedHead=snapshot?.head,appliedRound=appliedHead?proposalRound(appliedHead.fitness,appliedHead.level):undefined;
  const retainedTargets=[...view.observationTargets,...view.unresolvedTargets];
  const sourceLocalTargets=retainedTargets.filter(target=>!appliedHead || target.target.source.baseUrl!==appliedHead.evidence?.source.baseUrl || (target.admission!==undefined && target.admission.head.hash!==appliedHead.hash) || target.target.level>appliedHead.level+1).sort((a,b)=>b.evidence.receivedMonotonic-a.evidence.receivedMonotonic||a.identity.localeCompare(b.identity));
  const selectedIdentity=runtime.selectedIdentity??view.inspection.selectedIdentity;
  const sourceTarget=retainedTargets.find(target=>target.identity===selectedIdentity)??(runtime.followLiveSelection?undefined:sourceLocalTargets.find(target=>target.admission&&!target.contextInvalid)??sourceLocalTargets[0]);
  const admitted=sourceTarget && !sourceTarget.contextInvalid?sourceTarget.admission:undefined;
  const head=admitted?.head??snapshot?.head??(sourceTarget?runtime.monitor.observedHead(sourceTarget.target.source):undefined),derived=sourceTarget?admitted?.derived??null:snapshot?.derived,operations=sourceTarget?view.rawOperations:snapshot?.operations??view.rawOperations;
  if(!head){
    const error=view.headStream.error;
    updateDashboard(runtime,{status:error?"degraded":"loading",connection:collectionAllowed()?"Connecting":"Paused",...(error?{error}:{}),session:sessionModel(runtime),events:capturedEvents(runtime),comparison:comparisonModel(runtime),note:"Applied head unavailable; source-local context proof pending",sources:sources[runtime.network].map(source=>({name:source.name,url:source.baseUrl,status:"Standby"}))});return;
  }
  const now = Date.now(),
    headRound = proposalRound(head.fitness,head.level);
  if(headRound===undefined) {
    updateDashboard(runtime,{status:"degraded",...(appliedHead?{appliedLevel:appliedHead.level,hash:appliedHead.hash,blockTimestamp:Date.parse(appliedHead.timestamp)}:{}),note:"Applied round unavailable: unsupported or malformed fitness; consensus authority unavailable",connection:collectionAllowed()?"Observation unavailable":"Paused"});
    return;
  }
  let constants = derived?.constants;
  // An applied head can still be collecting votes. Move to its successor
  // once votes establish that level or its scheduled round-zero starts.
  const observedLevel = operations.reduce(
    (level, operation) =>
      Math.max(level, ...operation.contents.map((content) => content.level)),
    head.level,
  );
  const successorAnchor = constants
    ? Date.parse(head.timestamp) +
      (constants.minimum + headRound * constants.increment) * 1000
    : undefined;
  let consensusLevel =
    successorAnchor !== undefined && now >= successorAnchor
      ? head.level + 1
      : Math.min(head.level + 1, observedLevel);
  const headAge=Math.max(0,(now-Date.parse(head.timestamp))/1000);
  const headFresh=headAge<Math.max(15,(constants?.minimum??6)+headRound*(constants?.increment??0))*1.5;
  let observedInstance:{level:number;round:number}|undefined;
  if(headFresh) {
    const candidates=operations.flatMap(operation=>operation.contents).filter(content=>{
      if(!content.block_payload_hash || content.level<head.level||content.level>head.level+1)return false;
      const ceiling=content.level===head.level?headRound:constants&&successorAnchor!==undefined?
        (roundSchedule(successorAnchor,constants.minimum,constants.increment,now)?.round??-1)+1:0;
      return content.round<=ceiling && (content.level!==head.level||content.round>=headRound);
    }).sort((a,b)=>b.level-a.level||b.round-a.round);
    const latest=candidates[0];if(latest)observedInstance={level:latest.level,round:latest.round};
  } else if(constants&&successorAnchor!==undefined) {
    const scheduled=roundSchedule(successorAnchor,constants.minimum,constants.increment,now)?.round;
    if(scheduled!==undefined&&operations.some(operation=>operation.contents.some(content=>content.block_payload_hash&&content.level===head.level+1&&content.round===scheduled)))
      observedInstance={level:head.level+1,round:scheduled};
  }
  const proposal=view.latestProposal;
  const observedProposalRound=proposal?proposalRound(proposal.fitness,proposal.level):undefined;
  if(proposal && observedProposalRound!==undefined && proposal.payload_hash && proposal.level>=head.level && proposal.level<=head.level+1 && constants && now-Date.parse(proposal.timestamp)<Math.max(15,constants.minimum+observedProposalRound*constants.increment)*1500 &&
    (!observedInstance||proposal.level>observedInstance.level||(proposal.level===observedInstance.level&&observedProposalRound>observedInstance.round))) {
    observedInstance={level:proposal.level,round:observedProposalRound};
  }
  if(sourceTarget){observedInstance={level:sourceTarget.target.level,round:sourceTarget.target.round};}
  if(observedInstance)consensusLevel=observedInstance.level;
  const retainedCandidates=[...view.candidates,...view.unresolvedCandidates];
  const selectedCandidate = retainedCandidates.find(candidate => candidate.identity === runtime.selectedIdentity && candidate.header.level >= head.level && candidate.header.level <= head.level + 1);
  const selectedCandidateRound=selectedCandidate?proposalRound(selectedCandidate.header.fitness,selectedCandidate.header.level):undefined;
  if (selectedCandidate && selectedCandidateRound!==undefined) {
    consensusLevel = selectedCandidate.header.level;
    observedInstance = {level: consensusLevel,round:selectedCandidateRound};
  }
  if(derived?.constantsByLevel)constants=derived.constantsByLevel.get(consensusLevel)??null;
  const targetContext=derived?.contexts?.get(consensusLevel);
  const receivedRights = targetContext&&runtime.monitor.contextAuthorized(targetContext)?derived?.rights.get(consensusLevel):undefined;
  const authority = committeeAuthority(receivedRights ?? [],constants?.committee,constants?.quorum);
  const rights = authority.usable && constants ? receivedRights : undefined;
  const groups = groupsFor(operations,rights ?? [],consensusLevel);
  const base = consensusLevel === head.level + 1 ? head : derived?.predecessor;
  const baseRound=base?proposalRound(base.fitness,base.level):undefined;
  const schedule =
    consensusLevel === head.level && successorAnchor !== undefined
      ? {
          round: headRound,
          startedAt: Date.parse(head.timestamp),
          endsAt: successorAnchor,
        }
      : constants && base && baseRound!==undefined
        ? roundSchedule(
            Date.parse(base.timestamp) +
              (constants.minimum +
                baseRound * constants.increment) *
                1000,
            constants.minimum,
            constants.increment,
            now,
          )
        : undefined;
  const currentRound = observedInstance?.round ?? (schedule
    ? Math.max(schedule.round, consensusLevel === head.level ? headRound : 0)
    : undefined);
  const power = (signers: Set<string>): number => signerPower(signers,rights ?? []) ?? 0;
  const currentGroups = groups.filter((group) => group.round === currentRound);
  currentGroups.sort(
    (a, b) =>
      b.round - a.round ||
      power(b.pre) + power(b.att) - power(a.pre) - power(a.att) ||
      a.payload.localeCompare(b.payload),
  );
  const groupIdentity = (group: typeof groups[number]): string => JSON.stringify([group.contextKey,group.level,group.round,group.payload]);
  const matchingCandidates = retainedCandidates.filter(candidate => candidate.header.level === consensusLevel && proposalRound(candidate.header.fitness,candidate.header.level) === currentRound);
  const selected = selectedCandidate
    ? currentGroups.find(group => group.payload === selectedCandidate.header.payload_hash && (!group.evidence || group.evidence.source.baseUrl === selectedCandidate.evidence.source.baseUrl))
    : sourceTarget?currentGroups.find(group=>group.payload===sourceTarget.target.payload && group.evidence?.source.baseUrl===sourceTarget.target.source.baseUrl)
    : currentGroups.find(group => groupIdentity(group) === runtime.selectedIdentity) ?? currentGroups[0];
  const activeCandidate = sourceTarget?sourceTarget.target.candidate:selectedCandidate ?? matchingCandidates.find(candidate => candidate.header.payload_hash === selected?.payload && candidate.evidence.source.baseUrl === selected?.evidence?.source.baseUrl);
  const chosenIdentity = sourceTarget?.identity??activeCandidate?.identity ?? (selected ? groupIdentity(selected) : undefined);
  const selectable=supportedChoices(view.observationTargets,targetContext&&runtime.monitor.contextAuthorized(targetContext)?targetContext:undefined,consensusLevel,currentRound,chosenIdentity);
  const selectedEvidence = sourceTarget?.evidence??activeCandidate?.evidence??selected?.evidence;
  const sharedPayload = activeCandidate && matchingCandidates.filter(candidate => candidate.header.payload_hash === activeCandidate.header.payload_hash && candidate.evidence.source.baseUrl === activeCandidate.evidence.source.baseUrl).length > 1;
  const candidateEvidence = `${sourceTarget&&!admitted?`Unresolved${sourceTarget.contextInvalid?" · context invalid":""}${sourceTarget.error?` · ${sourceTarget.error}`:""} · level ${sourceTarget.target.level} · round ${sourceTarget.target.round} · payload ${sourceTarget.target.payload} · `:""}${activeCandidate ? `Observed block hash ${activeCandidate.header.hash}` : 'Candidate hash unavailable'} · Producer unknown${sharedPayload ? ' · Shared payload evidence; signatures are not candidate-specific' : ''}${selected?.conflicts.length ? ` · Conflicting payload signer(s): ${selected.conflicts.join(', ')}` : ''}${selected?.unknownSlots.length ? ` · Unknown-rights signer slots: ${selected.unknownSlots.join(', ')}` : ''}${selectedEvidence ? ` · Source ${selectedEvidence.source.baseUrl} · requested head ${selectedEvidence.requestedHeadHash ?? 'unknown'} · observed head ${selectedEvidence.observedHeadHash ?? 'unknown'} · parent ${selectedEvidence.predecessor ?? 'unknown'} · chain ${selectedEvidence.chainId ?? 'unknown'} · protocol-level counter ${selectedEvidence.protocolLevel ?? 'unknown'} · received ${new Date(selectedEvidence.receivedAt).toISOString()} · age ${Math.max(0,Math.floor((performance.now()-selectedEvidence.receivedMonotonic)/1000))}s` : ' · Source/context unavailable'}${authority.usable ? '' : ` · Numerical authority unavailable: ${authority.reason}`}`;
  const sourceFacts=sourceTarget?.sourceContext?.context,sourceHead=sourceTarget?runtime.monitor.observedHead(sourceTarget.target.source):undefined;
  const identityEvidence=view.networkIdentity?`Expected network chain ${view.networkIdentity.chainId} · identity source ${view.networkIdentity.source.baseUrl} · proven head ${view.networkIdentity.header.hash}`:"Expected network identity unavailable";
  const contextEvidence=(rights&&targetContext?`Rights responder ${rights[0]?.evidence?.source.baseUrl??"unknown"} · authority observer ${targetContext.observer.source.baseUrl} · chain ${targetContext.observer.chainId} · context head ${targetContext.observer.header.hash} · requested anchor ${targetContext.anchor.header.hash} · target ${targetContext.level} · execution protocol ${targetContext.protocolHash} · rights received ${rights[0]?.evidence?new Date(rights[0].evidence.receivedAt).toISOString():"unknown"}`:sourceFacts?`Source-local proof · observer ${sourceFacts.observer.source.baseUrl} · chain ${sourceFacts.observer.chainId} · context head ${sourceFacts.observer.header.hash} · requested anchor ${sourceFacts.anchor.header.hash} · execution protocol ${sourceFacts.protocolHash} · numerical authority unavailable`:"Rights context unavailable")+` · ${identityEvidence}${sourceHead?` · Source-local observed head ${sourceHead.hash} · observed chain ${sourceHead.chainId??"unknown"}`:""}`;
  const activityRound = currentRound;
  const hasObservation = selected!==undefined && targetContext!==undefined && observationContextCompatible(selected.evidence,targetContext,selected.admission) && observedInstance!==undefined &&
    view.lastOperationAt !== null &&
    ((!collectionAllowed()) || (view.operationStream.mode === "stream" &&
      selected.evidence?.source.baseUrl===view.operationStream.source?.baseUrl && selected.evidence?.source.network===view.operationStream.source?.network) ||
      (snapshot!==null && snapshot!==undefined && view.operationGeneration === snapshot.generation &&
        schedule !== undefined &&
        view.lastOperationAt >= schedule.startedAt));
  const coverage=sourceTarget?.coverage;
  const phaseCoverage=(phase:"pre"|"att"):boolean=>coverage!==undefined && pendingPhaseComplete(coverage,phase) && sourceTarget?.coverageStale!==true && sourceTarget?.contextInvalid!==true && targetContext!==undefined && runtime.monitor.contextAuthorized(targetContext);
  const preCoverage=phaseCoverage("pre"),attCoverage=phaseCoverage("att"),hasCoverage=preCoverage||attCoverage;
  const total = rights && authority.usable ? authority.total : undefined;
  const pre = selected?.pre ?? new Set<string>(),
    att = selected?.att ?? new Set<string>();
  const delegateView = (right: DelegateRight): DelegateView => {
    const alias = runtime.data.alias(right.address),
      eligibilityEvidence=runtime.data.eligibilityStatus(right.address),
      forbidden = eligibilityEvidence.value;
    return {
      address: right.address,
      power: right.power,
      ...(eligibilityEvidence.contextInvalid?{eligibilityState:"context-invalid" as const}:eligibilityEvidence.stale?{eligibilityState:"stale" as const}:{}),
      ...(eligibilityEvidence.evidence?{eligibilityNote:`Source ${eligibilityEvidence.evidence.source.baseUrl} · requested head ${eligibilityEvidence.evidence.requestedHeadHash??"unknown"} · context head ${eligibilityEvidence.evidence.contextHeadHash??"unknown"} · chain ${eligibilityEvidence.evidence.chainId??"unknown"} · protocol ${eligibilityEvidence.evidence.protocolHash??"unknown"} · received ${new Date(eligibilityEvidence.evidence.receivedAt).toISOString()} · age ${Math.floor((eligibilityEvidence.ageMs??0)/1000)}s · retained fact ${eligibilityEvidence.rawValue?"forbidden":"eligible"}`} : {}),
      ...(alias ? { alias: `${alias} · TzKT`,searchAlias:alias } : {}),
      eligibility:
        forbidden === undefined
          ? "unavailable"
          : forbidden
            ? "forbidden"
            : "eligible",
    };
  };
  const degraded = view.headStream.error !== null;
  const paused = !collectionAllowed()||!runtime.collectionActive;
  const predictionElapsed=!paused&&runtime.opportunityFacts?.some(fact=>fact.timing.state==='known'&&fact.timing.basis==='observed-selected'&&appliedHead!==undefined&&headFactsKey(fact.timing.reference)===headFactsKey(appliedHead)&&fact.timing.parameters.context.observer.header.hash===appliedHead.hash&&Math.max(0,performance.now()-fact.capturedMonotonic)>=fact.timing.remainingAtCapture);
  const model: NetworkViewModel = {
    status: degraded ? "degraded" : predictionElapsed?"stalled":appliedHead!==undefined && view.progression?.to.header.hash===appliedHead.hash && view.progression.to.source.baseUrl===appliedHead.evidence?.source.baseUrl && ["next-level","same-level-round","skipped-levels"].includes(view.progression.kind)?"healthy":"unknown",
    candidates: selectable,
    session:sessionModel(runtime),
    ...(chosenIdentity ? {selectedIdentity:chosenIdentity} : {}),
    candidateEvidence,
    ...(sourceTarget&&(sourceTarget.error || sourceTarget.coverageStale)?{retryIdentity:sourceTarget.identity,canRetry:collectionAllowed()}:{}),
    contextEvidence,
    level: consensusLevel,
    consensusLevel,
    ...(currentRound === undefined ? {} : { round: currentRound }),
    ...(appliedHead?{appliedLevel:appliedHead.level,...(appliedRound===undefined?{}:{appliedRound}),hash:appliedHead.hash,blockTimestamp:Date.parse(appliedHead.timestamp),...(appliedHead.evidence?{observedMonotonic:appliedHead.evidence.receivedMonotonic}:{})}:{}),
    ...((selectedEvidence??appliedHead?.evidence)?{snapshotMonotonic:(selectedEvidence??appliedHead?.evidence)!.receivedMonotonic}:{}),
    ...(view.headObservedAt === null
      ? {}
      : { observedAt: view.headObservedAt }),
    ...(view.lastOperationAt === null
      ? {}
      : { lastOperationAt: view.lastOperationAt }),
    ...(activityRound === undefined ? {} : { activityRound }),
    roundSource: observedInstance ? "observed" : "schedule",
    ...(proposal && observedProposalRound!==undefined?{observedProposal:{level:proposal.level,round:observedProposalRound,...(proposal.payload_hash?{payload:proposal.payload_hash}:{})}}:{}),
    ...(selected
      ? { payload: selected.payload }
      : observedInstance && proposal?.payload_hash && proposal.level===consensusLevel && proposalRound(proposal.fitness,proposal.level)===currentRound
        ? { payload: proposal.payload_hash }
        : consensusLevel === head.level &&
          currentRound === headRound &&
          head.payload_hash
        ? { payload: head.payload_hash }
        : {}),
    source: head.evidence?.source.name ?? view.headStream.source?.name ?? runtime.data.source.name,
    connection: paused
      ? "Paused"
      : view.headStream.mode === "fallback"
        ? "Heads polling (15s) · reduced coverage"
        : view.operationMode === "fallback"
          ? runtime.network==="mainnet"?"Heads stream · source-local snapshots (proven heads / 6s) · raw stream separate":"Heads stream · operations polling (30s)"
          : view.headStream.mode === "stream"
            ? "Live RPC streams"
            : "Reconnecting",
    note: paused
      ? `Monitoring paused. Values below are retained observations.${coverage?` Retained source snapshot stale · source ${coverage.evidence.source.baseUrl} · original received ${new Date(coverage.evidence.receivedAt).toISOString()}.`:""}`
      : `${hasObservation||hasCoverage ? `Observed votes · level ${consensusLevel.toLocaleString("en-US")} · round ${currentRound ?? "unavailable"}` : `Matching votes unavailable${schedule ? ` · scheduled level ${consensusLevel.toLocaleString("en-US")} · estimated round ${schedule.round}` : ""}`}${currentGroups.length > 1 ? ` · ${currentGroups.length} competing payloads; selected payload shown` : ""}${groups.some((group) => group.round !== currentRound) ? " · older/future-round votes excluded" : ""}. ${hasCoverage?`Source-snapshot measured zero only for independently complete phases (${[preCoverage?"preattestation":undefined,attCoverage?"attestation":undefined].filter(Boolean).join(", ")}) without received votes · source ${coverage?.evidence.source.baseUrl} · snapshot received ${coverage?new Date(coverage.evidence.receivedAt).toISOString():"unknown"} · no global completeness claim. `:hasObservation?`Source ${selectedEvidence?.source.baseUrl??"unknown"} · partial positive observations; absent phase evidence is unproven. `:""}${coverage&&sourceTarget?.coverageStale?`Retained source snapshot stale · original received ${new Date(coverage.evidence.receivedAt).toISOString()}. `:""}`,
    ...(runtime.opportunityFacts?{opportunityFacts:runtime.opportunityFacts}:{}),
    sources: [
      {
        name: "Heads",
        url: view.headStream.source?.baseUrl ?? "",
        status: paused ? "Paused" : view.headStream.mode,
        detail: `${view.headStream.metrics.messages} messages · ${view.headStream.metrics.reconnects} reconnects${view.headStream.error ? ` · ${view.headStream.error}` : ""}`,
      },
      {
        name: "Consensus operations",
        url: view.operationStream.source?.baseUrl ?? "mempool",
        status: view.operationMode,
        detail: `${view.operationStream.metrics.messages} batches · ${view.fallbackRequests} fallback reads${view.operationStream.error ? ` · ${view.operationStream.error}` : ""}`,
      },
      {
        name: "Validated proposals",
        url: view.proposalStream.source?.baseUrl??"proposals",
        status: view.proposalStream.mode,
        detail: `${view.proposalStream.metrics.messages} messages${view.proposalStream.error?` · ${view.proposalStream.error}`:""}`,
      },
      {
        name: "Auxiliary RPC reads",
        url: runtime.data.source.baseUrl,
        status: `${runtime.data.requests} requests`,
        detail:
          derived?.errors.join("; ") ||
          "Committee authority requires exact source, chain, head, parent, target level and protocol context",
      },
    ],
  };
  const observedRecord=retainedTargets.find(record=>record.identity===chosenIdentity);
  if(observedRecord)model.observation=navigatorObservation(observedRecord);
  // Capture compact, already-qualified local alternatives before their authority expires.
  // Historical backgrounds keep the peak power/denominator/threshold as one fact.
  model.pathObservations=view.observationTargets.flatMap(record=>{
    const admission=record.admission;
    if(!admission||record.contextInvalid||!runtime.monitor.contextAuthorized(admission.context)||!record.target.candidate&&!record.target.payload)return [];
    const pre=record.phases?.pre,att=record.phases?.att;
    return [{anchor:navigatorObservation(record),...(pre?{pre:{power:pre.maximumPower,total:pre.maximumTotal,threshold:pre.maximumThreshold}}:{}),...(att?{att:{power:att.maximumPower,total:att.maximumTotal,threshold:att.maximumThreshold}}:{})}];
  });
  model.events=capturedEvents(runtime);
  if(rights)model.committee=rights.map(right=>({...delegateView(right),preReceipt:pre.has(right.address)?"Received":preCoverage?"Absent in selected source snapshot":"Partial / unavailable",attReceipt:att.has(right.address)?"Received":attCoverage?"Absent in selected source snapshot":"Partial / unavailable",contextNote:targetContext?`Source ${targetContext.observer.source.baseUrl} (observer) · rights responder ${right.evidence?.source.baseUrl??"unknown"} · chain ${targetContext.observer.chainId} · head ${targetContext.observer.header.hash} · target ${targetContext.level} · protocol ${targetContext.protocolHash}`:"Context unavailable"}));
  const knownSlots=new Set(rights?.map(right=>right.slot)??[]);
  model.unknownConsensus=operations.flatMap(operation=>operation.contents.filter(content=>content.level===consensusLevel && content.round===currentRound && (!selected?.payload||content.block_payload_hash===selected.payload) && !knownSlots.has(content.slot)).map(content=>`slot ${content.slot} · operation ${operation.hash} · source ${operation.evidence?.source.baseUrl??"unknown"} · level ${content.level} · round ${content.round} · payload ${content.block_payload_hash??"unknown"} · unknown power`)).slice(0,10000);
  const progress=view.progression;
  model.note+=progress?` Last source transition: ${progress.kind==="next-level"?"Observed next-level advance":progress.kind==="same-level-round"?"Observed same-level round advance":progress.kind==="same-height-reorg"?"Observed same-height reorg":progress.kind==="skipped-levels"?"Skipped delivered levels; intermediate path unobserved":"Observed head change; ancestry unavailable"} · source ${progress.evidence.source.baseUrl} · ${progress.from.header.hash} → ${progress.to.header.hash} · received ${new Date(progress.evidence.receivedAt).toISOString()}.`:" Source progress unknown.";
  const liveUnavailable=runtime.followLiveSelection&&!view.inspection.snapshot?" Live unavailable: no coherent current selection.":"";
  model.note+=liveUnavailable;
  if(view.crossingHistoryPartial)model.note+=" Crossing history partial after bounded fact retirement; uncertain histories cannot emit a new crossing.";
  if (degraded)
    model.error = `Heads connection interrupted: ${view.headStream.error}. Retaining the last coherent observation.${liveUnavailable}`;
  if (authority.usable && constants) model.quorum = authority.threshold;
  if (total !== undefined){model.committeePower = total;model.committeeTotal=total;}
  if (
    rights &&
    total !== undefined &&
    (hasObservation||hasCoverage) &&
    currentRound !== undefined
  ) {
    if (pre.size > 0 || preCoverage) model.preattestations = {
      count: pre.size,
      expected: rights.length,
      power: power(pre),
      proof:phaseProof(pre.size?selected?.preEvidence:coverage?.evidence,targetContext,rights,preCoverage),
      total,
    };
    if (att.size > 0 || attCoverage) model.attestations = {
      count: att.size,
      expected: rights.length,
      power: power(att),
      proof:phaseProof(att.size?selected?.attEvidence:coverage?.evidence,targetContext,rights,attCoverage),
      total,
    };
    if(preCoverage)model.missingPre = rights
      .filter((r) => !pre.has(r.address))
      .map(delegateView);
    if(attCoverage)model.missingAtt = rights
      .filter((r) => !att.has(r.address))
      .map(delegateView);
  }
  applyIndependentClock(runtime,model);
  if(!paused&&root.dataset.selected===runtime.network)void loadOpportunities(runtime);
  model.recentConsensus=capturedRecent(runtime);
  model.comparison=comparisonModel(runtime);
  Object.assign(model,observationMeaning(view,model.observation));applyProducer(runtime,model);updateDashboard(runtime, model);
}

function scheduleRender(runtime: Runtime): void {
  if (runtime.requestFrame !== null) return;
  runtime.requestFrame = requestAnimationFrame(() => {
    runtime.requestFrame = null;
    render(runtime);
  });
}

function opportunitySelection(runtime:Runtime){
 const view=runtime.view;if(!view||view.inspection.mode==='pin')return undefined;
 const identity=runtime.selectedIdentity??view.inspection.selectedIdentity;
 const record=view.observationTargets.find(value=>value.identity===identity);
 if(record?.contextInvalid||record&&!record.admission)return undefined;
 const head=record?.admission?.head??view.snapshot?.head;
 const reference=record?.target.candidate?.header??head;
 const requestHead=record?.target.candidate?Object.freeze({...record.target.candidate.header,evidence:record.target.candidate.evidence}):head;
 const context=record?.admission?.context??(head?view.snapshot?.derived?.contexts.get(head.level):undefined);
 const level=record?.target.level??head?.level,round=record?.target.round??(head?proposalRound(head.fitness,head.level):undefined);
 if(!head||!context||level===undefined||round===undefined||!runtime.monitor.contextAuthorized(context))return undefined;
 const token=record?runtime.monitor.opportunityToken(record.identity):undefined;
 const key=JSON.stringify([identity??head.hash,headFactsKey(head),reference?headFactsKey(reference):null,context.key,level,round,token??null]);
 return {key,head,requestHead:requestHead??head,reference,context,level,round,identity:record?.identity,token};
}
async function loadOpportunities(runtime:Runtime):Promise<void>{
 const selected=opportunitySelection(runtime);if(!selected||root.dataset.selected!==runtime.network||!collectionAllowed()||!runtime.collectionActive||selected.key===runtime.opportunityKey)return;
 runtime.opportunityController.abort();runtime.opportunityController=new AbortController();
 const signal=runtime.opportunityController.signal;runtime.opportunityKey=selected.key;delete runtime.opportunityFacts;
 const token=selected.token;
 const result=await Promise.all([0,1].map(async index=>{
   const level=selected.level+index,round=index===0?selected.round+1:0;
   // A parent context cannot prove the execution protocol two levels ahead.
   if(level>selected.requestHead.level+1)return {rights:undefined,parameters:undefined};
   const [rights,parameters]=await Promise.allSettled([runtime.data.bakers(selected.requestHead,level,round,signal),runtime.data.opportunityConstants(selected.requestHead,level,signal)]);
   return {rights:rights.status==='fulfilled'?rights.value:undefined,parameters:parameters.status==='fulfilled'?parameters.value:undefined};
 }));
 if(signal.aborted||root.dataset.selected!==runtime.network||!collectionAllowed()||!runtime.collectionActive||opportunitySelection(runtime)?.key!==selected.key)return;
 const capturedAt=Date.now(),capturedMonotonic=performance.now();
 const facts=result.map((value,index):OpportunityFact=>{
   const branch=index===0?'same-level':'next-level',right=value.rights?.[0],parameters=value.parameters;
   const reference=selected.reference??selected.head,referenceTimestamp=Date.parse(reference.timestamp),referenceRound=proposalRound(reference.fitness,reference.level);
   // Observed selected timestamps are authoritative; a synthetic future block is not.
   const observed=reference.level===selected.level&&referenceRound===selected.round;
   const migrationKnown=index===0||parameters?.context?.protocolHash===selected.context.protocolHash;
   const hypothetical=!observed&&index===0&&reference.level===selected.level-1&&referenceRound!==undefined&&selected.context.protocolHash===selected.context.observer.protocolHash;
   const deadline=parameters&&migrationKnown?(observed?conditionalRoundBoundary({referenceTimestamp,referenceRound:selected.round,branch,minimum:parameters.minimum,increment:parameters.increment,roundBasis:'proven'}):hypothetical?protocolRoundStart({referenceTimestamp,referenceRound:referenceRound!,targetRound:selected.round+1,minimum:parameters.minimum,increment:parameters.increment,roundBasis:'proven'}):undefined):undefined;
   return {branch,level:selected.level+index,round:index===0?selected.round+1:0,condition:index===0?'Conditional on continued same-level production':'Earliest protocol boundary conditional on hypothetical next-level production from selected predecessor',capturedAt,capturedMonotonic,
    proposer:right?.context&&right.evidence?{state:'known',right:{...right,context:right.context,evidence:right.evidence}}:{state:'unavailable',reason:'Exact branch baking rights unavailable'},
    timing:deadline!==undefined&&parameters?.context&&parameters.evidence?{state:'known',basis:observed?'observed-selected':'hypothetical-selected',parameters:{...parameters,context:parameters.context,evidence:parameters.evidence},reference,referenceTimestamp,referenceRound:observed?selected.round:referenceRound!,deadline,remainingAtCapture:Math.max(0,deadline-capturedAt)}:{state:'unavailable',reason:!observed?'Selected timestamp basis unavailable':!migrationKnown?'Target migration timing basis unavailable':'Exact execution timing parameters unavailable'}};
 }) as [OpportunityFact,OpportunityFact];
 const captured=captureOpportunityFacts(facts,selected.context,selected.level,selected.round,source=>streamSources[runtime.network].some(configured=>configured.baseUrl===source.baseUrl&&configured.network===source.network),selected.reference);
 if(!captured)return;
 if(selected.identity&&(!token||!runtime.monitor.captureOpportunities(selected.identity,token,captured)))return;
 runtime.opportunityFacts=captured;
 scheduleRender(runtime);
}

for (const network of ["mainnet", "shadownet"] as const) {
  const data = new NetworkData(network);
  let runtime: Runtime;
  const monitor = new NetworkMonitor<Derived>({
    network,
    headSources: streamSources[network],
    operationSources: rawStreamSources[network],
    sourceLocalOperationFallback:network==="mainnet",
    ...(network==="mainnet"?{fallbackIntervalMs:6_000}:{}),
    proposalSources:rawStreamSources[network],
    // Tap exact (source, error) pairs so a failing custom source gets an actionable diagnosis.
    streamFactory:reportingStreamFactory(network),
    derive: (head, signal) => data.derive(head, signal),
    reconcile:async(target,signal,onObservedHead)=>{
      const proof=await data.reconcile(target,signal,onObservedHead);
      let changed=false;
      try {
        const snapshot=await data.pending(signal,proof.head,proof.context,head=>{changed ||= headFactsKey(head)!==headFactsKey(proof.context.observer.header);onObservedHead(head);});
        if(changed)throw new Error("Observer changed during source snapshot");
        return {...proof,snapshot};
      }catch(error){if(changed || signal.aborted)throw error;return {...proof,snapshotError:String(error)};}
    },
    onCandidatesAdmitted:records=>runtime?.producers.admitted(records),
    fallbackOperations: async(head,signal,derived) => {
      if(network!=="mainnet")return data.pending(signal,head);
      if(!derived)throw new Error("Observer snapshot context not ready");
      const context=derived.contexts.get(head.level+1),rights=derived.rights.get(head.level+1),constants=derived.constantsByLevel.get(head.level+1);
      if(!context || !rights || !constants || context.observer.header.hash!==head.hash)throw new Error("Observer snapshot context not ready");
      const snapshot=await data.pending(signal,head,context);
      if(!snapshot.complete)throw new Error(snapshot.reasons.join("; "));
      return {kind:"source-snapshot" as const,admission:{head,derived,context,rights,constants,snapshot}};
    },
    fallbackHead: (signal) => data.head(signal),
    onUpdate(view) {
      if (!runtime) return;
      const destination=view.inspection.mode==='follow'?view.observationTargets.find(record=>record.identity===view.inspection.selectedIdentity&&record.admission&&!record.contextInvalid&&runtime.monitor.contextAuthorized(record.admission.context)):undefined;
      runtime.cameraReceipt=cameraReceipt(runtime.cameraReceipt,destination?.identity,view.emittedMonotonic);
      runtime.comparison.setRawCapacity(10000-view.rawOperations.length);
      runtime.view = view;runtime.producers.fence();
      const currentHead=view.snapshot?.head,expectedChain=view.networkIdentity?.chainId;
      const applied=currentHead&&expectedChain?[...(view.snapshot?.derived?.contexts.values()??[])].map(context=>context.observer).find(observer=>
        observer.chainId===expectedChain&&observer.source.network===network&&currentHead.evidence?.source.network===network&&observer.source.baseUrl===currentHead.evidence.source.baseUrl&&observedHeaderMatches(observer.header,currentHead)):undefined;
      if(applied){
        const header=applied.header,round=proposalRound(header.fitness,header.level);
        if(round!==undefined)runtime.intervals.appliedHead({key:JSON.stringify([applied.chainId,header.hash,header.level,header.predecessor,header.timestamp,round,applied.protocolHash]),source:applied.source.baseUrl,chain:applied.chainId,level:header.level,hash:header.hash,predecessor:header.predecessor});
      }
      fenceComparisonSelection(runtime);
      scheduleRender(runtime);
    },
  });
  runtime = {
    network,
    collectionActive:false,followLiveSelection:true,
    data,
    intervals:new BlockIntervals(network,()=>scheduleRender(runtime)),
    producers:new CandidateProducers({data,sources:streamSources[network].map(source=>source.baseUrl),epoch:record=>record.admission&&monitor.contextAuthorized(record.admission.context)?monitor.producerEpoch(record.identity):undefined,changed:(fact,epoch)=>{monitor.captureProducer(fact,epoch);scheduleRender(runtime);}}),
    comparison:new SourceComparison(network,streamSources[network],{rawCapacity:()=>10000-(runtime.view?.rawOperations.length??0),onChange:()=>{for(const value of runtimes.values())scheduleRender(value);}}),
    monitor,
    view: null,
    opportunityKey: "",
    opportunityController: new AbortController(),
    eligibilityHead: "",
    eligibilityLoading:false,
    eligibilityController:new AbortController(),
    requestFrame: null,
    cameraReceipt:undefined,
  };
  data.onChange=()=>scheduleRender(runtime);
  runtimes.set(network, runtime);
  dashboard.update(network, { status: "loading" });
  runtime.comparison.pause();data.pause();syncCollection(runtime);
}
document.addEventListener("visibilitychange", () => {
  for(const runtime of runtimes.values())syncCollection(runtime);
});
window.addEventListener("pagehide", () => {
  pageActive=false;for(const runtime of runtimes.values())syncCollection(runtime);
});
window.addEventListener("pageshow", () => {
  pageActive=true;for(const runtime of runtimes.values())syncCollection(runtime);
});
setInterval(() => {
  dashboard.tick();
  if (!document.hidden)
    for (const runtime of runtimes.values()) scheduleRender(runtime);
}, 1000);
