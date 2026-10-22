import {ObservationStore} from '../../src/monitor/observationStore';
import {NetworkData,sources,type Derived} from "../../src/rpc/networkData";
import {groupsFor,signerPower} from "../../src/consensus/phaseEvidence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NetworkMonitor,
  type NetworkDerivedState,
  type NetworkMonitorView,
} from "../../src/monitor/networkMonitor";
import type {
  BlockHeader,
  RpcSource,
  TransportMetrics,
} from "../../src/rpc/models";

const source: RpcSource = {
  network: "mainnet",
  name: "rpc",
  baseUrl: "https://rpc",
};
const metrics: TransportMetrics = {
  connects: 1,
  messages: 0,
  reconnects: 0,
  bytes: 0,
  lastLatencyMs: null,
};
class FakeTransport<T> {
  static instances: FakeTransport<unknown>[] = [];
  readonly settings: ConstructorParameters<
    typeof import("../../src/rpc/streamTransport").StreamTransport<T>
  >[0];
  constructor(
    settings: ConstructorParameters<
      typeof import("../../src/rpc/streamTransport").StreamTransport<T>
    >[0],
  ) {
    this.settings = settings;
    FakeTransport.instances.push(this as FakeTransport<unknown>);
  }
  start() {
    this.settings.onStatus(source, null, metrics);
  }
  stop() {
    this.settings.onStatus(null, null, metrics);
  }
  value(value: T,observer:RpcSource=source) {
    this.settings.onValue(value, observer, 0);
  }
}
const header = (level: number): BlockHeader => ({
  level,
  hash: `B${level}`,
  predecessor: `B${level - 1}`,
  timestamp: "2026-10-14T00:00:00Z",
  fitness: ["02",level.toString(16).padStart(8,"0"),"","ffffffff","00000000"],
});
beforeEach(() => {
  vi.stubGlobal("window", globalThis);
});

it("retains raw validated proposals independently of applied-head and round ceilings", () => {
  vi.useFakeTimers();
  const { monitor, heads, views } = setup({ proposalSources: [source] });
  const proposals = FakeTransport.instances[2] as FakeTransport<BlockHeader>;
  const proposal = (level: number, round: number): BlockHeader => ({
    ...header(level),
    hash: `B${level}r${round}`,
    fitness: [
      "02",
      level.toString(16).padStart(8,"0"),
      "",
      "ffffffff",
      round.toString(16).padStart(8, "0"),
    ],
  });
  expect(proposals.settings.path).toBe("/monitor/validated_blocks?chain=main");
  heads.value(header(10));
  proposals.value(proposal(11, 2));
  expect(views.at(-1)?.latestProposal?.hash).toBe("B11r2");
  expect(views.at(-1)?.snapshot?.head.level).toBe(10);
  proposals.value(proposal(11, 1));
  proposals.value(proposal(10, 4));
  expect(views.at(-1)?.latestProposal?.hash).toBe("B10r4");
  proposals.value(proposal(11, 3));
  expect(views.at(-1)?.latestProposal?.hash).toBe("B11r3");
  heads.value(header(12));
  expect(views.at(-1)?.latestProposal).toBeNull();
  proposals.value(proposal(11, 100));
  expect(views.at(-1)?.latestProposal?.hash).toBe("B11r100");
  proposals.settings.onStatus(source, "HTTP 401", metrics);
  expect(views.at(-1)?.proposalStream.error).toBe("HTTP 401");
  expect(views.at(-1)?.headStream.mode).toBe("stream");
  monitor.stop();
  proposals.value(proposal(13, 0));
  expect(views.at(-1)?.latestProposal?.hash).toBe("B11r100");
  expect(views.at(-1)?.proposalStream.mode).toBe("paused");
});

