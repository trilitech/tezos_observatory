class PartialPhaseCoverageError extends Error {}

import {pendingPhaseComplete} from "../rpc/networkData";
import type {BlockProducerFact} from "../rpc/candidateProducer";
import {
  asBlockHeader,
  asOperationBatch,
  asValidatedProposal,
} from "../rpc/guards";
import { proposalRound,type OpportunityFact,type OpportunityCaptureToken } from "../consensus/roundSchedule";
import type {
  BlockHeader,
  CandidateObservation,
  ObservationEvidence,
  MonitorOperationBatch,
  NetworkName,
  RpcSource,
  StreamStatus,
  TransportMetrics,
} from "../rpc/models";
import {ObservationStore,type ContextAdmission,type ObservationTarget,type AcceptedEvent,type SessionSnapshot,type SessionInspection} from "./observationStore";
import {ObserverReconciliation,reconciliationKey,type ReconciliationTarget} from "./observerReconciliation";
import type {Constants,DelegateRight,TargetContext,RpcContext,PendingSnapshot} from "../rpc/networkData";
import {contextFacts} from '../consensus/phaseEvidence';
import { StreamTransport } from "../rpc/streamTransport";
import {
  HeadGeneration,
  commitIfCurrent,
  headFactsKey,
  type HeadSnapshot,
} from "./headGeneration";

export interface NetworkDerivedState {
  readonly refreshedAt: number;
  readonly contexts?:ReadonlyMap<number,TargetContext>;
  readonly rights?:ReadonlyMap<number,readonly DelegateRight[]>;
  readonly constantsByLevel?:ReadonlyMap<number,Constants>;
}
export interface ObservedProgress {
  readonly kind:"next-level"|"same-level-round"|"same-height-reorg"|"skipped-levels"|"head-change";
  readonly from:RpcContext;
  readonly to:RpcContext;
  readonly evidence:ObservationEvidence;
}

export interface NetworkMonitorView<T extends NetworkDerivedState> {
  /** UI delivery clock captured before view construction, not network evidence. */
  readonly emittedMonotonic:number;
  readonly network: NetworkName;
  readonly snapshot: HeadSnapshot<T> | null;
  readonly rawOperations: MonitorOperationBatch;
  readonly observationTargets: readonly ObservationTarget<T>[];
  readonly history:readonly SessionSnapshot<T>[];
  readonly inspection:SessionInspection<T>;
  readonly navigationUnits:readonly Readonly<{identity:string;sequence:number}>[];
  readonly unresolvedTargets: readonly ObservationTarget<T>[];
  readonly networkIdentity:RpcContext|null;
  readonly acceptedEvents:readonly AcceptedEvent[];
  readonly crossingHistoryPartial:boolean;
  readonly progression:ObservedProgress|null;
  readonly appliedProof?:Readonly<{context:RpcContext;evidence:ObservationEvidence}>|null;
  readonly headStream: StreamStatus;
  readonly operationStream: StreamStatus;
  readonly operationMode: "stream" | "fallback" | "paused";
  readonly fallbackRequests: number;
  readonly headObservedAt: number | null;
  readonly lastOperationAt: number | null;
  readonly operationGeneration: number | null;
  readonly latestProposal: BlockHeader | null;
  readonly candidates: readonly CandidateObservation[];
  readonly unresolvedCandidates: readonly CandidateObservation[];
  readonly proposalStream: StreamStatus;
}

export interface NetworkMonitorOptions<T extends NetworkDerivedState> {
  readonly network: NetworkName;
  readonly headSources: readonly RpcSource[];
  readonly operationSources: readonly RpcSource[];
  readonly proposalSources?: readonly RpcSource[];
  readonly derive: (head: BlockHeader, signal: AbortSignal) => Promise<T>;
  readonly reconcile?: (target:ReconciliationTarget,signal:AbortSignal,onObservedHead:(head:BlockHeader)=>void)=>Promise<ContextAdmission<T>>;
  readonly fallbackOperations: (
    head: BlockHeader,
    signal: AbortSignal,
    derived: T | null,
  ) => Promise<MonitorOperationBatch|{readonly kind:"source-snapshot";readonly admission:ContextAdmission<T>&{readonly snapshot:PendingSnapshot}}>;
  /** Keep coherent snapshots running when another observer supplies only raw streams. */
  readonly sourceLocalOperationFallback?: boolean;
  readonly onUpdate: (view: NetworkMonitorView<T>) => void;
  readonly onCandidatesAdmitted?:(records:readonly ObservationTarget<T>[])=>void;
  readonly reconciliationClock?:()=>number;
  readonly fallbackIntervalMs?: number;
  readonly fallbackHead?: (signal: AbortSignal) => Promise<BlockHeader>;
  readonly headFallbackIntervalMs?: number;
  readonly streamBootstrapTimeoutMs?: number;
  readonly streamFactory?: <V>(
    options: ConstructorParameters<typeof StreamTransport<V>>[0],
  ) => StreamTransport<V>;
}

