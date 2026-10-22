import {expect,it} from "vitest";
import {groupsFor} from "../../src/consensus/phaseEvidence";
const source={network:"mainnet" as const,name:"A",baseUrl:"A"};
const contextFor=(baseUrl:string)=>{
 const observerSource={...source,name:baseUrl,baseUrl},header={chainId:"NetFixture",level:119,hash:"H119",predecessor:"H118",timestamp:"2026-01-01T00:00:00Z",fitness:["02","00000077","","ffffffff","00000000"]};
 const observer={header,source:observerSource,chainId:"NetFixture",protocolHash:"PFixture",nextProtocolHash:"PFixture",evidence:{source:observerSource,receivedAt:1,receivedMonotonic:1}};
 return {observer,anchor:observer,level:120,protocolHash:"PFixture",key:JSON.stringify([baseUrl,"NetFixture","H119","H118","PFixture",120])};
};
const operation=(payload:string,slot:number,kind:"preattestation"|"attestation"="preattestation")=>({evidence:{source,chainId:"NetFixture",observedHeadHash:"H119",receivedAt:1,receivedMonotonic:1},hash:`${payload}:${slot}:${kind}`,contents:[{kind,level:120,round:2,slot,block_payload_hash:payload}]});
const rights=[{address:"D1",slot:0,power:3,context:contextFor("A")},{address:"D2",slot:1,power:2,context:contextFor("A")}];
it("keeps competing payload delegate power separate and exposes conflicting delegates",()=>{
 const groups=groupsFor([operation("P",0),operation("P",0),operation("Q",0),operation("Q",1)],rights,120);
 expect(groups.find(g=>g.payload==="P")?.pre.size).toBe(1);expect(groups.find(g=>g.payload==="Q")?.pre.size).toBe(2);
 expect((groups.find(g=>g.payload==="P") as unknown as {conflicts:readonly string[]})?.conflicts).toEqual(["D1"]);
});
it("withdraws contradictory committee authority but preserves raw signer evidence",()=>{
 const groups=groupsFor([operation("P",0)],[...rights,{address:"D1",slot:2,power:4}],120);
 expect(groups[0]?.pre.size).toBe(0);
 expect((groups[0] as unknown as {unknownSlots:readonly number[]})?.unknownSlots).toEqual([0]);
});

it("separates identical payload evidence from different immutable observer contexts",()=>{
 const evidence=(source:string)=>({source:{network:"mainnet" as const,name:source,baseUrl:source},observedHeadHash:"H119",receivedAt:1,receivedMonotonic:1});
 const groups=groupsFor([{...operation("P",0),evidence:evidence("A")},{...operation("P",1),evidence:evidence("B")}],rights,120);
 expect(groups).toHaveLength(2);expect(groups[0]?.pre.size).toBe(1);expect(groups[1]?.pre.size).toBe(0);
 const other=groupsFor([{...operation("P",0),evidence:evidence("A")},{...operation("P",1),evidence:evidence("B")}],rights.map(right=>({...right,context:contextFor("B")})),120);expect(other.map(group=>group.pre.size)).toEqual([0,1]);
});

it("preserves exact independent conflict evidence for the permitted 10000-group flood",()=>{
 const operations=Array.from({length:10000},(_,index)=>operation(`payload-${index}`,0));
 const groups=groupsFor(operations,rights,120);
 expect(groups).toHaveLength(10000);
 expect(groups.every(group=>group.pre.size===1 && group.pre.has("D1") && group.att.size===0 && group.conflicts.length===1 && group.conflicts[0]==="D1")).toBe(true);
 const differentPhase=groupsFor([operation("P",0,"preattestation"),operation("Q",0,"attestation")],rights,120);
 expect(differentPhase.every(group=>group.conflicts.length===0)).toBe(true);
});


it("keeps the receipt of newly contributing delegates separate by phase and ignores duplicate receipt refresh",()=>{
 const first=operation("P",0),second={...operation("P",1),evidence:{...first.evidence,receivedAt:2,receivedMonotonic:2}},replay={...first,hash:"duplicate",evidence:{...first.evidence,receivedAt:9,receivedMonotonic:9}};
 const group=groupsFor([first,second,replay],rights,120)[0] as unknown as {preEvidence?:{receivedMonotonic:number};attEvidence?:unknown};
 expect(group.preEvidence?.receivedMonotonic).toBe(2);expect(group.attEvidence).toBeUndefined();
});

it('preserves first-seen tuple order and receipt ownership across interleaved phases sources and numeric rounds',()=>{
 const initial=operation('P,2]',0),replay={...initial,evidence:{...initial.evidence,receivedAt:50,receivedMonotonic:50}},foreign={...operation('P,2]',1),evidence:{...initial.evidence,source:{...source,baseUrl:'Other'}}};
 const att={...operation('P,2]',1,'attestation'),evidence:{...initial.evidence,receivedAt:3,receivedMonotonic:3}};
 const initialContent=initial.contents[0];if(initialContent===undefined)throw new Error('Fixture consensus content missing');
 const laterRound={...operation('P,2]',0),contents:[{...initialContent,round:3}]};
 const groups=groupsFor([initial,foreign,laterRound,att,replay],rights,120);
 expect(groups.map(group=>[group.round,group.payload,group.pre.size,group.att.size])).toEqual([[2,'P,2]',1,1],[2,'P,2]',0,0],[3,'P,2]',1,0]]);
 expect(groups[0]?.preEvidence?.receivedMonotonic).toBe(1);expect(groups[0]?.attEvidence?.receivedMonotonic).toBe(3);expect(groups[1]?.unknownSlots).toEqual([1]);
 const invalid=[NaN,Infinity,-Infinity].map(round=>({...initial,contents:[{...initialContent,round}]}));
 expect(groupsFor(invalid,rights,120)).toHaveLength(1);
});
