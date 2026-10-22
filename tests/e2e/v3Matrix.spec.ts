import {openDetails,attachFailureTrace} from './productionFixture';
import {annotateV3} from './v3Verification';
import {choose,inspectionModule,inspectRetainedCandidate,inspectRaw,selectNetwork} from './productionFixture';
import {test,expect} from '@playwright/test';
import {head,vote,prepare,send,headers} from './productionFixture';
import {captureMatrix} from './v3Evidence';

const errors=new WeakMap<object,string[]>();
test.beforeEach(async({page})=>{const found:string[]=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message));page.on('response',response=>{const url=new URL(response.url());if(url.hostname==='127.0.0.1'&&response.status()>=400&&/\.(ts|js|css)(?:$|\?)/.test(url.pathname))found.push(`${response.status()} ${url.pathname}`);});});
test.afterEach(async({page})=>{if(errors.get(page)?.length)throw new Error(`Production runtime: ${errors.get(page)?.join('; ')}`);});

test('V3 AC-06 production empty partial and quorum states cover every required base theme and engine',async({page},info)=>{
 test.setTimeout(240000);await prepare(page,false,head(100),100,true);
 await captureMatrix(page,info,'initially-hidden');
 await page.evaluate(()=>{window.mockHidden=false;document.dispatchEvent(new Event('visibilitychange'));});const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.headline')).toContainText('100');
 await captureMatrix(page,info,'empty-observed');
 await send(page,'mainnet-operations',[vote(0)]);await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');await expect(panel.locator('.att .gauge-exact')).toHaveText('Unavailable');
 await captureMatrix(page,info,'partial-positive-phase-unavailable');
 await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.session-mode')).toContainText('Pinned');await captureMatrix(page,info,'pinned-votes-missing-historical-branches');
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();await send(page,'mainnet-operations',Array.from({length:34},(_,slot)=>vote(slot)));await expect(panel.locator('.pre .gauge-exact')).toHaveText('20,400 / 30,000');await captureMatrix(page,info,'observed-quorum-partial');
 await send(page,'mainnet-operations',Array.from({length:50},(_,slot)=>vote(slot)));await expect(panel.locator('.pre .gauge-exact')).toHaveText('30,000 / 30,000');await captureMatrix(page,info,'full-observed-power-partial-coverage');
 const candidate={...head(101),hash:'BKnownExactCandidateLongHash123456789012345678901234567890',payload_hash:'vhPayload101'};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.navigator-current')).toContainText('101 · r0');await inspectRetainedCandidate(panel,candidate.hash);await expect(panel.locator('.candidate-evidence')).toContainText(candidate.hash);await captureMatrix(page,info,'known-block-unknown-producer-pinned');
 info.annotations.push({type:'v3-verified',description:'AC-06'});
});


test('V3 AC-06 production source zero stale and failed comparison remain distinct across the full matrix',async({page},info)=>{
 test.setTimeout(180000);const current=head(100);await prepare(page,false,current);const panel=page.locator('.network-panel.mainnet');
 await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));
 await page.route('https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate={...head(101),hash:'MatrixMeasuredZero',payload_hash:'MatrixZeroPayload'};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.pre .gauge-exact')).toHaveText('0 / 30,000');await expect(panel.locator('.att .gauge-exact')).toHaveText('0 / 30,000');await captureMatrix(page,info,'measured-zero-both-phases');
 await page.route('https://tezos-mainnet.octez.io/**',route=>route.fulfill({status:503,body:'Provider unavailable'}));await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();await expect(panel.locator('.comparison-result')).toContainText('unavailable');await captureMatrix(page,info,'failed-independent-comparison');
 await page.evaluate(()=>window.mockStreams['mainnet-operations']?.error(new Error('Source coverage interrupted')));await expect(panel.locator('.pre .gauge-exact')).toHaveText('Unavailable');await expect(panel).toContainText('Retained source snapshot stale');await captureMatrix(page,info,'source-stale-zero-withdrawn');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await captureMatrix(page,info,'manually-paused-stale');
 info.annotations.push({type:'v3-verified',description:'AC-06'});
});