const emptyMetrics = (): TransportMetrics => ({
  connects: 0,
  messages: 0,
  reconnects: 0,
  bytes: 0,
  lastLatencyMs: null,
});
const emptyStatus = (): StreamStatus => ({
  mode: "paused",
  source: null,
  error: null,
  metrics: emptyMetrics(),
});

export class NetworkMonitor<T extends NetworkDerivedState> {
  private readonly state = new HeadGeneration<T>();
  private readonly observations:ObservationStore<T>;
  private readonly reconcilers=new Map<string,ObserverReconciliation<ContextAdmission<T>>>();
  private provenHead:RpcContext|undefined;
  private appliedProof:Readonly<{context:RpcContext;evidence:ObservationEvidence}>|null=null;
  private progression:ObservedProgress|null=null;
  private readonly headTransport: StreamTransport<BlockHeader>;
  private readonly operationTransport: StreamTransport<MonitorOperationBatch> | null;
  private readonly proposalTransport: StreamTransport<BlockHeader> | null;
  private headStatus = emptyStatus();
  private operationStatus = emptyStatus();
  private proposalStatus = emptyStatus();
  private latestProposal: BlockHeader | null = null;
  private proposalStreaming = false;
  private operationMode: "stream" | "fallback" | "paused" = "paused";
  private fallbackTimer: number | null = null;
  private fallbackRunning = false;
  private fallbackAfterCurrent = false;
  private fallbackRequests = 0;
  private running = false;
  private headObservedAt: number | null = null;
  private lastOperationAt: number | null = null;
  private operationGeneration: number | null = null;
  private initialOperations: MonitorOperationBatch = [];
  private lifecycle = 0;
  private lifecycleController = new AbortController();
  private bootstrapTimer: number | null = null;
  private headFallbackTimer: number | null = null;
  private operationStreaming = false;
  private operationSource: RpcSource | null = null;
  private headStreaming = false;
  private headFallbackActive = false;
  private derivingGeneration: number | null = null;
  private readonly deferredReconciliations = new Set<string>();

