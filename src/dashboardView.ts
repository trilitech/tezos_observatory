import {CAMERA_DURATION_MS} from './cameraTiming';
import {navigatorDirection,retainNavigator,sameCameraPosition} from './navigatorMotion';
import {NavigatorPath,historyLength,historyLengths,type HistoryLength,type NavigatorPathInput,type NavigatorPathRecord} from './navigatorPath';
import {formatInterval,intervalWindows,type IntervalView} from './rpc/blockIntervals';
import {proposalRound,type OpportunityFact} from './consensus/roundSchedule';
import type {ComparisonResult} from './rpc/sourceComparison';
export type Network = 'mainnet' | 'shadownet';
export interface VoteView {count: number; expected: number; power: number; total: number;threshold?:number;proof?:{description:string;receivedAt:number;receivedMonotonic:number}|undefined}
export interface DelegateView {address: string; alias?: string;searchAlias?:string; power: number; forbidden?: boolean; eligibility?: 'eligible' | 'forbidden' | 'unavailable'; eligibilityState?:'stale'|'context-invalid'; eligibilityNote?:string;preReceipt?:string;attReceipt?:string;contextNote?:string}
export interface SourceView {name: string; url: string; status: string; detail?: string}
export interface RecentConsensusView {identity?:string;level: number; round: number; prePower?: number; attPower?: number; preTotal?:number;attTotal?:number;total: number; payload?: string;source?:string}
export interface ObservedNavigatorView {
 readonly identity:string; readonly level:number; readonly round:number; readonly source:string;
 readonly payload?:string; readonly hash?:string; readonly coherent:boolean;
 readonly contextHead?:string; readonly contextParent?:string; readonly chain?:string; readonly protocol?:string;
 readonly receivedMonotonic:number; readonly receivedAt:number;
 readonly predecessor?:{readonly hash:string;readonly level:number;readonly round:number;readonly relation:'ancestry'|'context';readonly payload?:string;readonly parentHash:string};
}
export interface NetworkViewModel {
  /** UI admission-to-render budget; not an observation receipt. */
  cameraAcceptedMonotonic?:number;
  navigatorDiscontinuity?:string;
  blockIntervals?:IntervalView;
  observation?:ObservedNavigatorView;
  pathObservations?:readonly NavigatorPathInput[];
  selectedRelationship?:'applied-block'|'applied-tuple'|'different-block'|'next-level'|'other';
  appliedSinceMonotonic?:number;
  nextProposalObservation?:{observed:boolean;source:string};
  producer?:string;
  comparison?:{providers:readonly {name:string;url:string}[];enabled:boolean;running:boolean;result?:()=>ComparisonResult|undefined};
  status: 'loading' | 'healthy' | 'unknown' | 'stalled' | 'degraded' | 'paused';
  level?: number; consensusLevel?: number; round?: number; activityRound?: number; hash?: string; payload?: string;
  appliedLevel?: number; appliedRound?: number;
  observedProposal?: {level: number; round: number; payload?: string; at?: number}; roundSource?: 'observed' | 'schedule';
  candidates?: readonly {identity:string;hash?:string;payload?:string;level:number;round:number;prePower?:number;attPower?:number;source?:string;payloadShared?:boolean}[];
  provenanceCandidates?:readonly {identity:string;hash:string;level:number;round:number}[];
  unresolvedObservations?:readonly {identity:string;hash?:string;payload?:string;level:number;round:number;source:string}[];
  selectedIdentity?: string;
  session?:{previous?:string;mode:"follow"|"pin";frozen:boolean;newer:number;newerPartial:boolean;selected?:string;canPin:boolean;accepted:number;unresolved:number;raw:number;instances:readonly {identity:string;label:string;level?:number;round?:number;source?:string;received?:number;receivedMonotonic?:number;partial?:boolean;candidates?:number}[]};
  retryIdentity?:string;
  canRetry?:boolean;
  eligibilityLoading?:boolean;
  eligibilityAvailable?:boolean;
  candidateEvidence?: string;
  contextEvidence?: string;
  recentConsensus?: RecentConsensusView[];
  events?:readonly {readonly identity:string;readonly description:string;readonly observedAt:number}[];
  observedAt?: number; observedMonotonic?:number; snapshotMonotonic?:number; blockTimestamp?: number; lastOperationAt?: number;
  source?: string; connection?: string; error?: string; note?: string;
  preattestations?: VoteView; attestations?: VoteView; quorum?: number; committeePower?: number;committeeTotal?:number;
  timing?: {evidence?:string; level?: number; round: number; nextRound: number; endsAt: number; startedAt?: number};
  nextBakers?: {label: string; alias?: string; address: string; round: number; level: number}[];
  opportunityFacts?:readonly OpportunityFact[];
  opportunitiesHistorical?:boolean;
  missingPre?: DelegateView[]; missingAtt?: DelegateView[]; committee?:DelegateView[];unknownConsensus?:readonly string[]; sources?: SourceView[];
}

const number = (value: number | undefined): string => value === undefined ? '—' : value.toLocaleString('en-US');
const clock = (value: number | undefined): string => value === undefined ? 'Unavailable' : new Date(value).toLocaleTimeString('en-GB');
const short = (value: string | undefined): string => value ? `${value.slice(0, 10)}…${value.slice(-7)}` : 'Unavailable';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', value = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
};
const set = (node: HTMLElement, value: string): void => {if (node.textContent !== value) node.textContent = value;};
const saved = (key: string): boolean => {try {return localStorage.getItem(key) === 'open';} catch {return false;}};
function disclosure(title: string, key: string): {details: HTMLDetailsElement; summary: HTMLElement; body: HTMLElement} {
  const details = el('details', 'disclosure'); details.open = saved(key);
  const summary = el('summary', '', title), body = el('div', 'disclosure-body'); details.append(summary, body);
  // Persist synchronously: the native toggle event may be deferred past navigation.
  summary.addEventListener('click', event => {
    event.preventDefault(); details.open = !details.open;
    try {localStorage.setItem(key, details.open ? 'open' : 'closed');} catch { /* Storage is optional. */ }
  });
  details.addEventListener('toggle', () => {try {localStorage.setItem(key, details.open ? 'open' : 'closed');} catch { /* Storage is optional. */ }});
  return {details, summary, body};
}
function field(parent: HTMLElement, label: string): HTMLElement {
  const item = el('div', 'metric'); item.append(el('span', 'eyebrow', label)); const value = el('strong', '', '—'); item.append(value); parent.append(item); return value;
}
function blockIntervalRegion(network:Network,onRefresh:()=>void){
 const root=el('section','block-intervals');root.setAttribute('aria-label',`${network==='mainnet'?'Mainnet':'Shadownet'} completed block intervals`);
 const header=el('div','interval-header'),refresh=el('button','','Refresh block intervals');refresh.type='button';refresh.setAttribute('aria-label',`Refresh block intervals for ${network==='mainnet'?'Mainnet':'Shadownet'}`);refresh.addEventListener('click',onRefresh);
 header.append(el('h3','','Mean completed-block interval'),refresh);
 const source=el('a','','TzKT-reported indexed spans');source.rel='noreferrer';source.target='_blank';
 const note=el('p','interval-note'),rows=el('div','interval-windows'),status=el('p','interval-status');
 const values=intervalWindows.map(definition=>{const row=el('div','interval-window'),mean=el('strong','interval-mean','—'),coverage=el('p','interval-coverage'),endpoints=el('p','interval-endpoints');row.append(el('h4','',definition.label),mean,coverage,endpoints);rows.append(row);return {mean,coverage,endpoints};});
 const details=el('details','interval-details'),evidence=el('pre','interval-evidence');details.append(el('summary','','Interval calculation & source evidence'),evidence);
 root.append(header,source,note,status,rows,details);
 const utc=(value:number)=>new Date(value).toISOString();
 const coverageDuration=(milliseconds:number)=>{const seconds=Math.floor(milliseconds/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);return [days?`${days}d`:'',hours?`${hours}h`:'',minutes?`${minutes}m`:'',`${seconds%60}s`].filter(Boolean).join(' ');};
 return {root,update(view:IntervalView|undefined){
  if(!view){refresh.disabled=true;set(status,'Not yet collected');return;}
  source.href=`${view.source}/v1/blocks`;
  refresh.disabled=!view.enabled||view.running||view.cooldownSeconds>0;
  const eligibility=!view.enabled?'Collection paused':view.running?'Refreshing block intervals':view.cooldownSeconds>0?`Refresh available in ${view.cooldownSeconds}s`:'Refresh available';
  const batch=view.batch;
  set(status,`${eligibility}${batch?` · ${view.stale?'Stale retained evidence':'As-of evidence'} · fetch age ${Math.floor((view.freshnessMilliseconds??0)/1000)}s · selected indexed-endpoint age ${view.endpointAgeMilliseconds===undefined?'unknown':`${Math.floor(view.endpointAgeMilliseconds/1000)}s`}`:view.running?' · Loading':view.failure?' · Unavailable':' · Not yet collected'}${view.failure?` · ${view.failure.reason}`:''}`);
  set(note,batch?`As of ${utc(batch.start.wall)} · ${batch.metadata.lag===undefined?'Indexer lag unknown':`Indexer lag ${batch.metadata.lag} levels`} · Endpoint spans reported by TzKT; intermediate ancestry and completeness are not independently verified.`:'Three wall-clock windows; awaiting bounded indexed history.');
  values.forEach((nodes,index)=>{
   const window=batch?.windows[index],value=window?.value;
   if(!window||!value){set(nodes.mean,'—');set(nodes.coverage,view.running?'Loading':view.failure?'Unavailable':'Not yet collected');set(nodes.endpoints,'');return;}
   if(value.state==='available'||value.state==='partial'){
    set(nodes.mean,formatInterval(value.mean));set(nodes.coverage,`${value.state==='partial'?'Partial available history · ':''}${value.count.toLocaleString('en-US')} intervals · ${(value.spanMilliseconds/1000).toLocaleString('en-US')} s actual coverage · ${coverageDuration(value.spanMilliseconds)}`);
    set(nodes.endpoints,`Level ${value.start.level.toLocaleString('en-US')} · ${utc(value.start.milliseconds)} → ${batch.end.level.toLocaleString('en-US')} · ${utc(batch.end.milliseconds)}`);
   }else if('reason' in value){set(nodes.mean,value.state==='insufficient'?'Insufficient data':'Unavailable');set(nodes.coverage,value.reason);set(nodes.endpoints,`Requested ${window.seconds}s · cutoff ${utc(window.cutoff)}`);}
  });
  set(evidence,batch?JSON.stringify({qualification:'TzKT-reported indexed spans; no independent intermediate completeness, ancestry or genesis proof',formula:'(E.timestamp − S.timestamp) / 1000 / (E.level − S.level)',...batch,failedAttempt:view.failure??null},null,2):view.failure?JSON.stringify(view.failure,null,2):'No completed indexed history batch.');
 }};
}
function gauge(label: string, kind: string) {
  const root = el('section', `vote-gauge ${kind}`), header = el('div', 'gauge-header');
  const title = el('h3', '', label), percentage = el('strong', 'gauge-percent', '—'); header.append(title, percentage);
  const track = el('div', 'gauge-track'); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', `${label} voting power`);
  const fill = el('div', 'gauge-fill'), marker = el('span', 'quorum-marker'); track.append(fill, marker);
  const counts = el('div', 'gauge-counts'), power = el('span', '', 'Voting power unavailable'), ops = el('span', '', 'Operations unavailable'); counts.append(power, ops);
  const exact = el('strong', 'gauge-exact', 'Unavailable');
  header.insertBefore(exact, percentage);
  const remaining = el('p', 'quorum-caption', 'Quorum unavailable');
  const details=el('details','phase-provenance'),proof=el('p','phase-evidence table-note'),age=el('span','phase-age');details.append(el('summary','',`${label} source & receipt`),proof,age);
  let receipt:VoteView['proof'];
  const tick=()=>set(age,receipt?`Receipt age ${Math.max(0,Math.floor((performance.now()-receipt.receivedMonotonic)/1000))}s`:'Receipt age unknown');
  root.append(header, track, counts, remaining,details);
  return {root,tick, update(vote: VoteView | undefined, quorum: number | undefined) {
    receipt=vote?.proof;set(proof,receipt?`${receipt.description} · Received ${new Date(receipt.receivedAt).toISOString()}`:"Phase source and receipt unavailable");if(receipt)proof.dataset.received=new Date(receipt.receivedAt).toISOString();else delete proof.dataset.received;tick();
    const known = vote !== undefined && vote.total > 0, percent = known ? 100 * vote.power / vote.total : 0;
    set(exact, known ? `${number(vote.power)} / ${number(vote.total)}` : 'Unavailable');
    set(percentage, known ? `${percent.toFixed(1)}%` : '—'); fill.style.width = `${Math.min(100, percent)}%`;
    track.setAttribute('aria-valuenow', known ? String(vote.power) : '0'); track.setAttribute('aria-valuemax', known ? String(vote.total) : '100');
    track.setAttribute('aria-valuetext', known ? `${vote.power} of ${vote.total} voting power` : 'Voting power unavailable');
    marker.hidden = !known || quorum === undefined;
    if (known && quorum !== undefined) marker.style.left = `${100 * quorum / vote.total}%`;
    set(power, known ? `${number(vote.power)} / ${number(vote.total)} power` : 'Voting power unavailable');
    set(ops, vote === undefined ? 'Operations unavailable' : `${number(vote.count)} / ${number(vote.expected)} signers`);
    set(remaining, known && quorum !== undefined ? (vote.power >= quorum ? `Quorum reached · ${number(quorum)} power required` : `${number(quorum - vote.power)} more power to quorum · ${number(quorum)} required`) : 'Quorum unavailable');
    root.dataset.reached = String(known && quorum !== undefined && vote.power >= quorum);
  }};
}

