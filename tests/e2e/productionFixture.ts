import {readFileSync} from 'node:fs';
import {expect,type Page,type Locator} from '@playwright/test';
type Channel = 'mainnet-head' | 'mainnet-operations' | 'shadownet-head' | 'shadownet-operations' | 'mainnet-proposals' | 'shadownet-proposals';
declare global {
  interface Window {
    mockStreams: Record<string, ReadableStreamDefaultController<Uint8Array>>;
    mockInitialOperations: boolean;
    mockHidden: boolean;
    mockRequests: {url:string;aborted:boolean}[];
  }
}

export const head = (level = 100, round = 0) => ({
  level, hash: `BBlock${level}`, predecessor: `BBlock${level - 1}`,
  timestamp: new Date().toISOString(), fitness: ['02', level.toString(16).padStart(8,'0'), '', 'ffffffff', round.toString(16).padStart(8, '0')],
  payload_hash: `vhPayload${level}`,
});
export const vote = (slot: number, level = 101, round = 0) => ({
  hash: `operation-${slot}-${level}-${round}`,
  contents: [{kind: 'preattestation', slot, level, round, block_payload_hash: `vhPayload${level}`}],
});

export async function openDetails(details:Locator):Promise<void>{if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();}

export const headers=new WeakMap<Page,Map<string,ReturnType<typeof head>>>();
const appliedHeads=new WeakMap<Page,Map<string,ReturnType<typeof head>>>();
export async function send(page: Page, channel: Channel, value: unknown): Promise<void> {
  if(channel.endsWith("-head")){
    let observed=value as ReturnType<typeof head>;const records=headers.get(page),parent=records?.get(observed.predecessor);
    if(parent){const parentRound=Number.parseInt(parent.fitness[4]??"0",16);observed={...observed,fitness:[...observed.fitness.slice(0,3),(0xffffffff-parentRound).toString(16).padStart(8,"0"),observed.fitness[4]??"00000000"]};value=observed;}
    records?.set(observed.hash,observed);
    appliedHeads.get(page)?.set(channel.startsWith('shadownet')?'shadownet':'mainnet',observed);
    if(!records?.has(observed.predecessor))records?.set(observed.predecessor,{...head(observed.level-1),hash:observed.predecessor});
  }
  if(channel.endsWith("-proposals")){const proposal=value as {hash:string;header:ReturnType<typeof head>};headers.get(page)?.set(proposal.hash,{...proposal.header,hash:proposal.hash});}
  await page.evaluate(({channel, value}) => {
    const stream = window.mockStreams[channel];
    if (!stream) throw new Error(`Missing stream ${channel}`);
    stream.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`));
  }, {channel, value});
}

export async function prepare(page: Page, initialOperations = true, initialHead=head(),expectedLevel=initialHead.level,initiallyHidden=false,sourceB=false,rpcCommittee?:{total:number;quorum:number;powers:readonly number[]},aliases?:readonly {address:string;alias:string}[],protocol='PFixture',holdInitialHeads=false): Promise<void> {
  headers.set(page,new Map([[initialHead.hash,initialHead],[initialHead.predecessor,{...head(initialHead.level-1),hash:initialHead.predecessor}]]));
  appliedHeads.set(page,new Map([['mainnet',initialHead],['shadownet',initialHead]]));
  await page.addInitScript(({initialOperations, initialHead, initiallyHidden,sourceB,holdInitialHeads}) => {
    window.mockHidden=initiallyHidden;window.mockRequests=[];
    Object.defineProperty(document,"hidden",{configurable:true,get:()=>window.mockHidden});
    window.mockStreams = {};
    window.mockInitialOperations = initialOperations;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, options) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const entry={url:url.href,at:performance.now(),aborted:options?.signal?.aborted??false,abortedAt:null as number|null};window.mockRequests.push(entry);
      options?.signal?.addEventListener('abort',()=>{entry.aborted=true;entry.abortedAt=performance.now();},{once:true});
      const monitoring = url.pathname.includes('/monitor/heads/') || url.pathname.endsWith('/monitor_operations') || url.pathname.includes('/monitor/validated_blocks');
      if (!monitoring) return originalFetch(input, options);
      const network = url.hostname.includes('shadownet') ? 'shadownet' : 'mainnet';
      const kind = url.pathname.includes('/monitor/heads/') ? 'head' : url.pathname.includes('/monitor/validated_blocks') ? 'proposals' : 'operations';
      if(sourceB && network==="shadownet" && kind==="operations" && url.hostname==="rpc.shadownet.teztnets.com")return new Response("Unavailable A operations",{status:503});
      const body = new ReadableStream<Uint8Array>({start(controller) {
        window.mockStreams[`${network}-${kind}`] = controller;
        options?.signal?.addEventListener('abort', () => {if(window.mockStreams[`${network}-${kind}`]===controller)delete window.mockStreams[`${network}-${kind}`];controller.error(new DOMException('Aborted', 'AbortError'));}, {once: true});
        if (kind === 'head'&&!holdInitialHeads) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(initialHead)}\n`));
        else if (kind === 'operations' && initialOperations) controller.enqueue(new TextEncoder().encode('[]\n'));
      }});
      return new Response(body, {headers: {'Content-Type': 'application/json'}});
    };
  }, {initialOperations, initialHead,initiallyHidden,sourceB,holdInitialHeads});

  await page.route('https://**/*', async route => {
    const url = new URL(route.request().url());
    const level = Number(url.searchParams.get('level') ?? 100);
    let result: unknown;
    if (url.pathname.includes('attestation_rights')) result = [{level, delegates: Array.from({length: rpcCommittee?.powers.length??50}, (_, slot) => ({
      delegate: `tz1BakerAddress${String(slot).padStart(25, '0')}`, first_slot: slot, attesting_power: rpcCommittee?.powers[slot]??600,
    }))}];
    else if (url.pathname.endsWith('/context/constants')) result = {
      minimal_block_delay: '6', delay_increment_per_round: '3', consensus_threshold_size: rpcCommittee?.quorum??20000, consensus_committee_size: rpcCommittee?.total??30000,
    };
    else if (url.pathname.includes('baking_rights')) result = [{level, round: Number(url.searchParams.get('max_round') ?? 0), delegate: 'tz1BakerAddress0000000000000000000000000'}];
    else if (url.pathname.endsWith('/is_forbidden')) result = false;
    else if (url.pathname.endsWith('/protocols')) result={protocol,next_protocol:protocol};
    else if (url.pathname.endsWith('/header')) {
      const hash=url.pathname.split('/blocks/')[1]?.split('/')[0]??'';
      const observed=hash==='head'?appliedHeads.get(page)?.get(url.hostname.includes('shadownet')?'shadownet':'mainnet'):headers.get(page)?.get(hash);
      if(!observed){await route.fulfill({status:404,json:{error:'Unobserved fixture header'}});return;}
      result={...observed,chain_id:'NetFixture'};
    }
    else if (url.pathname.includes('/v1/delegates')) result = aliases??Array.from({length: 50}, (_, slot) => ({address: `tz1BakerAddress${String(slot).padStart(25, '0')}`, alias: `Baker ${slot}`}));
    else if (url.pathname.includes('pending_operations')) result = {}; // No full snapshot is claimed by ordinary stream fixtures.
    else {await route.abort(); return;}
    await route.fulfill({json: result, headers: {'Access-Control-Allow-Origin': '*'}});
  });
  await page.addInitScript(path=>{document.addEventListener('DOMContentLoaded',()=>{void import(path).then(module=>{
    const trace:unknown[]=[];Object.assign(window,{fixtureDomainTrace:trace});const original=module.NetworkMonitor.prototype.emit;
    module.NetworkMonitor.prototype.emit=function(...args:unknown[]){const snapshot=this.state.snapshot();trace.push({at:performance.now(),network:this.options.network,networkIdentity:this.observations.networkIdentity(),provenHead:this.provenHead,generation:snapshot?.generation,rawHead:snapshot?.header,derivedErrors:snapshot?.derived?.errors,targets:[...this.observations.acceptedTargets(),...this.observations.unresolvedTargets()].slice(-4).map((record:import('../../src/monitor/observationStore').ObservationTarget<unknown>)=>({identity:record.identity,source:record.target.source.baseUrl,level:record.target.level,round:record.target.round,admitted:record.admission!==undefined,contextInvalid:record.contextInvalid,error:record.error,pre:record.phases?.pre?.power,att:record.phases?.att?.power})),contexts:snapshot?.derived?.contexts?[...snapshot.derived.contexts]:[],progression:this.progression,headStatus:this.headStatus,operationStatus:this.operationStatus});if(trace.length>80)trace.shift();return original.apply(this,args);};
  }).catch(error=>Object.assign(window,{fixtureDomainTraceError:String(error)}));},{once:true});},inspectionModule());
  await page.goto('/');
  if(initiallyHidden||holdInitialHeads)return;
  const selected=page.locator('.network-tab[aria-pressed="true"]');
  const network=await selected.evaluate(tab=>tab.classList.contains('shadownet')?'shadownet':'mainnet');
  await expect(page.locator(`.${network} .headline`)).toContainText(initialHead.level.toLocaleString('en-US'));
}

