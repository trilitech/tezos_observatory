import {PRODUCER_PROTOCOL} from './rpc/candidateProducer';
export type Fact=Record<string,unknown>;
export const record=(v:unknown):v is Fact=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export const bakerAddress=(v:string):boolean=>/^tz[1-4][1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
export function rows(v:unknown):Fact[]{if(!Array.isArray(v)||v.some(x=>!record(x)))throw Error('Malformed indexed rows');return v as Fact[];}
export const addressOf=(v:unknown):string|null=>record(v)&&typeof v.address==='string'?v.address:null;
export const text=(v:unknown):string=>typeof v==='string'||typeof v==='number'||typeof v==='boolean'?String(v):'Unavailable';
export function mutez(v:unknown):string{if((typeof v==='string'&&/^\d+$/.test(v))||(integer(v))){const n=BigInt(v);return `${n/1000000n}.${String(n%1000000n).padStart(6,'0')} ꜩ`;}return 'Unavailable';}
export function profileFacts(v:unknown,address:string){if(!record(v)||v.address!==address)throw Error('Delegate response does not match selected address');return {alias:typeof v.alias==='string'?v.alias:address,active:typeof v.active==='boolean'?String(v.active):'Unavailable',staked:mutez(v.totalStakedBalance),power:mutez(v.bakingPower),software:record(v.software)?text(v.software.version):'Unavailable',softwareLevel:text(v.softwareUpdateLevel),softwareTime:text(v.softwareUpdateTime)};}
export function dalCounters(v:unknown){if(!record(v)||!integer(v.delegate_attested_dal_slots)||!integer(v.delegate_attestable_dal_slots)||v.delegate_attested_dal_slots>v.delegate_attestable_dal_slots)throw Error('DAL counters unavailable or inconsistent');return {attested:v.delegate_attested_dal_slots,eligible:v.delegate_attestable_dal_slots,ratio:v.delegate_attestable_dal_slots>0?v.delegate_attested_dal_slots/v.delegate_attestable_dal_slots:null,sufficient:typeof v.sufficient_dal_participation==='boolean'?String(v.sufficient_dal_participation):'Unavailable',denounced:typeof v.denounced==='boolean'?String(v.denounced):'Unavailable',rewards:mutez(v.expected_dal_rewards)};}
export function rewardRows(v:unknown,cycle:number):Fact[]{return rows(v).filter(x=>integer(x.cycle)&&x.cycle<=cycle).sort((a,b)=>Number(b.cycle)-Number(a.cycle)).slice(0,6);}
export function rightsWindow(v:unknown,baker:string,head:number,count:number){const all=rows(v),seen=new Set<number>();for(const r of all){if(!integer(r.level)||r.level>head||r.level<Math.max(0,head-count+1)||addressOf(r.baker)!==baker||r.type!=='attestation'||seen.has(r.level))throw Error('Rights window incomplete or inconsistent');seen.add(r.level);}if(all.length>=count+1)throw Error('Rights window capped');return Array.from({length:Math.min(count,head+1)},(_,i)=>{const level=head-i,r=all.find(x=>x.level===level);return {level,status:r?text(r.status):'no indexed right',slots:r?text(r.slots):'—'};});}
export interface DalBits{readonly kind:'individual'|'aggregate';readonly bits:string;}
export function includedDal(v:unknown,baker:string,protocol:string):DalBits[]{
 if(!Array.isArray(v))throw Error('Operations unavailable');const out:DalBits[]=[];
 for(const op of v){if(!record(op)||!Array.isArray(op.contents))throw Error('Malformed operation');for(const c of op.contents){if(!record(c))throw Error('Malformed content');if(c.kind==='attestation_with_dal'&&record(c.metadata)&&c.metadata.delegate===baker){if(typeof c.dal_attestation!=='string'||!/^\d+$/.test(c.dal_attestation))throw Error('Malformed DAL bits');out.push({kind:'individual',bits:c.dal_attestation});}
 if(c.kind==='attestations_aggregate'){
 // Index alignment is verified for the U025 PsUshuai protocol family only.
 if(protocol!==PRODUCER_PROTOCOL)continue;
 if(!Array.isArray(c.committee)||!record(c.metadata)||!Array.isArray(c.metadata.committee)||c.committee.length!==c.metadata.committee.length)throw Error('Aggregate committee mismatch');
 const seen=new Set<string>();const matched:DalBits[]=[];for(let i=0;i<c.committee.length;i++){const item:unknown=c.committee[i],meta:unknown=c.metadata.committee[i];if(!record(item)||!record(meta)||typeof meta.delegate!=='string'||seen.has(meta.delegate))throw Error('Malformed or duplicate aggregate delegate');seen.add(meta.delegate);if(item.dal_attestation!==undefined&&(typeof item.dal_attestation!=='string'||!/^\d+$/.test(item.dal_attestation)))throw Error('Malformed aggregate DAL bits');if(meta.delegate===baker&&typeof item.dal_attestation==='string')matched.push({kind:'aggregate',bits:item.dal_attestation});}out.push(...matched);
 }
 }}return out;
}