describe("NetworkMonitor", () => {
  it("aborts old derivation on streamed head transition and pauses while hidden", async () => {
    FakeTransport.instances = [];
    const views: NetworkMonitorView<NetworkDerivedState>[] = [];
    let finishOld: ((value: NetworkDerivedState) => void) | undefined;
    const derive = vi.fn((head: BlockHeader) =>
      head.level === 1
        ? new Promise<NetworkDerivedState>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve({ refreshedAt: 2 }),
    );
    const monitor = new NetworkMonitor({
      network: "mainnet",
      headSources: [source],
      operationSources: [source],
      derive,
      fallbackOperations: async () => [],
      onUpdate: (view) => views.push(view),
      streamFactory: (settings) => new FakeTransport(settings) as never,
    });
    const listeners: EventListener[] = [];
    const page = {
      hidden: false,
      addEventListener: (
        _name: string,
        listener: EventListenerOrEventListenerObject,
      ) => listeners.push(listener as EventListener),
    };
    monitor.bindVisibility(
      page as Pick<Document, "hidden" | "addEventListener">,
    );
    const heads = FakeTransport.instances[0] as FakeTransport<BlockHeader>;
    heads.value(header(1));
    heads.value(header(2));
    finishOld?.({ refreshedAt: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(views.at(-1)?.snapshot?.head.level).toBe(2);
    expect(views.at(-1)?.snapshot?.derived?.refreshedAt).toBe(2);
    Object.assign(page, { hidden: true });
    listeners[0]?.(new Event("visibilitychange"));
    expect(views.at(-1)?.operationMode).toBe("paused");
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("refreshes partial derived state at the same head without parallel derivations", async () => {
  vi.useFakeTimers();
  type Derived = NetworkDerivedState & { errors: string[] };
  let finish: (value: Derived) => void = () => undefined;
  const derive = vi
    .fn()
    .mockResolvedValueOnce({ refreshedAt: 1, errors: ["rights unavailable"] })
    .mockImplementationOnce(
      () =>
        new Promise<Derived>((resolve) => {
          finish = resolve;
        }),
    );
  const { monitor, heads, views } = setup({ derive });
  heads.value(header(10));
  await vi.advanceTimersByTimeAsync(0);
  monitor.refreshDerived();
  monitor.refreshDerived();
  expect(derive).toHaveBeenCalledTimes(2);
  finish({ refreshedAt: 2, errors: [] });
  await vi.advanceTimersByTimeAsync(0);
  expect(views.at(-1)?.snapshot?.derived?.refreshedAt).toBe(2);
  monitor.stop();
  monitor.refreshDerived();
  expect(derive).toHaveBeenCalledTimes(2);
});

it("keeps a failed head stream visible during RPC fallback and reconnect attempts", async () => {
  vi.useFakeTimers();
  const { monitor, heads, views } = setup({
    fallbackHead: async () => header(10),
  });
  heads.settings.onStatus(source, "stream blocked", metrics);
  await vi.advanceTimersByTimeAsync(1);
  expect(views.at(-1)?.headStream).toMatchObject({
    mode: "fallback",
    error: "stream blocked",
  });
  heads.settings.onStatus(source, null, metrics);
  expect(views.at(-1)?.headStream).toMatchObject({
    mode: "fallback",
    error: "stream blocked",
  });
  heads.value(header(10));
  expect(views.at(-1)?.headStream).toMatchObject({
    mode: "stream",
    error: null,
  });
  monitor.stop();
});

it.each(["stop", "transition"])(
  "rejects a late same-head retry after %s",
  async (action) => {
    vi.useFakeTimers();
    let finish: (value: NetworkDerivedState) => void = () => undefined;
    const derive = vi
      .fn()
      .mockResolvedValueOnce({ refreshedAt: 1 })
      .mockImplementationOnce(
        () =>
          new Promise<NetworkDerivedState>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue({ refreshedAt: 3 });
    const { monitor, heads, views } = setup({ derive });
    heads.value(header(10));
    await vi.advanceTimersByTimeAsync(0);
    monitor.refreshDerived();
    if (action === "stop") monitor.stop();
    else heads.value(header(11));
    finish({ refreshedAt: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(views.at(-1)?.snapshot?.derived?.refreshedAt).toBe(
      action === "stop" ? 1 : 3,
    );
    monitor.stop();
  },
);

function setup(
  overrides: Partial<
    ConstructorParameters<typeof NetworkMonitor<NetworkDerivedState>>[0]
  > = {},
) {
  FakeTransport.instances = [];
  const views: NetworkMonitorView<NetworkDerivedState>[] = [];
  const derive = vi.fn(async () => ({ refreshedAt: Date.now() }));
  const monitor = new NetworkMonitor({
    network: "mainnet",
    headSources: [source],
    operationSources: [source],
    derive,
    fallbackOperations: async () => [],
    onUpdate: (view) => views.push(view),
    streamFactory: (settings) => new FakeTransport(settings) as never,
    ...overrides,
  });
  monitor.start();
  return {
    monitor,
    views,
    derive,
    heads: FakeTransport.instances[0] as FakeTransport<BlockHeader>,
    operations: FakeTransport.instances[1] as FakeTransport<
      import("../../src/rpc/models").MonitorOperationBatch
    >,
  };
}

it("preserves votes delivered before the initial head and deduplicates repeated head derivation", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  const { monitor, views, derive, heads, operations } = setup();
  expect(views.at(-1)?.headObservedAt).toBeNull();
  expect(views.at(-1)?.lastOperationAt).toBeNull();
  operations.value([
    {
      hash: "early",
      contents: [{ kind: "attestation", level: 2, round: 0, slot: 0 }],
    },
  ]);
  heads.value(header(1));
  heads.value(header(1));
  expect(derive).toHaveBeenCalledTimes(1);
  expect(views.at(-1)?.snapshot?.operations.map((op) => op.hash)).toEqual([
    "early",
  ]);
  expect(views.at(-1)?.lastOperationAt).toBe(Date.now());
  heads.value(header(2));
  expect(views.at(-1)?.snapshot?.operations.map((op) => op.hash)).toEqual([
    "early",
  ]);
  monitor.stop();
});

it("bootstraps with head RPC when streams hang, and cancels fallback after stream recovery", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  const fallbackHead = vi.fn(async () => header(10));
  const fallbackOperations = vi.fn(async () => []);
  const { monitor, heads, operations, views } = setup({
    fallbackHead,
    fallbackOperations,
    streamBootstrapTimeoutMs: 100,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(fallbackHead).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(101);
  expect(fallbackHead).toHaveBeenCalledTimes(1);
  expect(views.at(-1)?.snapshot?.head.level).toBe(10);
  expect(views.at(-1)?.headStream.mode).toBe("fallback");
  const operationCalls = fallbackOperations.mock.calls.length;
  heads.value(header(11));
  operations.value([]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fallbackHead).toHaveBeenCalledTimes(1);
  expect(fallbackOperations).toHaveBeenCalledTimes(operationCalls);
  expect(views.at(-1)?.operationMode).toBe("stream");
  monitor.stop();
});

it('keeps source-local fallback running beside another observer raw stream until coherent stream recovery',async()=>{
 vi.useFakeTimers();
 const other={...source,name:'Raw observer',baseUrl:'https://raw'},fallbackOperations=vi.fn(async()=>[]);
 const {monitor,heads,operations,views}=setup({operationSources:[source,other],sourceLocalOperationFallback:true,fallbackIntervalMs:6000,fallbackOperations});
 heads.value(header(120));operations.value([{hash:'raw-only',contents:[{kind:'preattestation',level:121,round:0,slot:0,block_payload_hash:'P'}]}],other);
 await vi.advanceTimersByTimeAsync(0);
 expect(views.at(-1)?.operationMode).toBe('fallback');expect(views.at(-1)?.rawOperations[0]?.evidence?.source).toEqual(other);
 expect(fallbackOperations).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(6000);expect(fallbackOperations).toHaveBeenCalledTimes(2);
 operations.value([],source);expect(views.at(-1)?.operationMode).toBe('stream');
 await vi.advanceTimersByTimeAsync(12000);expect(fallbackOperations).toHaveBeenCalledTimes(2);
 heads.value(header(121),other);await vi.advanceTimersByTimeAsync(0);
 expect(views.at(-1)?.operationMode).toBe('fallback');expect(fallbackOperations).toHaveBeenCalledTimes(3);
 monitor.stop();await vi.advanceTimersByTimeAsync(12000);expect(fallbackOperations).toHaveBeenCalledTimes(3);
});

it('rejects obsolete source-local fallback completion after a head transition',async()=>{
 vi.useFakeTimers();let finish:(batch:import('../../src/rpc/models').MonitorOperationBatch)=>void=()=>undefined;
 const other={...source,baseUrl:'https://raw'},fallbackOperations=vi.fn(()=>new Promise<import('../../src/rpc/models').MonitorOperationBatch>(resolve=>{finish=resolve;}));
 const {monitor,heads,operations,views}=setup({operationSources:[other],sourceLocalOperationFallback:true,fallbackOperations});
 heads.value(header(120));operations.value([],other);await vi.advanceTimersByTimeAsync(0);
 expect(fallbackOperations).toHaveBeenCalledTimes(1);heads.value(header(121));
 finish([{hash:'old-snapshot',evidence:{source,receivedAt:1,receivedMonotonic:1},contents:[{kind:'preattestation',level:121,round:0,slot:0,block_payload_hash:'P'}]}]);
 await vi.advanceTimersByTimeAsync(0);expect(views.at(-1)?.rawOperations).toEqual([]);monitor.stop();
});

it('samples each proven head promptly without overlapping an older source-local snapshot',async()=>{
 vi.useFakeTimers();const releases:Array<()=>void>=[];let active=0,maximum=0;
 const other={...source,baseUrl:'https://raw'},fallbackOperations=vi.fn(()=>new Promise<import('../../src/rpc/models').MonitorOperationBatch>(resolve=>{
  active++;maximum=Math.max(maximum,active);releases.push(()=>{active--;resolve([]);});
 }));
 const {monitor,heads,operations}=setup({operationSources:[other],sourceLocalOperationFallback:true,fallbackIntervalMs:6000,fallbackOperations});
 heads.value(header(120));operations.value([],other);await vi.advanceTimersByTimeAsync(0);expect(fallbackOperations).toHaveBeenCalledTimes(1);
 heads.value(header(121));await vi.advanceTimersByTimeAsync(0);expect(fallbackOperations).toHaveBeenCalledTimes(1);
 releases[0]!();await vi.advanceTimersByTimeAsync(0);expect(fallbackOperations).toHaveBeenCalledTimes(2);expect(maximum).toBe(1);
 releases[1]!();await vi.advanceTimersByTimeAsync(0);
 heads.value(header(122));await vi.advanceTimersByTimeAsync(0);expect(fallbackOperations).toHaveBeenCalledTimes(3);expect(maximum).toBe(1);
 releases[2]!();await vi.advanceTimersByTimeAsync(0);monitor.stop();
});

it.each(['valid','head','source','pause','generation'] as const)('admits a completed fallback snapshot once and fences %s ownership',async mode=>{
 vi.useFakeTimers();FakeTransport.instances=[];
 const observer=sources.mainnet[0]!,raw={network:'mainnet' as const,name:'Raw',baseUrl:'https://rpc.tzkt.io/mainnet'},reads:string[]=[],views:NetworkMonitorView<Derived>[]=[];
 vi.stubGlobal('fetch',async(input:string|URL|Request)=>{const url=String(input);reads.push(url);
  if(url.endsWith('/header')){const hash=url.split('/blocks/')[1]?.split('/')[0],level=hash==='head'?100:Number(hash?.slice(1));return Response.json({...header(level),chain_id:'NetFixture'});}
  if(url.endsWith('/protocols'))return Response.json({protocol:'PFixture',next_protocol:'PFixture'});
  if(url.includes('pending_operations'))return Response.json({validated:[{hash:'snapshot-vote',contents:[{kind:'preattestation',level:101,round:0,slot:0,block_payload_hash:'P'}]}]});
  if(url.includes('attestation_rights'))return Response.json([{level:Number(new URL(url).searchParams.get('level')),delegates:[{delegate:'D',first_slot:0,attesting_power:5}]}]);
  return Response.json({minimal_block_delay:'6',delay_increment_per_round:'3',consensus_threshold_size:4,consensus_committee_size:5});
 });
 const data=new NetworkData('mainnet'),reconcile=vi.fn(async()=>{throw new Error('Completed snapshot must not be reread');});let completed=0;
 const monitor=new NetworkMonitor<Derived>({network:'mainnet',headSources:[observer],operationSources:[raw],sourceLocalOperationFallback:true,derive:(head,signal)=>data.derive(head,signal),reconcile,onUpdate:view=>views.push(view),streamFactory:settings=>new FakeTransport(settings) as never,
  fallbackOperations:async(head,signal,derived)=>{
   const context=derived?.contexts.get(101),rights=derived?.rights.get(101),constants=derived?.constantsByLevel.get(101);
   if(!derived||!context||!rights||!constants)throw new Error('Context not ready');
   if(completed++)return new Promise<never>(()=>undefined);
   const snapshot=await data.pending(signal,head,context);
   if(mode==='pause')monitor.stop();if(mode==='generation')(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(101),observer);
   return {kind:'source-snapshot' as const,admission:{head:mode==='head'?{...head,hash:'Other'}:head,derived,context:mode==='source'?{...context,observer:{...context.observer,source:raw}}:context,rights,constants,snapshot}};
  },
 });
 monitor.start();(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(100),observer);(FakeTransport.instances[1] as FakeTransport<import('../../src/rpc/models').MonitorOperationBatch>).value([],raw);
 await vi.advanceTimersByTimeAsync(0);
 expect(reconcile).not.toHaveBeenCalled();expect(reads.filter(url=>url.includes('pending_operations'))).toHaveLength(1);expect(reads.filter(url=>url.endsWith('/blocks/head/header'))).toHaveLength(2);
 const admitted=views.at(-1)?.observationTargets;
 if(mode==='valid'){expect(admitted).toHaveLength(1);expect(admitted?.[0]?.phases?.pre?.power).toBe(5);expect(admitted?.[0]?.coverage?.complete).toBe(true);}
 else expect(admitted).toEqual([]);
 monitor.stop();
});

it("retains state on refresh and ignores an obsolete fallback result", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  let finish: (head: BlockHeader) => void = () => undefined;
  const fallbackHead = vi.fn(
    () =>
      new Promise<BlockHeader>((resolve) => {
        finish = resolve;
      }),
  );
  const { monitor, heads, views } = setup({
    fallbackHead,
    streamBootstrapTimeoutMs: 100,
  });
  await vi.advanceTimersByTimeAsync(101);
  monitor.refresh();
  heads.value(header(20));
  finish(header(10));
  await Promise.resolve();
  await Promise.resolve();
  expect(views.at(-1)?.snapshot?.head.level).toBe(20);
  const observedAt = views.at(-1)?.headObservedAt;
  monitor.stop();
  heads.value(header(99));
  expect(views.at(-1)?.snapshot?.head.level).toBe(20);
  expect(views.at(-1)?.headObservedAt).toBe(observedAt);
});

it("retains distinct same-round candidate hashes and immutable first receipts", () => {
  vi.useFakeTimers();
  const {monitor,heads,views}=setup({proposalSources:[source]});
  heads.value(header(120));
  const proposals=FakeTransport.instances[2] as FakeTransport<BlockHeader>;
  const first={...header(121),hash:"H1",payload_hash:"P"};
  proposals.value(first);vi.advanceTimersByTime(1);proposals.value({...first,hash:"H2"});
  expect(views.at(-1)?.latestProposal?.hash).toBe("H2");
  const view=views.at(-1) as unknown as {unresolvedCandidates: readonly {header:BlockHeader;evidence:{receivedAt:number;source:RpcSource}}[]};
  expect(view.unresolvedCandidates.map(c=>c.header.hash)).toEqual(["H1","H2"]);
  const receipt=view.unresolvedCandidates[0]?.evidence.receivedAt;
  vi.advanceTimersByTime(1);proposals.value(first);
  const replay=views.at(-1) as unknown as typeof view;
  expect(replay.unresolvedCandidates).toHaveLength(2);expect(replay.unresolvedCandidates[0]?.evidence.receivedAt).toBe(receipt);
  expect(replay.unresolvedCandidates[0]?.evidence.source).toEqual(source);monitor.stop();
});

it("bounds unresolved candidates by first receipt without fabricating admission from primary height", () => {
  vi.useFakeTimers();
  const {monitor,heads,views}=setup({proposalSources:[source]});heads.value(header(120));
  const proposals=FakeTransport.instances[2] as FakeTransport<BlockHeader>;
  for (let index=0;index<101;index++) {proposals.value({...header(121),hash:`accepted-${String(index).padStart(3,"0")}`});vi.advanceTimersByTime(1);}
  for (let index=0;index<101;index++) {proposals.value({...header(1_000_000+index),hash:`unknown-${String(index).padStart(3,"0")}`});vi.advanceTimersByTime(1);}
  expect(views.at(-1)?.candidates).toHaveLength(0);expect(views.at(-1)?.unresolvedCandidates).toHaveLength(100);
  expect(views.at(-1)?.unresolvedCandidates.some(candidate=>candidate.header.hash==="unknown-000")).toBe(false);
  expect(views.at(-1)?.unresolvedCandidates.some(candidate=>candidate.header.hash==="unknown-100")).toBe(true);
  monitor.stop();
});

it("keeps unpinned A/B stream requested-head facts unknown and never borrows A head context for B",()=>{
 vi.useFakeTimers();
 const other={...source,name:"observer B",baseUrl:"https://observer-b"};
 const {monitor,heads,operations,views}=setup({proposalSources:[source,other],operationSources:[source,other]});
 heads.value(header(120));
 const headEvidence=views.at(-1)?.snapshot?.head.evidence;
 expect(headEvidence?.requestedHeadHash).toBeUndefined();
 expect(headEvidence?.observedHeadHash).toBe("B120");
 operations.settings.onValue([{hash:"B-vote",contents:[{kind:"preattestation",level:121,round:0,slot:0,block_payload_hash:"P"}]}],other,0);
 const voteEvidence=views.at(-1)?.snapshot?.operations[0]?.evidence;
 expect(voteEvidence?.requestedHeadHash).toBeUndefined();expect(voteEvidence?.observedHeadHash).toBeUndefined();
 expect(voteEvidence?.source.baseUrl).toBe(other.baseUrl);
 const proposals=FakeTransport.instances[2] as FakeTransport<BlockHeader>;
 proposals.settings.onValue({...header(121),hash:"B-proposal",chainId:"NetB",payload_hash:"P"},other,0);
 const candidate=views.at(-1)?.unresolvedCandidates[0];
 expect(candidate?.evidence.requestedHeadHash).toBeUndefined();expect(candidate?.evidence.observedHeadHash).toBeUndefined();
 expect(candidate?.header.predecessor).toBe("B120");
 monitor.stop();
});

it("retains ahead raw operations without letting another observer head count them",async()=>{
 vi.useFakeTimers();vi.stubGlobal("window",globalThis);
 const observerB={...source,name:"B",baseUrl:"https://B"};
 const {monitor,heads,operations,views}=setup({operationSources:[source,observerB]});heads.value(header(120));
 operations.value([{hash:"ahead-B",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"PB"}]}],observerB);
 expect(views.at(-1)?.snapshot?.head.level).toBe(120);
 expect(views.at(-1)?.snapshot?.operations).toHaveLength(0);
 expect(views.at(-1)?.rawOperations).toHaveLength(1);
 expect(views.at(-1)?.rawOperations[0]?.contents[0]?.level).toBe(123);
 monitor.stop();
});


it("starts source-local reconciliation for retained ahead votes without replacing applied A head", async()=>{
 vi.useFakeTimers();FakeTransport.instances=[];
 const b={...source,name:"B",baseUrl:"https://b"},views:NetworkMonitorView<NetworkDerivedState>[]=[];
 const reconcile=vi.fn().mockRejectedValue(new Error("Unavailable B proof"));
 const options={network:"mainnet" as const,headSources:[source],operationSources:[source,b],derive:async()=>({refreshedAt:1}),fallbackOperations:async()=>[],onUpdate:(view:NetworkMonitorView<NetworkDerivedState>)=>views.push(view),streamFactory:<T>(settings:ConstructorParameters<typeof import("../../src/rpc/streamTransport").StreamTransport<T>>[0])=>new FakeTransport(settings) as never,reconcile};
 const monitor=new NetworkMonitor(options);monitor.start();
 (FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(120));
 (FakeTransport.instances[1] as FakeTransport<import("../../src/rpc/models").MonitorOperationBatch>).value([{hash:"ahead",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"P"}]}],b);
 await vi.advanceTimersByTimeAsync(0);
 expect(reconcile).toHaveBeenCalledTimes(1);expect(reconcile.mock.calls[0]?.[0].source.baseUrl).toBe(b.baseUrl);
 expect(views.at(-1)?.snapshot?.head.level).toBe(120);expect(views.at(-1)?.rawOperations).toHaveLength(1);
 monitor.stop();
});


it.each([122,123])("promotes source B123 in the real monitor with B head %i while applied A120 stays independent",async(bLevel)=>{
 vi.useFakeTimers();FakeTransport.instances=[];const a=sources.mainnet[0]!,b=sources.mainnet[1]!,reads:string[]=[];
 vi.stubGlobal("fetch",async(input:string|URL|Request)=>{const url=String(input);reads.push(url);const level=Number(new URL(url).searchParams.get("level"));
 if(url.endsWith("/header")){const hash=url.split("/blocks/")[1]?.split("/")[0],n=hash==="head"?bLevel:Number(hash?.slice(1));return Response.json({...header(n),chain_id:"NetFixture"});}
 if(url.endsWith("/protocols"))return Response.json({protocol:"Protocol",next_protocol:"Protocol"});
 return Response.json(url.includes("attestation_rights")?[{level,delegates:[{delegate:"D1",first_slot:0,attesting_power:3},{delegate:"D2",first_slot:1,attesting_power:2}]}]:{minimal_block_delay:"6",delay_increment_per_round:"3",consensus_threshold_size:4,consensus_committee_size:5});});
 const data=new NetworkData("mainnet"),views:NetworkMonitorView<Derived>[]=[];
 const monitor=new NetworkMonitor<Derived>({network:"mainnet",headSources:[a],operationSources:[a,b],derive:async()=>({refreshedAt:1,rights:new Map(),contexts:new Map(),constantsByLevel:new Map(),constants:null,predecessor:null,errors:[]}),reconcile:(target,signal,onObservedHead)=>data.reconcile(target,signal,onObservedHead),fallbackOperations:async()=>[],onUpdate:view=>views.push(view),streamFactory:settings=>new FakeTransport(settings) as never});
 monitor.start();(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(120),a);
 (FakeTransport.instances[1] as FakeTransport<import("../../src/rpc/models").MonitorOperationBatch>).value([{hash:"B-vote",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"P"}]}],b);
 expect(views.at(-1)?.unresolvedTargets).toHaveLength(1);await vi.advanceTimersByTimeAsync(0);
 const view=views.at(-1),admission=view?.observationTargets[0]?.admission;expect(admission?.head.hash).toBe(`B${bLevel}`);
 expect(view?.snapshot?.head.level).toBe(120);expect(view?.unresolvedTargets).toHaveLength(0);expect(view?.rawOperations).toHaveLength(1);
 expect(view?.rawOperations[0]?.evidence?.observedHeadHash).toBeUndefined();expect(view?.rawOperations[0]?.admission?.headHash).toBe(`B${bLevel}`);
 expect(reads.length).toBeGreaterThan(0);expect(reads.every(url=>url.startsWith(b.baseUrl))).toBe(true);
 const rights=admission?.rights??[],group=groupsFor(view?.rawOperations??[],rights,123)[0];expect(signerPower(group?.pre??new Set(),rights)).toBe(3);
 (FakeTransport.instances[1] as FakeTransport<import("../../src/rpc/models").MonitorOperationBatch>).value([{hash:"B-vote",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"P"}]}],b);
 expect(views.at(-1)?.rawOperations).toHaveLength(1);expect(views.at(-1)?.rawOperations[0]?.evidence?.observedHeadHash).toBeUndefined();monitor.stop();
});