/** Select the network explicitly; send never starts or switches collection. */
export async function selectNetwork(page:Page,network:'mainnet'|'shadownet'):Promise<void>{
 const tab=page.locator(`.network-tab.${network}`);
 if(await tab.getAttribute('aria-pressed')!=='true')await tab.click();
 await expect(tab).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(network=>Boolean(window.mockStreams[`${network}-operations`]),network)).toBe(true);
 await expect.poll(()=>page.evaluate(network=>window.mockRequests.some(request=>request.url.includes('/monitor/heads/')&&request.url.includes('shadownet')===(network==='shadownet')&&!request.aborted),network)).toBe(true);
 await expect.poll(()=>page.evaluate(network=>window.mockRequests.some(request=>request.url.includes('monitor_operations')&&request.url.includes('shadownet')===(network==='shadownet')&&!request.aborted),network)).toBe(true);
}

export const rawObservation=(panel:Locator,name:string):Locator=>panel.locator('.raw-observations').getByRole('button',{name,exact:true});

/** Inspect unresolved facts in provenance without claiming validated participation. */
export async function inspectRaw(panel:Locator,name:string):Promise<void>{
 await openDetails(panel.getByText('Sources & observation evidence',{exact:true}).locator('..'));
 await openDetails(panel.locator('.raw-observations'));
 await rawObservation(panel,name).click();
}