test('V3 AC-06 dense retained history long aliases and frozen inspection remain usable in the full matrix',async({page},info)=>{
 test.setTimeout(240000);const current=head(100),powers=Array.from({length:300},()=>100),aliases=powers.map((_,index)=>({address:`tz1BakerAddress${String(index).padStart(25,'0')}`,alias:`Delegate ${index} · cooperative with a deliberately long operational alias and source qualification`}));
 await prepare(page,false,current,100,false,false,{total:30000,quorum:20000,powers},aliases);const panel=page.locator('.network-panel.mainnet');
 const first={...head(101),hash:'BDensePinnedExactHash123456789012345678901234567890123',payload_hash:'vhPayload101'};headers.get(page)?.set(first.hash,first);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:first.hash,header:first});await send(page,'mainnet-operations',[vote(0)]);await expect(panel.locator('.pre .gauge-exact')).toHaveText('100 / 30,000');await inspectRetainedCandidate(panel,first.hash);
 const candidates=Array.from({length:100},(_,index)=>({...head(101),hash:`BDenseSibling${index}ExactHash123456789012345678901234567890`,payload_hash:'vhPayload101'}));for(const candidate of candidates)headers.get(page)?.set(candidate.hash,candidate);await page.evaluate(values=>window.mockStreams['mainnet-proposals']?.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:'NetFixture',hash:header.hash,header})).join('\n')+'\n')),candidates);
 await expect(panel.locator('.captured-candidates button')).toHaveCount(100);await expect(panel).toContainText('Historical inspection facts partially retained');await captureMatrix(page,info,'active-evicted-retained-pin-100-candidate-facts');
 const histories=Array.from({length:151},(_,index)=>({...head(101),hash:`BDenseHistory${index}ExactHash123456789012345678901234567890`,payload_hash:`vhDenseHistoryPayload${index}0123456789012345678901234567890`}));for(const candidate of histories)headers.get(page)?.set(candidate.hash,candidate);await page.evaluate(values=>window.mockStreams['mainnet-proposals']?.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:'NetFixture',hash:header.hash,header})).join('\n')+'\n')),histories);
 await expect(panel.locator('.session-mode')).toContainText('frozen');await expect(panel.getByLabel('Retained session instance').locator('..').locator('.choice-option')).toHaveCount(150);await captureMatrix(page,info,'frozen-pin-150-history-many-delegates-long-values');
 await panel.getByRole('button',{name:'Latest',exact:true}).click();await expect(panel.locator('.session-mode')).toContainText('Pinned');await expect(panel.locator('.session-mode')).not.toContainText('frozen');await captureMatrix(page,info,'latest-once-dense-history');
 info.annotations.push({type:'v3-verified',description:'AC-06'});
});