  constructor(private readonly options: NetworkMonitorOptions<T>) {
    this.observations=new ObservationStore(options.network,[...options.headSources,...options.operationSources,...(options.proposalSources??[])]);
    const factory =
      options.streamFactory ?? ((settings) => new StreamTransport(settings));
    this.headTransport = factory({
      sources: options.headSources,
      path: "/monitor/heads/main",
      parse: asBlockHeader,
      onValue: (head, source) => {
        if (!this.running) return;
        this.headStreaming = true;
        this.headFallbackActive = false;
        this.clearHeadFallback();
        this.headStatus = { ...this.headStatus, mode: "stream", error: null };
        this.acceptHead({...head, evidence: this.receipt(source, head, true)});
      },
      onStatus: (source, error, metrics) => {
        if(error!==null && source)this.observations.interrupt(source);
        if (error !== null) {
          this.headStreaming = false;
          this.enableHeadFallback();
        }
        this.headStatus = {
          mode: this.running
            ? this.headStreaming
              ? "stream"
              : this.headFallbackActive
                ? "fallback"
                : "connecting"
            : "paused",
          source,
          error: error ?? (this.headStreaming ? null : this.headStatus.error),
          metrics,
        };
        this.emit();
      },
    });
    this.operationTransport =
      options.operationSources.length === 0
        ? null
        : factory({
            sources: options.operationSources,
            path: "/chains/main/mempool/monitor_operations?validated=true&version=1",
            reconnectOnEnd: true,
            parse: asOperationBatch,
            onValue: (batch, source) => {
              if (!this.running) return;
              this.operationStreaming = true;
              this.operationSource = source;
              if(this.needsOperationFallback())this.enableFallback();
              else {this.operationMode = "stream";this.clearOperationFallback();}
              this.operationStatus = {
                ...this.operationStatus,
                mode: "stream",
                error: null,
              };
              const evidence = this.receipt(source);
              this.acceptOperations(batch.map(operation => ({...operation, evidence})));
            },
            onStatus: (source, error, metrics) => {
              if (error !== null) {
                this.operationStreaming = false;
                if(source)this.observations.interrupt(source);
                this.enableFallback();
              }
              this.operationStatus = {
                mode: this.running
                  ? this.operationStreaming
                    ? "stream"
                    : "connecting"
                  : "paused",
                source,
                error:
                  error ??
                  (this.operationStreaming ? null : this.operationStatus.error),
                metrics,
              };
              this.emit();
            },
          });
    this.proposalTransport =
      (options.proposalSources?.length ?? 0) === 0
        ? null
        : factory({
            sources: options.proposalSources!,
            path: "/monitor/validated_blocks?chain=main",
            parse: asValidatedProposal,
            onValue: (proposal, source) => {
              if (!this.running) return;
              this.proposalStreaming = true;
              this.proposalStatus = {
                ...this.proposalStatus,
                mode: "stream",
                error: null,
              };
              this.acceptProposal(proposal, source);
            },
            onStatus: (source, error, metrics) => {
              if (error !== null) this.proposalStreaming = false;
              this.proposalStatus = {
                mode: this.running
                  ? this.proposalStreaming
                    ? "stream"
                    : "connecting"
                  : "paused",
                source,
                error:
                  error ??
                  (this.proposalStreaming ? null : this.proposalStatus.error),
                metrics,
              };
              this.emit();
            },
          });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.observations.start();
    for(const reconciler of this.reconcilers.values())reconciler.start();
    this.lifecycle += 1;
    this.lifecycleController = new AbortController();
    this.state.resumeWork();
    this.headStreaming = false;
    this.headFallbackActive = false;
    this.operationStreaming = false;
    this.operationSource = null;
    this.fallbackRunning = false;
    this.fallbackAfterCurrent = false;
    this.proposalStreaming = false;
    this.operationMode =
      this.operationTransport === null ? "fallback" : "stream";
    this.headTransport.start();
    this.operationTransport?.start();
    this.proposalTransport?.start();
    // A quiet monitor stream need not send an initial head. Bootstrap once by
    // RPC immediately; the first streamed head cancels this fallback loop.
    if (this.state.snapshot() === null) this.enableHeadFallback();
    if (this.operationTransport === null) this.enableFallback();
    this.bootstrapTimer = window.setTimeout(() => {
      this.bootstrapTimer = null;
      if (!this.headStreaming) this.enableHeadFallback();
      if (this.needsOperationFallback()) this.enableFallback();
    }, this.options.streamBootstrapTimeoutMs ?? 8_000);
    const snapshot = this.state.snapshot();
    if (snapshot !== null && snapshot.derived === null)
      this.deriveHead(snapshot.head, snapshot.generation);
    this.emit();
  }
  stop(): void {
    this.running = false;
    this.observations.stop();
    for(const reconciler of this.reconcilers.values())reconciler.stop();
    this.lifecycle += 1;
    this.lifecycleController.abort();
    this.state.cancelWork();
    this.derivingGeneration = null;
    this.deferredReconciliations.clear();
    this.headTransport.stop();
    this.operationTransport?.stop();
    this.proposalTransport?.stop();
    this.clearOperationFallback();
    this.clearHeadFallback();
    if (this.bootstrapTimer !== null) window.clearTimeout(this.bootstrapTimer);
    this.bootstrapTimer = null;
    this.operationMode = "paused";
    this.emit();
  }
  refresh(): void {
    this.stop();
    this.start();
    this.refreshDerived();
  }
  refreshDerived(): void {
    if (!this.running) return;
    const snapshot = this.state.snapshot();
    if (snapshot !== null) this.deriveHead(snapshot.head, snapshot.generation);
  }
  bindVisibility(
    documentLike: Pick<Document, "hidden" | "addEventListener"> = document,
  ): void {
    const update = () => {
      if (documentLike.hidden) this.stop();
      else this.start();
    };
    documentLike.addEventListener("visibilitychange", update);
    update();
  }