it("shares one unresolved bound between raw candidates and candidate-free targets",()=>{
 vi.useFakeTimers();const {monitor,heads,operations,views}=setup({proposalSources:[source]});heads.value(header(120));
 const proposals=FakeTransport.instances[2] as FakeTransport<BlockHeader>;
 for(let index=0;index<60;index++){proposals.value({...header(123),hash:`candidate-${index}`,payload_hash:`candidate-P${index}`});vi.advanceTimersByTime(1);}
 for(let index=0;index<60;index++){operations.value([{hash:`operation-${index}`,contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:`instance-P${index}`}]}]);vi.advanceTimersByTime(1);}
 expect(views.at(-1)?.unresolvedTargets).toHaveLength(100);
 expect(views.at(-1)?.unresolvedTargets.filter(value=>value.target.candidate)).toHaveLength(40);monitor.stop();
});


it("bounds actual canonical monitor raw storage at ten thousand operations",()=>{
 vi.useFakeTimers();const {monitor,heads,operations,views}=setup();heads.value(header(120));
 operations.value(Array.from({length:10001},(_,index)=>({hash:`raw-${String(index).padStart(5,"0")}`,contents:[{kind:"preattestation" as const,level:123,round:0,slot:0,block_payload_hash:"P"}]})));
 expect(views.at(-1)?.rawOperations).toHaveLength(10000);expect(views.at(-1)?.rawOperations.some(operation=>operation.hash==="raw-00000")).toBe(false);expect(views.at(-1)?.unresolvedTargets).toHaveLength(1);monitor.stop();
});