function recentConsensus() {
  const root = el('section', 'recent-consensus'); root.append(el('h3', '', 'Recent consensus'));
  root.append(el('p', 'table-note', 'Peak power observed by this browser · historical observations, not current votes'));
  const rows = el('div', 'recent-consensus-rows'); root.append(rows);
  const keyed = new Map<string, HTMLElement>();
  const placeholders = Array.from({length: 4}, () => {
    const row = el('div', 'recent-consensus-row recent-placeholder');
    row.append(el('span', 'recent-identity', 'Level — · round —'), el('span', '', 'Pre —'), el('span', '', 'Att —'));
    return row;
  });
  rows.append(...placeholders);
  return {root, update(history: RecentConsensusView[] | undefined) {
    const values = (history ?? []).slice(0, 5), keys = new Set<string>();
    for (const [index, value] of values.entries()) {
      const key = value.identity??`${value.level}:${value.round}:${value.payload ?? ''}`; keys.add(key);
      let row = keyed.get(key);
      if (!row) {
        row = el('div', 'recent-consensus-row'); row.append(el('span', 'recent-identity'));
        for (const phase of ['pre', 'att']) {
          const cell = el('div', `recent-phase ${phase}`), label = el('span'), track = el('div', 'recent-track'), fill = el('div', 'recent-fill');
          track.append(fill); cell.append(label, track); row.append(cell);
        }
        keyed.set(key, row);
      }
      set(row.children[0] as HTMLElement, `${number(value.level)} · r${value.round}`);
      row.title = `Level ${value.level} · round ${value.round}${value.payload ? ` · payload ${value.payload}` : ''}${value.source?` · source ${value.source}`:""}`;
      for (const [offset, power] of [value.prePower, value.attPower].entries()) {
        const total=(offset===0?value.preTotal:value.attTotal)??value.total;
        const percent = power!==undefined && total > 0 ? Math.min(100, Math.max(0, 100 * power / total)) : undefined;
        const cell = row.children[offset + 1] as HTMLElement;
        set(cell.children[0] as HTMLElement, `${offset === 0 ? 'Pre' : 'Att'} ${percent === undefined ? '—' : `${percent.toFixed(1)}%`}`);
        cell.title = `${number(power)} / ${number(total)} voting power`;
        (cell.querySelector('.recent-fill') as HTMLElement).style.width = `${percent ?? 0}%`;
      }
      if (rows.children[index] !== row) rows.insertBefore(row, rows.children[index] ?? null);
    }
    for (const [key, row] of keyed) if (!keys.has(key)) {row.remove(); keyed.delete(key);}
    // Reserve four complete rows even before the first observation arrives.
    placeholders.forEach((placeholder, index) => {
      const needed = index < Math.max(0, 4 - values.length);
      if (needed && !placeholder.isConnected) rows.append(placeholder);
      if (!needed) placeholder.remove();
    });
  }};
}

let choiceSequence=0;
/** Native disclosure + radios: browser/OS popup colors are not author-controllable. */
export function nativeChoice(name:string,initial:readonly (readonly [string,string])[]=[]) {
 const root=el('details','native-choice'),summary=el('summary'),group=el('fieldset','choice-options'),legend=el('legend','sr-only',name);
 summary.setAttribute('aria-label',name);group.tabIndex=-1;group.append(legend);root.append(summary,group);const groupName=`observatory-choice-${++choiceSequence}`;
 const entries=new Map<string,{label:HTMLLabelElement;input:HTMLInputElement;text:HTMLSpanElement}>();let selected='';
 const sync=()=>{for(const [value,entry] of entries)entry.input.checked=value===selected;set(summary,entries.get(selected)?.text.textContent??'Unavailable');};
 const update=(items:readonly (readonly [string,string])[])=>{const wanted=new Set(items.map(([value])=>value));for(const [value,entry] of entries)if(!wanted.has(value)){entry.label.remove();entries.delete(value);}for(const [value,text] of items){let entry=entries.get(value);if(!entry){const label=el('label','choice-option'),input=el('input'),span=el('span');input.type='radio';input.name=groupName;input.value=value;label.dataset.value=value;label.append(input,span);entry={label,input,text:span};entries.set(value,entry);group.append(label);input.addEventListener('change',()=>{if(input.checked){selected=value;sync();}});}set(entry.text,text);}if(!entries.has(selected))selected=items[0]?.[0]??'';sync();};
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.open){root.open=false;summary.focus();event.stopPropagation();}});
 document.addEventListener('click',event=>{if(event.target instanceof Node&&!root.contains(event.target))root.open=false;});
 update(initial);
 return {root,group,update,get value(){return selected;},set value(value:string){selected=value;sync();},set disabled(value:boolean){group.disabled=value;root.inert=value;summary.setAttribute('aria-disabled',String(value));if(value)root.open=false;},onChange(callback:()=>void){group.addEventListener('change',callback);}};
}

function delegateList(network: Network, phase: 'Pre' | 'Att' | 'Committee') {
  const full=phase==='Committee',title = full?'Committee evidence':phase === 'Pre' ? 'Missing preattestations' : 'Missing attestations';
  const {details, summary, body} = disclosure(title, `consensus-v2:${network}:${phase}`);
  if(full){details.classList.add('committee-evidence'); details.open = true;}
  const intro = el('p', 'table-note', full?'Validated-rights delegates. Receipt and absence refer only to the selected source/context; no network-wide inactivity claim.':'Expected rights minus observed signers. Power is committee voting power, not token balance.');
  const viewport = el('div', 'delegate-scroll'); viewport.tabIndex = 0; viewport.setAttribute('aria-label', `${title} delegate list`);
  const table = el('table', 'delegate-table'), head = el('thead'), header = el('tr');
  for (const name of ['Baker', 'Address', 'Power', 'Share', 'Eligibility',...(full?['Preattestation','Attestation','Context']:[])]) header.append(el('th', '', name)); head.append(header);
  const tbody = el('tbody'); table.append(head, tbody); viewport.append(table); const empty = el('p', 'empty-state', 'Rights or observations unavailable.'); body.append(intro, viewport, empty);
  const rows = new Map<string, HTMLTableRowElement>();
  const search=el('input');search.type='search';search.placeholder='Find participant by alias or address';search.setAttribute('aria-label','Search committee alias or address');
  const sort=nativeChoice('Committee sort',[['power','Power'],['address','Address'],['alias','Alias']]);
  const resort=el('button','','Resort committee');resort.type='button';
  const receipt=nativeChoice('Committee phase receipt filter',[['all','All phase receipts'],['pre:received','Preattestation received'],['att:received','Attestation received'],['pre:absent','Preattestation snapshot absent'],['att:absent','Attestation snapshot absent'],['pre:unknown','Preattestation partial / unavailable'],['att:unknown','Attestation partial / unavailable']]);
  const unknown=el('details','committee-unknown'),unknownSummary=el('summary'),unknownViewport=el('div','unknown-observations-scroll'),unknownNote=el('p','table-note'),unknownList=el('ul','unknown-observations');
  unknownViewport.tabIndex=0;unknownViewport.setAttribute('aria-label','Unknown-rights observation receipts');unknownViewport.append(unknownNote,unknownList);unknown.append(unknownSummary,unknownViewport);
  unknown.addEventListener('toggle',()=>render());
  if(full){intro.classList.add('committee-status');viewport.append(empty);body.insertBefore(search,viewport);body.insertBefore(sort.root,viewport);body.insertBefore(resort,viewport);body.insertBefore(receipt.root,viewport);body.append(unknown);}
  let current:DelegateView[]|undefined,currentTotal:number|undefined,unknownFacts:readonly string[]=[],order:string[]=[],reset=true,retainedScrollTop=0;
  const explicit=()=>{reset=true;render();};search.addEventListener('input',explicit);sort.onChange(explicit);resort.addEventListener('click',explicit);receipt.onChange(explicit);
  tbody.addEventListener('focusout',()=>queueMicrotask(()=>render()));
  function render() {
    const delegates=current,total=currentTotal;
    if(full&&!table.hidden&&!viewport.hidden)retainedScrollTop=viewport.scrollTop;
    const scrollTop = full?retainedScrollTop:viewport.scrollTop;
    const known = delegates !== undefined,all=[...(delegates??[])],query=search.value.trim().toLowerCase();
    const matches=(delegate:DelegateView)=>{
      if(query&&!(delegate.searchAlias??delegate.alias??'').toLowerCase().includes(query)&&!delegate.address.toLowerCase().includes(query))return false;
      const [phase,state]=receipt.value.split(':');if(!state)return true;const fact=phase==='pre'?delegate.preReceipt:delegate.attReceipt;
      return state==='received'?fact==='Received':state==='absent'?fact==='Absent in selected source snapshot':fact!=='Received'&&fact!=='Absent in selected source snapshot';
    };
    const compare=(a:DelegateView,b:DelegateView)=>sort.value==='address'?a.address.localeCompare(b.address):sort.value==='alias'?(a.searchAlias??a.alias??'').localeCompare(b.searchAlias??b.alias??'')||a.address.localeCompare(b.address):b.power-a.power||a.address.localeCompare(b.address);
    let list:DelegateView[];
    if(full){const byAddress=new Map(all.map(delegate=>[delegate.address,delegate]));const matching=all.filter(matches);
      if(reset){order=matching.sort(compare).map(delegate=>delegate.address);reset=false;}
      else {order=order.filter(address=>{const delegate=byAddress.get(address);return delegate!==undefined&&(matches(delegate)||rows.get(address)?.contains(document.activeElement));});const retained=new Set(order);for(const delegate of matching)if(!retained.has(delegate.address)){order.push(delegate.address);retained.add(delegate.address);}}
      list=order.map(address=>byAddress.get(address)!);
      const matchingFacts=query?unknownFacts.filter(fact=>fact.toLowerCase().includes(query)):unknownFacts;
      set(unknownSummary,`Unknown-rights observations · ${matchingFacts.length?number(matchingFacts.length):'None matching this query'}`);
      const visibleFacts=unknown.open?matchingFacts.slice(0,100):[];
      if(unknown.open)set(unknownNote,matchingFacts.length?`Showing ${visibleFacts.length} of ${number(matchingFacts.length)} matching observations · Unknown power until committee rights are proven.`:'None matching this query');
      for(let index=0;index<visibleFacts.length;index++){let item=unknownList.children[index] as HTMLLIElement|undefined;if(!item){item=el('li');unknownList.append(item);}set(item,visibleFacts[index]!);}
      while(unknownList.children.length>visibleFacts.length)unknownList.lastElementChild?.remove();
    }else list=all.sort((a,b)=>b.power-a.power);
    if(full)set(intro,`Validated-rights delegates · ${!known||all.some(delegate=>delegate.preReceipt==='Partial / unavailable'||delegate.attReceipt==='Partial / unavailable')?'Coverage partial / unavailable; absence is not established for those phase rows':'Usable selected-source snapshot receipt states'} · no network-wide inactivity or global completeness claim.`);
    const forbidden = list.filter(item => item.forbidden || item.eligibility === 'forbidden').length;
    const sum = list.reduce((acc, item) => acc + item.power, 0);
    set(summary, known ? `${title} · ${list.length} bakers · ${number(sum)} power${forbidden ? ` · ${forbidden} forbidden` : ''}` : `${title} · unavailable`);
    const keep = new Set(list.map(item => item.address));
    for (const [address, row] of rows) if (!keep.has(address)) {row.remove(); rows.delete(address);}
    list.forEach((delegate, index) => {
      let row = rows.get(delegate.address);
      if (!row) {row = el('tr'); for (let i = 0; i < (full?8:5); i++) row.append(el('td')); rows.set(delegate.address, row);}
      const cells = row.children;
      const pending=full&&!matches(delegate);set(cells[0] as HTMLElement,`${delegate.alias??'No alias'}${pending?' · Pending exclusion until focus leaves':''}`);row.dataset.pendingExclusion=String(pending);
      const address = cells[1] as HTMLElement;
      let addressText = address.querySelector('span');
      if (!addressText) {
        addressText = el('span', 'address-text', short(delegate.address));
        const copy = el('button', 'address-copy', 'Copy'); copy.type = 'button';
        copy.setAttribute('aria-label', `Copy full address for ${delegate.alias ?? delegate.address}`);
        copy.addEventListener('click', () => {void navigator.clipboard?.writeText(delegate.address).then(() => {set(copy, 'Copied'); setTimeout(() => set(copy, 'Copy'), 1400);}).catch(() => set(copy, 'Unavailable'));});
        address.append(addressText, copy);
      }
      address.querySelector('button')?.setAttribute('aria-label',`Copy full address for ${delegate.alias??delegate.address}`);
      address.title = delegate.address;
      set(cells[2] as HTMLElement, number(delegate.power)); set(cells[3] as HTMLElement, total ? `${(100 * delegate.power / total).toFixed(2)}%` : '—');
      const eligibility = delegate.forbidden ? 'forbidden' : delegate.eligibility ?? 'unavailable';
      const badge = cells[4] as HTMLElement; set(badge, delegate.eligibilityState==='context-invalid'?'Context invalid':delegate.eligibilityState==='stale'?'Stale':eligibility === 'unavailable' ? 'Unknown' : eligibility === 'forbidden' ? 'Forbidden' : 'Eligible'); badge.dataset.eligibility = eligibility;badge.title=delegate.eligibilityNote??'Eligibility evidence unavailable';
      if(full){set(cells[5] as HTMLElement,delegate.preReceipt??'Partial / unavailable');set(cells[6] as HTMLElement,delegate.attReceipt??'Partial / unavailable');const contextCell=cells[7] as HTMLElement;let contextText=contextCell.querySelector('p');if(!contextText){const detail=el('details','participant-context');detail.append(el('summary','','Source & context'));contextText=el('p');detail.append(contextText);contextCell.append(detail);}set(contextText,delegate.contextNote??'Context unavailable');}
      if (tbody.children[index] !== row) tbody.insertBefore(row, tbody.children[index] ?? null);
    });
    empty.hidden = known && list.length > 0; viewport.hidden = full?false:!known || list.length === 0;
    if(full)table.hidden=!known||list.length===0;
    set(empty, known ? full?'No validated committee delegates match these controls.':'All expected bakers observed for this phase.' : 'Rights or observations unavailable.');
    // Removing an observed signer can trigger browser scroll anchoring to a new row.
    viewport.scrollTop = scrollTop;
    if(full&&known&&list.length>0)retainedScrollTop=viewport.scrollTop;
  }
  return {root:details,update(delegates:DelegateView[]|undefined,total:number|undefined,observations:readonly string[]=[]){current=delegates;currentTotal=total;unknownFacts=observations;render();}};
}