  private acceptHead(head: BlockHeader): void {
    if (!this.running) return;
    this.observations.observeHead(head);
    this.headObservedAt = Date.now();
    const generation = this.state.transition(head);
    if(this.options.sourceLocalOperationFallback){
      if(this.needsOperationFallback())this.operationMode="fallback";
      else {this.operationMode="stream";this.clearOperationFallback();}
    }
    const headRound=proposalRound(head.fitness,head.level);
    const previousProposalRound=this.latestProposal?proposalRound(this.latestProposal.fitness,this.latestProposal.level):undefined;
    if (
      this.latestProposal !== null &&
      (this.latestProposal.level < head.level ||
        (this.latestProposal.level === head.level &&
          previousProposalRound!==undefined && headRound!==undefined && previousProposalRound<headRound))
    ) {
      this.latestProposal = null;
    }
    if (this.initialOperations.length > 0) {
      this.state.addOperations(generation, this.initialOperations);
      this.initialOperations = [];
    }
    this.emit();
    if (this.state.snapshot()?.derived === null)
      this.deriveHead(head, generation);
  }
  private deriveHead(head: BlockHeader, generation: number): void {
    if (this.derivingGeneration === generation) return;
    this.derivingGeneration = generation;
    const lifecycle = this.lifecycle;
    const epochs=head.evidence?this.observations.generation(head.evidence.source):undefined;
    void commitIfCurrent(this.state, generation, (signal) =>
      this.options.derive(head, signal),
    )
      .then((committed) => {
        if (committed && this.running && lifecycle === this.lifecycle){
          const derived=this.state.snapshot()?.derived;
          for(const context of derived?.contexts?.values()??[])if(context.observer.header.hash===head.hash){
            if(this.observations.establishNetworkIdentity(context.observer))this.recordProvenProgress(context.observer,head.evidence);
          }
          for(const [level,context] of derived?.contexts??[]){
            const rights=derived?.rights?.get(level),constants=derived?.constantsByLevel?.get(level);
            if(!rights || !constants || !derived)continue;
            try{this.observations.accept({head,derived,context,rights,constants,...epochs});}catch{/* retain raw facts without contradictory authority */}
          }
          if(this.options.sourceLocalOperationFallback && this.needsOperationFallback())this.enableFallback(true);
          this.emit();this.options.onCandidatesAdmitted?.(this.observations.acceptedTargets());
        }
      })
      .catch(() => {
        if (this.running && lifecycle === this.lifecycle) this.emit();
      })
      .finally(() => {
        if (
          lifecycle === this.lifecycle &&
          this.derivingGeneration === generation
        ) {
          this.derivingGeneration = null;
          const deferred = [...this.deferredReconciliations];
          this.deferredReconciliations.clear();
          for (const identity of deferred) {
            const record = this.observations.target(identity);
            if (record) this.reconcileTarget(record);
          }
        }
      });
  }
  private recordProvenProgress(current:RpcContext,evidence:ObservationEvidence|undefined):void {
    if(!evidence || evidence.source.baseUrl!==current.source.baseUrl)return;
    const previous=this.provenHead;
    if(previous?.source.baseUrl===current.source.baseUrl && previous.chainId===current.chainId && previous.header.hash===current.header.hash)return;
    this.provenHead=current;
    this.appliedProof=Object.freeze({context:current,evidence});
    if(!previous || previous.source.baseUrl!==current.source.baseUrl || previous.chainId!==current.chainId)return;
    const from=previous.header,to=current.header,oldRound=proposalRound(from.fitness,from.level),round=proposalRound(to.fitness,to.level);
    const kind:ObservedProgress["kind"]=to.level===from.level+1 && to.predecessor===from.hash && previous.nextProtocolHash===current.protocolHash?"next-level"
      :to.level===from.level && to.predecessor===from.predecessor && previous.protocolHash===current.protocolHash && oldRound!==undefined && round!==undefined && round>oldRound?"same-level-round"
      :to.level===from.level?"same-height-reorg":to.level>from.level+1?"skipped-levels":"head-change";
    this.progression=Object.freeze({kind,from:previous,to:current,evidence});
  }
  private receipt(source: RpcSource, observed?: BlockHeader, appliedHead = false): ObservationEvidence {
    const current = this.observations.observerHead(source);
    // Streams request a chain-wide endpoint, never the currently rendered hash.
    // Context may be captured only from a head actually observed at this endpoint.
    const contextualHead = appliedHead ? observed : current?.evidence?.source.baseUrl === source.baseUrl ? current : undefined;
    return Object.freeze({
      source: Object.freeze({...source}),
      ...(observed?.chainId ? {chainId: observed.chainId} : {}),
      ...(observed ? {observedBlockHash:observed.hash} : {}),
      ...(contextualHead ? {observedHeadHash:contextualHead.hash,observedHeadLevel:contextualHead.level,predecessor:contextualHead.predecessor,...(contextualHead.proto === undefined ? {} : {protocolLevel:contextualHead.proto})} : {}),
      receivedAt: Date.now(), receivedMonotonic: performance.now(),
    });
  }