it("withholds B numerical authority when its actual chain contradicts proven network identity",async()=>{
 vi.useFakeTimers();FakeTransport.instances=[];const a={network:"mainnet" as const,name:"TzKT",baseUrl:"https://rpc.tzkt.io/mainnet"},b=sources.mainnet[0]!,views:NetworkMonitorView<Derived>[]=[];
 vi.stubGlobal("fetch",async(input:string|URL|Request)=>{const url=String(input),level=Number(new URL(url).searchParams.get("level"));
 if(url.endsWith("/header")){const hash=url.split("/blocks/")[1]?.split("/")[0],n=hash==="head"?122:Number(hash?.slice(1));return Response.json({...header(n),chain_id:url.startsWith(b.baseUrl)?"WrongChain":"NetFixture"});}
 if(url.endsWith("/protocols"))return Response.json({protocol:"Protocol",next_protocol:"Protocol"});
 return Response.json(url.includes("attestation_rights")?[{level,delegates:[{delegate:"D1",first_slot:0,attesting_power:3},{delegate:"D2",first_slot:1,attesting_power:2}]}]:{minimal_block_delay:"6",delay_increment_per_round:"3",consensus_threshold_size:4,consensus_committee_size:5});});
 const data=new NetworkData("mainnet"),monitor=new NetworkMonitor<Derived>({network:"mainnet",headSources:[a],operationSources:[a,b],derive:(head,signal)=>data.derive(head,signal),reconcile:(target,signal,onObservedHead)=>data.reconcile(target,signal,onObservedHead),fallbackOperations:async()=>[],onUpdate:view=>views.push(view),streamFactory:settings=>new FakeTransport(settings) as never});
 monitor.start();(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(120),a);await vi.advanceTimersByTimeAsync(0);
 (FakeTransport.instances[1] as FakeTransport<import("../../src/rpc/models").MonitorOperationBatch>).value([{hash:"wrong-network-B",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"P"}]}],b);await vi.advanceTimersByTimeAsync(0);
 expect(views.at(-1)?.observationTargets).toHaveLength(0);expect(views.at(-1)?.unresolvedTargets).toHaveLength(1);expect(views.at(-1)?.rawOperations[0]?.admission).toBeUndefined();monitor.stop();
});