test('V3 AC-07 production focus hover search sorting and open evidence remain usable throughout the matrix',async({page},info)=>{
 test.setTimeout(240000);const address=(slot:number)=>`tz1BakerAddress${String(slot).padStart(25,'0')}`;
 await prepare(page,false,head(),100,false,false,{total:5,quorum:4,powers:[3,2]},[{address:address(0),alias:'Baker Alpha'},{address:address(1),alias:'Baker Beta'}]);await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet'),query=panel.getByRole('searchbox',{name:'Search committee alias or address'}),rows=panel.locator('.committee-evidence tbody tr');await expect(rows).toHaveCount(2);
 await captureMatrix(page,info,'keyboard-search-focus',async()=>{await query.focus();await expect(query).toBeFocused();});
 await captureMatrix(page,info,'hover-primary-control',async()=>{await page.getByRole('button',{name:'Pause',exact:true}).hover();});
 await query.fill('  alpha  ');await expect(rows).toHaveCount(1);await captureMatrix(page,info,'search-matching-alias');await query.fill('no-matching-delegate');await expect(rows).toHaveCount(0);await captureMatrix(page,info,'search-no-match');
 await query.fill('');await choose(panel.getByLabel('Committee sort'),'alias');await expect(rows).toHaveCount(2);await captureMatrix(page,info,'explicit-alias-sort');
 const details=rows.first().locator('details');await details.locator('summary').click();await panel.locator('.selected-inspector > .consensus-section > details, .phase-provenance').evaluateAll(nodes=>nodes.forEach(node=>(node as HTMLDetailsElement).open=true));await captureMatrix(page,info,'expanded-full-address-phase-source-context');
 await query.fill('alpha');const copy=rows.first().getByRole('button',{name:'Copy full address for Baker Alpha · TzKT'});await copy.focus();
 await page.evaluate(async({changed,path})=>{const module=await import(path),original=module.NetworkData.prototype.alias;let corrected=true;Object.assign(window,{setFixtureAliasCorrection:(value:boolean)=>{corrected=value;}});module.NetworkData.prototype.alias=function(address:string){return corrected&&this.network==='mainnet'&&address===changed?'Gamma':original.call(this,address);};},{changed:address(0),path:inspectionModule()});await send(page,'mainnet-operations',[vote(1)]);await expect(rows).toHaveCount(1);await expect(rows.first()).toHaveAttribute('data-pending-exclusion','true');await captureMatrix(page,info,'focused-corrected-alias-pending-exclusion',async()=>{
  // Appearance intentionally receives focus between cells: rebuild the focused
  // nonmatching-row condition after that legitimate blur, never retain it across blur.
  await page.evaluate(()=>(window as unknown as {setFixtureAliasCorrection:(value:boolean)=>void}).setFixtureAliasCorrection(false));await send(page,'mainnet-operations',[vote(0)]);await query.fill('alpha');await expect(rows).toHaveCount(1);await rows.first().getByRole('button').focus();
  await page.evaluate(()=>(window as unknown as {setFixtureAliasCorrection:(value:boolean)=>void}).setFixtureAliasCorrection(true));await send(page,'mainnet-operations',[vote(1)]);await expect(rows.first()).toHaveAttribute('data-pending-exclusion','true');await expect(rows.first().locator('button')).toBeFocused();
 });
 await query.focus();await expect(rows).toHaveCount(0);await query.fill('');await expect(rows).toHaveCount(2);
 info.annotations.push({type:'v3-verified',description:'AC-07'});
});