export function createDashboard(root: HTMLElement, options: {sourceControls?:Partial<Record<Network,HTMLElement>>;onReadEligibility?:(network:Network)=>void;onNetworkChange?:(network:Network)=>void;onRefreshIntervals?:(network:Network)=>void;onPauseChange?: (paused: boolean) => void; onReconnect?: () => void; revision?: string; onSelect?: (network:Network, identity:string)=>void;onRetry?: (network:Network,identity:string)=>void;onPin?:(network:Network)=>void;onFollow?:(network:Network)=>void;onLatest?:(network:Network)=>void;onCompare?:(network:Network,url:string)=>void} = {}): {update(network: Network, model: NetworkViewModel): void; tick(now?: number): void} {
  root.classList.add('consensus-app');
  const header = el('header', 'masthead'), brand = el('div', 'header-brand');
  const mark = el('img', 'header-mark'); mark.src='./observatory-mark.svg'; mark.alt=''; mark.width=40; mark.height=40;
  const brandText = el('div', 'header-brand-text');
  brandText.append(el('div', 'eyebrow', 'Consensus / browser observer'), el('h1', '', 'Tezos Observatory'));
  brand.append(mark, brandText);
  const controls = el('div', 'header-controls');
  const live = el('div', 'live-label', `Browser monitoring · v3${options.revision ? ` / ${options.revision}` : ''}`); live.prepend(el('span', 'live-dot'));
  const pause = el('button', 'control-button', 'Pause'), reconnect = el('button', 'control-button', 'Reconnect'); pause.type = reconnect.type = 'button';
  let paused = false;
  pause.addEventListener('click', () => {paused = !paused; set(pause, paused ? 'Resume' : 'Pause'); pause.setAttribute('aria-pressed', String(paused)); options.onPauseChange?.(paused);});
  reconnect.addEventListener('click', () => options.onReconnect?.());
  const bakerLink=el('a','control-button','Baker & DAL');bakerLink.href='./baker.html?view=dal&network=mainnet';
  controls.append(live, pause, reconnect,bakerLink); header.append(brand, controls);
  const appearance = el('div', 'appearance');
  appearance.append(el('span', 'eyebrow', 'Appearance'));
  const theme = nativeChoice('Appearance',[['system','System'],['light','Light'],['dark','Dark']]);
  const themeNotice = el('span', 'theme-notice', 'Theme saved for this session only'); themeNotice.hidden = true;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  try {const stored = localStorage.getItem('observatory:theme'); theme.value = stored === 'light' || stored === 'dark' ? stored : 'system';} catch {theme.value = 'system';}
  const applyTheme = () => {document.documentElement.dataset.theme = theme.value === 'system' ? systemTheme.matches ? 'dark' : 'light' : theme.value;};
  theme.onChange(() => {applyTheme(); try {localStorage.setItem('observatory:theme', theme.value); themeNotice.hidden = true;} catch {themeNotice.hidden = false; set(themeNotice, 'Theme saved for this session only');}});
  systemTheme.addEventListener('change', () => {if (theme.value === 'system') applyTheme();}); applyTheme();
  const paletteLabel = el('div', 'palette-label', 'Colour palette');
  const paletteOptions = [['pollen','Graphite & pollen'],['braise','Braise'],['cinabre','Encre & cinabre'],['ocre','Pierre & ocre'],['reference','Forest / copper']] as const;
  const palette = nativeChoice('Colour palette',paletteOptions);palette.root.classList.add('palette-choice');
  const paletteNotice = el('span', 'palette-notice', 'Palette saved for this session only'); paletteNotice.hidden = true;
  const knownPalette = (value: string | null) => paletteOptions.some(([id]) => id === value) ? value ?? 'pollen' : 'pollen';
  try {palette.value = knownPalette(localStorage.getItem('observatory:palette'));} catch {palette.value = 'pollen';}
  const applyPalette = () => {document.documentElement.dataset.palette = palette.value;};
  palette.group.addEventListener('change', event => {
    event.stopPropagation(); applyPalette();
    try {localStorage.setItem('observatory:palette', palette.value); paletteNotice.hidden = true;} catch {paletteNotice.hidden = false;}
  });
  applyPalette(); paletteLabel.append(palette.root); theme.group.append(paletteLabel, paletteNotice);
  appearance.append(theme.root, themeNotice); controls.append(appearance);
  const tabs = el('nav', 'network-tabs'); tabs.setAttribute('aria-label', 'Network');
  const grid = el('div', 'network-grid');
  const announcements = el('div', 'sr-only'); announcements.setAttribute('aria-live', 'polite'); announcements.setAttribute('role', 'status');
  const footer = el('footer', 'page-footer', 'Read-only monitoring · RPC streams are opened by this browser while the page is visible. No signatures, no node changes.');
  root.replaceChildren(header, tabs, grid, footer, announcements);
  const states = new Map<Network, {model?: NetworkViewModel; tick(now: number): void; update(model: NetworkViewModel): void}>();
  let retainedLength:HistoryLength=500;try {retainedLength=historyLength(localStorage.getItem('observatory:path-length'));} catch { /* Storage is optional. */ }
  const lengthControls:ReturnType<typeof nativeChoice>[]=[],resizeHistories:((length:HistoryLength)=>void)[]=[];
  for (const network of ['mainnet', 'shadownet'] as const) {
    const name = network === 'mainnet' ? 'Mainnet' : 'Shadownet';
    const tab = el('button', `network-tab ${network}`), tabName = el('span', '', name), tabStatus = el('span', 'tab-status', 'Connecting'); tab.append(tabName, tabStatus); tab.type = 'button';
    let selected = 'mainnet'; try {selected = localStorage.getItem('consensus-v2:network') ?? selected;} catch { /* Optional storage. */ }
    tab.setAttribute('aria-pressed', String(network === selected));
    tab.addEventListener('click', () => {root.dataset.selected = network; options.onNetworkChange?.(network); try {localStorage.setItem('consensus-v2:network', network);} catch { /* Optional storage. */ } for (const button of tabs.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button === tab));}); tabs.append(tab);
    const panel = el('article', `network-panel ${network}`); panel.setAttribute('aria-label', `${name} observation workspace`); panel.dataset.network = network; panel.dataset.status = 'loading';
    const panelHeader = el('div', 'panel-header'), heading = el('h2', '', name), status = el('span', 'status-chip', 'Connecting'); panelHeader.append(heading, status);
    const headline = el('div', 'headline'), level = field(headline, 'Consensus level'), round = field(headline, 'Current round');
    const appliedContext = el('p', 'applied-context table-note', 'Last applied block unavailable');
    const appliedStability=el('span','applied-stability','Applied-head session age unknown');
    const proposalContext = el('p', 'proposal-context', 'Proposal observation unavailable');
    const connection = el('div', 'connection-line'), transport = el('span', '', 'Connecting to RPC streams…'), freshness = el('span', '', 'No observation yet'); connection.append(transport, freshness,appliedStability);
    const notice = el('div', 'network-notice', 'Waiting for the first successful observation.');
    const consensus = el('section', 'consensus-section'), sectionTitle = el('div', 'section-heading');
    sectionTitle.append(el('h3', '', 'Committee participation')); const activity = el('span', 'subtle', 'Activity round —'); sectionTitle.append(activity);
    const selection = el('p', 'selection-label', 'Level — · payload unavailable');
    const candidateControls = el('div', 'candidate-controls'); candidateControls.setAttribute('aria-label','Observed candidates and payloads');
    const alternatives=el('details','observed-proposals'),alternativesSummary=el('summary','','Proposals with observed votes (0)');
    const alternativesNote=el('p','table-note','Same level, round and source context, with received voting power. Strongest phase support first; inspect to pin an instance. Payload signatures can be shared by several block hashes.');
    alternatives.append(alternativesSummary,alternativesNote,candidateControls);
    const candidateEvidence = el('p','candidate-evidence table-note');
    const selectedHeader = el('div', 'selected-heading'), selectedTitle = el('h2', 'selected-title', 'Observation unavailable'); selectedHeader.append(el('p', 'eyebrow', 'Selected consensus instance'), selectedTitle);
    const selectedRelationship=el('p','selected-relationship'),nextProposalObservation=el('p','next-proposal-observation table-note');
    const selectedKind = el('p', 'selected-kind', 'Waiting for observed evidence'), selectedPayload = el('p', 'selected-payload');
    const selectedProof = disclosure('Selected identity & phase provenance', `observatory:${network}:identity`); selectedProof.body.append(candidateEvidence);
    const captured=el('details','captured-candidates'),capturedSummary=el('summary','','Captured block observations (0)'),capturedButtons=el('div','candidate-controls');
    captured.append(capturedSummary,el('p','table-note','Block identities captured in this retained instance. Inspecting pins its recorded evidence; voting power can be unavailable.'),capturedButtons);selectedProof.body.append(captured);
    const capturedControls=new Map<string,HTMLButtonElement>();
    const inspector = el('section', 'selected-inspector'); inspector.setAttribute('aria-label', 'Selected consensus evidence');
    let retryIdentity:string|undefined;
    const retry=el("button","","Retry selected observer context");retry.type="button";retry.hidden=true;retry.addEventListener("click",()=>{if(retryIdentity)options.onRetry?.(network,retryIdentity);});
    const candidateButtons = new Map<string,HTMLButtonElement>();
    const gauges = el('div', 'gauges'), pre = gauge('Preattestations', 'pre'), att = gauge('Attestations', 'att'); gauges.append(pre.root, att.root); const retrySlot=el('div','retry-slot');retrySlot.append(retry);consensus.append(sectionTitle, selection,retrySlot, gauges,selectedProof.details);
    const opportunities = el('section', 'opportunities'), timingHeader = el('div', 'section-heading'); timingHeader.append(el('h3', '', 'Observed path & conditional branches'));
    const countdown = el('span', 'countdown', 'Timing unavailable');
    const timing = el('p', 'timing-detail address-text', 'Independent clock estimate unavailable');
    const clockProof=disclosure('Independent applied-head clock', `observatory:${network}:clock`); clockProof.body.append(countdown,timing);
    const bakerRows = el('div', 'baker-rows');
    const junction=el('div','navigator-junction'),camera=el('div','navigator-camera'),stage=el('div','navigator-stage'),previousNode=el('section','navigator-previous'),currentNode=el('section','navigator-current');
    junction.tabIndex=0;junction.setAttribute('aria-label','Observed path. Drag or use the camera direction buttons to explore retained observations.');
    previousNode.setAttribute('aria-label','Previous block context');currentNode.setAttribute('aria-label','Selected observed anchor');
    const previousTarget=el('strong','branch-target','Previous block unavailable'),previousKind=el('span','subtle'),previousHash=el('span','address-text'),previousRelation=el('span','subtle');
    previousNode.append(el('span','eyebrow','← Previous block'),previousTarget,previousKind,previousHash,previousRelation);
    const currentTarget=el('strong','branch-target','Observation unavailable'),currentKind=el('span','subtle'),currentHash=el('span','address-text');
    const copyHash=el('button','address-copy','Copy block hash');copyHash.type='button';let observedHash:string|undefined;
    copyHash.addEventListener('click',()=>{if(observedHash)void navigator.clipboard?.writeText(observedHash).then(()=>set(copyHash,'Copied')).catch(()=>set(copyHash,'Copy unavailable'));});
    const currentPhases=el('span','path-phase-summary subtle');
    currentNode.append(el('span','eyebrow','Observed / selected'),currentTarget,currentKind,currentHash,currentPhases,copyHash);
    stage.append(previousNode,currentNode,bakerRows);camera.append(stage);junction.append(camera);
    for(const name of ['previous','round','level']){const edge=el('span',`navigator-edge navigator-edge-${name}`);edge.setAttribute('aria-hidden','true');stage.append(edge);}
    const navigatorStatus=el('p','navigator-status subtle','Solid: observation · dashed: conditional · no implied finality');
    const navigation=el('nav','navigator-navigation'),pathStatus=el('span','path-camera-status subtle');navigation.setAttribute('aria-label','Path camera');
    const navigatorContext=el('aside','navigator-context');
    const selectedContext=el('dl','navigator-context-fields');
    const contextFields=new Map<string,HTMLElement>();
    for(const label of ['Observer','Chain','Context head','Execution protocol','Received']){selectedContext.append(el('dt','eyebrow',label));const value=el('dd');selectedContext.append(value);contextFields.set(label,value);}
    navigatorContext.append(el('h4','','Selected observation context'),selectedContext,clockProof.details);
    opportunities.append(timingHeader,junction,navigation,navigatorStatus);
    const contextProof=disclosure('Selected observation context',`observatory:${network}:navigator-context`);contextProof.body.append(navigatorContext);
    const missing = el('section', 'missing-section'); missing.append(el('h3', '', 'Expected bakers not observed'));
    const recent = recentConsensus();
    const missingPre = delegateList(network, 'Pre'), missingAtt = delegateList(network, 'Att'); missing.append(missingPre.root, missingAtt.root);
    const committee=delegateList(network,'Committee');
    const readEligibility=el('button','eligibility-read','Read committee eligibility');readEligibility.type='button';
    if(network==='shadownet'){readEligibility.addEventListener('click',()=>options.onReadEligibility?.(network));committee.root.querySelector('.disclosure-body')?.prepend(readEligibility);}
    const evidence = disclosure('Sources & observation evidence', `consensus-v2:${network}:evidence`);
    const rawObservations=el('details','raw-observations'),rawSummary=el('summary','','Unresolved raw observations (0)'),rawButtons=el('div','candidate-controls');
    rawObservations.append(rawSummary,el('p','table-note','Source-local context or voting power remains unproven. Inspect raw facts and retry their observer proof; these are not validated committee support.'),rawButtons);evidence.body.append(rawObservations);
    const rawControls=new Map<string,HTMLButtonElement>();
    const metadata = el('dl', 'evidence-meta');
    const meta = new Map<string, HTMLElement>();
    for (const label of ['Primary source', 'Applied head', 'Block hash', 'Last successful head', 'Last operation', 'Block age', 'Snapshot age']) {metadata.append(el('dt', '', label)); const value = el('dd', '', 'Unavailable'); metadata.append(value); meta.set(label, value);}
    const sessionControls=el("div","session-controls"),sessionNote=el("p","table-note"),sessionSelect=nativeChoice("Retained session instance");
    const previous=el("button","control-button","Previous");previous.setAttribute("aria-label","Previous observation");previous.type="button";let previousIdentity:string|undefined;previous.addEventListener("click",()=>{if(previousIdentity)options.onSelect?.(network,previousIdentity);});
    const pinSelected=el("button","control-button","Pin"),latest=el("button","control-button","Latest"),follow=el("button","control-button","Follow");pinSelected.setAttribute("aria-label","Pin selected instance");follow.setAttribute("aria-label","Follow live");for(const button of [pinSelected,latest,follow])button.type="button";
    pinSelected.addEventListener("click",()=>options.onPin?.(network));latest.addEventListener("click",()=>options.onLatest?.(network));follow.addEventListener("click",()=>options.onFollow?.(network));sessionSelect.onChange(()=>{if(sessionSelect.value)options.onSelect?.(network,sessionSelect.value);});const sessionMode=el('p','session-mode');const retention=el('details','retention-detail');retention.append(el('summary','','Session limits'),sessionNote);sessionControls.append(sessionMode,previous,pinSelected,latest,follow,retention);
    const sessionRail=el("aside","session-rail");sessionRail.setAttribute("aria-label","Session history");sessionRail.append(el("h3","","Session history"),sessionSelect.root,recent.root);
    const comparisonSection=el('section','source-comparison'),comparisonProvider=nativeChoice('Comparison provider'),compare=el('button','control-button','Compare selected observation'),comparisonResult=el('div','comparison-result table-note');
    compare.type='button';compare.addEventListener('click',()=>options.onCompare?.(network,comparisonProvider.value));comparisonSection.append(el('h4','','Independent source comparison'),comparisonProvider.root,compare,comparisonResult);evidence.body.append(comparisonSection);
    const retainedList=el('ol','retained-history');retainedList.setAttribute('aria-label','Retained observations in receipt order');
    sessionRail.insertBefore(retainedList,recent.root);const historyButtons=new Map<string,HTMLButtonElement>();
    const authorityEvidence=el('p','authority-evidence table-note');
    const sourceRows = el('div', 'source-rows'), history = el('ol', 'event-history'); evidence.body.append(metadata, authorityEvidence, sourceRows, el('h4', '', 'Recent network events'), history);
    const observer = el('section', 'observer-summary'); observer.append(panelHeader, connection, headline, appliedContext,nextProposalObservation);
    const sourcePane = el('aside', 'source-pane'); sourcePane.append(el('h3', '', 'Sources & limits'),contextProof.details,sourceRows,...(options.sourceControls?.[network]?[options.sourceControls[network]]:[]),comparisonSection,evidence.details);evidence.body.prepend(authorityEvidence);
    inspector.append(selectedHeader,selectedRelationship, selectedKind,selectedPayload,proposalContext,alternatives,consensus,notice,missing);
    const intervals=blockIntervalRegion(network,()=>options.onRefreshIntervals?.(network));
    const workspace=el('div','inspection-workspace'); workspace.append(sessionRail,inspector,intervals.root,committee.root,sourcePane);
    panel.append(observer,sessionControls,opportunities,workspace); grid.append(panel);
    const keyedBakers = new Map<string, HTMLElement>(), keyedSources = new Map<string, HTMLElement>();
    let current: NetworkViewModel | undefined,previousAnnouncement:string|undefined;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    let cameraAnimation:Animation|undefined,departures:HTMLElement|undefined,cameraX=0,cameraY=0,cameraAnchor:ObservedNavigatorView|undefined;
    const anchorKey=(anchor:ObservedNavigatorView):string=>JSON.stringify([anchor.identity,anchor.source,anchor.chain,anchor.protocol,anchor.contextHead,anchor.contextParent,anchor.level,anchor.round,anchor.hash,anchor.payload]);
    const cardPresentation=(node:HTMLElement)=>{
      const copy=node.cloneNode(true) as HTMLElement,originals=[node,...node.querySelectorAll<HTMLElement>('*')],copies=[copy,...copy.querySelectorAll<HTMLElement>('*')];
      for(const [index,original] of originals.entries()){
        const child=copies[index];if(!child)continue;
        const rendered=getComputedStyle(original);
        for(const property of ['order','flex-shrink','flex-grow','flex-basis','align-self','font-size','font-weight','font-family','line-height','letter-spacing','text-transform','padding','margin','min-height','max-width','display','white-space','overflow-wrap'])child.style.setProperty(property,rendered.getPropertyValue(property));
      }
      return {node:copy,scrolls:originals.map(original=>({top:original.scrollTop,left:original.scrollLeft}))};
    };
    // Only the inert departing visual may reuse this last coherent, context-bound card.
    let observedCard:{key:string;presentation:ReturnType<typeof cardPresentation>}|undefined,navigatorHadOpportunities=false;
    const cancelCamera=():void=>{cameraAnimation?.cancel();cameraAnimation=undefined;departures?.remove();departures=undefined;previousNode.style.opacity='';};
    const path=new NavigatorPath(retainedLength),past=el('div','navigator-past'),pastCards=new Map<string,HTMLElement>();stage.append(past);
    const proposalDialog=el('dialog','path-observations'),dialogTitle=el('h3','','Observed proposals'),dialogNote=el('p','table-note','Local observations only; not a canonical-chain or uncle claim. Payload-only observations do not identify a block. Votes may be shared by several hashes of the same payload.'),dialogRows=el('ol','path-observation-rows'),dialogPaging=el('div','path-observation-paging'),dialogPage=el('span','subtle'),dialogPrevious=el('button','','Previous page'),dialogNext=el('button','','Next page'),dialogClose=el('button','','Close observed proposals');
    proposalDialog.setAttribute('aria-label','Retained observed proposals');dialogPrevious.type=dialogNext.type=dialogClose.type='button';
    dialogPaging.append(dialogPrevious,dialogPage,dialogNext);proposalDialog.append(dialogTitle,dialogNote,dialogRows,dialogPaging,dialogClose);panel.append(proposalDialog);
    let proposalPage=0,proposalFilter:{level:number;round:number}|undefined;
    const renderObservations=():void=>{
      const values=(proposalFilter?path.observations(proposalFilter.level,proposalFilter.round):path.records).slice().sort((a,b)=>b.anchor.receivedMonotonic-a.anchor.receivedMonotonic);
      proposalPage=Math.max(0,Math.min(proposalPage,Math.ceil(values.length/10)-1));dialogRows.replaceChildren();
      for(const record of values.slice(proposalPage*10,proposalPage*10+10)){
        const anchor=record.anchor,row=el('li','path-observation'),identity=anchor.hash??anchor.payload??anchor.identity;
        row.append(el('strong','',`Level ${number(anchor.level)} · r${anchor.round} · ${anchor.hash?'Observed block':'Payload-only observation'}`),el('span','address-text',identity),el('span','path-phase-summary subtle',`pre ${record.pre?`${number(record.pre.power)}/${number(record.pre.total)}`:'unknown'} · att ${record.att?`${number(record.att.power)}/${number(record.att.total)}`:'unknown'}`),el('span','subtle address-text',`Source ${anchor.source} · chain ${anchor.chain} · protocol ${anchor.protocol} · context ${anchor.contextHead} · parent ${anchor.contextParent} · proposal received ${new Date(anchor.receivedAt).toISOString()}`));
        if(anchor.hash){const hash=anchor.hash,copy=el('button','address-copy','Copy block hash');copy.type='button';copy.addEventListener('click',()=>{void navigator.clipboard?.writeText(hash).then(()=>set(copy,'Copied')).catch(()=>set(copy,'Copy unavailable'));});row.append(copy);}
        dialogRows.append(row);
      }
      set(dialogTitle,proposalFilter?`Observed alternatives · level ${number(proposalFilter.level)} · r${proposalFilter.round}`:'Retained observed proposals');
      set(dialogPage,`${values.length} observations · page ${proposalPage+1}/${Math.max(1,Math.ceil(values.length/10))}`);dialogPrevious.disabled=proposalPage===0;dialogNext.disabled=(proposalPage+1)*10>=values.length;
    };
    const showObservations=(filter?:{level:number;round:number}):void=>{proposalFilter=filter;proposalPage=0;renderObservations();proposalDialog.showModal();};
    dialogPrevious.addEventListener('click',()=>{proposalPage--;renderObservations();});dialogNext.addEventListener('click',()=>{proposalPage++;renderObservations();});dialogClose.addEventListener('click',()=>proposalDialog.close());
    const allObservations=el('button','path-observations-open','Observed proposals (0)');allObservations.type='button';allObservations.setAttribute('aria-label','Inspect retained proposals');allObservations.addEventListener('click',()=>showObservations());
    const currentAlternatives=el('button','path-alternatives','No observed alternatives');currentAlternatives.type='button';currentNode.append(currentAlternatives);
    const updateObservationBadge=(button:HTMLButtonElement,anchor:ObservedNavigatorView):void=>{
      const count=path.observations(anchor.level,anchor.round).length;set(button,count>1?`${count} observed identities`:'No observed alternatives');button.disabled=!!localCamera||count<2;
      button.setAttribute('aria-label',`Inspect observed alternatives for level ${anchor.level} round ${anchor.round}`);
      button.onclick=()=>showObservations({level:anchor.level,round:anchor.round});
    };
    const historyLabel=el('div','path-history-length','History length'),historySelect=nativeChoice('History length',historyLengths.map(length=>[String(length),String(length)] as const));
    historySelect.value=String(retainedLength);historyLabel.append(historySelect.root);lengthControls.push(historySelect);
    historySelect.root.addEventListener('toggle',()=>{if(!historySelect.root.open)return;const box=historySelect.root.getBoundingClientRect(),above=box.top,below=innerHeight-box.bottom,up=above>below;historySelect.group.style.top=up?'auto':'100%';historySelect.group.style.bottom=up?'100%':'auto';historySelect.group.style.maxHeight=`${Math.max(44,Math.min(320,(up?above:below)-8))}px`;});
    historySelect.onChange(()=>{retainedLength=historyLength(historySelect.value);try {localStorage.setItem('observatory:path-length',String(retainedLength));} catch { /* The local choice still works without storage. */ }for(const control of lengthControls)control.value=String(retainedLength);for(const resize of resizeHistories)resize(retainedLength);});
    navigation.append(historyLabel,allObservations);resizeHistories.push(length=>{path.setLimit(length);layoutPath();});
    const naturalTabIndex=new WeakMap<HTMLElement,string|null>();
    let cameraFollowing=true,viewX=0,viewY=0,pathActive=false,localCamera:ObservedNavigatorView|undefined;
    const knownPhase=(phase:VoteView|undefined)=>phase&&Number.isSafeInteger(phase.power)&&Number.isSafeInteger(phase.total)&&phase.power>=0&&phase.power<=phase.total&&phase.total>0?{power:phase.power,total:phase.total,...(phase.threshold===undefined?{}:{threshold:phase.threshold})}:undefined;
    const paintPhases=(node:HTMLElement,summary:HTMLElement,pre:NavigatorPathRecord['pre'],att:NavigatorPathRecord['att']):void=>{
      for(const [name,phase] of [['pre',pre],['att',att]] as const)node.style.setProperty(`--path-${name}`,`${phase?Math.min(100,100*phase.power/phase.total):0}%`);
      set(summary,`pre ${pre?`${number(pre.power)}/${number(pre.total)}`:'unknown'} · att ${att?`${number(att.power)}/${number(att.total)}`:'unknown'}`);
    };
    const cardAccess=():void=>{
      if(cameraAnimation)return;
      const frame=junction.getBoundingClientRect();
      for(const card of [currentNode,...bakerRows.querySelectorAll<HTMLElement>('.baker-opportunity'),...pastCards.values()]){
        const box=card.getBoundingClientRect(),inside=box.left>=frame.left-.5&&box.right<=frame.right+.5&&box.top>=frame.top-.5&&box.bottom<=frame.bottom+.5;
        card.inert=!inside&&!card.contains(document.activeElement);
        for(const control of card.querySelectorAll<HTMLElement>('button,summary,a,input,select,[tabindex]')){
          if(!naturalTabIndex.has(control))naturalTabIndex.set(control,control.getAttribute('tabindex'));
          const original=naturalTabIndex.get(control);
          if(!inside)control.tabIndex=-1;else if(original===null)control.removeAttribute('tabindex');else if(original!==undefined)control.setAttribute('tabindex',original);
        }
      }
    };
    const cameraDestination=():NavigatorPathRecord|undefined=>localCamera?{key:anchorKey(localCamera),anchor:localCamera,x:0,y:0,gapBefore:false}:path.current;
    const layoutPath=():void=>{
      const width=junction.clientWidth;if(!width)return;
      const gapX=parseFloat(getComputedStyle(junction).columnGap)||12,gapY=parseFloat(getComputedStyle(junction).rowGap)||12;
      const cardWidth=width<700?Math.min(260,width*.78):Math.min(340,(width-2*gapX)/3),cardHeight=parseFloat(getComputedStyle(junction).gridTemplateRows);
      const stepX=cardWidth+gapX,stepY=cardHeight+gapY,totalWidth=3*cardWidth+2*gapX;
      camera.style.width=`${totalWidth}px`;camera.style.left=`${(width-totalWidth)/2}px`;
      const destination=cameraDestination(),retainedRecords=pathActive?path.positions:[];
      if(!pathActive&&!localCamera||!destination){camera.style.transform='translate(0,0)';past.hidden=true;set(pathStatus,'Retained path unavailable · observations accumulate during this browser session');cardAccess();return;}
      past.hidden=!pathActive;
      if(cameraFollowing){viewX=destination.x;viewY=destination.y;}
      camera.style.transform=`translate(${(destination.x-viewX)*stepX}px,${(destination.y-viewY)*stepY}px)`;
      const visible=retainedRecords.filter(record=>record.key!==destination.key&&Math.abs(record.x-viewX)<=2&&Math.abs(record.y-viewY)<=2).sort((a,b)=>Math.abs(a.x-viewX)+Math.abs(a.y-viewY)-Math.abs(b.x-viewX)-Math.abs(b.y-viewY)).slice(0,9),wanted=new Set(visible.map(record=>record.key));
      for(const [key,card] of pastCards)if(!wanted.has(key)){card.remove();pastCards.delete(key);}
      for(const record of visible){
        let card=pastCards.get(record.key);
        if(!card){
          card=el('section','navigator-path-card');card.dataset.identity=record.anchor.identity;card.dataset.pathKey=record.key;
          const hash=record.anchor.hash,copy=el('button','address-copy','Copy block hash');copy.type='button';copy.disabled=!hash;
          copy.addEventListener('click',()=>{if(hash)void navigator.clipboard?.writeText(hash).then(()=>set(copy,'Copied')).catch(()=>set(copy,'Copy unavailable'));});
          const identity=el('span','address-text',hash?short(hash):'Proposal hash unavailable');identity.title=hash??'No proposal hash observed';
          const alternatives=el('button','path-alternatives');alternatives.type='button';
          card.append(el('span','eyebrow','Observed earlier'),el('strong','branch-target',`${number(record.anchor.level)} · r${record.anchor.round}`),el('span','subtle',hash?'Observed block':'Votes only'),identity,el('span','path-phase-summary subtle'),copy,alternatives);
          pastCards.set(record.key,card);past.append(card);
        }
        card.dataset.worldX=String(record.x);card.dataset.worldY=String(record.y);
        card.style.left=`${stepX+(record.x-destination.x)*stepX}px`;card.style.top=`${stepY+(record.y-destination.y)*stepY}px`;card.style.width=`${cardWidth}px`;card.style.height=`${cardHeight}px`;
        card.title=`Source ${record.anchor.source} · chain ${record.anchor.chain} · protocol ${record.anchor.protocol} · context ${record.anchor.contextHead} · parent ${record.anchor.contextParent} · as of ${new Date(record.anchor.receivedAt).toISOString()}`;
        const alternatives=card.querySelector<HTMLButtonElement>('.path-alternatives');if(alternatives)updateObservationBadge(alternatives,record.anchor);
        const summary=card.querySelector<HTMLElement>('.path-phase-summary');if(summary)paintPhases(card,summary,record.pre,record.att);
      }
      for(const edge of past.querySelectorAll('.navigator-path-edge,.navigator-path-gap'))edge.remove();
      const records=[...visible,destination];
      for(const record of records){
        const older=retainedRecords.find(value=>value.x===record.x-1&&value.y===record.y||value.x===record.x&&value.y===record.y+1);if(!older)continue;
        const x=stepX+(record.x-destination.x)*stepX,y=stepY+(record.y-destination.y)*stepY;
        if(record.gapBefore){const gap=el('span','navigator-path-gap subtle','Observation gap');gap.style.left=`${x}px`;gap.style.top=`${y-22}px`;past.append(gap);continue;}
        const relation=navigatorDirection(older.anchor,record.anchor);
        if(older.x===record.x?relation!=='up':relation!=='right')continue;
        const edge=el('span','navigator-path-edge');edge.setAttribute('aria-hidden','true');
        if(older.x===record.x){Object.assign(edge.style,{left:`${x+cardWidth/2}px`,top:`${y+cardHeight}px`,height:`${gapY}px`,borderLeft:'2px dotted var(--muted)'});}
        else{Object.assign(edge.style,{left:`${x-gapX}px`,top:`${y+30}px`,width:`${gapX}px`,borderTop:`2px ${record.anchor.hash&&older.anchor.hash===record.anchor.predecessor?.hash&&record.anchor.predecessor?.relation==='ancestry'?'solid var(--forest)':'dotted var(--muted)'}`});}
        past.append(edge);
      }
      const count=path.records.length,truncated=path.truncated;
      set(pathStatus,localCamera?'Pinned camera · captured conditional branches':`${cameraFollowing?'Live camera':'Exploring retained path'} · ${count}${path.limit==='unlimited'?' · unlimited (memory grows)':`/${path.limit}`} observed proposals · phase peaks, not finality${truncated.records?' · older observations retired':''}`);
      set(allObservations,`Observed proposals (${count})`);allObservations.disabled=!pathActive;
      const anchor=localCamera??path.current?.anchor;if(anchor)updateObservationBadge(currentAlternatives,anchor);
      junction.dataset.cameraFollowing=String(cameraFollowing);junction.dataset.viewX=String(viewX);junction.dataset.viewY=String(viewY);
      // Buffered tiles are reached by panning, never by scrolling the clipped frame on Tab.
      cardAccess();
    };
    const panCamera=(x:number,y:number):void=>{
      const destination=cameraDestination();if(!pathActive&&!localCamera||!destination)return;
      cancelCamera();cameraFollowing=false;
      const records=pathActive?path.records:[destination],xs=records.map(record=>record.x),ys=records.map(record=>record.y);
      viewX=Math.max(Math.min(...xs)-1,Math.min(Math.max(...xs)+1,x));viewY=Math.max(Math.min(...ys)-1,Math.min(Math.max(...ys)+1,y));layoutPath();
    };
    for(const [label,dx,dy] of [['←',-1,0],['↓',0,1],['→',1,0],['↑',0,-1]] as const){const button=el('button','path-pan',label);button.type='button';button.setAttribute('aria-label',`Pan path ${dx<0?'left':dx>0?'right':dy>0?'down':'up'}`);button.addEventListener('click',()=>panCamera(viewX+dx,viewY+dy));navigation.append(button);}
    const returnLive=el('button','path-live','Return to live');returnLive.type='button';returnLive.addEventListener('click',()=>{cancelCamera();cameraFollowing=true;layoutPath();});navigation.append(returnLive,pathStatus);
    junction.addEventListener('keydown',event=>{if(event.target!==junction)return;const delta=event.key==='ArrowLeft'?[-1,0]:event.key==='ArrowRight'?[1,0]:event.key==='ArrowDown'?[0,1]:event.key==='ArrowUp'?[0,-1]:undefined;if(delta){event.preventDefault();panCamera(viewX+delta[0]!,viewY+delta[1]!);}else if(event.key==='Home'){event.preventDefault();returnLive.click();}});
    // Touch reserves vertical swipes for the page; only horizontal intent takes the camera.
    let dragging:{id:number;clientX:number;clientY:number;x:number;y:number;touch:boolean;active:boolean}|undefined;
    junction.addEventListener('pointerdown',event=>{
      if(event.button!==0||!event.isPrimary||!pathActive&&!localCamera||(event.target as HTMLElement).closest('button,summary,details,input,select,a'))return;
      const touch=event.pointerType==='touch';
      dragging={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:viewX,y:viewY,touch,active:!touch};
      if(!touch){event.preventDefault();cancelCamera();junction.setPointerCapture(event.pointerId);}
    });
    junction.addEventListener('pointermove',event=>{
      if(!dragging||event.pointerId!==dragging.id)return;
      const dx=event.clientX-dragging.clientX,dy=event.clientY-dragging.clientY;
      if(dragging.touch&&!dragging.active){
        if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
        if(Math.abs(dy)>=Math.abs(dx)){dragging=undefined;return;}
        dragging.active=true;cancelCamera();junction.setPointerCapture(event.pointerId);
      }
      const card=currentNode.getBoundingClientRect(),style=getComputedStyle(junction);
      if(Math.abs(dx)+Math.abs(dy)>4)panCamera(dragging.x-dx/(card.width+parseFloat(style.columnGap)),dragging.touch?dragging.y:dragging.y-dy/(card.height+parseFloat(style.rowGap)));
    });
    for(const name of ['pointerup','pointercancel'])junction.addEventListener(name,()=>{dragging=undefined;});
    junction.addEventListener('lostpointercapture',event=>{if(event.target===junction)dragging=undefined;});
    junction.addEventListener('focusout',()=>queueMicrotask(layoutPath));
    new ResizeObserver(layoutPath).observe(junction);
    const updatePath=(model:NetworkViewModel,retained:boolean):void=>{
      const anchor=model.observation;
      if(!retained){
        const pinned=model.session?.mode==='pin'&&anchor?.coherent?anchor:undefined;
        if(pinned?.identity!==localCamera?.identity)cameraFollowing=true;localCamera=pinned;
        pathActive=model.session?.mode==='follow'&&anchor?.coherent===true;
        let record:NavigatorPathRecord|undefined;
        if(pathActive&&anchor){
          const pre=knownPhase(model.preattestations),att=knownPhase(model.attestations),direction=junction.dataset.direction==='up'?'up':junction.dataset.direction==='right'?'right':'static',before=path.current?.anchor;
          const clear=before!==undefined&&(anchor.source!==before.source||anchor.chain!==before.chain||anchor.protocol!==before.protocol);
          if(clear)cameraFollowing=true;
          record=path.observe({anchor,...(pre?{pre}:{}),...(att?{att}:{})},direction);
          if(!record)pathActive=!clear&&sameCameraPosition(before,anchor);
        }
        if(!pathActive&&!localCamera)cameraFollowing=true;
        // Rejected old receipts never lend their stored peaks to a different live identity.
        paintPhases(currentNode,currentPhases,record?.pre??knownPhase(model.preattestations),record?.att??knownPhase(model.attestations));
      }
      if(model.session?.mode==='follow')for(const observation of model.pathObservations??[])path.retain(observation);
      junction.dataset.pathHistory=String(pathActive);for(const button of navigation.querySelectorAll('button'))button.disabled=!pathActive&&!localCamera;
      set(returnLive,localCamera?'Return to anchor':'Return to live');
      if(localCamera&&proposalDialog.open)proposalDialog.close();
      layoutPath();
    };
    reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){cancelCamera();set(navigatorStatus,'Reduced motion · static observed destination. Solid: verified ancestry · dotted: context only · dashed: conditional.');}});
    const moveCamera=(model:NetworkViewModel,retained:boolean,reset:boolean):void=>{
      const before=reset?undefined:cameraAnchor,after=model.observation;
      if(reset){cameraAnchor=undefined;observedCard=undefined;}
      if(retained&&before){if(!cameraAnimation)junction.dataset.direction='static';junction.dataset.awaitingProof='true';set(navigatorStatus,`Last coherent ${number(before.level)} · r${before.round} · as of ${new Date(before.receivedAt).toISOString()} · awaiting current proof. Dotted: context only · no current authority implied.`);return;}
      const wasAwaiting=junction.dataset.awaitingProof==='true';junction.dataset.awaitingProof='false';
      const sameMode=current?.session?.mode===model.session?.mode;
      // Camera coordinates belong to a level/round, independently of its current evidence identity.
      if(sameMode&&sameCameraPosition(before,after)){if(after?.coherent)cameraAnchor=after;if(wasAwaiting)set(navigatorStatus,`Coherent destination restored · ${cameraAnimation?'camera continues':'stationary'}. Solid: verified ancestry · dotted: context only · dashed: conditional.`);return;}
      cancelCamera();
      cameraAnchor=after?.coherent?after:undefined;
      let direction='static',reason=model.session?.mode==='pin'?'Pinned observation · stationary':!after?.coherent?'Context unavailable · stationary':!before?'Observed anchor':before.source!==after.source?'Observer changed · recentered':before.level===after.level&&before.round===after.round?'Candidate changed · recentered':after.level>before.level+1||after.round>before.round+1?'Observation gap · recentered without inferred steps':'Observed context changed · recentered';
      if(before&&after&&current?.session?.mode==='follow'&&model.session?.mode==='follow')direction=navigatorDirection(before,after);
      if(direction==='up'){cameraY-=1;reason='Observed adjacent round · camera UP';}
      if(direction==='right'){cameraX+=1;reason='Observed adjacent level · camera RIGHT';}
      set(navigatorStatus,`${reason}${reducedMotion.matches?' · reduced motion, static destination':''}. Solid: verified ancestry · dotted: context only · dashed: conditional.`);
      // Local coordinates are descriptive, never proportional to absolute network rounds.
      junction.dataset.direction=direction;junction.dataset.cameraX=String(cameraX);junction.dataset.cameraY=String(cameraY);
      const coherentCard=before&&observedCard?.key===anchorKey(before)?observedCard.presentation:undefined;
      if(direction!=='static'&&!reducedMotion.matches&&coherentCard&&cameraFollowing){
        const origin=junction.querySelector<HTMLElement>(direction==='up'?'[data-branch=same-level]':'[data-branch=next-level]');
        if(!origin)return;
        const frame=stage.getBoundingClientRect(),destination=currentNode.getBoundingClientRect(),slot=origin.getBoundingClientRect();
        const dx=direction==='right'?slot.x-destination.x:0,dy=direction==='up'?slot.y-destination.y:0;
        const scrolls:{node:HTMLElement;top:number;left:number}[]=[];
        const departing=el('div','navigator-departures');departing.setAttribute('aria-hidden','true');departing.inert=true;
        // The former world and the incoming frontier share one camera transform.
        const oldNodes=direction==='right'
          ?[currentNode,stage.querySelector('[data-branch=same-level]'),stage.querySelector('.navigator-edge-round')]
          :[currentNode,stage.querySelector('[data-branch=next-level]'),stage.querySelector('.navigator-edge-round'),stage.querySelector('.navigator-edge-level')];
        for(const node of oldNodes){
          if(!(node instanceof HTMLElement))continue;
          const presentation=node===currentNode?coherentCard:cardPresentation(node);
          const rect=node.getBoundingClientRect(),style=getComputedStyle(node),copy=presentation.node.cloneNode(true) as HTMLElement;
          copy.className=node.classList.contains('navigator-edge')?'navigator-motion-edge':'navigator-motion-card';copy.setAttribute('aria-hidden','true');copy.inert=true;
          copy.removeAttribute('id');for(const child of copy.querySelectorAll('[id]'))child.removeAttribute('id');
          Object.assign(copy.style,{left:`${rect.x-frame.x-dx}px`,top:`${rect.y-frame.y-dy}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:style.padding,borderTop:style.borderTop,borderRight:style.borderRight,borderBottom:style.borderBottom,borderLeft:style.borderLeft,background:style.background,color:style.color,font:style.font,gap:style.gap,display:style.display});
          const copies=[copy,...copy.querySelectorAll<HTMLElement>('*')];
          for(const [index,position] of presentation.scrolls.entries()){const child=copies[index];if(child)scrolls.push({node:child,...position});}
          departing.append(copy);
        }
        stage.append(departing);departures=departing;if(direction==='right')previousNode.style.opacity='0';for(const scroll of scrolls){scroll.node.scrollTop=scroll.top;scroll.node.scrollLeft=scroll.left;}
        // This is the latest coherent rendered destination, not a queued receipt replay.
        const animation=stage.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:CAMERA_DURATION_MS,easing:'linear'});
        cameraAnimation=animation;
        animation.onfinish=()=>{if(cameraAnimation===animation){departing.remove();departures=undefined;cameraAnimation=undefined;previousNode.style.opacity='';layoutPath();}};
      }
    };
    const tick = (now: number): void => {
      if (!current) return;
      pre.tick();att.tick();
      const age = current.observedMonotonic === undefined ? undefined : Math.max(0, (performance.now() - current.observedMonotonic) / 1000);
      const snapshotAge=current.snapshotMonotonic===undefined?undefined:Math.max(0,(performance.now()-current.snapshotMonotonic)/1000);
      const stableAge=current.appliedSinceMonotonic===undefined?undefined:Math.max(0,Math.floor((performance.now()-current.appliedSinceMonotonic)/1000));set(appliedStability,stableAge===undefined?'Applied-head session age unknown':`Applied head unchanged in this session · ${stableAge}s`);if(current.appliedSinceMonotonic===undefined)delete appliedStability.dataset.since;else appliedStability.dataset.since=String(current.appliedSinceMonotonic);
      set(freshness, age === undefined ? 'No head message yet' : `Last head message ${age < 1 ? 'just now' : `${Math.floor(age)}s ago`}`);
      set(meta.get('Snapshot age')!, snapshotAge === undefined ? 'Unavailable' : `${Math.floor(snapshotAge)}s`);
      set(meta.get('Block age')!, current.blockTimestamp === undefined ? 'Unavailable' : current.observedAt===undefined||age===undefined?'Unavailable':`${Math.max(0,Math.floor((current.observedAt-current.blockTimestamp)/1000+age))}s`);
      const t = current.timing;
      if (!t) {set(countdown, 'Timing unavailable'); set(timing, 'Independent clock estimate unavailable'); return;}
      const remaining = Math.ceil((t.endsAt - now) / 1000);
      set(countdown, remaining > 0 ? `${Math.floor(remaining / 60)}m ${String(remaining % 60).padStart(2, '0')}s` : 'Awaiting next opportunity');
      set(timing, `Independent clock estimate · level ${number(t.level ?? current.consensusLevel)} · estimated round ${t.round} → ${t.nextRound} · next estimated round boundary ${new Date(t.endsAt).toISOString()} · separate from selected branch deadlines${t.evidence?` · ${t.evidence}`:""}${remaining <= 0 ? ' · waiting for fresh timing' : ''}`);
    };
    states.set(network, {tick, update(model) {
      intervals.update(model.blockIntervals);
      const reset=model.navigatorDiscontinuity!==undefined&&model.navigatorDiscontinuity!==current?.navigatorDiscontinuity;
      const branchesPending=navigatorHadOpportunities&&model.opportunityFacts===undefined&&cameraAnchor!==undefined&&model.observation?.coherent===true&&anchorKey(cameraAnchor)===anchorKey(model.observation);
      const retained=!reset&&retainNavigator(cameraAnchor,current,model,branchesPending);
      moveCamera(model,retained,reset);current = model; panel.dataset.status = model.status;
      const anchor=model.observation;
      set(contextFields.get('Observer')!,anchor?.source??'Unavailable');set(contextFields.get('Chain')!,anchor?.chain??'Unknown');set(contextFields.get('Context head')!,anchor?.contextHead??'Unknown');set(contextFields.get('Execution protocol')!,anchor?.protocol??'Unknown');set(contextFields.get('Received')!,anchor?new Date(anchor.receivedAt).toISOString():'Unavailable');
      if(!retained){
      set(currentTarget,anchor?`${number(anchor.level)} · r${anchor.round}`:'Observation unavailable');
      set(currentKind,anchor?anchor.hash?'Observed block':'Votes only':'Live unavailable');
      observedHash=anchor?.hash;copyHash.disabled=!observedHash;
      set(currentHash,anchor?.hash?short(anchor.hash):'Proposal hash unavailable');currentHash.title=anchor?.hash??'No proposal hash observed';
      currentNode.dataset.identity=anchor?.identity??'';
      const parent=anchor?.predecessor;
      set(previousTarget,parent?`${number(parent.level)} · r${parent.round}`:'Previous block unavailable');
      set(previousKind,parent?.hash?'Observed block':parent?'Votes only':'Live unavailable');
      set(previousHash,parent?short(parent.hash):'Ancestry unknown');previousHash.title=parent?.hash??'';
      set(previousRelation,parent?.relation==='ancestry'?'Verified ancestry':parent?'Context only · not ancestry':'Observation gap');
      junction.dataset.relationship=parent?.relation??'unknown';
      }
      const observed = model.roundSource === 'observed';
      set(selectedTitle, observed ? `${number(model.consensusLevel ?? model.level)} / r${number(model.round)}` : 'Observation unavailable');
      const relationshipLabels={'applied-block':'Votes for the already-applied block','applied-tuple':'Votes match the already-applied head tuple · block hash unproven','different-block':'Votes match the applied tuple; selected block hash differs','next-level':'Observed consensus for the next level · not yet applied','other':'Other retained observation · not current applied progress'};set(selectedRelationship,model.selectedRelationship?relationshipLabels[model.selectedRelationship]:'Relationship to applied head unknown');set(nextProposalObservation,model.nextProposalObservation?`${model.nextProposalObservation.observed?'Coherent next-level proposal observed':'No coherent next-level proposal observed'} in retained session · ${model.nextProposalObservation.source}`:'Next-level proposal observation unavailable');
      set(selectedKind, observed ? model.observation?.hash ? `Observed proposal · ${model.producer?`block producer ${model.producer}`:'producer unknown'}` : 'Observed votes · proposal hash and producer unavailable' : 'Live unavailable · waiting for coherent observed evidence');
      set(selectedPayload, observed ? `Payload ${model.payload ?? 'unavailable'} · ${model.source ?? 'Source unavailable'}` : 'No observation inferred from the protocol clock');
      const labels = {loading: 'Connecting', healthy: 'Observed advance', unknown:'Progress unknown',stalled: 'Prediction elapsed', degraded: 'RPC coverage degraded',paused:'Paused'};
      set(status, labels[model.status]); set(tabStatus, labels[model.status]); tab.dataset.status = model.status; set(level, number(model.appliedLevel)); set(round, number(model.appliedRound));
      const levelLabel=level.parentElement?.querySelector('.eyebrow'), roundLabel=round.parentElement?.querySelector('.eyebrow');
      if(levelLabel)set(levelLabel as HTMLElement,'Applied block level');
      if(roundLabel)set(roundLabel as HTMLElement,'Applied block round');
      set(appliedContext, model.appliedLevel === undefined ? 'Last applied block unavailable' : `Last applied block · level ${number(model.appliedLevel)} · round ${number(model.appliedRound)}${model.blockTimestamp === undefined ? "" : ` · block timestamp ${clock(model.blockTimestamp)}`}`);
      set(proposalContext, model.roundSource === 'schedule' ? 'Proposal observation unavailable' : model.roundSource === 'observed' ? model.observedProposal && model.observedProposal.level===model.level&&model.observedProposal.round===model.round && model.payload && model.observedProposal.payload===model.payload ? `Observed proposal · level ${number(model.level)} · round ${model.round}` : `Observed votes · level ${number(model.level)} · round ${model.round}` : 'Proposal observation unavailable');
      if (model.observedProposal) proposalContext.title = `Last observed proposal: level ${model.observedProposal.level}, round ${model.observedProposal.round}${model.observedProposal.at === undefined ? '' : ` at ${clock(model.observedProposal.at)}`}`;
      else proposalContext.removeAttribute('title');
      const session=model.session;sessionControls.hidden=!session;
      if(session){previousIdentity=session.previous;previous.disabled=!previousIdentity;set(sessionMode,`${session.mode==='follow'?'Following live':session.frozen?'Pinned · frozen outside history':'Pinned · retained observation'}${session.newer?` · ${session.newerPartial?'At least ':''}${session.newer} newer`:''}`);set(sessionNote,`${session.mode==="follow"?"Follow live":session.frozen?"Pinned frozen snapshot outside retained history":"Pinned retained session instance"} · ${session.instances.length} / 150 session instances · ${session.accepted} / 100 active candidates · ${session.unresolved} / 100 unresolved identities · ${session.raw} / 10000 raw operations · ${session.newerPartial?"At least ":""}${session.newer} newer items${session.newerPartial?"; first-arrival history partial":""} · Browser-session history is nonarchival and resets on reload`);pinSelected.disabled=!session.canPin;follow.setAttribute("aria-pressed",String(session.mode==="follow"));latest.setAttribute("aria-pressed","false");sessionSelect.update(session.instances.map(instance=>[instance.identity,instance.label] as const));sessionSelect.value=session.selected??"";}
      if(session){
        const wanted=new Set(session.instances.map(instance=>instance.identity));
        for(const [key,button] of historyButtons)if(!wanted.has(key)){button.parentElement?.remove();historyButtons.delete(key);}
        const ordered=[...session.instances].sort((a,b)=>(a.receivedMonotonic??0)-(b.receivedMonotonic??0)||a.identity.localeCompare(b.identity));
        for(const [index,instance] of ordered.entries()){
          let button=historyButtons.get(instance.identity);
          if(!button){button=el('button','history-choice');button.type='button';button.addEventListener('click',()=>options.onSelect?.(network,instance.identity));button.append(el('strong'),el('span','subtle'));const row=el('li');row.append(button);const next=ordered.slice(index+1).map(value=>historyButtons.get(value.identity)?.parentElement).find(value=>value!==undefined);retainedList.insertBefore(row,next??null);historyButtons.set(instance.identity,button);}
          set(button.children[0] as HTMLElement,instance.level===undefined?instance.label:`${number(instance.level)} · r${number(instance.round)}`);
          set(button.children[1] as HTMLElement,`${instance.source??'Source unavailable'} · ${instance.candidates??0} candidates${instance.partial?' · partial':''}`);
          button.setAttribute('aria-label',`Inspect retained instance ${instance.label}`);button.setAttribute('aria-pressed',String(instance.identity===session.selected));button.title=instance.received===undefined?'Receipt unavailable':`First received ${new Date(instance.received).toISOString()} · receipt order, not ancestry`;
        }
      }
      const comparison=model.comparison;comparisonSection.hidden=!comparison;
      if(comparison){comparisonProvider.update(comparison.providers.map(provider=>[provider.url,`${provider.name} · ${provider.url}`] as const));compare.disabled=!comparison.enabled||comparison.running||!comparison.providers.length;comparisonProvider.disabled=comparison.running;const result=comparison.result?.();
        if(!result)set(comparisonResult,comparison.running?'Comparison in progress; LIVE authority remains separate':'Explicit one-shot comparison · at most 3 reads · 8 seconds per read including body · no polling');
        else{const raw=result.rawOperations.map(operation=>`${operation.hash} · source ${operation.evidence?.source.baseUrl??'unknown'} · requested head ${operation.evidence?.requestedHeadHash??'unknown'} · observed head ${operation.evidence?.observedHeadHash??'unknown'} · ${operation.contents.map(content=>`${content.kind} ${content.level}/${content.round}/${content.block_payload_hash??'unknown'} slot ${content.slot}`).join('; ')}`).join(' | ');
          const power=result.powers===undefined?'Power unknown: compatible cached committee proof unavailable':result.powers.length===0?'Phase power unknown: no captured compatible positive votes; empty pending does not certify zero':result.powers.map(group=>`${group.round}/${group.payload} · Pre ${group.pre===undefined?'unknown':`${group.pre}/${group.total}`} · Att ${group.att===undefined?'unknown':`${group.att}/${group.total}`} · threshold ${group.threshold}`).join('; ');
          const rightReceipt=result.rights?.[0]?.evidence;
          set(comparisonResult,`${result.outcome} · Head fields: ${result.headOutcome} · ${result.invalidated?'context-invalid · ':''}${result.stale?'stale · ':''}Selected ${result.selection.historical?'historical':'observed'} A ${result.selection.source.baseUrl} · ${result.selection.header?.hash??'hash unknown'} · ${result.selection.level}/${result.selection.round} · chain ${result.selection.chainId??'unknown'} · time ${result.selection.header?.timestamp??'unknown'} · fetched current B ${result.source.baseUrl} · chain ${result.chainId??'unknown'} · hash ${result.head?.hash??'unknown'} · level ${result.head?.level??'unknown'} · round ${result.head?proposalRound(result.head.fitness,result.head.level)??'unknown':'unknown'} · time ${result.head?.timestamp??'unknown'} · producing protocol ${result.protocolHash??'unknown'} · ${result.differences.join('; ')} · received ${result.evidence?new Date(result.evidence.receivedAt).toISOString():'unavailable'} · ${result.evidence?Math.max(0,Math.floor((performance.now()-result.evidence.receivedMonotonic)/1000)):'unknown'}s monotonic age · ${result.reads.length}/3 reads · Head comparison is not vote agreement or finality. Separate B source-limited observations; never pooled with LIVE power/events. ${power} · rights original responder ${rightReceipt?.source.baseUrl??'unknown'} · rights requested anchor ${rightReceipt?.requestedHeadHash??'unknown'} · rights context head ${rightReceipt?.contextHeadHash??'unknown'} · rights chain ${rightReceipt?.chainId??'unknown'} · rights protocol ${rightReceipt?.protocolHash??'unknown'} · rights target ${rightReceipt?.targetLevel??'unknown'} · rights received ${rightReceipt?new Date(rightReceipt.receivedAt).toISOString():'unknown'} · raw ${result.rawOperations.length} · ${raw||'Raw unavailable / no retained entries; no measured-zero claim'} · ${result.pendingReasons.join('; ')} · ${result.errors.join('; ')}`);
        }
      }
      const announcement=JSON.stringify([model.selectedIdentity??model.observation?.identity,session?.mode,session?.frozen,model.status,model.observation?.coherent]);
      if(previousAnnouncement!==undefined&&previousAnnouncement!==announcement&&tab.getAttribute('aria-pressed')==='true')set(announcements,`${name}: ${session?.mode==='pin'?'Pinned'+(session.frozen?' frozen':''):'Following live'} · ${model.observation?`observed level ${model.observation.level}, round ${model.observation.round}`:'observation unavailable'} · ${labels[model.status]}`);
      previousAnnouncement=announcement;
      recent.update(model.recentConsensus);
      set(transport, `${model.connection ?? 'Monitoring'}${model.source ? ` · ${model.source}` : ''}`);
      set(notice, model.error ?? model.note ?? (model.status === 'stalled' ? 'Proposal activity continues, but the level has not advanced.' : model.status === 'loading' ? 'Waiting for the first successful observation.' : 'Live observations from this browser.'));
      set(activity, `${model.roundSource==='schedule'?'Scheduled':'Observed'} round ${number(model.activityRound)}`); set(selection, `Level ${number(model.consensusLevel ?? model.level)} · payload ${short(model.payload)}`); selection.title = model.payload ?? '';
      const candidateKeys = new Set<string>();
      let candidateIndex=0;
      for (const candidate of model.candidates ?? []) {
        candidateKeys.add(candidate.identity);
        let button = candidateButtons.get(candidate.identity);
        if (!button) {
          button = el('button','control-button'); button.type = 'button';
          button.addEventListener('click', () => options.onSelect?.(network,candidate.identity));
          candidateButtons.set(candidate.identity,button);
        }
        const kind=candidate.hash?'Block':'Payload',identity=candidate.hash??candidate.payload??'unavailable';
        const support=`pre ${number(candidate.prePower)} · att ${number(candidate.attPower)}${candidate.payloadShared?' · payload-shared':''}`;
        set(button,`Level ${number(candidate.level)} / r${number(candidate.round)} · ${kind} ${short(identity)} · ${support}`);
        button.setAttribute('aria-label',candidate.hash?`Inspect candidate ${identity}`:`Inspect payload ${identity}`);
        button.setAttribute('aria-pressed',String(candidate.identity === model.selectedIdentity));
        button.title = `Level ${candidate.level} · round ${candidate.round} · ${kind.toLowerCase()} ${identity} · payload ${candidate.payload ?? 'unavailable'} · ${support} · source ${candidate.source??'unavailable'}`;
        const position=candidateControls.children.item(candidateIndex++);
        if(position!==button){const focused=document.activeElement===button;candidateControls.insertBefore(button,position);if(focused)button.focus({preventScroll:true});}
      }
      for (const [key,button] of candidateButtons) if (!candidateKeys.has(key)) {button.remove();candidateButtons.delete(key);}
      set(alternativesSummary,`Proposals with observed votes (${candidateKeys.size})`);
      set(alternativesNote,`Same level, round and source context${model.candidates?.[0]?.source?` · ${model.candidates[0].source}`:''}, with received voting power. Strongest phase support first; inspect to pin an instance. Payload signatures can be shared by several block hashes.`);
      const capturedKeys=new Set<string>();
      for(const candidate of model.provenanceCandidates??[]){
        capturedKeys.add(candidate.identity);let button=capturedControls.get(candidate.identity);
        if(!button){button=el('button','control-button');button.type='button';button.addEventListener('click',()=>options.onSelect?.(network,candidate.identity));capturedControls.set(candidate.identity,button);capturedButtons.append(button);}
        set(button,`Level ${number(candidate.level)} / r${number(candidate.round)} · Block ${short(candidate.hash)}`);button.title=candidate.hash;
        button.setAttribute('aria-label',`Inspect candidate ${candidate.hash}`);button.setAttribute('aria-pressed',String(candidate.identity===model.selectedIdentity));
      }
      for(const [key,button] of capturedControls)if(!capturedKeys.has(key)){button.remove();capturedControls.delete(key);}
      captured.hidden=capturedKeys.size===0;set(capturedSummary,`Captured block observations (${capturedKeys.size})`);
      const rawKeys=new Set<string>();
      for(const record of model.unresolvedObservations??[]){
        rawKeys.add(record.identity);let button=rawControls.get(record.identity);
        if(!button){button=el('button','control-button');button.type='button';button.addEventListener('click',()=>options.onSelect?.(network,record.identity));rawControls.set(record.identity,button);rawButtons.append(button);}
        const id=record.hash??record.payload??'unavailable';set(button,`Unproven · Level ${number(record.level)} / r${number(record.round)} · ${record.hash?'Block':'Payload'} ${short(id)}`);
        button.title=`${id} · source ${record.source}`;button.setAttribute('aria-label',record.hash?`Inspect candidate ${id}`:`Inspect payload ${id}`);
      }
      for(const [key,button] of rawControls)if(!rawKeys.has(key)){button.remove();rawControls.delete(key);}
      rawObservations.hidden=rawKeys.size===0;set(rawSummary,`Unresolved raw observations (${rawKeys.size})`);
      retryIdentity=model.retryIdentity;retry.hidden=retryIdentity===undefined;retry.disabled=!model.canRetry;
      set(candidateEvidence,model.candidateEvidence ?? 'Candidate identity unavailable · producer unknown');
      set(authorityEvidence,model.contextEvidence??'Rights context unavailable');
      readEligibility.disabled = model.eligibilityLoading === true || model.eligibilityAvailable === false || !options.onReadEligibility;
      set(readEligibility, model.eligibilityLoading ? 'Reading committee eligibility…' : 'Read committee eligibility');
      pre.update(model.preattestations, model.preattestations?.threshold??model.quorum); att.update(model.attestations, model.attestations?.threshold??model.quorum);
      missingPre.update(model.missingPre, model.committeePower); missingAtt.update(model.missingAtt, model.committeePower);committee.update(model.committee,model.committeeTotal??model.committeePower,model.unknownConsensus);
      if(!retained){
      const bakers = model.opportunityFacts?model.opportunityFacts.map(fact=>({label:fact.branch==='same-level'?'Next round · same level':'Following level · round 0',alias:undefined,level:fact.level,round:fact.round,address:fact.proposer.state==='known'?fact.proposer.right.delegate:'',detail:fact})):model.nextBakers ?? [], bakerKeys = new Set<string>();
      for (const [index, baker] of bakers.entries()) {
        const key = `${baker.label}`; bakerKeys.add(key);
        let row = keyedBakers.get(key);
        if (!row) {row = el('div', 'baker-opportunity'); row.append(el('span', 'eyebrow', baker.label === 'Next round · same level' ? '↑ Next round' : baker.label === 'Following level · round 0' ? '→ Next level' : baker.label), el('strong', '', baker.alias ?? short(baker.address)), el('span', 'subtle branch-target', `Level ${number(baker.level)} · round ${baker.round}`)); row.title = baker.address; keyedBakers.set(key, row);}
        row.dataset.branch=index===0?'same-level':'next-level';set(row.children[2] as HTMLElement,`Level ${number(baker.level)} · round ${baker.round}`);
        if('detail' in baker){const fact=baker.detail as OpportunityFact,timing=fact.timing;set(row.children[1] as HTMLElement,fact.proposer.state==='known'?`${fact.proposer.right.delegate.slice(0,6)}…${fact.proposer.right.delegate.slice(-4)}`:'Baking rights unavailable');let detail=row.querySelector('.opportunity-detail');if(!detail){const proof=el('details','branch-proof');proof.append(el('summary','','Branch evidence'));detail=el('span','subtle opportunity-detail');proof.append(detail);row.append(proof);}const remaining=timing.state==='known'?Math.max(0,timing.remainingAtCapture-(model.opportunitiesHistorical?0:Math.max(0,performance.now()-fact.capturedMonotonic))):undefined;let critical=row.querySelector('.branch-critical');if(!critical){critical=el('div','branch-critical');row.insertBefore(critical,row.querySelector('details'));}set(critical as HTMLElement,`${timing.state==='known'?`Conditional timer: ${remaining===0?'Awaiting observation':`${Math.ceil((remaining??0)/1000)}s`}`:'Timer unavailable'} · ${fact.branch==='same-level'?'If level continues':'If predecessor produced'} · Future hash unknown`);set(detail as HTMLElement,`${fact.condition} · Future hash unknown · ${timing.state==='known'?`Conditional timer · ${remaining===0?'Awaiting observation':`${Math.ceil(remaining!/1000)}s remaining`} · deadline ${new Date(timing.deadline).toISOString()} · ${model.opportunitiesHistorical?'Captured historical':'As of'} ${new Date(fact.capturedAt).toISOString()} · timing source ${timing.parameters.evidence.source.baseUrl} · timing received ${new Date(timing.parameters.evidence.receivedAt).toISOString()} · reference ${timing.reference.hash} · basis ${timing.basis} · target ${timing.parameters.context.level} · execution protocol ${timing.parameters.context.protocolHash}`:`Timer unavailable · ${timing.reason}`}${fact.proposer.state==='known'?` · proposer ${fact.proposer.right.delegate} · proposer source ${fact.proposer.right.evidence.source.baseUrl} · rights received ${new Date(fact.proposer.right.evidence.receivedAt).toISOString()} · chain ${fact.proposer.right.context.observer.chainId} · context head ${fact.proposer.right.context.observer.header.hash} · execution protocol ${fact.proposer.right.context.protocolHash} · requested anchor ${fact.proposer.right.evidence.requestedHeadHash??'unknown'}`:` · ${fact.proposer.reason}`}`);}
        if (bakerRows.children[index] !== row) bakerRows.insertBefore(row, bakerRows.children[index] ?? null);
      }
      for (const [key, row] of keyedBakers) if (!bakerKeys.has(key)) {row.remove(); keyedBakers.delete(key);}
      if (!bakers.length && !bakerRows.querySelector('.empty-state')) {
        for (const label of ['↑ Next round', '→ Next level']) {
          const placeholder = el('div', 'baker-opportunity empty-state');placeholder.dataset.branch=label==='↑ Next round'?'same-level':'next-level';
          placeholder.append(el('span', 'eyebrow', label), el('strong', '', 'Baking rights unavailable'), el('span', 'subtle branch-target', 'Level — · round —'));
          placeholder.append(el('p','branch-critical',`Timer unavailable · ${label==='↑ Next round'?'If level continues':'If predecessor produced'} · Future hash unknown`));const proof=el('details','branch-proof');proof.append(el('summary','','Branch evidence'),el('p','opportunity-detail',label==='↑ Next round'?'Conditional on continued same-level production · Historical timing and rights not captured':'Earliest protocol boundary conditional on hypothetical next-level production · Historical timing and rights not captured'));placeholder.append(proof);bakerRows.append(placeholder);
        }
      }
      if (bakers.length) for (const placeholder of bakerRows.querySelectorAll('.empty-state')) placeholder.remove();
      else for(const placeholder of bakerRows.querySelectorAll<HTMLElement>('.empty-state')){const same=placeholder.dataset.branch==='same-level',target=placeholder.querySelector<HTMLElement>('.branch-target');if(target)set(target,anchor?`Level ${number(anchor.level+(same?0:1))} · round ${same?anchor.round+1:0}`:'Level — · round —');}
      }
      updatePath(model,retained);
      if(!retained){if(anchor?.coherent){observedCard={key:anchorKey(anchor),presentation:cardPresentation(currentNode)};navigatorHadOpportunities=model.opportunityFacts!==undefined;}else navigatorHadOpportunities=false;}
      set(meta.get('Primary source')!, model.source ?? 'Unavailable'); set(meta.get('Block hash')!, model.hash ?? 'Unavailable');
      set(meta.get('Applied head')!, model.appliedLevel === undefined ? 'Unavailable' : `Level ${number(model.appliedLevel)} · round ${number(model.appliedRound)}`);
      set(meta.get('Last successful head')!, clock(model.observedAt)); set(meta.get('Last operation')!, clock(model.lastOperationAt));
      const sources = model.sources ?? [], sourceKeys = new Set(sources.map(source => source.url));
      for (const source of sources) {let row = keyedSources.get(source.url); if (!row) {row = el('div', 'source-row'); sourceRows.append(row); keyedSources.set(source.url, row);} set(row, `${source.name} · ${source.status}${source.detail ? ` · ${source.detail}` : ''}`); row.title = source.url;}
      for (const [key, row] of keyedSources) if (!sourceKeys.has(key)) {row.remove(); keyedSources.delete(key);}
      history.replaceChildren(...(model.events??[]).slice(-12).reverse().map(event=>el('li','',`${clock(event.observedAt)} · ${event.description}`)));
      tick(Date.now());
    }});
  }
  try {root.dataset.selected = localStorage.getItem('consensus-v2:network') === 'shadownet' ? 'shadownet' : 'mainnet';} catch {root.dataset.selected = 'mainnet';}
  return {update(network, model) {states.get(network)!.update(model);}, tick(now = Date.now()) {for (const state of states.values()) state.tick(now);}};
}