it.each(["protocol-counter","timestamp","fitness","payload"])("invalidates actual monitor derivation when same-hash %s facts change",async(kind)=>{
 vi.useFakeTimers();const {monitor,heads,views}=setup();const old=header(120);heads.value(old);await vi.advanceTimersByTimeAsync(0);expect(views.at(-1)?.snapshot?.derived).not.toBeNull();
 const changed=kind==="protocol-counter"?{...old,proto:2}:kind==="timestamp"?{...old,timestamp:"2026-10-14T00:00:01Z"}:kind==="fitness"?{...old,fitness:[...old.fitness.slice(0,4),"00000001"]}:{...old,payload_hash:"ChangedPayload"};
 heads.value(changed);expect(views.at(-1)?.snapshot?.derived).toBeNull();expect(views.at(-1)?.snapshot?.head).toMatchObject(changed);monitor.stop();
});


it("withdraws B authority before replacement helpers finish after a newly observed B fork",async()=>{
 vi.useFakeTimers();FakeTransport.instances=[];const a=sources.mainnet[0]!,b=sources.mainnet[1]!,views:NetworkMonitorView<Derived>[]=[];let current=header(122),release:(value:Response)=>void=()=>undefined;
 vi.stubGlobal("fetch",async(input:string|URL|Request)=>{const url=String(input),level=Number(new URL(url).searchParams.get("level"));
 if(url.endsWith("/header")){const hash=url.split("/blocks/")[1]?.split("/")[0],observed=hash==="head"||hash===current.hash?current:hash===current.predecessor?{...header(121),hash:current.predecessor}:header(Number(hash?.slice(1)));return Response.json({...observed,chain_id:"NetFixture"});}
 if(url.endsWith("/protocols"))return Response.json({protocol:"Protocol",next_protocol:"Protocol"});
 if(current.hash==="Fork122"&&url.includes("attestation_rights"))return new Promise<Response>(resolve=>{release=resolve;});
 return Response.json(url.includes("attestation_rights")?[{level,delegates:[{delegate:"D1",first_slot:0,attesting_power:3},{delegate:"D2",first_slot:1,attesting_power:2}]}]:{minimal_block_delay:"6",delay_increment_per_round:"3",consensus_threshold_size:4,consensus_committee_size:5});});
 const data=new NetworkData("mainnet"),monitor=new NetworkMonitor<Derived>({network:"mainnet",headSources:[a],operationSources:[a,b],reconciliationClock:()=>performance.now(),derive:async()=>({refreshedAt:1,rights:new Map(),contexts:new Map(),constantsByLevel:new Map(),constants:null,predecessor:null,errors:[]}),reconcile:(target,signal,onHead)=>data.reconcile(target,signal,onHead),fallbackOperations:async()=>[],onUpdate:view=>views.push(view),streamFactory:settings=>new FakeTransport(settings) as never});
 monitor.start();(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(120),a);(FakeTransport.instances[1] as FakeTransport<import("../../src/rpc/models").MonitorOperationBatch>).value([{hash:"B-vote",contents:[{kind:"preattestation",level:123,round:0,slot:0,block_payload_hash:"P"}]}],b);await vi.advanceTimersByTimeAsync(0);
 const retained=views.at(-1)?.observationTargets[0],proof=retained?.admission,receipt=views.at(-1)?.rawOperations[0]?.evidence;if(!retained||!proof)throw new Error("Fixture missing");expect(monitor.contextAuthorized(proof.context)).toBe(true);
 await vi.advanceTimersByTimeAsync(15000);current={...header(122),hash:"Fork122",predecessor:"Fork121"};expect(monitor.reconcileObservation(retained.identity)).toBe(true);await vi.advanceTimersByTimeAsync(0);
 expect(monitor.observedHead(b)?.hash).toBe("Fork122");expect(monitor.contextAuthorized(proof.context)).toBe(false);expect(views.at(-1)?.observationTargets[0]?.contextInvalid).toBe(true);expect(views.at(-1)?.snapshot?.head.level).toBe(120);expect(views.at(-1)?.rawOperations[0]?.evidence).toBe(receipt);
 release(Response.json({error:"Helpers unavailable"},{status:503}));await vi.advanceTimersByTimeAsync(0);expect(monitor.contextAuthorized(proof.context)).toBe(false);monitor.stop();
});