test('V3 AC-06 loading unresolved gaps reorg reduced motion and visibility states render across every base',async({page},info)=>{
 test.setTimeout(240000);const lifecycle:unknown[]=[];const receipt=async(label:string)=>lifecycle.push(await page.evaluate(label=>({label,at:performance.now(),hidden:document.hidden,requests:window.mockRequests.map(value=>({...value}))}),label));const initial=head();await prepare(page,false,initial,100,false,false,undefined,undefined,'PFixture',true);await selectNetwork(page,'shadownet');const panel=page.locator('.network-panel.shadownet');await expect(panel.locator('.selected-title')).toHaveText('Observation unavailable');await captureMatrix(page,info,'loading-no-head-received');
 await send(page,'shadownet-head',initial);await expect(panel.locator('.headline')).toContainText('100');await send(page,'shadownet-operations',[vote(0,123,0)]);await inspectRaw(panel,'Inspect payload vhPayload123');await expect(panel.locator('.candidate-evidence')).toContainText('Unresolved');await captureMatrix(page,info,'unresolved-ahead-context');
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();await send(page,'shadownet-operations',[vote(0,101,0)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r0');await send(page,'shadownet-operations',[vote(1,101,9)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r9');await expect(panel.locator('.navigator-status')).toContainText('Observation gap');expect(await panel.locator('.navigator-junction').evaluate(node=>node.getAnimations().length)).toBe(0);await captureMatrix(page,info,'actual-round-gap-static');
 await page.emulateMedia({reducedMotion:'reduce'});await send(page,'shadownet-operations',[vote(2,101,10)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r10');expect(await panel.locator('.navigator-junction').evaluate(node=>node.getAnimations().length)).toBe(0);await captureMatrix(page,info,'reduced-motion-observed-adjacent-destination');
 await send(page,'shadownet-head',{...initial,hash:'MatrixReorgHead100'});await expect(panel).toContainText('Observed same-height reorg');expect(await panel.locator('.navigator-junction').evaluate(node=>node.getAnimations().length)).toBe(0);await captureMatrix(page,info,'actual-same-height-reorg-invalidated-context');
 await receipt('before-hidden');await page.evaluate(()=>{window.mockHidden=true;document.dispatchEvent(new Event('visibilitychange'));});const paused=await page.evaluate(()=>window.mockRequests.length);await captureMatrix(page,info,'hidden-collection-suspended');expect(await page.evaluate(()=>window.mockRequests.length)).toBe(paused);await receipt('suspended');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await captureMatrix(page,info,'pagehide-bfcache-suspended');expect(await page.evaluate(()=>window.mockRequests.length)).toBe(paused);await receipt('suspended');
 await page.evaluate(()=>{window.mockHidden=false;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await expect.poll(()=>page.evaluate(()=>window.mockRequests.length)).toBeGreaterThan(paused);await captureMatrix(page,info,'bfcache-resumed-attributed-state');await receipt('resumed');await info.attach('actual-request-lifecycle-trace',{body:JSON.stringify(lifecycle),contentType:'application/json'});
 info.annotations.push({type:'v3-verified',description:'AC-06'});
});


test('V3 AC-09 matching block producers shared and separate payloads render without pooled power throughout the matrix',async({page},info)=>{
 test.setTimeout(240000);const protocol='PsUshuai9QapM5TGj1JpuVGkdxz5GykdnEvS6Rh8SUVrARvZLCY',baker='tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',other='tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';await prepare(page,false,head(),100,false,false,undefined,undefined,protocol);
 await page.route('**/blocks/*/metadata',route=>route.fulfill({json:{protocol,next_protocol:protocol,baker,proposer:other,level_info:{level:101,level_position:100,cycle:0,cycle_position:100,expected_commitment:false},balance_updates:[],consumed_milligas:'0',deactivated:[]}}));
 await send(page,'mainnet-operations',[{...vote(0),contents:[{...vote(0).contents[0],block_payload_hash:'P'}]}]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');
 for(const [hash,payload,state] of [['MatrixProducerH1','P','producer-known-exact-block'],['MatrixProducerH2','P','same-round-shared-payload-distinct-blocks'],['MatrixProducerH3','Q','same-round-separate-payload-no-pooled-power']] as const){const candidate={...head(101),hash,payload_hash:payload};headers.get(page)?.set(hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash,header:candidate});await inspectRetainedCandidate(panel,hash);await expect(panel.locator('.candidate-evidence')).toContainText(`Block producer / baker ${baker}`);await expect(panel.locator('.pre .gauge-exact')).toHaveText(payload==='P'?'600 / 30,000':'Unavailable');await captureMatrix(page,info,state);}
 info.annotations.push({type:'v3-verified',description:'AC-09'});
});


test('V3 AC-10 both phases render exact below at and full thresholds independently across the matrix',async({page},info)=>{
 test.setTimeout(240000);await prepare(page,false,head(),100,false,false,{total:5,quorum:4,powers:[3,1,1]});const panel=page.locator('.network-panel.mainnet');
 const att=(slot:number)=>({hash:`matrix-att-${slot}`,contents:[{kind:'attestations_aggregate',consensus_content:{level:101,round:0,block_payload_hash:'vhPayload101'},committee:[{slot}]}]});
 for(const [slots,state,power] of [[[0],'both-phases-just-below-threshold',3],[[1],'both-phases-at-exact-threshold',4],[[2],'both-phases-full-observed-power',5]] as const){await send(page,'mainnet-operations',slots.flatMap(slot=>[vote(slot),att(slot)]));await expect(panel.locator('.pre .gauge-exact')).toHaveText(`${power} / 5`);await expect(panel.locator('.att .gauge-exact')).toHaveText(`${power} / 5`);await captureMatrix(page,info,state);}
 info.annotations.push({type:'v3-verified',description:'AC-10'});
});


test('V3 AC-36 native choice open checked hover focus and disabled surfaces cover every base',async({page},info)=>{
 test.setTimeout(240000);await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);
 const panel=page.locator('.network-panel.mainnet');await expect(page.locator('select')).toHaveCount(0);await expect(page.getByLabel('Colour palette')).toHaveCount(1);
 for(const name of ['Appearance','Committee sort','Committee phase receipt filter','Retained session instance','Comparison provider']){
  await captureMatrix(page,info,`native-choice-${name.toLowerCase().replaceAll(' ','-')}-open`,async()=>{
   const summary=name==='Appearance'?page.getByLabel(name):panel.getByLabel(name),root=summary.locator('..');
   await summary.click();await expect(root).toHaveAttribute('open','');const checked=root.locator(':scope > .choice-options > .choice-option > input:checked');await checked.focus();await expect(checked).toBeFocused();await root.locator(':scope > .choice-options > .choice-option').last().hover();
  });
  await page.keyboard.press('Escape');
 }
 await page.getByRole('button',{name:'Pause',exact:true}).click();await captureMatrix(page,info,'native-controls-paused-disabled');
 info.annotations.push({type:'v3-verified',description:'AC-36'});
});

test.afterEach(async({},info)=>annotateV3(info));


test('V3 AC-35 live captured and elapsed conditional timers retain exact paired references throughout the matrix',async({page},info)=>{
 test.setTimeout(240000);const now=Date.parse('2026-10-14T19:52:30Z');await page.clock.setFixedTime(now);const applied={...head(100),timestamp:new Date(now).toISOString()};await prepare(page,false,applied);const panel=page.locator('.network-panel.mainnet'),rows=panel.locator('.baker-opportunity');
 const candidate={...head(101),hash:'MatrixSixSeconds101',timestamp:new Date(now).toISOString()};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});
 await expect(rows.first()).toContainText('reference MatrixSixSeconds101');await expect(rows.first()).toContainText('deadline 2026-10-14T19:52:36.000Z');await expect(rows.nth(1)).toContainText('Conditional timer');await captureMatrix(page,info,'conditional-pair-known-live');
 await inspectRetainedCandidate(panel,'MatrixSixSeconds101');await expect(rows.first()).toContainText('6s remaining');await page.clock.setFixedTime(now+90000);await captureMatrix(page,info,'conditional-pair-captured-six-seconds');await expect(rows.first()).toContainText('6s remaining');
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();await expect(rows.first()).toContainText('Awaiting observation');await expect(panel.locator('.navigator-current')).toContainText('101 · r0');await captureMatrix(page,info,'conditional-pair-elapsed-unobserved');
});

for(const malformed of ['att','pre'] as const)test(`V3 AC-10 complete ${malformed==='att'?'pre':'att'} zero and opposite partial coverage render throughout the matrix`,async({page},info)=>{
 test.setTimeout(120000);const current=head();await prepare(page,false,current);await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));
 const bad={hash:'MatrixMalformedPhaseOnly',contents:[{kind:malformed==='att'?'attestations_aggregate':'preattestations_aggregate',consensus_content:{level:101,round:0,block_payload_hash:'vhPayload101'},committee:malformed==='att'?[{slot:0},{slot:-1}]:[0,-1]}]};await page.route('https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{validated:[bad],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate={...head(101),hash:'MatrixIndependentZero'};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});const panel=page.locator('.network-panel.mainnet'),known=malformed==='att'?'pre':'att';await expect(panel.locator(`.${known} .gauge-exact`)).toHaveText('0 / 30,000');await expect(panel.locator(`.${malformed} .gauge-exact`)).toHaveText('Unavailable');await captureMatrix(page,info,`complete-${known}-zero-partial-${malformed}`);
});

test('V3 AC-22 system appearance and denied persistence remain readable throughout the matrix',async({page},info)=>{
 test.setTimeout(180000);await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('Storage denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('Storage denied','SecurityError');};});await prepare(page,false);
 await captureMatrix(page,info,'theme-storage-denied-notice');await expect(page.locator('.theme-notice')).toContainText('session');
 for(const os of ['light','dark'] as const)await captureMatrix(page,info,`theme-system-os-${os}`,async()=>{
  // Each rendered cell keeps its stated palette; the OS transition is exercised
  // through the opposite preference before settling to that cell's palette.
  const rendered=await page.locator('html').getAttribute('data-theme');await choose(page.getByLabel('Appearance'),'system');await page.emulateMedia({colorScheme:os});await expect(page.locator('html')).toHaveAttribute('data-theme',os);await page.emulateMedia({colorScheme:rendered==='dark'?'dark':'light'});await expect(page.locator('html')).toHaveAttribute('data-theme',rendered??'light');
 });
});

test('V3 AC-28 independent comparison agreement divergence unknown power and stale receipts render throughout the matrix',async({page},info)=>{
 test.setTimeout(240000);await page.clock.install();const current=head();await prepare(page,false,current);let compared={...current,chain_id:'NetFixture',protocol:'PFixture'},chain='NetFixture';const reads:string[]=[];
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);await route.fulfill({json:path.endsWith('/chain_id')?chain:path.endsWith('/header')?compared:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 const panel=page.locator('.network-panel.mainnet');await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');await compare.click();await expect(result).toContainText('head-agreement');expect(reads).toHaveLength(3);await captureMatrix(page,info,'independent-comparison-agreement');
 compared={...compared,hash:'MatrixOtherHead100'};await compare.click();await expect(result).toContainText('divergence');expect(reads).toHaveLength(6);await captureMatrix(page,info,'independent-comparison-divergence');
 chain='OtherChain';compared={...compared,chain_id:chain};await compare.click();await expect(result).toContainText('chain OtherChain');await expect(result).toContainText('Power unknown');expect(reads).toHaveLength(7);await captureMatrix(page,info,'independent-comparison-unknown-power');
 await page.clock.runFor(60000);await expect(result).toContainText('stale');await captureMatrix(page,info,'independent-comparison-stale');expect(reads).toHaveLength(7);
});

test.afterEach(async({page},info)=>attachFailureTrace(page,info));

for(const variant of ['conditional-rights-known-timing-unknown','conditional-timing-known-rights-unknown','successor-migration-timing-unknown'] as const)test(`V3 AC-35 ${variant} remains independently qualified throughout the matrix`,async({page},info)=>{
 test.setTimeout(120000);await prepare(page,false);const panel=page.locator('.network-panel.mainnet'),rows=panel.locator('.baker-opportunity'),candidate={...head(101,2),hash:`MatrixBranch-${variant}`};headers.get(page)?.set(candidate.hash,candidate);
 // The immutable parent constants still prove admission. Fail only the opportunity consumer.
 if(variant==='conditional-rights-known-timing-unknown')await page.evaluate(async({path,hash})=>{const module=await import(path),original=module.NetworkData.prototype.opportunityConstants;module.NetworkData.prototype.opportunityConstants=function(head: {hash:string},...args:unknown[]){if(head.hash===hash)return Promise.reject(new Error('Projected timing unavailable'));return original.call(this,head,...args);};},{path:inspectionModule(),hash:candidate.hash});
 if(variant==='conditional-timing-known-rights-unknown')await page.route('**/helpers/baking_rights?*',route=>route.fulfill({json:[]}));
 if(variant==='successor-migration-timing-unknown'){
  await page.route(`**/${candidate.hash}/protocols`,route=>route.fulfill({json:{protocol:'PFixture',next_protocol:'PSuccessor'}}));
  await page.route(`**/${candidate.hash}/context/constants`,route=>route.fulfill({json:{minimal_block_delay:'10',delay_increment_per_round:'4',consensus_threshold_size:20000,consensus_committee_size:30000}}));
 }
 await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(rows.first()).toContainText('Level 101 · round 3');await expect(rows.nth(1)).toContainText('Level 102 · round 0');
 if(variant==='conditional-rights-known-timing-unknown'){await expect(rows.first()).toContainText('proposer source');await expect(rows.first()).toContainText('Timer unavailable');await expect(rows.nth(1)).toContainText('proposer source');}
 if(variant==='conditional-timing-known-rights-unknown'){await expect(rows.first()).toContainText(`reference ${candidate.hash}`);await expect(rows.first()).toContainText('Conditional timer');await expect(rows.nth(1)).toContainText('Conditional timer');await expect(rows.first()).toContainText('Baking rights unavailable');}
 if(variant==='successor-migration-timing-unknown'){await expect(rows.first()).toContainText(`deadline ${new Date(Date.parse(candidate.timestamp)+12000).toISOString()}`);await expect(rows.nth(1)).toContainText(/migration.*unavailable|migration.*unproven/i);await expect(rows.nth(1)).toContainText('Timer unavailable');}
 await captureMatrix(page,info,variant);
});


test('V3 AC-01 applied tuple relationship and next-level observation remain qualified throughout the matrix',async({page},info)=>{
 test.setTimeout(240000);const initial=head(100,209);await prepare(page,false,initial);await selectNetwork(page,'shadownet');await send(page,'shadownet-operations',[vote(0,100,209)]);const panel=page.locator('.network-panel.shadownet');
 await expect(panel.locator('.selected-relationship')).toContainText('already-applied');await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');await captureMatrix(page,info,'already-applied-tuple-qualified-votes');
 const fork={...initial,hash:'SameTupleDifferentBlock100'};headers.get(page)?.set(fork.hash,fork);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:fork.hash,header:fork});await inspectRetainedCandidate(panel,'SameTupleDifferentBlock100');await expect(panel.locator('.selected-relationship')).toContainText('selected block hash differs');await captureMatrix(page,info,'applied-tuple-different-known-block');
 const next={...head(101),hash:'NextObserved101'};next.fitness[3]=(0xffffffff-209).toString(16).padStart(8,'0');headers.get(page)?.set(next.hash,next);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:next.hash,header:next});await panel.getByRole('button',{name:'Follow live',exact:true}).click();await expect(panel.locator('.selected-relationship')).toContainText('next level');await expect(panel.locator('.next-proposal-observation')).toContainText('Coherent next-level proposal observed');await captureMatrix(page,info,'coherent-next-level-proposal-observed');
});


test('V3 AC-36 palette and history radio choices expose selected hover and focus states at every base',async({page},info)=>{
 test.setTimeout(180000);await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);await expect(page.locator('select')).toHaveCount(0);
 for(const [state,name] of [['palette-choice-states','Colour palette'],['history-length-choice-states','History length']] as const){
  await captureMatrix(page,info,state,async()=>{
   const control=name==='Colour palette'?page.getByLabel(name,{exact:true}):page.locator('.mainnet').getByLabel(name,{exact:true});
   for(const ancestor of await control.locator('..').locator('xpath=ancestor::details').all())await openDetails(ancestor);
   if(await control.locator('..').getAttribute('open')===null)await control.click();
   const group=control.locator('..').locator(':scope > .choice-options'),checked=group.locator(':scope > .choice-option > input:checked');await checked.focus();await expect(checked).toBeFocused();await group.locator(':scope > .choice-option').last().hover();
  });
  await page.keyboard.press('Escape');if(name==='Colour palette')await page.keyboard.press('Escape');
 }
 info.annotations.push({type:'v3-verified',description:'AC-36'});
});