  private acceptProposal(proposal:BlockHeader,source:RpcSource):void {
    const identity=JSON.stringify([source.network,source.baseUrl,proposal.chainId??"unknown",proposal.hash]);
    if(this.observations.target(identity))return;
    const evidence=this.receipt(source,proposal);
    const candidate:CandidateObservation=Object.freeze({identity,header:Object.freeze({...proposal,evidence}),evidence});
    const record=this.observations.addCandidate(candidate);if(!record)return;
    this.latestProposal=candidate.header;
    this.reconcileTarget(record);
    this.emit();this.options.onCandidatesAdmitted?.(this.observations.acceptedTargets());
  }
  private acceptOperations(batch: MonitorOperationBatch): void {
    if (!this.running) return;
    const created=this.observations.addOperations(batch);
    for(const record of created)this.reconcileTarget(record);
    this.publishOperations();
  }
  private publishOperations():void {
    this.lastOperationAt = Date.now();
    const generation = this.state.currentGeneration();
    // One synchronous publication uses one captured operation buffer. Other
    // emissions still collect current facts independently.
    const operations=this.observations.rawOperations();
    if (generation === 0) {
      this.initialOperations = operations;
      this.emit(operations);
      return;
    }
    this.operationGeneration = generation;
    this.state.syncOperations(generation, operations);
    this.emit(operations);
  }
  reconcileObservation(identity:string):boolean {
    const record=this.observations.target(identity);return record?this.reconcileTarget(record,true):false;
  }
  opportunityToken(identity:string):OpportunityCaptureToken|undefined {return this.running?this.observations.opportunityToken(identity):undefined;}
  captureOpportunities(identity:string,token:OpportunityCaptureToken,facts:readonly [OpportunityFact,OpportunityFact]):boolean {
    if(!this.running)return false;
    const captured=this.observations.captureOpportunities(identity,token,facts);if(captured)this.emit();return captured;
  }
  pinObservation(identity:string):boolean {const pinned=this.observations.pin(identity);if(pinned)this.emit();return pinned;}
  followLive():void {this.observations.followLive();this.emit();}
  latestObservation():boolean {const selected=this.observations.latest();this.emit();return selected;}
  captureProducer(fact:BlockProducerFact,epoch:string):boolean {
    if(this.producerEpoch(fact.identity)!==epoch)return false;
    const token=this.opportunityToken(fact.identity);if(!token)return false;
    const captured=this.observations.captureProducer(fact.identity,token,fact);if(captured)this.emit();return captured;
  }
  producerEpoch(identity:string):string|undefined {
    const retained=this.observations.acceptedTargets().some(record=>record.identity===identity)||this.observations.history().some(snapshot=>snapshot.candidates.some(record=>record.identity===identity));
    const token=retained?this.opportunityToken(identity):undefined;return token?JSON.stringify(token):undefined;
  }
  contextAuthorized(context:TargetContext):boolean {return this.observations.contextAuthorized(context);}
  observedHead(source:RpcSource):BlockHeader|undefined {return this.observations.observerHead(source);}
  private currentTarget(record:ObservationTarget<T>):ReconciliationTarget {
    const head=this.observations.observerHead(record.target.source);
    return {...record.target,...this.observations.generation(record.target.source),...(head?{observerHead:head}:{})};
  }
  private reconcileTarget(record:ObservationTarget<T>,manual=false):boolean {
    if(!this.running || !this.options.reconcile)return false;
    const source=record.target.source;
    const snapshot=this.state.snapshot(),head=snapshot?.head,observer=head?.evidence?.source;
    if(!manual && snapshot && this.derivingGeneration===snapshot.generation && observer?.network===source.network && observer.baseUrl===source.baseUrl && (record.target.level===head?.level || record.target.level===(head?.level??-1)+1)){
      // Let this owner's proof finish before another owner requests the same
      // immutable helpers. Reconciliation still performs its own source proof.
      this.deferredReconciliations.add(record.identity);
      const retained=new Set([...this.observations.unresolvedTargets(),...this.observations.acceptedTargets()].map(value=>value.identity));
      for(const identity of this.deferredReconciliations)if(!retained.has(identity))this.deferredReconciliations.delete(identity);
      return true;
    }
    let reconciler=this.reconcilers.get(source.baseUrl);
    if(!reconciler){
      reconciler=new ObserverReconciliation(source,{
        ...(this.options.reconciliationClock?{now:this.options.reconciliationClock}:{}),
        run:async(target,signal)=>{
          let epoch=target.observerGeneration;
          const result=await this.options.reconcile!(target,signal,head=>{
            const current=this.observations.generation(source);
            if(!this.running || signal.aborted || epoch!==current.observerGeneration || target.collectionGeneration!==current.collectionGeneration)throw new Error("Obsolete observed-head response");
            this.observations.observeHead(head);
            const learned=this.observations.generation(source);epoch=learned.observerGeneration;
            reconciler!.observeOwnedContext(head,learned.observerGeneration,learned.collectionGeneration);this.emit();
          });
          return {...result,...(epoch===undefined?{}:{observerGeneration:epoch})};
        },
        retainedKeys:()=>new Set([...this.observations.unresolvedTargets(),...this.observations.acceptedTargets()].filter(value=>value.target.source.baseUrl===source.baseUrl).map(value=>reconciliationKey(this.currentTarget(value)))),
        onResult:(_target,value)=>{this.observations.accept(value);this.state.syncOperations(this.state.currentGeneration(),this.observations.rawOperations());this.emit();this.options.onCandidatesAdmitted?.(this.observations.acceptedTargets());if(value.snapshotError)throw new Error(value.snapshotError);if(value.snapshot?.complete===false){const message=value.snapshot.reasons.join("; ");if(pendingPhaseComplete(value.snapshot,"pre")||pendingPhaseComplete(value.snapshot,"att"))throw new PartialPhaseCoverageError(message);throw new Error(message);}},
        onError:(target,error)=>{for(const value of [...this.observations.unresolvedTargets(),...this.observations.acceptedTargets()])if(reconciliationKey(this.currentTarget(value))===reconciliationKey(target))this.observations.fail(value.identity,error,error instanceof PartialPhaseCoverageError?"preserve-received-phase":"invalidate");this.emit();},
      });this.reconcilers.set(source.baseUrl,reconciler);reconciler.start();
    }
    const target=this.currentTarget(record);
    return reconciler.request(target,manual);
  }