it('keeps the exact applied proof on duplicates and records a fresh material receipt on cached A B A return',async()=>{
 const contexts=new Map<string,import('../../src/rpc/networkData').RpcContext>();
 const {monitor,heads,views}=setup({derive:async head=>{
  let context=contexts.get(head.hash);
  if(!context){context={header:{...head,chainId:'NetFixture'},source,chainId:'NetFixture',protocolHash:'P',nextProtocolHash:'P',evidence:{source,receivedAt:1,receivedMonotonic:1,chainId:'NetFixture',requestedHeadHash:head.hash}};contexts.set(head.hash,context);}
  return {refreshedAt:Date.now(),contexts:new Map([[head.level,{key:head.hash,level:head.level,protocolHash:'P',observer:context,anchor:context}]])};
 }});
 heads.value(header(10));await vi.waitFor(()=>expect(views.at(-1)?.appliedProof?.context.header.hash).toBe('B10'));const first=views.at(-1)?.appliedProof;expect(first).toBeTruthy();
 heads.value(header(10));expect(views.at(-1)?.appliedProof).toBe(first);
 heads.value({...header(10),hash:'BFork10'});await vi.waitFor(()=>expect(views.at(-1)?.appliedProof?.context.header.hash).toBe('BFork10'));const second=views.at(-1)?.appliedProof;
 heads.value(header(10));await vi.waitFor(()=>expect(views.at(-1)?.appliedProof?.context.header.hash).toBe('B10'));const returned=views.at(-1)?.appliedProof;
 expect(returned).not.toBe(first);expect(returned?.context).toBe(first?.context);expect(returned?.evidence.receivedMonotonic).toBeGreaterThan(first?.evidence.receivedMonotonic??Infinity);expect(returned?.evidence.receivedMonotonic).toBeGreaterThan(second?.evidence.receivedMonotonic??Infinity);expect(returned?.context.evidence.receivedMonotonic).toBe(1);
 heads.value(header(10));expect(views.at(-1)?.appliedProof).toBe(returned);expect(Object.isFrozen(returned)).toBe(true);monitor.stop();
});