/** Operate the existing retained-session choice by its complete payload label. */
export async function inspectRetainedPayload(panel:Locator,payload:string,context?:{level:number;round:number;source?:string}):Promise<void>{
 const control=panel.getByLabel('Retained session instance');
 let option=control.locator('..').locator('.choice-option').filter({hasText:` · ${payload} · `});
 if(context){option=option.filter({hasText:` · ${context.level}/${context.round} · `});if(context.source)option=option.filter({hasText:context.source});}
 await expect(option).toHaveCount(1);
 const label=await option.textContent();
 if(!label)throw new Error(`Retained session label unavailable for ${payload}`);
 const prefix=`Inspect retained instance ${label.slice(0,label.lastIndexOf(' · '))} · `;
 await panel.getByRole('button',{name:new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\d+ candidates$`)}).click();
}

export const capturedCandidate=(panel:Locator,hash:string):Locator=>panel.locator('.captured-candidates').getByRole('button',{name:`Inspect candidate ${hash}`,exact:true,includeHidden:true});

/** Pin the retained instance, then inspect its exact captured block without adding votes. */
export async function inspectRetainedCandidate(panel:Locator,hash:string,source?:string):Promise<void>{
 const observed=headers.get(panel.page())?.get(hash);
 if(!observed)throw new Error(`Fixture header unavailable for retained candidate ${hash}`);
 // Follow updates on the next render; old pinned controls can still exist here.
 // Select history explicitly before relying on its captured-only hash controls.
 await inspectRetainedPayload(panel,observed.payload_hash,{level:observed.level,round:Number.parseInt(observed.fitness[4]??'0',16),...(source?{source}:{})});
 await inspectCapturedCandidate(panel,hash);
}

/** Inspect an already pinned capture, including frozen evidence outside history. */
export async function inspectCapturedCandidate(panel:Locator,hash:string):Promise<void>{
 await openDetails(panel.getByText('Selected identity & phase provenance',{exact:true}).locator('..'));
 await openDetails(panel.locator('.captured-candidates'));
 await capturedCandidate(panel,hash).click();
}

/** Operate the production disclosure and native radio, preserving its keyboard close path. */
export async function choose(control:Locator,value:string):Promise<void>{
 const root=control.locator('..');for(const ancestor of await root.locator('xpath=ancestor::details').all())await openDetails(ancestor);if(await root.getAttribute('open')===null)await control.click();
 const radio=root.locator(`input[type=radio][value=${JSON.stringify(value)}]`);await radio.check();await radio.press('Escape');
}

export function inspectionModule():string {
 const manifest=JSON.parse(readFileSync('dist/.vite/manifest.json','utf8')) as Record<string,{file?:string;isEntry?:boolean}>;
 const entry=manifest['inspection.ts'];if(!entry?.isEntry||!entry.file?.startsWith('assets/'))throw new Error('Production inspection entry missing from actual Vite manifest');
 return `/${entry.file}`;
}


/** Persist passive bounded domain receipts when a production scenario fails. */
export async function attachFailureTrace(page:Page,info:import('@playwright/test').TestInfo):Promise<void>{
 if(info.status==='passed'||page.isClosed())return;
 const evidence=await page.evaluate(()=>{const data=window as unknown as {fixtureDomainTrace?:unknown[];fixtureDomainTraceError?:string};return {frames:data.fixtureDomainTrace??[],instrumentationError:data.fixtureDomainTraceError,requests:window.mockRequests.slice(-100),selected:document.querySelector('.mainnet .navigator-current')?.textContent,status:document.querySelector('.mainnet .navigator-status')?.textContent};});
 await info.attach('bounded-production-domain-failure',{body:JSON.stringify(evidence),contentType:'application/json'});
}