  private clearOperationFallback(): void {
    if (this.fallbackTimer !== null) window.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
    this.fallbackAfterCurrent = false;
  }
  private needsOperationFallback():boolean {
    if(!this.operationStreaming)return true;
    if(!this.options.sourceLocalOperationFallback)return false;
    const source=this.state.snapshot()?.head.evidence?.source;
    return !source || source.network!==this.operationSource?.network || source.baseUrl!==this.operationSource?.baseUrl;
  }
  private clearHeadFallback(): void {
    if (this.headFallbackTimer !== null)
      window.clearTimeout(this.headFallbackTimer);
    this.headFallbackTimer = null;
  }
  private enableFallback(immediate=false): void {
    if (!this.running) return;
    this.operationMode = "fallback";
    if(this.fallbackRunning){if(immediate)this.fallbackAfterCurrent=true;return;}
    if(this.fallbackTimer!==null){if(!immediate)return;window.clearTimeout(this.fallbackTimer);}
    const lifecycle = this.lifecycle;
    const run = async () => {
      this.fallbackTimer = null;
      if (
        !this.running ||
        lifecycle !== this.lifecycle ||
        !this.needsOperationFallback()
      )
        return;
      this.fallbackRunning = true;
      this.fallbackAfterCurrent = false;
      const snapshot = this.state.snapshot();
      if (snapshot !== null) {
        const source=snapshot.head.evidence?.source,epochs=source?this.observations.generation(source):undefined;
        this.fallbackRequests += 1;
        try {
          const batch = await this.options.fallbackOperations(
            snapshot.head,
            this.lifecycleController.signal,
            snapshot.derived,
          );
          if (
            this.running &&
            lifecycle === this.lifecycle &&
            this.needsOperationFallback() &&
            this.state.currentGeneration() === snapshot.generation
          ){
            if('kind' in batch){
              const value=batch.admission,expected=snapshot.derived?.contexts?.get(value.context.level),observer=value.context.observer.source;
              if(!source||!epochs||!snapshot.derived||value.derived!==snapshot.derived||value.rights!==snapshot.derived.rights?.get(value.context.level)||value.constants!==snapshot.derived.constantsByLevel?.get(value.context.level)||!expected||contextFacts(expected)!==contextFacts(value.context)||headFactsKey(value.head)!==headFactsKey(snapshot.head)||value.head.evidence?.source.baseUrl!==source.baseUrl||value.head.evidence?.source.network!==source.network||observer.network!==source.network||observer.baseUrl!==source.baseUrl||!value.snapshot.complete)throw new Error('Obsolete or incompatible fallback snapshot');
              this.observations.accept({...value,...epochs});this.publishOperations();this.options.onCandidatesAdmitted?.(this.observations.acceptedTargets());
            }else this.acceptOperations(batch);
          }
        } catch {
          /* retain last coherent snapshot */
        }
      }
      if(lifecycle!==this.lifecycle)return;
      this.fallbackRunning = false;
      if (
        this.running &&
        lifecycle === this.lifecycle &&
        this.needsOperationFallback()
      )
        this.fallbackTimer = window.setTimeout(() => {
          void run();
        }, this.fallbackAfterCurrent ? 0 : this.options.fallbackIntervalMs ?? 30_000);
    };
    this.fallbackTimer = window.setTimeout(() => {
      void run();
    }, 0);
  }
  private enableHeadFallback(): void {
    if (
      !this.running ||
      this.headFallbackTimer !== null ||
      this.options.fallbackHead === undefined
    )
      return;
    const lifecycle = this.lifecycle;
    const run = async () => {
      if (!this.running || lifecycle !== this.lifecycle || this.headStreaming)
        return;
      this.fallbackRequests += 1;
      try {
        const head = await this.options.fallbackHead!(
          this.lifecycleController.signal,
        );
        if (
          this.running &&
          lifecycle === this.lifecycle &&
          !this.headStreaming
        ) {
          this.headFallbackActive = true;
          this.headStatus = { ...this.headStatus, mode: "fallback" };
          this.acceptHead(head);
        }
      } catch {
        /* retain last coherent snapshot */
      }
      if (this.running && lifecycle === this.lifecycle && !this.headStreaming)
        this.headFallbackTimer = window.setTimeout(() => {
          void run();
        }, this.options.headFallbackIntervalMs ?? 15_000);
    };
    this.headFallbackTimer = window.setTimeout(() => {
      void run();
    }, 0);
  }
  private emit(operations?:MonitorOperationBatch): void {
    const emittedMonotonic=performance.now();
    this.options.onUpdate({
      emittedMonotonic,
      network: this.options.network,
      snapshot: this.state.snapshot(),
      acceptedEvents:this.observations.acceptedEvents(),
      crossingHistoryPartial:this.observations.crossingState().uncertain,
      progression:this.progression,
      appliedProof:this.appliedProof,
      rawOperations: operations??this.observations.rawOperations(),
      observationTargets:this.observations.acceptedTargets(),
      history:this.observations.history(),
      inspection:this.observations.inspection(),
      navigationUnits:this.observations.navigationUnits(),
      unresolvedTargets:this.observations.unresolvedTargets(),
      networkIdentity:this.observations.networkIdentity()??null,
      headStream: this.headStatus,
      operationStream: this.operationStatus,
      operationMode: this.operationMode,
      fallbackRequests: this.fallbackRequests,
      headObservedAt: this.headObservedAt,
      lastOperationAt: this.lastOperationAt,
      operationGeneration: this.operationGeneration,
      latestProposal: this.latestProposal,
      candidates:this.observations.acceptedTargets().flatMap(record=>record.target.candidate?[record.target.candidate]:[]),
      unresolvedCandidates:this.observations.unresolvedTargets().flatMap(record=>record.target.candidate?[record.target.candidate]:[]),
      proposalStream: this.proposalStatus,
    });
  }
}