it('reuses completed head helpers when same-observer votes arrive during derivation',async()=>{
 vi.useFakeTimers();FakeTransport.instances=[];
 const observer=sources.shadownet[0]!,reads:string[]=[],views:NetworkMonitorView<Derived>[]=[],release:Array<()=>void>=[];
 vi.stubGlobal('fetch',async(input:string|URL|Request)=>{
  const url=String(input);reads.push(url);
  if(url.endsWith('/header')){const hash=url.split('/blocks/')[1]?.split('/')[0],level=hash==='head'?100:Number(hash?.slice(1));return Response.json({...header(level),chain_id:'NetFixture'});}
  if(url.endsWith('/protocols'))return Response.json({protocol:'PFixture',next_protocol:'PFixture'});
  if(url.includes('/blocks/B100/'))await new Promise<void>(resolve=>release.push(resolve));
  if(url.includes('attestation_rights'))return Response.json([{level:Number(new URL(url).searchParams.get('level')),delegates:[{delegate:'D',first_slot:0,attesting_power:5}]}]);
  return Response.json({minimal_block_delay:'6',delay_increment_per_round:'3',consensus_threshold_size:4,consensus_committee_size:5});
 });
 const data=new NetworkData('shadownet'),monitor=new NetworkMonitor<Derived>({network:'shadownet',headSources:[observer],operationSources:[observer],derive:(head,signal)=>data.derive(head,signal),reconcile:(target,signal)=>data.reconcile(target,signal),fallbackOperations:async()=>[],onUpdate:view=>views.push(view),streamFactory:settings=>new FakeTransport(settings) as never});
 monitor.start();(FakeTransport.instances[0] as FakeTransport<BlockHeader>).value(header(100),observer);
 await vi.advanceTimersByTimeAsync(0);
 (FakeTransport.instances[1] as FakeTransport<import('../../src/rpc/models').MonitorOperationBatch>).value([{hash:'during-derive',contents:[{kind:'preattestation',level:101,round:0,slot:0,block_payload_hash:'P'}]}],observer);
 await vi.advanceTimersByTimeAsync(0);
 release.forEach(finish=>finish());await vi.advanceTimersByTimeAsync(0);
 expect(views.at(-1)?.observationTargets[0]?.phases?.pre?.power).toBe(5);
 expect(reads.filter(url=>url.includes('/B100/helpers/attestation_rights?level=101'))).toHaveLength(1);
 expect(reads.filter(url=>url.includes('/B100/context/constants'))).toHaveLength(1);
 expect(reads).toHaveLength(9); // four pinned proofs, four helpers, one own-head reconciliation.
 monitor.stop();
});


it.each(['other-source','other-level','manual','failure','transition','stop'] as const)('fences derivation reuse for %s without sharing unfinished cancellation owners',async mode=>{
 vi.useFakeTimers();let finish:()=>void=()=>undefined,finishNew:()=>void=()=>undefined;
 const derive=vi.fn((head:BlockHeader)=>new Promise<NetworkDerivedState>((resolve,reject)=>{
  const done=()=>mode==='failure'?reject(new Error('Proof unavailable')):resolve({refreshedAt:head.level});
  if(head.level===10)finish=done;else finishNew=done;
 }));
 const reconcile=vi.fn(async(_target:import('../../src/monitor/observerReconciliation').ReconciliationTarget,_signal:AbortSignal)=>{throw new Error('No authority in this raw-only fixture');});
 const other={...source,baseUrl:'https://other'},observer=mode==='other-source'?other:source;
 const {monitor,heads,operations,views}=setup({derive,reconcile,operationSources:[source,other]});
 heads.value(header(10));
 operations.value([{hash:'queued',contents:[{kind:'preattestation',level:mode==='other-level'?99:11,round:0,slot:0,block_payload_hash:'P'}]}],observer);
 if(mode==='manual')expect(monitor.reconcileObservation(views.at(-1)!.unresolvedTargets[0]!.identity)).toBe(true);
 await vi.advanceTimersByTimeAsync(0);
 if(mode==='other-source'||mode==='other-level'||mode==='manual')expect(reconcile).toHaveBeenCalledTimes(1);
 else expect(reconcile).not.toHaveBeenCalled();
 if(mode==='stop')monitor.stop();
 if(mode==='transition')heads.value(header(11));
 finish();await vi.advanceTimersByTimeAsync(0);
 if(mode==='stop'||mode==='transition')expect(reconcile).not.toHaveBeenCalled();
 if(mode==='failure')expect(reconcile).toHaveBeenCalledTimes(1);
 if(mode==='transition'){
  finishNew();await vi.advanceTimersByTimeAsync(0);expect(reconcile).toHaveBeenCalledTimes(1);
  expect(reconcile.mock.calls[0]?.[0]).toMatchObject({observerHead:{hash:'B11'}});
 }
 monitor.stop();
});

it('captures raw operations once per publication while later emissions independently read retained facts',()=>{
 const now=vi.spyOn(performance,'now').mockReturnValue(1),raw=vi.spyOn(ObservationStore.prototype,'rawOperations');
 const {monitor,operations,heads,views}=setup();
 try {
 const batch=[{hash:'receipt',contents:[{kind:'preattestation' as const,level:101,round:0,slot:0,block_payload_hash:'P'}]}];
 const firstOperation=batch[0];if(firstOperation===undefined)throw new Error('Fixture operation missing');
 raw.mockClear();operations.value(batch);expect(raw).toHaveBeenCalledTimes(2);expect(views.at(-1)?.rawOperations.map(value=>value.hash)).toEqual(['receipt']);
 const beforeHead=views.at(-1)?.rawOperations;heads.value(header(100));raw.mockClear();operations.value([{...firstOperation,hash:'next-receipt'}]);expect(raw).toHaveBeenCalledTimes(2);
 expect(views.at(-1)?.rawOperations.map(value=>value.hash)).toEqual(['receipt','next-receipt']);expect(beforeHead?.map(value=>value.hash)).toEqual(['receipt']);expect(views.at(-1)?.snapshot?.operations.map(value=>value.hash)).toEqual(['receipt','next-receipt']);
 const published=views.at(-1)?.rawOperations;raw.mockClear();now.mockReturnValue(120002);operations.settings.onStatus(source,null,metrics);expect(raw).toHaveBeenCalledTimes(1);expect(views.at(-1)?.rawOperations).not.toBe(published);expect(views.at(-1)?.rawOperations.map(value=>value.hash)).toEqual(['receipt','next-receipt']);
 } finally {monitor.stop();raw.mockRestore();now.mockRestore();}
});
