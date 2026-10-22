import {burstSettlement} from './burstTiming';
import {writeFile} from 'node:fs/promises';
import {attachFailureTrace} from './productionFixture';
import {annotateV3} from './v3Verification';
import {expect, test, type Page, type Locator} from '@playwright/test';
import type {ObservationStore,ObservationTarget} from '../../src/monitor/observationStore';
import type {Derived} from '../../src/rpc/networkData';

// Runtime/import failures must remain execution errors in semantic reports.
const executionErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
  const errors:string[]=[];executionErrors.set(page,errors);
  page.on('pageerror',error=>errors.push(`Browser runtime error: ${error.message}`));
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.hostname==='127.0.0.1' && response.status()>=400 && /\.(?:ts|js|css)(?:$|\?)/.test(url.pathname))errors.push(`Production asset failed: ${url.pathname} HTTP ${response.status()}`);
  });
});
test.afterEach(async({page})=>{
  const errors=executionErrors.get(page)??[];
  if(errors.length)throw new Error(errors.join('\n'));
});

test.afterEach(async({},testInfo)=>{
 const criterion=/^V3 (AC-\d\d) /.exec(testInfo.title)?.[1];
 if(criterion&&testInfo.status==='passed')testInfo.annotations.push({type:'v3-verified',description:criterion});
});

test.afterEach(async({page},info)=>{if(info.title.startsWith('V3 AC-13')&&info.title.includes('burst')){const trace=await page.evaluate(()=>(window as unknown as {burstDomainTrace?:unknown[]}).burstDomainTrace??[]);await info.attach('actual-domain-admission-trace',{body:JSON.stringify(trace),contentType:'application/json'});}});

import {head,vote,headers,send,prepare,openDetails,choose,inspectionModule,selectNetwork,inspectRetainedCandidate,inspectRetainedPayload,capturedCandidate,inspectCapturedCandidate,inspectRaw,rawObservation} from './productionFixture';

test('foundations AC-33 selected-relative opportunities retain observed branches and require exact proposer rights',async({page},testInfo)=>{
 await page.clock.install();const observed=head(100,0);await prepare(page,false,observed);
 const panel=page.locator('.network-panel').first();
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 100 · round 1');
 await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Level 101 · round 0');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('proposer source https://mainnet.smartpy.io');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('proposer source https://mainnet.smartpy.io');await expect(panel.locator('.baker-opportunity').first()).toContainText('Future hash unknown');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Future hash unknown');
 const applied=await panel.locator('.headline').textContent();await page.clock.runFor(120000);
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 100 · round 1');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Awaiting observation');
 await expect(panel.locator('.headline')).toHaveText(applied!);
 const selected={...head(101,2),hash:'ObservedOpportunity101'};headers.get(page)!.set(selected.hash,selected);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:selected.hash,header:selected});await inspectRetainedCandidate(panel,'ObservedOpportunity101');await expect(panel.locator('.candidate-evidence')).toContainText('Observed block hash ObservedOpportunity101');await expect(panel.locator('.candidate-evidence')).toContainText('Producer unknown');await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 101 · round 3');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Level 102 · round 0');await expect(panel.locator('.baker-opportunity').first()).toContainText('Future hash unknown');await expect(panel.locator('.headline')).toHaveText(applied!);
 for(const mode of ['missing','conflicting'] as const){await page.route('**/helpers/baking_rights?*',async route=>{const url=new URL(route.request().url()),level=Number(url.searchParams.get('level')),round=Number(url.searchParams.get('max_round'));await route.fulfill({json:mode==='missing'?[]:[{level,round,delegate:'ConflictingBakerA'},{level,round,delegate:'ConflictingBakerB'}]});});const candidate={...selected,hash:`ObservedOpportunity-${mode}`};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await inspectRetainedCandidate(panel,candidate.hash);await expect(panel.locator('.candidate-evidence')).toContainText(`Observed block hash ${candidate.hash}`);await expect(panel.locator('.baker-opportunity').first()).toContainText('Baking rights unavailable');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Baking rights unavailable');await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 101 · round 3');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Level 102 · round 0');await expect(panel.locator('.headline')).toHaveText(applied!);}
 testInfo.annotations.push({type:'foundation-verified',description:'AC-33'});
});

test('monitor operations update the production dashboard without losing list scroll or focus', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await prepare(page,false);
  const pinned=headers.get(page)!.get("BBlock100")!;
  await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...pinned,chain_id:"NetFixture"}}));
  await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
  await send(page, 'mainnet-operations', [vote(0)]);
  const panel = page.locator('.network-panel.mainnet');
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await inspectRetainedPayload(panel,"vhPayload101");
  await expect(panel).toContainText("Source-snapshot measured zero");
  const details = panel.locator('.missing-section details').first();
  await details.locator('summary').click();
  const viewport = details.locator('.delegate-scroll');
  await viewport.evaluate(element => {element.scrollTop = 200;});
  const copy = details.getByRole('button', {name: 'Copy full address for Baker 11 · TzKT', exact: true});
  await copy.focus();
  const position = await viewport.evaluate(element => element.scrollTop);
  await send(page, 'mainnet-operations', [vote(1)]);
  await expect(panel.locator('.pre .gauge-counts')).toContainText('1,200 / 30,000 power');
  await expect(details).toHaveAttribute('open', '');
  await expect(copy).toBeFocused();
  // Firefox may round scroll positions to subpixel row boundaries.
  expect(Math.abs(await viewport.evaluate(element => element.scrollTop) - position)).toBeLessThan(1);
  await send(page, 'mainnet-operations', [vote(1)]);
  await expect(panel.locator('.pre .gauge-counts')).toContainText('1,200 / 30,000 power');
  await expect(panel.locator('.pre .gauge-counts')).toContainText('2 / 50 signers');
  await page.screenshot({path: '/tmp/consensus-v2-redesign.png', fullPage: true});
});

test('a selected network outage stays isolated when another network resumes receiving votes', async ({page}) => {
  await prepare(page);
  await selectNetwork(page,'shadownet');
  await page.evaluate(() => window.mockStreams['shadownet-head']!.error(new Error('Fixture outage')));
  await expect(page.locator('.shadownet .status-chip')).toHaveText('RPC coverage degraded');
  await selectNetwork(page,'mainnet');
  expect(await page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes('shadownet')&&request.url.includes('/monitor/')).every(request=>request.aborted))).toBe(true);
  await send(page, 'mainnet-operations', [vote(0)]);
  await expect(page.locator('.mainnet .pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(page.locator('.mainnet .status-chip')).toHaveText('Progress unknown');
});

test('recent consensus retains peak power after the current level moves on',async({page})=>{
  await prepare(page);await selectNetwork(page,'shadownet');
  await send(page,'shadownet-operations',[vote(0),vote(1)]);
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('1,200 / 30,000 power');
  await send(page,'shadownet-head',head(102));
  await expect(page.locator('.shadownet .headline')).toContainText('102');
  await expect(page.locator('.shadownet .recent-consensus')).toContainText('101 · r0');
  await expect(page.locator('.shadownet .recent-consensus')).toContainText('Pre 4.0%');
  await expect(page.locator('.shadownet .pre .gauge-counts')).not.toContainText('1,200');
});

test('unobserved phases stay unavailable while coherent received rounds remain selected independently of the clock', async ({page}) => {
  await prepare(page, false);await selectNetwork(page,'shadownet');
  await expect(page.locator('.shadownet .pre .gauge-percent')).toHaveText('—');
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('Voting power unavailable');
  await send(page, 'shadownet-operations', [vote(0, 101, 9)]);
  await expect(page.locator('.shadownet .section-heading')).toContainText(['Observed round 9']);
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(page.locator('.shadownet .att .gauge-counts')).toContainText('Voting power unavailable');
  await send(page, 'shadownet-operations', [vote(0, 101, 0)]);
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('600 / 30,000 power');
  await send(page, 'shadownet-head', head(102));
  await expect(page.locator('.shadownet .headline')).toContainText('102');
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('Voting power unavailable');
  await expect(page.locator('.shadownet .pre .gauge-percent')).toHaveText('—');
  await expect(page.locator('.shadownet .consensus-section')).not.toContainText('vhPayload100');
});

test('clock boundaries preserve observed power until a new round is received or its parent context is replaced', async ({page}) => {
  await page.clock.install({time: new Date()});
  await prepare(page);await selectNetwork(page,'shadownet');
  await send(page, 'shadownet-operations', [vote(0),vote(1)]);
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('1,200 / 30,000 power');
  await page.clock.fastForward(31_000);
  await expect(page.locator('.shadownet .section-heading')).toContainText(['Observed round 0']);
  await expect(page.locator('.shadownet .timing-detail')).toContainText('estimated round 2');
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('1,200 / 30,000 power');
  await expect(page.locator('.shadownet .baker-opportunity').first()).toContainText('Level 101 · round 1');
  await send(page, 'shadownet-operations', [vote(3,101,2)]);
  await expect(page.locator('.shadownet .section-heading')).toContainText(['Observed round 2']);
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('600 / 30,000 power');
  await send(page,'shadownet-head',{...head(100),hash:'ReplacedRoundParent'});
  await expect(page.locator('.shadownet .pre .gauge-counts')).toContainText('Voting power unavailable');
  await expect(page.locator('.shadownet .pre .gauge-percent')).toHaveText('—');
});

test('fresh votes under an old but coherent parent retain power until proven parent replacement',async({page})=>{
  const old=head(100,75);old.timestamp=new Date(Date.now()-3_600_000).toISOString();
  await prepare(page,true,old,101);
  await selectNetwork(page,'shadownet');
  await send(page,'shadownet-operations',[vote(0,101,0)]);
  const panel=page.locator('.network-panel.shadownet');
  await expect(panel.locator('.headline')).toContainText('Applied block round75');
  await expect(panel).toContainText('Observed votes · level 101 · round 0');
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');
  await send(page,'shadownet-head',{...old,hash:'ReplacedOldParent'});
  await expect(panel.locator('.pre .gauge-counts')).toContainText('Voting power unavailable');
  await expect(panel.locator('.pre .gauge-percent')).toHaveText('—');
});

test('desktop and mobile layouts use the viewport without horizontal clipping', async ({page}) => {
  await prepare(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const panel = page.locator('.mainnet');
    await panel.locator('.gauges').scrollIntoViewIfNeeded();
    expect(await panel.locator('.gauges').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(250);
    await expect(panel.locator('.pre .gauge-percent')).toBeVisible();
  }
});

test('mobile network selection and disclosures persist, and pause stops stream updates', async ({page}) => {
  await page.setViewportSize({width: 390, height: 900});
  await prepare(page);
  await selectNetwork(page,'shadownet');
  await expect(page.locator('.network-panel.shadownet')).toBeVisible();
  await page.locator('.shadownet .missing-section summary').first().click();
  await page.reload();
  await expect(page.locator('.network-panel.shadownet')).toBeVisible();
  await expect(page.locator('.network-panel.mainnet')).toBeHidden();
  await expect(page.locator('.shadownet .missing-section details').first()).toHaveAttribute('open', '');
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await expect(page.locator('.shadownet .connection-line')).toContainText('Paused');
});


test('stalled applied head keeps estimated round 37 separate from selected observed successor round zero', async ({page}, testInfo) => {
  await page.clock.install({time: new Date('2026-10-14T18:54:31Z')});
  const applied = {...head(5489251, 101), timestamp: '2026-10-14T18:12:09Z'};
  await prepare(page, false, applied, 5489252);
  await selectNetwork(page,'shadownet');
  await send(page, 'shadownet-operations', [vote(0, 5489251, 101), vote(1, 5489252, 0), vote(2, 5489252, 36)]);
  const panel = page.locator('.network-panel.shadownet'); await page.locator('.network-tab.shadownet').click();
  await expect(panel.locator('.headline')).toHaveText('Applied block level5,489,251Applied block round101');
  await expect(panel.locator('.navigator-current')).toContainText('5,489,252 · r36');
  await inspectRetainedPayload(panel,'vhPayload5489252',{level:5489252,round:0});
  await expect(panel.locator('.timing-detail')).toContainText('Independent clock estimate · level 5,489,252 · estimated round 37');
  await expect(panel.locator('.applied-context')).toContainText('Last applied block · level 5,489,251 · round 101 · block timestamp');
  await expect(panel.locator('.applied-context')).toBeVisible();
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(panel.locator('.att .gauge-percent')).toHaveText('—');
  await expect(panel.locator('.selection-label')).toHaveAttribute('title','vhPayload5489252');
  await expect(panel.locator('.network-notice')).toContainText('Observed votes · level 5,489,252 · round 0');await expect(panel.locator('.network-notice')).toContainText('partial positive observations');
  const opportunities = panel.locator('.baker-opportunity');
  await expect(opportunities.nth(0)).toContainText('↑ Next round');
  await expect(opportunities.nth(0)).toContainText('Level 5,489,252 · round 1');
  await expect(opportunities.nth(1)).toContainText('→ Next level');
  await expect(opportunities.nth(1)).toContainText('Level 5,489,253 · round 0');
  await expect(opportunities.nth(0)).toContainText('Conditional on continued same-level production');await expect(opportunities.nth(1)).toContainText('Earliest protocol boundary conditional on hypothetical next-level production');
  await panel.screenshot({path: testInfo.outputPath('stalled-successor-hotfix.png')});
});

test('a validated proposal without matching payload votes never measures zero', async ({page}) => {
  await prepare(page, false);await selectNetwork(page,'shadownet');
  await send(page, 'shadownet-proposals', {chain_id: 'NetFixture', hash: 'BProposal', header: {...head(101), payload_hash: 'vhProposalA'}});
  const panel = page.locator('.shadownet');
  await expect(panel.locator('.proposal-context')).toContainText('Observed proposal');
  await expect(panel.locator('.pre .gauge-percent')).toHaveText('—');
  const malformed = vote(0);
  delete (malformed.contents[0] as {block_payload_hash?: string}).block_payload_hash;
  await send(page, 'shadownet-operations', [malformed]);
  await expect(panel.locator('.evidence-meta dd').nth(4)).not.toHaveText('Unavailable');
  await expect(panel.locator('.pre .gauge-percent')).toHaveText('—');
  await expect(panel.locator('.selection-label')).not.toContainText('unknown');
  await send(page, 'shadownet-operations', [vote(1)]);
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(panel.locator('.proposal-context')).toContainText('Observed votes');
  await expect(panel.locator('.proposal-context')).not.toContainText('Observed proposal');
  await expect(panel.locator('.att .gauge-percent')).toHaveText('—');
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(panel.locator('.network-notice')).toContainText('Observed votes · level 101 · round 0');
  await expect(panel.locator('.network-notice')).toContainText('partial positive observations');
  await expect(panel.locator('.network-notice')).not.toContainText('Current round');
});


test('observed votes and scheduled proposals name their own levels and rounds', async ({page}) => {
  await page.clock.install({time: new Date('2026-10-14T18:54:31Z')});
  const applied = {...head(5489251, 114), timestamp: '2026-10-14T18:47:21Z'};
  await prepare(page, false, applied, 5489251);
  await selectNetwork(page,'shadownet');
  await send(page, 'shadownet-operations', [vote(0, 5489252, 0)]);
  const panel = page.locator('.network-panel.shadownet'); await page.locator('.network-tab.shadownet').click();
  await expect(panel.locator('.headline')).toHaveText('Applied block level5,489,251Applied block round114');
  await expect(panel.locator('.network-notice')).toContainText('Observed votes · level 5,489,252 · round 0');
  await expect(panel.locator('.network-notice')).toContainText('partial positive observations');
  await expect(panel.locator('.network-notice')).not.toContainText('Current round');
  await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
  await expect(panel.locator('.timing-detail')).toContainText('estimated round 6');
  const opportunities = panel.locator('.baker-opportunity');
  await expect(opportunities.nth(0)).toContainText('↑ Next round');
  await expect(opportunities.nth(0)).toContainText('Level 5,489,252 · round 1');
  await expect(opportunities.nth(1)).toContainText('→ Next level');
  await expect(opportunities.nth(1)).toContainText('Level 5,489,253 · round 0');
});

 test("foundations slice 1 selects same-round shared-payload candidates and isolates competing power",async({page},testInfo)=>{
  await prepare(page,false);const panel=page.locator(".network-panel.mainnet");
  for(const hash of ["H1","H2"]) await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash,header:{...head(101),payload_hash:"vhPayload101"}});
  await send(page,"mainnet-operations",[vote(0)]);
  await openDetails(panel.locator(".observed-proposals"));
  await expect(panel.locator(".observed-proposals").getByRole("button",{name:"Inspect candidate H1",exact:true})).toBeVisible();
  await expect(panel.locator(".observed-proposals").getByRole("button",{name:"Inspect candidate H2",exact:true})).toBeVisible();
  await panel.locator(".observed-proposals").getByRole("button",{name:"Inspect candidate H1",exact:true}).click();
  await expect(panel.locator(".candidate-evidence")).toContainText("H1");
  await expect(panel.locator(".candidate-evidence")).toContainText("Producer unknown");
  await expect(panel.locator(".candidate-evidence")).toContainText("Shared payload evidence");
  await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
  await inspectRetainedCandidate(panel,"H2");
  await expect(panel.locator(".candidate-evidence")).toContainText("H2");
  await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
  const competing=vote(1);competing.contents[0]!.block_payload_hash="vhOtherPayload";
  await send(page,"mainnet-operations",[competing]);
  await inspectRetainedPayload(panel,"vhOtherPayload");
  await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
  await inspectRetainedCandidate(panel,"H1");
  const aggregate={hash:"replay-aggregate",contents:[{kind:"preattestations_aggregate",consensus_content:{level:101,round:0,block_payload_hash:"vhPayload101"},committee:[0,0]}]};
  await send(page,"mainnet-operations",[aggregate,aggregate]);
  await expect(panel.locator(".pre .gauge-counts")).toContainText("1 / 50 signers");
  await expect(panel.locator(".pre .quorum-caption")).toContainText("19,400 more power");
  await expect(panel.locator(".candidate-evidence")).toContainText("rpc.tzkt.io");
  await panel.getByText("Sources & observation evidence",{exact:true}).click();
  await expect(panel.locator(".authority-evidence")).toBeVisible();
  await expect(panel.locator(".authority-evidence")).toContainText("Rights responder https://rpc.tzkt.io/mainnet");
  await expect(panel.locator(".authority-evidence")).toContainText("authority observer https://rpc.tzkt.io/mainnet");
  await expect(panel.locator(".authority-evidence")).toContainText("chain NetFixture · context head BBlock100 · requested anchor BBlock100 · target 101 · execution protocol PFixture");
  await expect(panel.locator(".authority-evidence")).toContainText("rights received");
  await panel.getByText("Sources & observation evidence",{exact:true}).click();
  await panel.screenshot({path:`roster/observatory-foundations/slice-1-${testInfo.project.name}.png`});
 });

 test("foundations AC-4 initially hidden starts no work and permitted generations restart",async({page},testInfo)=>{
  await prepare(page,false,head(),100,true);
  expect(await page.evaluate(()=>window.mockRequests.length)).toBe(0);
  await page.evaluate(()=>{window.mockHidden=false;document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.locator(".mainnet .headline")).toContainText("100");
  await expect.poll(()=>page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes("/v1/delegates")).length)).toBe(1);
  await page.evaluate(()=>{window.mockHidden=true;document.dispatchEvent(new Event("visibilitychange"));});
  const paused=await page.evaluate(()=>window.mockRequests.length);
  await page.waitForTimeout(100);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(paused);
  expect(await page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes("/monitor/")).every(request=>request.aborted))).toBe(true);
  await page.evaluate(()=>{window.mockHidden=false;document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(()=>page.evaluate(()=>window.mockRequests.length)).toBeGreaterThan(paused);
  await send(page,"mainnet-operations",[vote(0)]);await expect(page.locator(".mainnet .pre .gauge-counts")).toContainText("600 / 30,000 power");
  testInfo.annotations.push({type:"foundation-verified",description:"AC-4"});
 });
 test("foundations AC-20 manual pause survives pagehide pageshow and visibility restoration",async({page},testInfo)=>{
  await prepare(page);await page.getByRole("button",{name:"Pause",exact:true}).click();
  const count=await page.evaluate(()=>window.mockRequests.length);
  await page.evaluate(()=>{window.dispatchEvent(new Event("pagehide"));window.dispatchEvent(new Event("pageshow"));window.mockHidden=true;document.dispatchEvent(new Event("visibilitychange"));window.mockHidden=false;document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.getByRole("button",{name:"Resume",exact:true})).toBeVisible();
  await page.waitForTimeout(100);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(count);
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.mockRequests.length)).toBeGreaterThan(count);
  testInfo.annotations.push({type:"foundation-verified",description:"AC-20"});
 });
 test("paused local candidate inspection starts no external reads",async({page},testInfo)=>{
  await prepare(page,false);
  for(const hash of ["H1","H2"])await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash,header:{...head(101),payload_hash:"vhPayload101"}});
  await send(page,"mainnet-operations",[vote(0)]);const panel=page.locator(".network-panel.mainnet");
  await inspectRetainedCandidate(panel,"H1");
  await expect(capturedCandidate(panel,"H1")).toBeVisible();
  await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
  await page.getByRole("button",{name:"Pause",exact:true}).click();const count=await page.evaluate(()=>window.mockRequests.length);
  await inspectRetainedCandidate(panel,"H2");
  await expect(panel.locator(".candidate-evidence")).toContainText("H2");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
  await panel.locator(".missing-section summary").first().click();await expect(panel.locator(".missing-section details").first()).toHaveAttribute("open","");
  expect(await page.evaluate(()=>window.mockRequests.length)).toBe(count);
  testInfo.annotations.push({type:"foundation-verified",description:"AC-21"});
 });


test("source B ahead votes promote under B proof while applied A remains independent",async({page},testInfo)=>{
 await prepare(page,false,head(120),120,false,true);await selectNetwork(page,'shadownet');
 const bHead=head(122),records=headers.get(page);records?.set("BBlock122",bHead);records?.set("BBlock121",head(121));
 let release:()=>void=()=>undefined;const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",async route=>{await held;await route.fulfill({json:{...bHead,chain_id:"NetFixture"}});});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mockStreams["shadownet-operations"]))).toBe(true);
 await send(page,"shadownet-operations",[vote(0,123)]);
 const panel=page.locator(".network-panel.shadownet");
 await inspectRaw(panel,"Inspect payload vhPayload123");
 await expect(panel.locator(".candidate-evidence")).toContainText("Unresolved");
 await expect(panel.locator(".candidate-evidence")).toContainText("tezos-shadownet.octez.io");
 await expect(rawObservation(panel,"Inspect payload vhPayload123")).toBeVisible();
 await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");release();
 await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 await expect(panel.locator(".headline")).toContainText("120");
 await expect(panel).toContainText("context head BBlock122");
 await expect(panel.locator(".att .gauge-percent")).toHaveText("—");
 await inspectRetainedPayload(panel,"vhPayload123");
 const q1=vote(1,123),q2=vote(2,123);q1.contents[0]!.block_payload_hash="OtherPayload";q2.contents[0]!.block_payload_hash="OtherPayload";
 await send(page,"shadownet-operations",[q1,q2]);
 await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 await inspectRetainedPayload(panel,"OtherPayload");await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");
 await inspectRetainedPayload(panel,"vhPayload123");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 await send(page,"shadownet-operations",[vote(0,123)]);await expect(panel.getByLabel("Retained session instance").locator("..").locator(".choice-option").filter({hasText:"vhPayload123"})).toHaveCount(1);
 const requests=await page.evaluate(()=>window.mockRequests.map(value=>value.url).filter(url=>url.includes("/blocks/head/header")));
 expect(requests).toContain("https://tezos-shadownet.octez.io/chains/main/blocks/head/header");
 await openDetails(panel.getByText("Sources & observation evidence",{exact:true}).locator(".."));await expect(panel.locator(".authority-evidence")).toBeVisible();
 await panel.screenshot({path:`roster/observatory-foundations/slice-4-${testInfo.project.name}.png`});
});


test("failed B evidence retries only through a fresh permitted explicit action",async({page})=>{
 await prepare(page,false,head(120),120,false,true);await selectNetwork(page,'shadownet');
 let attempts=0;await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",async route=>{attempts++;await route.fulfill({status:503,json:{error:"B unavailable"}});});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mockStreams["shadownet-operations"]))).toBe(true);
 await send(page,"shadownet-operations",[vote(0,123)]);const panel=page.locator(".network-panel.shadownet");
 await inspectRaw(panel,"Inspect payload vhPayload123");
 await expect(panel.locator(".candidate-evidence")).toContainText("Unresolved");
 await expect.poll(()=>attempts).toBe(1);
 const retry=panel.getByRole("button",{name:"Retry selected observer context",exact:true});await expect(retry).toBeVisible();
 await retry.click();await page.waitForTimeout(100);expect(attempts).toBe(1);
 await page.clock.install();await page.clock.runFor(20000);expect(attempts).toBe(1);
 await send(page,"shadownet-operations",[vote(0,123)]);await page.clock.runFor(100);expect(attempts).toBe(1);
 await retry.click();await expect.poll(()=>attempts).toBe(2);
 await page.getByRole("button",{name:"Pause",exact:true}).click();await expect(retry).toBeDisabled();
});


test("late B response bodies cannot authorize after pause and resume",async({page})=>{
 await prepare(page,false,head(120),120,false,true);await selectNetwork(page,'shadownet');const bHead=head(122);headers.get(page)?.set(bHead.hash,bHead);headers.get(page)?.set(bHead.predecessor,head(121));
 await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",route=>route.fulfill({json:{...bHead,chain_id:"NetFixture"}}));
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mockStreams["shadownet-operations"]))).toBe(true);
 await page.evaluate(()=>{const original=window.fetch.bind(window);const state={waiting:false,release:()=>{}};Object.assign(window,{heldBBody:state});
 window.fetch=async(input,options)=>{const response=await original(input,options),url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
 if(url==="https://tezos-shadownet.octez.io/chains/main/blocks/head/header"){const body=await response.json();response.json=()=>new Promise(resolve=>{state.waiting=true;state.release=()=>resolve(body);});}return response;};});
 await send(page,"shadownet-operations",[vote(0,123)]);await expect.poll(()=>page.evaluate(()=>(window as unknown as {heldBBody:{waiting:boolean}}).heldBBody.waiting)).toBe(true);
 await page.getByRole("button",{name:"Pause",exact:true}).click();
 const count=await page.evaluate(()=>window.mockRequests.length);await page.getByRole("button",{name:"Resume",exact:true}).click();
 await page.evaluate(()=>(window as unknown as {heldBBody:{release:()=>void}}).heldBBody.release());
 const panel=page.locator(".network-panel.shadownet");await inspectRaw(panel,"Inspect payload vhPayload123");
 await expect(panel.locator(".candidate-evidence")).toContainText("Unresolved");
 await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await expect(panel.locator(".headline")).toContainText("120");
 expect(await page.evaluate(()=>window.mockRequests.filter(request=>request.url==="https://tezos-shadownet.octez.io/chains/main/blocks/head/header").every(request=>request.aborted))).toBe(true);
 expect(count).toBeGreaterThan(0);
});


test("reader selects retained A and B contexts without pooling their power",async({page})=>{
 await prepare(page,false,head(120));await selectNetwork(page,'shadownet');await send(page,"shadownet-operations",[vote(0,121)]);const panel=page.locator(".network-panel.shadownet");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 const bHead=head(122);headers.get(page)?.set(bHead.hash,bHead);headers.get(page)?.set(bHead.predecessor,head(121));await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",route=>route.fulfill({json:{...bHead,chain_id:"NetFixture"}}));
 await page.evaluate(()=>window.mockStreams["shadownet-operations"]!.error(new Error("A operations unavailable")));
 await expect.poll(()=>page.evaluate(()=>window.mockRequests.some(request=>request.url.startsWith("https://tezos-shadownet.octez.io")&&request.url.includes("monitor_operations")))).toBe(true);
 await send(page,"shadownet-operations",[vote(1,123),vote(2,123)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");
 await inspectRetainedPayload(panel,"vhPayload121");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await expect(panel).toContainText("context head BBlock120");
 await inspectRetainedPayload(panel,"vhPayload123");await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await expect(panel).toContainText("context head BBlock122");
 await expect(panel.locator(".headline")).toContainText("120");
});


test("foundations AC-13 coherent source zero becomes stale while historical receipt stays inspectable",async({page},testInfo)=>{
 await page.clock.install();
 const current=head(100);await prepare(page,false,current);
 const candidate={...head(101),hash:"BZeroCandidate",payload_hash:"vhZeroPayload"};headers.get(page)?.set(candidate.hash,candidate);
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[{hash:"unrelated",branch:current.hash,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]}],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash:candidate.hash,header:candidate});const panel=page.locator(".network-panel.mainnet");
 await inspectRetainedCandidate(panel,candidate.hash);await expect(panel.locator(".candidate-evidence")).toContainText(candidate.hash);
 await expect(panel.locator(".pre .gauge-counts")).toContainText("0 / 30,000 power");await expect(panel.locator(".att .gauge-counts")).toContainText("0 / 30,000 power");await expect(panel).toContainText("Source-snapshot measured zero");
 const asOf=(await panel.textContent())?.match(/snapshot received (\d{4}-[^ ]+)/)?.[1];expect(asOf).toBeTruthy();
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();
 await page.evaluate(()=>window.mockStreams["mainnet-operations"]!.error(new Error("Source coverage interrupted")));
 await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await expect(panel).toContainText("Retained source snapshot stale");await expect(panel).toContainText(asOf!);await expect(panel.locator(".recent-phase.pre")).toContainText("Pre 0.0%");
 await page.getByRole("button",{name:"Pause",exact:true}).click();await page.clock.setSystemTime(new Date("2030-01-01T00:00:00Z"));await page.clock.runFor(1000);await expect(panel).toContainText(asOf!);await expect(panel.locator(".att .gauge-counts")).toContainText("Voting power unavailable");
 await page.getByRole("button",{name:"Resume",exact:true}).click();await expect(panel).toContainText(asOf!);await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");
 testInfo.annotations.push({type:"foundation-verified",description:"AC-13"});
});


test("foundations AC-8 accepted crossing is attributed once and applied values stay separate",async({page},testInfo)=>{
 await prepare(page,false,head(100),100,false,false,{total:5,quorum:4,powers:[3,1,1]});const panel=page.locator(".network-panel.mainnet");
 await send(page,"mainnet-operations",[vote(0)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");
 await send(page,"mainnet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");
 const crossings=panel.locator(".event-history li").filter({hasText:/Preattestation.*(?:quorum reached|crossing)/});await expect(crossings).toHaveCount(1);
 const other={hash:"other-payload",contents:[{kind:"preattestation",level:101,round:0,slot:0,block_payload_hash:"vhOtherPayload"}]};await send(page,"mainnet-operations",[other]);
 await inspectRetainedPayload(panel,"vhOtherPayload");await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");
 await inspectRetainedPayload(panel,"vhPayload101");await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");await expect(crossings).toHaveCount(1);await expect(crossings).toContainText("rpc.tzkt.io/mainnet");await expect(panel.locator(".headline")).toContainText("100");await expect(panel).toContainText("Expected bakers not observed");
 testInfo.annotations.push({type:"foundation-verified",description:"AC-8"});
});


test("transport connectivity and observed source progress remain independent",async({page})=>{
 const current=head(100);await prepare(page,false,current);const panel=page.locator(".network-panel.mainnet");
 await expect(panel.locator(".status-chip")).toHaveText("Progress unknown");
 await expect(panel.locator(".authority-evidence")).toContainText("NetFixture");
 await send(page,"mainnet-head",head(101));await expect(panel.locator(".headline")).toContainText("101");await expect(panel).toContainText("Observed next-level advance");
 await page.evaluate(()=>window.mockStreams["mainnet-head"]!.error(new Error("Source head transport interrupted")));
 await expect(panel.locator(".status-chip")).toHaveText("RPC coverage degraded");await expect(panel).toContainText("Observed next-level advance");
});


test("malformed source coverage stays partial until a fresh permitted coherent snapshot",async({page})=>{
 await page.clock.install();const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 let reads=0,usable=false;await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>{reads++;return route.fulfill({json:{validated:usable?[{hash:"unrelated",branch:current.hash,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]}]:[{hash:"malformed",contents:[{kind:"preattestations_aggregate",consensus_content:{level:101,round:0,block_payload_hash:"vhPayload101"},committee:[0,-1]}]}],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 await send(page,"mainnet-operations",[vote(0)]);const panel=page.locator(".network-panel.mainnet");await inspectRetainedPayload(panel,"vhPayload101");
 await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await expect(panel.locator(".att .gauge-counts")).toContainText("0 / 5 power");await expect(panel).toContainText("partial positive observations");await expect(panel.getByText("Missing attestations · 3 bakers · 5 power",{exact:true})).toBeVisible();
 const retry=panel.getByRole("button",{name:"Retry selected observer context"});await expect(retry).toBeVisible();await expect.poll(()=>reads).toBe(1);
 await retry.click();usable=true;await send(page,"mainnet-operations",[vote(0)]);await page.clock.runFor(20000);expect(reads).toBe(1);
 await retry.click();await expect.poll(()=>reads).toBe(2);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await expect(panel.locator(".att .gauge-counts")).toContainText("0 / 5 power");await expect(panel).toContainText("Source-snapshot measured zero");
});


test("foundations AC-31 accepted maxima survive replay retirement and proven reorg return",async({page},testInfo)=>{
 const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});const panel=page.locator(".network-panel.mainnet");
 await send(page,"mainnet-operations",[vote(0)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await send(page,"mainnet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");
 const preCrossings=panel.locator(".event-history li").filter({hasText:"Preattestation crossing"});await expect(preCrossings).toHaveCount(1);
 await send(page,"mainnet-operations",[{hash:"first-att-quorum",contents:[{kind:"attestations_aggregate",consensus_content:{level:101,round:0,block_payload_hash:"vhPayload101"},committee:[{slot:0},{slot:1}]}]}]);await expect(panel.locator(".att .gauge-counts")).toContainText("4 / 5 power");await expect(panel.locator(".event-history li").filter({hasText:/\bAttestation observed quorum/})).toHaveCount(1);await expect(panel.locator(".event-history li").filter({hasText:/\bAttestation crossing/})).toHaveCount(0);
 const oldEvents=await panel.locator(".event-history li").allTextContents();
 await page.getByRole("button",{name:"Pause",exact:true}).click();await page.getByRole("button",{name:"Resume",exact:true}).click();await send(page,"mainnet-operations",[vote(0),vote(1)]);await expect(panel.locator(".event-history li")).toHaveText(oldEvents);
 const below={hash:"forgotten-below",contents:[{kind:"preattestation",level:101,round:0,slot:0,block_payload_hash:"vhBelow"}]};await send(page,"mainnet-operations",[below]);
 await send(page,"mainnet-operations",Array.from({length:151},(_,index)=>({hash:`retire-${index}`,contents:[{kind:"preattestation",level:101,round:0,slot:0,block_payload_hash:`vhRetire${index}`}]})));await expect(panel).toContainText("Crossing history partial");
 await send(page,"mainnet-operations",Array.from({length:10001},(_,index)=>({hash:`unrelated-bound-${index}`,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]})));
 const fork={...current,hash:"BProvenFork100"};await send(page,"mainnet-head",fork);await expect(panel).toContainText("Observed same-height reorg");await send(page,"mainnet-head",current);await expect(panel.locator(".authority-evidence")).toContainText("context head BBlock100");
 await send(page,"mainnet-operations",[vote(0),vote(1),below]);await send(page,"mainnet-operations",[{hash:"forgotten-below-threshold",contents:[{kind:"preattestation",level:101,round:0,slot:1,block_payload_hash:"vhBelow"}]}]);
 await inspectRetainedPayload(panel,"vhBelow");await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");await expect(preCrossings).toHaveCount(1);await expect(panel).toContainText("Crossing history partial");await expect(panel.locator(".event-history li").filter({hasText:/\bAttestation crossing/})).toHaveCount(0);
 await send(page,"mainnet-operations",[{hash:"reconstructed-att-quorum",contents:[{kind:"attestations_aggregate",consensus_content:{level:101,round:0,block_payload_hash:"vhPayload101"},committee:[{slot:0},{slot:1}]}]}]);await expect(panel.locator(".event-history li").filter({hasText:/\bAttestation observed quorum/})).toHaveCount(1);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-31"});
});


test("late pending snapshot body cannot restore coverage after pause and resume",async({page})=>{
 const current=head(100);await prepare(page,false,current);await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 await page.evaluate(()=>{const original=window.fetch.bind(window);const state={waiting:false,release:()=>{}};Object.assign(window,{heldPendingBody:state});window.fetch=async(input,options)=>{const response=await original(input,options),url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(url.startsWith("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?")){const body=await response.json();response.json=()=>new Promise(resolve=>{state.waiting=true;state.release=()=>resolve(body);});}return response;};});
 await send(page,"mainnet-operations",[vote(0)]);await expect.poll(()=>page.evaluate(()=>(window as unknown as {heldPendingBody:{waiting:boolean}}).heldPendingBody.waiting)).toBe(true);
 const panel=page.locator(".network-panel.mainnet");await page.getByRole("button",{name:"Pause",exact:true}).click();await page.getByRole("button",{name:"Resume",exact:true}).click();await page.evaluate(()=>(window as unknown as {heldPendingBody:{release:()=>void}}).heldPendingBody.release());
 await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await expect(panel.locator(".att .gauge-counts")).toContainText("Voting power unavailable");await expect(panel).not.toContainText("Source-snapshot measured zero");await expect(panel.locator(".event-history li")).toHaveCount(0);await expect(panel.locator(".headline")).toContainText("100");
});


test("supporting raw snapshot eviction withdraws measured coverage without fabricating zero",async({page})=>{
 const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate={...head(101),hash:"BSupportingCandidate",payload_hash:"vhPayload101"};headers.get(page)?.set(candidate.hash,candidate);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash:candidate.hash,header:candidate});const panel=page.locator(".network-panel.mainnet");await inspectRetainedCandidate(panel,candidate.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await expect(panel.locator(".att .gauge-counts")).toContainText("0 / 5 power");
 const receipt=(await panel.textContent())?.match(/snapshot received (\d{4}-[^ ]+)/)?.[1];expect(receipt).toBeTruthy();
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();
 await send(page,"mainnet-operations",Array.from({length:10000},(_,index)=>({hash:`raw-loss-${index}`,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]})));
 await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await expect(panel.locator(".att .gauge-counts")).toContainText("Voting power unavailable");await expect(panel).toContainText("Retained source snapshot stale");await expect(panel).toContainText(receipt!);await expect(panel.locator(".recent-phase.pre")).toContainText("Pre 60.0%");await expect(panel.locator(".event-history li")).toHaveCount(0);
});


test("unrelated raw eviction preserves a first proven below-to-quorum crossing",async({page})=>{
 await prepare(page,false,head(100),100,false,false,{total:5,quorum:4,powers:[3,1,1]});const panel=page.locator(".network-panel.mainnet");
 await send(page,"mainnet-operations",Array.from({length:10001},(_,index)=>({hash:`unrelated-only-${index}`,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]})));
 await send(page,"mainnet-operations",[vote(0)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await send(page,"mainnet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");await expect(panel.locator(".event-history li").filter({hasText:/\bPreattestation crossing/})).toHaveCount(1);await expect(panel).not.toContainText("Crossing history partial");
});


test("foundations AC-5 pinned full session evidence and reader controls survive continued collection",async({page},testInfo)=>{
 await page.clock.install();const current=head(100);await prepare(page,false,current);
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const panel=page.locator(".network-panel.mainnet");
 const add=async(hash:string,payload:string)=>{const candidate={...head(101),hash,payload_hash:payload};headers.get(page)?.set(hash,candidate);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash,header:candidate});};
 await add("BSessionPinned","vhPayload101");await inspectRetainedCandidate(panel,"BSessionPinned");
 await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await expect(panel.locator(".att .gauge-counts")).toContainText("0 / 30,000 power");await expect(panel).toContainText("Source-snapshot measured zero");
 await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");
 const receipt=await panel.locator(".candidate-evidence").textContent(),authority=await panel.locator(".authority-evidence").textContent(),originalReceipt=receipt?.match(/received (\S+)/)?.[1];expect(receipt).toContain("Source https://rpc.tzkt.io/mainnet");expect(originalReceipt).toBeTruthy();expect(authority).toContain("chain NetFixture");expect(authority).toContain("context head BBlock100");expect(authority).toContain("execution protocol PFixture");
 const snapshotReceipt=(await panel.textContent())?.match(/snapshot received (\d{4}-[^ ]+)/)?.[1];expect(snapshotReceipt).toBeTruthy();
 const pre=panel.locator(".missing-section details").nth(0),att=panel.locator(".missing-section details").nth(1);await pre.locator("summary").click();await att.locator("summary").click();
 await expect(pre.locator("summary")).toContainText("49 bakers · 29,400 power");await expect(att.locator("summary")).toContainText("50 bakers · 30,000 power");
 const baker=pre.locator("tbody tr").filter({hasText:"Baker 11 · TzKT"});await expect(baker.locator("td").nth(2)).toHaveText("600");await expect(baker.locator("td").nth(3)).toHaveText("2.00%");
 const viewport=pre.locator(".delegate-scroll"),copy=pre.getByRole("button",{name:"Copy full address for Baker 11 · TzKT",exact:true});await viewport.evaluate(element=>{element.scrollTop=200;});await copy.focus();const scroll=await viewport.evaluate(element=>element.scrollTop);
 await send(page,"mainnet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");
 await send(page,"mainnet-operations",[{hash:"session-attestation-2",contents:[{kind:"attestation",level:101,round:0,slot:2,block_payload_hash:"vhPayload101"}]}]);await expect(panel.locator(".att .gauge-counts")).toContainText("600 / 30,000 power");
 await add("BSessionShared","vhPayload101");await add("BSessionNewer","vhDifferent101");await send(page,"mainnet-operations",[vote(3)]);
 await expect(panel.locator(".pre .gauge-counts")).toContainText("1,800 / 30,000 power");await expect(panel.locator(".att .gauge-counts")).toContainText("600 / 30,000 power");
 await expect(capturedCandidate(panel,"BSessionPinned")).toHaveAttribute("aria-pressed","true");await expect(capturedCandidate(panel,"BSessionShared")).toBeVisible();
 await expect(panel.locator(".session-controls")).toContainText("2 newer items");await expect(panel.locator(".candidate-evidence")).toContainText("Observed block hash BSessionPinned");await expect(panel.locator(".candidate-evidence")).toContainText(originalReceipt!);await expect(panel.locator(".candidate-evidence")).toContainText("Source https://rpc.tzkt.io/mainnet");await expect(panel.locator(".authority-evidence")).toHaveText(authority!);await expect(panel).toContainText(snapshotReceipt!);
 await expect(pre).toHaveAttribute("open","");await expect(att).toHaveAttribute("open","");await expect(copy).toBeFocused();expect(Math.abs(await viewport.evaluate(element=>element.scrollTop)-scroll)).toBeLessThan(1);
 await expect(pre.locator("summary")).toContainText("47 bakers · 28,200 power");await expect(att.locator("summary")).toContainText("49 bakers · 29,400 power");await expect(baker.locator("td").nth(2)).toHaveText("600");await expect(baker.locator("td").nth(3)).toHaveText("2.00%");
 const peak=panel.locator('.recent-consensus-row[title*="payload vhPayload101"]');await expect(peak.locator(".recent-phase.pre")).toContainText("Pre 6.0%");await expect(peak.locator(".recent-phase.att")).toContainText("Att 2.0%");
 const committee=panel.locator('.committee-evidence');await openDetails(committee);const committeeQuery=committee.getByRole('searchbox',{name:'Search committee alias or address'}),committeeSort=committee.getByLabel('Committee sort');await choose(committeeSort,'alias');await committeeQuery.fill('  bAkEr  ');await expect(committee.locator('tbody tr')).toHaveCount(50);
 const committeeViewport=committee.locator('.delegate-scroll');await committeeViewport.evaluate(element=>{element.scrollTop=200;});const committeeScroll=await committeeViewport.evaluate(element=>element.scrollTop),committeeOrder=await committee.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.children[1]?.getAttribute('title')));await committeeQuery.focus();
 await send(page,'mainnet-operations',[vote(4)]);await expect(panel.locator('.pre .gauge-counts')).toContainText('2,400 / 30,000 power');await expect(committeeQuery).toBeFocused();await expect(committeeQuery).toHaveValue('  bAkEr  ');await expect(committeeSort.locator("..").locator("input:checked" )).toHaveValue('alias');await expect(committee).toHaveAttribute('open','');expect(await committee.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.children[1]?.getAttribute('title')))).toEqual(committeeOrder);expect(Math.abs(await committeeViewport.evaluate(element=>element.scrollTop)-committeeScroll)).toBeLessThan(1);await expect(panel.locator('.candidate-evidence')).toContainText('BSessionPinned');await expect(panel.locator('.candidate-evidence')).toContainText(originalReceipt!);await expect(panel.locator('.session-controls')).toContainText('2 newer items');await expect(peak.locator('.recent-phase.pre')).toContainText('Pre 8.0%');
 await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole("button",{name:"Follow live",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Follow live");await expect(panel.locator(".candidate-evidence")).toContainText("BSessionPinned");await expect(panel.locator(".pre .gauge-counts")).toContainText("2,400 / 30,000 power");await expect(page.getByRole("button",{name:"Resume",exact:true})).toBeVisible();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 await page.getByRole("button",{name:"Resume",exact:true}).click();await add("BSessionFollowing","vhFollowing101");await expect(panel.locator(".candidate-evidence")).toContainText("BSessionPinned");await expect(panel.getByLabel("Retained session instance").locator("..").locator(".choice-option").filter({hasText:"vhFollowing101"})).toHaveCount(1);await expect(panel.locator(".session-controls")).toContainText("Follow live");
 testInfo.annotations.push({type:"foundation-verified",description:"AC-5"});
});

test("foundations AC-16 retained source receipt and monotonic age survive provider switch and clock jump",async({page},testInfo)=>{
 await page.clock.install();const current=head(100);await prepare(page,false,current);await selectNetwork(page,'shadownet');
 await page.route("https://rpc.shadownet.teztnets.com/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await page.route("https://rpc.shadownet.teztnets.com/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate=(hash:string,payload:string)=>({...head(101),hash,payload_hash:payload});const a=candidate("BHistoryA","vhPayload101"),b=candidate("BHistoryB","vhOther101");for(const value of [a,b])headers.get(page)?.set(value.hash,value);
 await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:a.hash,header:a});const panel=page.locator(".network-panel.shadownet");await inspectRetainedCandidate(panel,a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");
 const details=panel.locator(".missing-section details").first();await details.locator("summary").click();const viewport=details.locator(".delegate-scroll");await viewport.evaluate(element=>{element.scrollTop=200;});const copy=details.getByRole("button",{name:"Copy full address for Baker 11 · TzKT",exact:true});await copy.focus();const scroll=await viewport.evaluate(element=>element.scrollTop),receipt=await panel.locator(".candidate-evidence").textContent();
 await send(page,"shadownet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await expect(copy).toBeFocused();expect(Math.abs(await viewport.evaluate(element=>element.scrollTop)-scroll)).toBeLessThan(1);await expect(details).toHaveAttribute("open","");await expect(panel.locator(".candidate-evidence")).toHaveText(receipt!);
 await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:b.hash,header:b});await expect(panel.locator(".session-controls")).toContainText("1 newer items");await expect(panel.locator(".candidate-evidence")).toContainText(a.hash);
 await page.evaluate(()=>window.mockStreams["shadownet-head"]!.error(new Error("A head provider disconnected")));await expect.poll(()=>page.evaluate(()=>window.mockRequests.some(request=>request.url.startsWith("https://tezos-shadownet.octez.io")&&request.url.includes("monitor/heads")))).toBe(true);await expect(panel.locator(".candidate-evidence")).toHaveText(receipt!);await expect(panel.locator(".authority-evidence")).toContainText("https://rpc.shadownet.teztnets.com");await expect(panel).toContainText("Current selected identity stale/unavailable");
 await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length),age=Number.parseInt(await panel.locator('.evidence-meta dt:has-text("Snapshot age") + dd').textContent()??"0",10);await page.clock.setSystemTime(new Date("2030-01-01T00:00:00Z"));await page.clock.runFor(2000);const later=Number.parseInt(await panel.locator('.evidence-meta dt:has-text("Snapshot age") + dd').textContent()??"0",10);expect(later-age).toBeGreaterThanOrEqual(1);expect(later-age).toBeLessThan(4);await expect(panel.locator(".candidate-evidence")).toHaveText(receipt!);
 await panel.getByRole("button",{name:"Latest",exact:true}).click();await expect(panel.locator(".candidate-evidence")).toContainText(b.hash);await expect(page.getByRole("button",{name:"Resume",exact:true})).toBeVisible();await panel.getByRole("button",{name:"Follow live",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Follow live");await expect(panel.locator(".candidate-evidence")).toContainText(a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-16"});
});


test("foundations AC-17 historical H1 remains inspectable after reorg and obsolete body completion",async({page},testInfo)=>{
 await page.clock.install();let current=head(100);await prepare(page,false,current);await selectNetwork(page,'shadownet');await page.route("https://rpc.shadownet.teztnets.com/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await page.route("https://rpc.shadownet.teztnets.com/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const a={...head(101),hash:"BH1Retained",payload_hash:"vhPayload101"},b={...head(101),hash:"BH1Pending",payload_hash:"vhPending101"};for(const candidate of [a,b])headers.get(page)?.set(candidate.hash,candidate);
 await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:a.hash,header:a});const panel=page.locator(".network-panel.shadownet");await inspectRetainedCandidate(panel,a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");await expect(panel.locator(".authority-evidence")).toContainText("context head BBlock100");const receipt=await panel.locator(".candidate-evidence").textContent();
 await page.evaluate(()=>{const original=window.fetch.bind(window),state={waiting:false,release:()=>{}};Object.assign(window,{oldHistoryBody:state});window.fetch=async(input,options)=>{const response=await original(input,options),url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(url.startsWith("https://rpc.shadownet.teztnets.com/chains/main/mempool/pending_operations?")){const body=await response.json();response.json=()=>new Promise(resolve=>{state.waiting=true;state.release=()=>resolve(body);});}return response;};});
 await page.clock.runFor(15000);await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:b.hash,header:b});await expect.poll(()=>page.evaluate(()=>(window as unknown as {oldHistoryBody:{waiting:boolean}}).oldHistoryBody.waiting)).toBe(true);
 current={...current,hash:"BH2SameHeight",payload_hash:"vhH2"};await send(page,"shadownet-head",current);await expect(panel.locator('.evidence-meta dt:has-text("Block hash") + dd')).toContainText("BH2SameHeight");await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await page.evaluate(()=>(window as unknown as {oldHistoryBody:{release:()=>void}}).oldHistoryBody.release());
 await expect(panel.locator(".candidate-evidence")).toHaveText(receipt!);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await panel.getByRole("button",{name:"Follow live",exact:true}).click();await expect(panel).toContainText("Live unavailable: no coherent current selection");await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");
 const option=panel.getByLabel("Retained session instance").locator("..").locator(".choice-option").filter({hasText:"vhPayload101"});const identity=await option.getAttribute("data-value");expect(identity).toBeTruthy();await choose(panel.getByLabel("Retained session instance"),identity!);await inspectRetainedCandidate(panel,a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await expect(panel.locator(".authority-evidence")).toContainText("context head BBlock100");await expect(panel.locator(".authority-evidence")).toContainText("execution protocol PFixture");await expect(panel.locator(".candidate-evidence")).toHaveText(receipt!);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-17"});
});


test("foundations AC-22 active eviction enriches retained pin and full history eviction freezes it",async({page},testInfo)=>{
 const current=head(100);await prepare(page,false,current);await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await page.route("https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*",route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const a={...head(101),hash:"BPinProtected",payload_hash:"vhPayload101"};headers.get(page)?.set(a.hash,a);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash:a.hash,header:a});const panel=page.locator(".network-panel.mainnet");await inspectRetainedCandidate(panel,a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");
 const candidates=Array.from({length:100},(_,index)=>({...head(101),hash:`BShared${index}`,payload_hash:"vhPayload101"}));for(const candidate of candidates)headers.get(page)?.set(candidate.hash,candidate);await page.evaluate(values=>{window.mockStreams["mainnet-proposals"]!.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:"NetFixture",hash:header.hash,header})).join("\n")+"\n"));},candidates);
 await expect(panel.locator(".candidate-evidence")).toContainText("Historical inspection facts partially retained");await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");await expect(capturedCandidate(panel,a.hash)).toBeVisible();await expect(panel.locator(".captured-candidates button")).toHaveCount(100);
 await send(page,"mainnet-operations",[vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await expect(panel.locator(".candidate-evidence")).toContainText(a.hash);
 const histories=Array.from({length:151},(_,index)=>({...head(101),hash:`BHistory${index}`,payload_hash:`vhHistory${index}`}));for(const candidate of histories)headers.get(page)?.set(candidate.hash,candidate);await page.evaluate(values=>{window.mockStreams["mainnet-proposals"]!.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:"NetFixture",hash:header.hash,header})).join("\n")+"\n"));},histories);
 await expect(panel.locator(".session-controls")).toContainText("Pinned frozen snapshot outside retained history");await inspectCapturedCandidate(panel,"BPinProtected");await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(panel.locator(".session-controls")).toContainText("Pinned frozen snapshot outside retained history");await inspectCapturedCandidate(panel,"BShared99");await expect(panel.locator(".candidate-evidence")).toContainText("BShared99");await expect(panel.locator(".session-controls")).toContainText("Pinned frozen snapshot outside retained history");await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await inspectCapturedCandidate(panel,"BPinProtected");await expect(panel.locator(".candidate-evidence")).toContainText("BPinProtected");await expect(panel.getByLabel("Retained session instance").locator("..").locator(".choice-option")).toHaveCount(150);const evidence=await panel.locator(".candidate-evidence").textContent(),authority=await panel.locator(".authority-evidence").textContent();
 await send(page,"mainnet-operations",[vote(2)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await expect(panel.locator(".candidate-evidence")).toHaveText(evidence!);await expect(panel.locator(".authority-evidence")).toHaveText(authority!);await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole("button",{name:"Latest",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");await expect(panel.locator(".candidate-evidence")).not.toContainText(a.hash);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-22"});
});


test("foundations AC-23 source-distinct shared payload candidates and hash-unknown promotion retain separate identities",async({page},testInfo)=>{
 await page.clock.install();const current=head(100);await prepare(page,false,current);let observerB=current;
 await page.route("https://rpc.shadownet.teztnets.com/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",route=>route.fulfill({json:{...observerB,chain_id:"NetFixture"}}));
 await selectNetwork(page,'shadownet');const a={...head(101),hash:"BObserverA",payload_hash:"vhPayload101"},b={...head(101),hash:"BObserverB",payload_hash:"vhPayload101"};for(const candidate of [a,b])headers.get(page)?.set(candidate.hash,candidate);await send(page,"shadownet-operations",[vote(0)]);await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:a.hash,header:a});const panel=page.locator(".network-panel.shadownet");await page.locator(".network-tab.shadownet").click();await inspectRetainedCandidate(panel,a.hash,"Teztnets");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");
 await page.evaluate(()=>{window.mockStreams["shadownet-proposals"]!.error(new Error("A proposals disconnected"));window.mockStreams["shadownet-operations"]!.error(new Error("A operations disconnected"));});await expect.poll(()=>page.evaluate(()=>window.mockRequests.some(request=>request.url.startsWith("https://tezos-shadownet.octez.io")&&request.url.includes("monitor/validated_blocks")))).toBe(true);await expect.poll(()=>page.evaluate(()=>window.mockRequests.some(request=>request.url.startsWith("https://tezos-shadownet.octez.io")&&request.url.includes("monitor_operations")))).toBe(true);
 await send(page,"shadownet-proposals",{chain_id:"NetFixture",hash:b.hash,header:b});await send(page,"shadownet-operations",[vote(1),vote(2)]);await page.clock.runFor(15000);await expect(panel.locator(".candidate-evidence")).toContainText(a.hash);await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");
 const choice=panel.getByLabel("Retained session instance").locator("..").locator(".choice-option").filter({hasText:"Octez public"});await expect(choice).toHaveCount(1);await choose(panel.getByLabel("Retained session instance"),(await choice.getAttribute("data-value"))!);await inspectRetainedCandidate(panel,b.hash,"Octez public");await expect(panel.locator(".pre .gauge-counts")).toContainText("1,200 / 30,000 power");await expect(panel.locator(".candidate-evidence")).toContainText("https://tezos-shadownet.octez.io");
 await panel.getByRole("button",{name:"Follow live",exact:true}).click();await send(page,"shadownet-operations",[vote(0,123)]);await inspectRaw(panel,"Inspect payload vhPayload123");await expect(panel.locator(".candidate-evidence")).toContainText("Unresolved");await expect(panel.locator(".candidate-evidence")).toContainText("Candidate hash unavailable");await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await page.clock.runFor(15000);
 observerB=head(122);headers.get(page)?.set(observerB.hash,observerB);headers.get(page)?.set(observerB.predecessor,head(121));await page.clock.runFor(15000);await panel.getByRole("button",{name:"Retry selected observer context",exact:true}).click();await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await expect(panel.locator(".candidate-evidence")).not.toContainText("Unresolved");await expect(panel.locator(".candidate-evidence")).toContainText("Candidate hash unavailable");await expect(panel.locator(".authority-evidence")).toContainText("context head BBlock122");await expect(panel.getByLabel("Retained session instance").locator("..").locator(".choice-option").filter({hasText:"vhPayload123"})).toHaveCount(1);
 const rights=await page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes("attestation_rights")&&new URL(request.url).searchParams.get("level")==="123").map(request=>request.url));expect(rights.length).toBeGreaterThan(0);expect(rights.every(url=>url.startsWith("https://tezos-shadownet.octez.io"))).toBe(true);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-23"});
});


test("foundations AC-24 independent products use first receipt lexical ties and bounded raw facts",async({page},testInfo)=>{
 const current=head(100);await prepare(page,false,current);await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await send(page,"mainnet-operations",[vote(0)]);const panel=page.locator(".network-panel.mainnet");await expect(panel.locator(".pre .gauge-counts")).toContainText("600 / 30,000 power");await panel.getByText("Sources & observation evidence",{exact:true}).click();
 const candidates=Array.from({length:151},(_,index)=>({...head(101),hash:`BArray${String(index).padStart(3,"0")}`,payload_hash:`P${String(index).padStart(3,"0")}`}));for(const candidate of candidates)headers.get(page)?.set(candidate.hash,candidate);
 await page.evaluate(values=>{const original=performance.now.bind(performance),receipt=original();Object.assign(window,{originalReceiptClock:original});Object.defineProperty(performance,"now",{configurable:true,value:()=>receipt});window.mockStreams["mainnet-proposals"]!.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:"NetFixture",hash:header.hash,header})).join("\n")+"\n"));},candidates);
 await expect(panel.locator(".session-controls")).toContainText("150 / 150 session instances");await expect(panel.locator(".session-controls")).toContainText("100 / 100 active candidates");await page.evaluate(()=>Object.defineProperty(performance,"now",{configurable:true,value:(window as unknown as {originalReceiptClock:()=>number}).originalReceiptClock}));
 const choices=panel.getByLabel("Retained session instance");await expect(choices.locator("..").locator(".choice-option").filter({hasText:"P000"})).toHaveCount(0);await expect(choices.locator("..").locator(".choice-option").filter({hasText:"P001"})).toHaveCount(1);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash:candidates[1]!.hash,header:candidates[1]});const extra={...head(101),hash:"BArray151",payload_hash:"P151"};headers.get(page)?.set(extra.hash,extra);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash:extra.hash,header:extra});await expect(choices.locator("..").locator(".choice-option").filter({hasText:"P001"})).toHaveCount(0);await expect(choices.locator("..").locator(".choice-option").filter({hasText:"P002"})).toHaveCount(1);
 const unresolved=Array.from({length:101},(_,index)=>({...head(2147483647),hash:`BUnresolved${index}`,payload_hash:`Unresolved${index}`}));for(const candidate of unresolved)headers.get(page)?.set(candidate.hash,candidate);await page.evaluate(values=>window.mockStreams["mainnet-proposals"]!.enqueue(new TextEncoder().encode(values.map(header=>JSON.stringify({chain_id:"NetFixture",hash:header.hash,header})).join("\n")+"\n")),unresolved);await expect(panel.locator(".session-controls")).toContainText("100 / 100 unresolved identities");await expect(panel.locator(".session-controls")).toContainText("100 / 100 active candidates");await expect(choices.locator("..").locator(".choice-option")).toHaveCount(150);
 await send(page,"mainnet-operations",Array.from({length:10001},(_,index)=>({hash:`bounded-raw-${index}`,contents:[{kind:"transaction",source:"tz1Source",destination:"tz1Destination",fee:"1",counter:"1",gas_limit:"100",storage_limit:"0",amount:"1"}]})));await expect(panel.locator(".session-controls")).toContainText("10000 / 10000 raw operations");await expect(panel.locator(".session-controls")).toContainText("100 / 100 active candidates");await expect(choices.locator("..").locator(".choice-option")).toHaveCount(150);
 testInfo.annotations.push({type:"foundation-verified",description:"AC-24"});
});


test("foundations AC-25 newer units deduplicate representation while Latest pins once and Follow stays live",async({page},testInfo)=>{
 await page.clock.install();const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));await send(page,"mainnet-operations",[vote(0)]);const panel=page.locator(".network-panel.mainnet");await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");
 const add=async(hash:string,payload:string)=>{const header={...head(101),hash,payload_hash:payload};headers.get(page)?.set(hash,header);await send(page,"mainnet-proposals",{chain_id:"NetFixture",hash,header});};await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("0 newer items");await add("BNewerA","vhPayload101");await expect(panel.locator(".session-controls")).toContainText("0 newer items");await panel.getByRole("button",{name:"Follow live",exact:true}).click();await inspectRetainedCandidate(panel,"BNewerA");await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("0 newer items");await send(page,"mainnet-operations",[vote(0),vote(1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");await expect(panel.locator(".session-controls")).toContainText("0 newer items");
 await add("BNewerB","vhPayload101");await expect(panel.locator(".session-controls")).toContainText("1 newer items");const q={hash:"candidate-free-Q",contents:[{kind:"preattestation",level:101,round:0,slot:0,block_payload_hash:"vhQ"}]};await send(page,"mainnet-operations",[q]);await expect(panel.locator(".session-controls")).toContainText("2 newer items");await add("BNewerC","vhQ");await expect(panel.locator(".session-controls")).toContainText("2 newer items");await add("BNewerD","vhQ");await expect(panel.locator(".session-controls")).toContainText("3 newer items");await add("BNewerB","vhPayload101");await send(page,"mainnet-operations",[q,vote(0,2147483647)]);await expect(panel.locator(".session-controls")).toContainText("3 newer items");
 await panel.getByRole("button",{name:"Latest",exact:true}).click();await expect(panel.locator(".candidate-evidence")).toContainText("BNewerD");await add("BNewerE","vhR");await expect(panel.locator(".session-controls")).toContainText("1 newer items");await expect(panel.locator(".candidate-evidence")).toContainText("BNewerD");await panel.getByRole("button",{name:"Follow live",exact:true}).click();await expect(panel.locator(".candidate-evidence")).toContainText("BNewerA");await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");
 // The raw observer must prove its own replacement; a SmartPy head cannot invalidate TzKT authority.
 const fork={...current,hash:"BNewerFork",payload_hash:"vhFork"};await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...fork,chain_id:"NetFixture"}}));await send(page,"mainnet-head",fork);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");const ownHeadsBefore=await page.evaluate(()=>window.mockRequests.filter(request=>request.url==="https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header").length);await page.clock.runFor(15000);await expect.poll(()=>page.evaluate(()=>window.mockRequests.filter(request=>request.url==="https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header").length)).toBeGreaterThan(ownHeadsBefore);await expect(panel).toContainText("Live unavailable: no coherent current selection");await expect(panel.locator(".pre .gauge-counts")).toContainText("Voting power unavailable");await page.evaluate(()=>window.mockStreams["mainnet-head"]!.error(new Error("Review head transport interrupted")));await expect(panel.locator(".network-notice")).toContainText("Heads connection interrupted");const combinedNotice=await panel.locator(".network-notice").textContent();expect(combinedNotice).toContain("Heads connection interrupted");expect(combinedNotice).toContain("Live unavailable: no coherent current selection");await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole("button",{name:"Latest",exact:true}).click();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(panel).toContainText("Live unavailable: no coherent current selection");await expect(panel.locator(".session-controls")).toContainText("Follow live");await panel.getByRole("button",{name:"Follow live",exact:true}).click();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);await expect(page.getByRole("button",{name:"Resume",exact:true})).toBeVisible();
 testInfo.annotations.push({type:"foundation-verified",description:"AC-25"});
});


test("foundations AC-32 immutable twelve events survive history eviction inspection replay and resume",async({page},testInfo)=>{
 const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});await page.route("https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));const panel=page.locator(".network-panel.mainnet"),events=panel.locator(".event-history li");
 const packet=(index:number,slot:number)=>({hash:`event-${index}-${slot}`,contents:[{kind:"preattestation",level:101,round:0,slot,block_payload_hash:`vhEvent${index}`} ]});
 for(let index=0;index<14;index++){await send(page,"mainnet-operations",[packet(index,0)]);await inspectRetainedPayload(panel,`vhEvent${index}`);await expect(panel.locator(".pre .gauge-counts")).toContainText("3 / 5 power");await send(page,"mainnet-operations",[packet(index,1)]);await expect(panel.locator(".pre .gauge-counts")).toContainText("4 / 5 power");await expect(events).toHaveCount(Math.min(index+1,12));}
 const original=await events.allTextContents();expect(original.every(text=>text.includes("rpc.tzkt.io/mainnet")&&text.includes("NetFixture"))).toBe(true);await panel.getByText("Sources & observation evidence",{exact:true}).click();await panel.getByRole("button",{name:"Pin selected instance",exact:true}).click();await expect(panel.locator(".session-controls")).toContainText("Pinned retained session instance");
 await send(page,"mainnet-operations",Array.from({length:151},(_,index)=>({hash:`history-retire-${index}`,contents:[{kind:"preattestation",level:101,round:0,slot:0,block_payload_hash:`vhRetired${index}`}]})));await expect(panel.locator(".session-controls")).toContainText("Pinned frozen snapshot outside retained history");await expect(events).toHaveText(original);
 await send(page,"mainnet-operations",[{hash:"reconstructed-crossed-payload",contents:[...packet(13,0).contents,...packet(13,1).contents]}]);await expect(events).toHaveText(original);await page.getByRole("button",{name:"Pause",exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole("button",{name:"Latest",exact:true}).click();await panel.getByRole("button",{name:"Follow live",exact:true}).click();await expect(events).toHaveText(original);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);await page.getByRole("button",{name:"Resume",exact:true}).click();await send(page,"mainnet-operations",[packet(13,0),packet(13,1)]);await expect(events).toHaveText(original);await expect(panel.locator(".headline")).toContainText("100");await expect(panel.locator(".status-chip")).not.toHaveText("Observed advance");
 testInfo.annotations.push({type:"foundation-verified",description:"AC-32"});
});

test('foundations AC-27 phase receipt filters preserve source-limited absence and unknown signer evidence',async({page},testInfo)=>{
 await page.clock.install();let current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,2]});await selectNetwork(page,'shadownet');await page.route('https://rpc.shadownet.teztnets.com/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));
 await send(page,'shadownet-operations',[vote(0),vote(999)]);const panel=page.locator('.network-panel.shadownet');await expect(panel.locator('.pre .gauge-counts')).toContainText('3 / 5 power');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');
 const committee=panel.locator('.committee-evidence');await openDetails(committee);const rows=committee.locator('tbody tr'),filter=committee.getByLabel('Committee phase receipt filter'),query=committee.getByRole('searchbox',{name:'Search committee alias or address'});
 await expect(rows).toHaveCount(2);await expect(rows.nth(0).locator('td').nth(5)).toHaveText('Received');await expect(rows.nth(0).locator('td').nth(6)).toHaveText('Partial / unavailable');await expect(rows.nth(1).locator('td').nth(5)).toHaveText('Partial / unavailable');await openDetails(committee.locator('.committee-unknown'));await expect(committee.locator('.committee-unknown')).toContainText('slot 999');await expect(committee.locator('.committee-unknown')).toContainText('unknown power');await expect(committee.locator('tbody')).not.toContainText('999');
 await choose(filter,'att:absent');await expect(rows).toHaveCount(0);await expect(committee).toContainText('no network-wide inactivity or global completeness claim');await expect(committee).toContainText('Coverage partial / unavailable');await choose(filter,'att:unknown');await expect(rows).toHaveCount(2);
 await page.route('https://rpc.shadownet.teztnets.com/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate={...head(101),hash:'BCommitteeSnapshot',payload_hash:'vhPayload101'};headers.get(page)?.set(candidate.hash,candidate);await page.clock.runFor(15000);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await inspectRetainedCandidate(panel,candidate.hash);await expect(panel.locator('.att .gauge-counts')).toContainText('0 / 5 power');
 await choose(filter,'att:absent');await expect(rows).toHaveCount(2);await expect(rows.nth(0).locator('td').nth(6)).toHaveText('Absent in selected source snapshot');await expect(rows.nth(1).locator('td').nth(6)).toHaveText('Absent in selected source snapshot');await expect(rows.nth(0).locator('td').nth(7)).toContainText('Source https://rpc.shadownet.teztnets.com');await expect(rows.nth(0).locator('td').nth(7)).toContainText('head BBlock100');await expect(panel).toContainText('Source-snapshot measured zero');
 await panel.getByRole('button',{name:'Follow live',exact:true}).click();
 await page.route('https://rpc.shadownet.teztnets.com/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{}}));await page.evaluate(()=>window.mockStreams['shadownet-operations']!.error(new Error('Selected source coverage interrupted')));await expect(rows).toHaveCount(0);await expect(panel).toContainText('Retained source snapshot stale');await choose(filter,'att:unknown');await expect(rows).toHaveCount(2);await expect(rows.nth(0).locator('td').nth(6)).toHaveText('Partial / unavailable');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();await page.route('**/helpers/attestation_rights?*',route=>route.fulfill({json:[{level:Number(new URL(route.request().url()).searchParams.get('level')),delegates:[]}]}));current={...current,hash:'BCommitteeMissingRights',payload_hash:'vhFork'};await page.route('https://tezos-shadownet.octez.io/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));await send(page,'shadownet-head',current);
 await send(page,'shadownet-operations',[{...vote(999),hash:'unknown-under-missing-rights'}]);await expect(panel.getByLabel('Retained session instance').locator('..').locator('.choice-option').filter({hasText:'Teztnets · 101/0 · vhPayload101'})).toHaveCount(1);await inspectRaw(panel,'Inspect payload vhPayload101');await expect(rawObservation(panel,'Inspect payload vhPayload101')).toHaveCount(1);await expect(panel.locator('.candidate-evidence')).toContainText('Source https://tezos-shadownet.octez.io');await expect(panel.locator('.candidate-evidence')).toContainText('observed head unknown');await expect.poll(()=>page.evaluate(()=>window.mockRequests.some(request=>request.url.startsWith('https://tezos-shadownet.octez.io/')&&request.url.includes('attestation_rights')))).toBe(true);await choose(filter,'all');await query.fill('999');await expect(rows).toHaveCount(0);await expect(committee.locator('.committee-unknown')).toContainText('slot 999');await expect(committee.locator('.committee-unknown')).toContainText('unknown-under-missing-rights');await expect(committee.locator('.committee-unknown')).toContainText('https://tezos-shadownet.octez.io');await expect(panel.locator('.pre .gauge-counts')).toContainText('Voting power unavailable');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-27'});
});

test('foundations AC-26 committee matching and explicit order stay stable across aliases and receipts',async({page},testInfo)=>{
 const address=(slot:number)=>`tz1BakerAddress${String(slot).padStart(25,'0')}`,addresses=Array.from({length:50},(_,slot)=>address(slot));
 const aliases=addresses.map((address,slot)=>({address,alias:slot===0?'Zeta':slot===1||slot===3?`${addresses[0]} Alpha`:slot===4?'Sort':slot===5?'Sort A':`Group ${String(slot).padStart(2,'0')}`}));
 await page.addInitScript(()=>{const original=window.fetch.bind(window),gate={waiting:false,release:()=>{}};Object.assign(window,{committeeAliasGate:gate});window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='api.tzkt.io'&&url.pathname.includes('/v1/delegates')){const body=await response.json();response.json=()=>new Promise(resolve=>{gate.waiting=true;gate.release=()=>resolve(body);});}return response;};});
 await prepare(page,false,head(),100,false,false,{total:52,quorum:4,powers:[3,...Array(49).fill(1)]},aliases);await send(page,'mainnet-operations',[vote(0)]);await expect(page.locator('.mainnet .pre .gauge-counts')).toContainText('3 / 52 power');
 const committee=page.locator('.mainnet .committee-evidence');await openDetails(committee);const query=committee.getByRole('searchbox',{name:'Search committee alias or address'}),sort=committee.getByLabel('Committee sort'),resort=committee.getByRole('button',{name:'Resort committee'}),rows=committee.locator('tbody tr');
 const order=()=>rows.evaluateAll(elements=>elements.map(row=>row.children[1]?.getAttribute('title')));
 await choose(sort,'alias');await query.fill(`  ${address(0).toUpperCase()}  `);await expect(rows).toHaveCount(1);await expect(rows).toContainText('No alias');await expect(query).toBeFocused();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {committeeAliasGate:{waiting:boolean}}).committeeAliasGate.waiting)).toBe(true);await page.evaluate(()=>(window as unknown as {committeeAliasGate:{release:()=>void}}).committeeAliasGate.release());
 await expect(rows).toHaveCount(3);expect(await order()).toEqual([address(0),address(1),address(3)]);await expect(rows.first()).toContainText('Zeta');await expect(query).toHaveValue(`  ${address(0).toUpperCase()}  `);await expect(query).toBeFocused();
 await sort.focus();expect(await order()).toEqual([address(0),address(1),address(3)]);await resort.click();expect(await order()).toEqual([address(1),address(3),address(0)]);
 // Match raw alias OR address, never decoration or text spanning both fields.
 for(const text of ['zeta · tzkt tz1baker','zeta tz1baker','TzKT']){await query.fill(text);await expect(rows).toHaveCount(0);}
 await query.fill('  zEtA  ');await expect(rows).toHaveCount(1);expect(await order()).toEqual([address(0)]);
 await query.fill('');await resort.click();await expect(rows).toHaveCount(50);const aliasOrder=await order();expect(aliasOrder.indexOf(address(4))).toBeLessThan(aliasOrder.indexOf(address(5)));
 await choose(sort,'address');expect(await order()).toEqual(addresses);await choose(sort,'power');expect(await order()).toEqual(addresses);
 const viewport=committee.locator('.delegate-scroll');await viewport.evaluate(element=>{element.scrollTop=200;});const scroll=await viewport.evaluate(element=>element.scrollTop);expect(scroll).toBeGreaterThan(0);await query.focus();
 await send(page,'mainnet-operations',[vote(1),vote(2),vote(4)]);await expect(page.locator('.mainnet .pre .gauge-counts')).toContainText('6 / 52 power');expect(await order()).toEqual(addresses);await expect(query).toBeFocused();await expect(query).toHaveValue('');await expect(sort.locator("..").locator("input:checked" )).toHaveValue('power');await expect(committee).toHaveAttribute('open','');expect(Math.abs(await viewport.evaluate(element=>element.scrollTop)-scroll)).toBeLessThan(1);
 const filter=committee.getByLabel('Committee phase receipt filter');await choose(filter,'pre:unknown');await expect(rows).toHaveCount(46);const pendingRow=rows.filter({has:page.locator(`td[title="${address(3)}"]`)}),copy=pendingRow.locator('.address-copy');await copy.focus();await send(page,'mainnet-operations',[vote(3)]);
 await expect(pendingRow.locator('td').nth(5)).toHaveText('Received');await expect(pendingRow).toHaveAttribute('data-pending-exclusion','true');await expect(pendingRow).toContainText('Pending exclusion until focus leaves');await expect(copy).toBeFocused();await query.focus();await expect(pendingRow).toHaveCount(0);await expect(rows).toHaveCount(45);
 expect(await order()).toEqual(addresses.filter((_,slot)=>![0,1,2,3,4].includes(slot)));await choose(filter,'all');await expect(rows).toHaveCount(50);
 // Correct a raw alias at the existing consumer boundary; no network refresh is claimed.
 await query.fill('alpha');await expect(rows).toHaveCount(2);const correctedRow=rows.filter({has:page.locator(`td[title="${address(1)}"]`)}),correctedCopy=correctedRow.locator('.address-copy');await correctedCopy.focus();
 await page.evaluate(async({changedAddress,path})=>{const module=await import(path);const original=module.NetworkData.prototype.alias;module.NetworkData.prototype.alias=function(address:string){return this.network==='mainnet'&&address===changedAddress?'Gamma':original.call(this,address);};Object.assign(window,{restoreCommitteeAlias:()=>{module.NetworkData.prototype.alias=original;}});},{changedAddress:address(1),path:inspectionModule()});await send(page,'mainnet-operations',[vote(5)]);
 await expect(correctedRow.locator('td').first()).toContainText('Gamma · TzKT');await expect(correctedRow).toContainText('Pending exclusion until focus leaves');await expect(correctedCopy).toHaveAttribute('aria-label','Copy full address for Gamma · TzKT');await expect(correctedCopy).toBeFocused();await query.focus();await expect(correctedRow).toHaveCount(0);await expect(rows).toHaveCount(1);await page.evaluate(()=>(window as unknown as {restoreCommitteeAlias:()=>void}).restoreCommitteeAlias());await query.fill('');
 await page.getByRole('button',{name:'Pause',exact:true}).click();const pausedReads=await page.evaluate(()=>window.mockRequests.length);await query.fill(' group ');await choose(sort,'address');await resort.click();await choose(filter,'pre:unknown');await expect(rows).toHaveCount(44);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(pausedReads);await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
 testInfo.annotations.push({type:'foundation-verified',description:'AC-26'});
});

 test('foundations AC-6 complete committee keeps received delegates searchable with exact phase evidence',async({page})=>{
 const d1=`tz1BakerAddress${String(0).padStart(25,'0')}`,d2=`tz1BakerAddress${String(1).padStart(25,'0')}`;
 await prepare(page,false,head(),100,false,false,{total:5,quorum:4,powers:[3,2]},[{address:d1,alias:'Baker Alpha'},{address:d2,alias:'Baker Beta'}]);
 const noVotes={...head(101),hash:'BCommitteeNoVotes',payload_hash:'vhPayload101'};headers.get(page)?.set(noVotes.hash,noVotes);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:noVotes.hash,header:noVotes});const panel=page.locator('.mainnet');await inspectRetainedCandidate(panel,'BCommitteeNoVotes');const knownCommittee=panel.locator('.committee-evidence');await openDetails(knownCommittee);await expect(knownCommittee.locator('tbody tr').first()).toContainText('60.00%');await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');await expect(knownCommittee.locator('tbody tr').first()).toContainText('60.00%');await expect(panel.locator('.pre .gauge-counts')).toContainText('Voting power unavailable');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');await panel.getByRole('button',{name:'Follow live',exact:true}).click();
 await send(page,'mainnet-operations',[vote(0),vote(999)]);await expect(page.locator('.mainnet .pre .gauge-counts')).toContainText('3 / 5 power');
 // Existing production table boundary: received D1 must remain in the committee,
 // even without complete source coverage. This is not a missing-module red.
 await expect(page.locator('.mainnet .delegate-table tbody tr')).toHaveCount(2);
 const committee=page.locator('.mainnet .committee-evidence');
 const query=committee.getByRole('searchbox',{name:'Search committee alias or address'});await query.fill('  aLpHa  ');
 const row=committee.locator('tbody tr');await expect(row).toHaveCount(1);await expect(row).toContainText('Baker Alpha');await expect(row).toContainText('60.00%');await expect(row).toContainText('Received');await expect(row).toContainText('Partial / unavailable');await expect(row.locator('td').nth(4)).toHaveText('Unknown');await expect(row.locator('td').nth(4)).toHaveAttribute('title','Eligibility evidence unavailable');await expect(row).toContainText('NetFixture');
 await query.fill(d1.slice(3));await expect(row).toHaveCount(1);await expect(row).toContainText('Baker Alpha');await query.fill('');await expect(row).toHaveCount(2);
 await openDetails(committee.locator('.committee-unknown'));await expect(committee.locator('.committee-unknown')).toContainText('999');await expect(committee.locator('tbody')).not.toContainText('999');
 test.info().annotations.push({type:'foundation-verified',description:'AC-6'});
 });


test('foundations AC-7 explicit comparison reads B independently and leaves LIVE power unchanged',async({page},testInfo)=>{
 await prepare(page,false);
 const pinned=headers.get(page)!.get('BBlock100')!;
 const reads:string[]=[];
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{
  const url=new URL(route.request().url());
  if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(url.pathname)){await route.fallback();return;}
  reads.push(url.pathname);
  if(url.pathname.endsWith('/chain_id'))await route.fulfill({json:'NetFixture'});
  else if(url.pathname.endsWith('/head/header'))await route.fulfill({json:{...pinned,chain_id:'NetFixture',protocol:'UnknownExecutionProtocol'}});
  else if(url.pathname.includes('pending_operations'))await route.fulfill({json:{validated:[vote(1,100)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});
  else await route.abort();
 });
 const panel=page.locator('.network-panel.mainnet');
 const evidence=panel.locator('details').filter({has:page.locator('summary', {hasText:'Sources & observation evidence'})});
 await evidence.locator(':scope > summary').click();
 const before=await panel.locator('.pre .gauge-counts').textContent();
 await expect(panel.getByLabel('Comparison provider')).toBeVisible();
 await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');
 await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();
 await expect(panel.locator('.comparison-result')).toContainText('head-agreement');
 await expect(panel.locator('.comparison-result')).toContainText('BBlock100');
 expect(reads).toEqual(['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations']);
 await expect(panel.locator('.pre .gauge-counts')).toHaveText(before??'');
 await expect(panel.locator('.comparison-result')).toContainText('not vote agreement or finality');
 await expect(panel.locator('.comparison-result')).toContainText('chain NetFixture');await expect(panel.locator('.comparison-result')).toContainText('level 100');await expect(panel.locator('.comparison-result')).toContainText(`time ${pinned.timestamp}`);await expect(panel.locator('.comparison-result')).toContainText('Power unknown');await expect(panel.locator('.comparison-result')).toContainText('source https://tezos-mainnet.octez.io');await expect(panel.locator('.comparison-result')).toContainText('requested head unknown');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-7'});
});

test('foundations AC-28 head equality divergence and historical uncertainty remain limited claims',async({page},testInfo)=>{
 await prepare(page,false);const initial=headers.get(page)!.get('BBlock100')!;let observed={...initial,chain_id:'NetFixture',protocol:'PFixture'},pendingUnavailable=false;const reads:string[]=[];
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);if(pendingUnavailable&&path.includes('pending_operations')){await route.fulfill({status:503,body:'Optional pending unavailable'});return;}await route.fulfill({json:path.endsWith('/chain_id')?'NetFixture':path.endsWith('/header')?observed:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 const panel=page.locator('.network-panel.mainnet');await panel.getByText('Sources & observation evidence',{exact:true}).click();await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');
 await compare.click();await expect(result).toContainText('head-agreement');await expect(result).toContainText('not vote agreement or finality');expect(reads).toHaveLength(3);
 pendingUnavailable=true;await compare.click();await expect(result).toContainText('503');await expect(result).toContainText('partial');await expect(result).toContainText('Head fields: head-agreement');expect(reads).toHaveLength(6);pendingUnavailable=false;
 observed={...observed,hash:'SamePayloadDifferentHash'};await compare.click();await expect(result).toContainText('divergence');await expect(result).toContainText('head hash');await expect(result).toContainText('SamePayloadDifferentHash');expect(observed.payload_hash).toBe(initial.payload_hash);expect(reads).toHaveLength(9);
 await send(page,'mainnet-operations',[vote(0)]);await inspectRetainedPayload(panel,'vhPayload101');await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();
 observed={...head(130),chain_id:'NetFixture',protocol:'PFixture'};await compare.click();await expect(result).toContainText('Selected historical A');await expect(result).toContainText('fetched current B');await expect(result).toContainText('BBlock130');await expect(result).toContainText(/partial|unavailable/);await expect(result).not.toContainText('head-agreement');await expect(result).toContainText('not vote agreement or finality');expect(reads).toHaveLength(12);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-28'});
});

test('foundations AC-38 exact cached A committee supports separate B power without a fourth read',async({page},testInfo)=>{
 await prepare(page,false);const initial=headers.get(page)!.get('BBlock100')!;let chain='NetFixture',observed={...initial,chain_id:'NetFixture',protocol:'PFixture'},comparedOperations=[vote(1)];const reads:string[]=[];
 await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await inspectRetainedPayload(panel,'vhPayload101');await panel.getByText('Sources & observation evidence',{exact:true}).click();
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);await route.fulfill({json:path.endsWith('/chain_id')?chain:path.endsWith('/header')?observed:{validated:comparedOperations,refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');const events=await panel.locator('.event-history').textContent();
 await compare.click();await expect(result).toContainText('Pre 600/30000');await expect(result).toContainText('rights original responder https://rpc.tzkt.io/mainnet');await expect(result).toContainText('rights requested anchor BBlock100');await expect(result).toContainText('rights target 101');await expect(result).toContainText('rights received');await expect(result).toContainText('source https://tezos-mainnet.octez.io');await expect(result).toContainText('producing protocol PFixture');expect(reads).toEqual(['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations']);await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');expect(await panel.locator('.event-history').textContent()).toBe(events);
 observed={...observed,hash:'WrongBContext'};await compare.click();await expect(result).toContainText('Power unknown');await expect(result).toContainText('raw 1');await expect(result).toContainText('rights original responder unknown');expect(reads).toHaveLength(6);
 observed={...initial,chain_id:'NetFixture',protocol:'WrongProducingProtocol'};await compare.click();await expect(result).toContainText('producing protocol WrongProducingProtocol');await expect(result).toContainText('Power unknown');expect(reads).toHaveLength(9);
 chain='OtherChain';await compare.click();await expect(result).toContainText('chain OtherChain');await expect(result).toContainText('Power unknown');await expect(result).toContainText('divergence');expect(reads.length).toBeLessThanOrEqual(12);await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
 chain='NetFixture';observed={...initial,chain_id:'NetFixture',protocol:'PFixture'};comparedOperations=[];const beforeEmpty=reads.length;await compare.click();await expect.poll(()=>reads.length).toBe(beforeEmpty+3);await expect(result).toContainText('raw 0');await expect(result).toContainText('rights original responder https://rpc.tzkt.io/mainnet');await expect(result).toContainText(/phase.*unknown|power unknown|power unavailable/i);await expect(result).not.toContainText('Pre 0/');await expect(result).not.toContainText('Att 0/');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-38'});
});

test('foundations AC-30 comparison receipt ages monotonically and context invalidation stays sticky',async({page},testInfo)=>{
 await page.clock.install();await prepare(page,false);const initial=headers.get(page)!.get('BBlock100')!,reads:string[]=[];
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);await route.fulfill({json:path.endsWith('/chain_id')?'NetFixture':path.endsWith('/header')?{...initial,chain_id:'NetFixture',protocol:'PFixture'}:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 const panel=page.locator('.network-panel.mainnet');await panel.getByText('Sources & observation evidence',{exact:true}).click();await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');
 await compare.click();await expect(result).toContainText('head-agreement');await expect(result).not.toContainText('stale');const receipt=(await result.textContent())!.match(/received ([^ ]+)/)![1]!;
 await page.clock.runFor(59999);await expect(result).not.toContainText('stale');await page.clock.setSystemTime(new Date('2030-01-01T00:00:00Z'));await page.clock.runFor(1);await expect(result).toContainText('stale');await expect(result).toContainText(`received ${receipt}`);expect(reads).toHaveLength(3);
 await compare.click();await expect(result).not.toContainText('stale');expect(reads).toHaveLength(6);const refreshed=(await result.textContent())!.match(/received ([^ ]+)/)![1]!;
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(result).toContainText('context-invalid');await expect(result).toContainText('stale');const pausedReads=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole('button',{name:'Latest',exact:true}).click();await panel.getByRole('button',{name:'Follow live',exact:true}).click();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(pausedReads);await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(result).toContainText('context-invalid');await expect(result).toContainText(`received ${refreshed}`);expect(reads).toHaveLength(6);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-30'});
});

test('foundations AC-29 comparison counts complete reads and rejects slow bodies redirects and extra clicks',async({page},testInfo)=>{
 await page.clock.install();
 await page.addInitScript(()=>{const original=window.fetch.bind(window);const gate={path:'',waiting:false,released:false,started:0,aborted:0,release:()=>{}};Object.assign(window,{comparisonReadGate:gate});window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='tezos-mainnet.octez.io'&&(url.pathname===gate.path||gate.path==='*')){gate.started=performance.now();gate.aborted=0;options?.signal?.addEventListener('abort',()=>{gate.aborted=performance.now();},{once:true});const body=await response.json();response.json=()=>new Promise(resolve=>{gate.waiting=true;gate.release=()=>{gate.released=true;gate.waiting=false;resolve(body);};});}return response;};});
 await prepare(page,false);const initial=headers.get(page)!.get('BBlock100')!,reads:string[]=[],redirects:string[]=[];let redirect=false,broken=false;
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const url=new URL(route.request().url()),path=url.pathname;if(path==='/forbidden-follow'){redirects.push(path);await route.abort();return;}if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);if(redirect){await route.fulfill({status:302,headers:{location:'https://tezos-mainnet.octez.io/forbidden-follow'}});return;}if(broken&&path.includes('pending_operations')){await route.fulfill({body:'{"validated":[',contentType:'application/json'});return;}await route.fulfill({json:path.endsWith('/chain_id')?'NetFixture':path.endsWith('/header')?{...initial,chain_id:'NetFixture',protocol:'PFixture'}:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});
 const panel=page.locator('.network-panel.mainnet');await panel.getByText('Sources & observation evidence',{exact:true}).click();await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const paths=['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'];
 for(let index=0;index<paths.length;index++){
  await page.evaluate(path=>{const gate=(window as unknown as {comparisonReadGate:{path:string;waiting:boolean}}).comparisonReadGate;gate.path=path;gate.waiting=false;},paths[index]!);const before=reads.length;
  await compare.click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {comparisonReadGate:{waiting:boolean}}).comparisonReadGate.waiting)).toBe(true);await page.clock.runFor(16);await expect(compare).toBeDisabled();expect(reads.length-before).toBe(index+1);
  await compare.dispatchEvent('click');expect(reads.length-before).toBe(index+1);await page.clock.runFor(7983);await expect(compare).toBeDisabled();await page.clock.runFor(17);await expect(compare).toBeEnabled();await expect(result).toContainText('eight seconds');expect(await page.evaluate(()=>{const gate=(window as unknown as {comparisonReadGate:{started:number;aborted:number}}).comparisonReadGate;return gate.aborted-gate.started;})).toBe(8000);expect(reads.length-before).toBe(index+1);
  const timedOut=await result.textContent();await page.evaluate(()=>(window as unknown as {comparisonReadGate:{release:()=>void}}).comparisonReadGate.release());await page.clock.runFor(20);expect(await result.textContent()).toBe(timedOut);await page.clock.runFor(24000);expect(reads.length-before).toBe(index+1);
 }
 await page.evaluate(()=>{const gate=(window as unknown as {comparisonReadGate:{path:string;waiting:boolean}}).comparisonReadGate;gate.path='*';gate.waiting=false;});const slowStart=await page.evaluate(()=>performance.now()),slowBefore=reads.length;await compare.click();
 for(let read=0;read<3;read++){await expect.poll(()=>page.evaluate(()=>(window as unknown as {comparisonReadGate:{waiting:boolean}}).comparisonReadGate.waiting)).toBe(true);expect(reads.length-slowBefore).toBe(read+1);await page.clock.runFor(7900);await page.evaluate(()=>(window as unknown as {comparisonReadGate:{release:()=>void}}).comparisonReadGate.release());}
 await expect.poll(async()=>{await page.clock.runFor(16);return compare.isEnabled();}).toBe(true);await expect(result).toContainText('head-agreement');expect(await page.evaluate(()=>performance.now())-slowStart).toBeLessThanOrEqual(24000);expect(reads.length-slowBefore).toBe(3);
 await page.evaluate(()=>(window as unknown as {comparisonReadGate:{path:string}}).comparisonReadGate.path='');redirect=true;let before=reads.length;await compare.click();await expect.poll(async()=>{await page.clock.runFor(16);return compare.isEnabled();}).toBe(true);await expect(result).toContainText(/unavailable|partial/);expect(reads.length-before).toBe(1);expect(redirects).toEqual([]);
 redirect=false;broken=true;before=reads.length;await compare.click();await expect.poll(async()=>{await page.clock.runFor(16);return reads.length-before;}).toBe(3);await expect.poll(async()=>{await page.clock.runFor(16);return compare.isEnabled();}).toBe(true);await expect(result).toContainText('partial');expect(reads.length-before).toBe(3);await page.clock.runFor(24000);expect(reads.length-before).toBe(3);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-29'});
});

test('foundations AC-36 selected-source phase and comparison labels disclose unavailable global evidence',async({page},testInfo)=>{
 await page.clock.install();await prepare(page,false);const initial=headers.get(page)!.get('BBlock100')!;await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...initial,chain_id:'NetFixture'}}));
 await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');await expect(panel).toContainText('partial positive observations');await expect(panel).toContainText(/coverage partial/i);
 await page.route('https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{validated:[vote(0)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));await page.clock.runFor(15000);const candidate={...head(101),hash:'BScopedCoverage',payload_hash:'vhPayload101'};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await inspectRetainedCandidate(panel,'BScopedCoverage');await expect(panel.locator('.att .gauge-counts')).toContainText('0 / 30,000 power');await expect(panel).toContainText('Source-snapshot measured zero');await expect(panel).toContainText('no global completeness');
 const committee=panel.locator('.committee-evidence');await openDetails(committee);await choose(committee.getByLabel('Committee phase receipt filter'),'att:absent');await expect(committee.locator('tbody tr')).toHaveCount(50);await expect(committee).toContainText('no network-wide inactivity or global completeness claim');await expect(committee.locator('tbody tr').first()).toContainText('Absent in selected source snapshot');
 await panel.getByText('Sources & observation evidence',{exact:true}).click();await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/chain_id'))await route.fulfill({json:'NetFixture'});else if(path.endsWith('/head/header'))await route.fulfill({json:{...initial,chain_id:'NetFixture',protocol:'UnknownProtocol'}});else if(path.includes('pending_operations'))await route.fulfill({json:{validated:[vote(1)],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});else await route.fallback();});await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();const result=panel.locator('.comparison-result');await expect(result).toContainText('Power unknown');await expect(result).toContainText('Separate B source-limited observations');await expect(result).toContainText('not vote agreement or finality');await expect(result).toContainText('fetched current B https://tezos-mainnet.octez.io');await expect(panel).toContainText(/finality.*unavailable|unavailable.*finality/i);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-36'});
});

test('foundations AC-37 browser session reset discloses nonarchival history and one-provider comparison scope',async({page},testInfo)=>{
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.session-controls')).toContainText('1 / 150 session instances');await expect(panel.locator('.session-controls')).toContainText('Browser-session history is nonarchival and resets on reload');await inspectRetainedPayload(panel,'vhPayload101');await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');
 const selected=headers.get(page)!.get('BBlock100')!,reads:string[]=[];await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(route.request().url());await route.fulfill({json:path.endsWith('/chain_id')?'NetFixture':path.endsWith('/header')?{...selected,chain_id:'NetFixture',protocol:'PFixture'}:{validated:[],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();await expect(panel.locator('.comparison-result')).toContainText('fetched current B https://tezos-mainnet.octez.io');expect(reads).toHaveLength(3);expect(reads.every(url=>url.startsWith('https://tezos-mainnet.octez.io/'))).toBe(true);await expect(panel.locator('.comparison-result')).toContainText('not vote agreement or finality');
 await page.reload();await expect(panel.locator('.headline')).toContainText('100');await expect(panel.locator('.session-controls')).toContainText('0 / 150 session instances');await expect(panel.locator('.session-controls')).toContainText('Follow live');await expect(panel.locator('.session-controls')).toContainText('nonarchival and resets on reload');await expect(panel.getByRole('button',{name:'Inspect payload vhPayload101',exact:true})).toHaveCount(0);await panel.getByText('Sources & observation evidence',{exact:true}).click();await expect(panel.locator('.comparison-result')).toContainText('Explicit one-shot comparison');expect(reads).toHaveLength(3);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-37'});
});

test('foundations AC-35 primary fallback keeps actual responder while failed comparison never cascades',async({page},testInfo)=>{
 await prepare(page,false,head(),100,false,true);await selectNetwork(page,'shadownet');await expect.poll(()=>page.evaluate(()=>Boolean(window.mockStreams['shadownet-operations']))).toBe(true);const respondingHead=headers.get(page)!.get('BBlock100')!;await page.route('https://tezos-shadownet.octez.io/chains/main/blocks/head/header',route=>route.fulfill({json:{...respondingHead,chain_id:'NetFixture'}}));await send(page,'shadownet-operations',[vote(0)]);const panel=page.locator('.network-panel.shadownet');await inspectRetainedPayload(panel,'vhPayload101');await expect(panel.locator('.candidate-evidence')).toContainText('Source https://tezos-shadownet.octez.io');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await panel.getByText('Sources & observation evidence',{exact:true}).click();const before=await panel.locator('.candidate-evidence').textContent(),power=await panel.locator('.pre .gauge-counts').textContent(),reads:string[]=[];
 await page.route('https://rpc.shadownet.teztnets.com/**',async route=>{const path=new URL(route.request().url()).pathname;if(!path.endsWith('/chain_id')){await route.fallback();return;}reads.push(route.request().url());await route.fulfill({status:503,body:'Explicit comparison provider unavailable'});});await choose(panel.getByLabel('Comparison provider'),'https://rpc.shadownet.teztnets.com');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();await expect(panel.locator('.comparison-result')).toContainText('unavailable');await expect(panel.locator('.comparison-result')).toContainText('503');expect(reads).toEqual(['https://rpc.shadownet.teztnets.com/chains/main/chain_id']);await expect(panel.locator('.candidate-evidence')).toHaveText(before??'');await expect(panel.locator('.pre .gauge-counts')).toHaveText(power??'');await expect(panel.locator('.comparison-result')).toContainText('Selected historical A https://tezos-shadownet.octez.io');await expect(panel.locator('.comparison-result')).toContainText('fetched current B https://rpc.shadownet.teztnets.com');
 await page.clock.install();let reconciliations=0;await page.route('https://tezos-shadownet.octez.io/chains/main/blocks/head/header',async route=>{reconciliations++;await route.fulfill({status:503,json:{error:'Same observer reconciliation unavailable'}});});const beforeReconcile=await page.evaluate(()=>window.mockRequests.length);
 await send(page,'shadownet-operations',[vote(0,124)]);await inspectRaw(panel,'Inspect payload vhPayload124');await page.clock.runFor(15000);await expect.poll(()=>reconciliations).toBe(1);await expect(panel.locator('.candidate-evidence')).toContainText('Unresolved');await expect(panel.locator('.candidate-evidence')).toContainText('https://tezos-shadownet.octez.io');
 await page.clock.runFor(20000);expect(reconciliations).toBe(1);await send(page,'shadownet-operations',[vote(0,124)]);expect(reconciliations).toBe(1);const retry=panel.getByRole('button',{name:'Retry selected observer context',exact:true});await retry.click();await expect.poll(()=>reconciliations).toBe(2);
 const contextReads=await page.evaluate(start=>window.mockRequests.slice(start).filter(request=>new URL(request.url).pathname.endsWith('/blocks/head/header')).map(request=>request.url),beforeReconcile);expect(contextReads).toEqual(['https://tezos-shadownet.octez.io/chains/main/blocks/head/header','https://tezos-shadownet.octez.io/chains/main/blocks/head/header']);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.evaluate(()=>window.mockRequests.length);await panel.getByRole('button',{name:'Latest',exact:true}).click();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(paused);expect(reads).toHaveLength(1);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-35'});
});

test('foundations AC-21 paused cached inspection rejects late alias rights and comparison bodies after resume',async({page},testInfo)=>{
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window),state={armRights:false,seen:new Set<string>(),gates:[] as {kind:string;signal:AbortSignal|null|undefined;release:()=>void}[]};Object.assign(window,{cancelledBodyFixture:state});
  window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);const kind=url.hostname==='api.tzkt.io'&&url.pathname.includes('/v1/delegates')?'aliases':state.armRights&&url.hostname==='mainnet.smartpy.io'&&url.pathname.includes('attestation_rights')&&url.searchParams.get('level')==='102'?'rights':url.hostname==='tezos-mainnet.octez.io'&&url.pathname.includes('pending_operations')?'comparison':undefined;if(kind&&!state.seen.has(kind)){state.seen.add(kind);let body=await response.json();if(kind==='aliases')body=body.map((entry:{address:string;alias:string})=>({...entry,alias:'Cancelled Poison Alias'}));if(kind==='rights'){const entries=body[0]?.delegates;if(entries?.length>=2){entries[0].attesting_power=601;entries[1].attesting_power=599;}}response.json=()=>new Promise(resolve=>state.gates.push({kind,signal:options?.signal,release:()=>resolve(body)}));}return response;};
 });
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await inspectRetainedPayload(panel,'vhPayload101');await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();
 await page.evaluate(()=>(window as unknown as {cancelledBodyFixture:{armRights:boolean}}).cancelledBodyFixture.armRights=true);await send(page,'mainnet-head',head(101));await expect.poll(()=>page.evaluate(()=>(window as unknown as {cancelledBodyFixture:{gates:{kind:string}[]}}).cancelledBodyFixture.gates.some(gate=>gate.kind==='rights'))).toBe(true);
 const initial=headers.get(page)!.get('BBlock100')!;await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/chain_id'))await route.fulfill({json:'NetFixture'});else if(path.endsWith('/head/header'))await route.fulfill({json:{...initial,chain_id:'NetFixture',protocol:'PFixture'}});else if(path.includes('pending_operations'))await route.fulfill({json:{validated:[{...vote(1),hash:'CancelledComparisonPoison'}],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});else await route.fallback();});await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {cancelledBodyFixture:{gates:{kind:string}[]}}).cancelledBodyFixture.gates.map(gate=>gate.kind).sort())).toEqual(['aliases','comparison','rights']);
 await page.getByRole('button',{name:'Pause',exact:true}).click();expect(await page.evaluate(()=>(window as unknown as {cancelledBodyFixture:{gates:{signal:AbortSignal}[]}}).cancelledBodyFixture.gates.every(gate=>gate.signal.aborted))).toBe(true);const reads=await page.evaluate(()=>window.mockRequests.length);const committee=panel.locator('.committee-evidence');await openDetails(committee);await committee.getByRole('searchbox',{name:'Search committee alias or address'}).fill('tz1');await choose(committee.getByLabel('Committee sort'),'address');await expect(committee.locator('tbody tr')).toHaveCount(50);await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 await page.getByRole('button',{name:'Resume',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes('/monitor/heads/')&&!request.aborted).length)).toBe(1);await send(page,'mainnet-head',headers.get(page)!.get('BBlock101')!);await page.evaluate(()=>(window as unknown as {cancelledBodyFixture:{gates:{release:()=>void}[]}}).cancelledBodyFixture.gates.forEach(gate=>gate.release()));await panel.getByRole('button',{name:'Follow live',exact:true}).click();const resumedHead=headers.get(page)!.get('BBlock101')!;await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...resumedHead,chain_id:'NetFixture'}}));await page.route('https://mainnet.smartpy.io/chains/main/blocks/head/header',route=>route.fulfill({json:{...resumedHead,chain_id:'NetFixture'}}));await page.clock.install();await send(page,'mainnet-operations',[{...vote(0,102),hash:'fresh-target102-after-cancel'}]);await page.clock.runFor(15000);await inspectRetainedPayload(panel,'vhPayload102',{level:102,round:0});await expect(panel.locator('.authority-evidence')).toContainText('context head BBlock101');const retry=panel.getByRole('button',{name:'Retry selected observer context',exact:true});if(await retry.isVisible())await retry.click();await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await expect(panel).not.toContainText('Cancelled Poison Alias');await expect(panel.locator('.comparison-result')).not.toContainText('CancelledComparisonPoison');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-21'});
});

test('foundations AC-19 comparison and LIVE share one raw budget and growth preserves only captured positive scalars',async({page},testInfo)=>{
 await prepare(page,false);const panel=page.locator('.network-panel.mainnet');await send(page,'mainnet-operations',Array.from({length:9999},(_,index)=>({...vote(0),hash:`live-capacity-${index}`})));await expect(panel.locator('.session-controls')).toContainText('9999 / 10000 raw operations');await inspectRetainedPayload(panel,'vhPayload101');await panel.getByText('Sources & observation evidence',{exact:true}).click();const initial=headers.get(page)!.get('BBlock100')!,reads:string[]=[];
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(!['/chains/main/chain_id','/chains/main/blocks/head/header','/chains/main/mempool/pending_operations'].includes(path)){await route.fallback();return;}reads.push(path);await route.fulfill({json:path.endsWith('/chain_id')?'NetFixture':path.endsWith('/header')?{...initial,chain_id:'NetFixture',protocol:'PFixture'}:{validated:[{...vote(1),hash:'compare-capacity-1'},{...vote(2),hash:'compare-capacity-2'}],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}});});await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();const result=panel.locator('.comparison-result');await expect(result).toContainText('raw 1');await expect(result).toContainText('Local shared raw retention limit');await expect(result).toContainText('Pre 1200/30000');const received=(await result.textContent())!.match(/received ([^ ]+)/)![1]!;
 await send(page,'mainnet-operations',[{...vote(0),hash:'live-capacity-last'}]);await expect(panel.locator('.session-controls')).toContainText('10000 / 10000 raw operations');await expect(result).toContainText('raw 0');await expect(result).toContainText('captured positive facts remain as-of');await expect(result).toContainText('Pre 1200/30000');await expect(result).toContainText(`received ${received}`);await expect(result).toContainText('rights original responder https://rpc.tzkt.io/mainnet');await expect(result).not.toContainText('Pre 0/');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');expect(reads).toHaveLength(3);
 await panel.getByRole('button',{name:'Compare selected observation',exact:true}).click();await expect.poll(()=>reads.length).toBe(6);await expect(result).toContainText('raw 0');await expect(result).toContainText('Local shared raw retention limit');await expect(result).not.toContainText('Pre 0/');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-19'});
});


for(const immediateCompare of [false,true])test(`selection actions synchronously fence obsolete comparison bodies with ${immediateCompare?'an immediate explicit new comparison':'prior attributed results retained'}`,async({page})=>{
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window),gate={armed:false,newSelection:false,waiting:false,signal:undefined as AbortSignal|null|undefined,release:()=>{}};Object.assign(window,{selectionComparisonFixture:gate});
  window.fetch=async(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='tezos-mainnet.octez.io')return original(input,options);
   if(url.pathname.endsWith('/chain_id')){const response=Response.json('NetFixture');if(gate.armed){gate.signal=options?.signal;response.json=()=>new Promise(resolve=>{gate.waiting=true;gate.release=()=>resolve('NetFixture');});}return response;}
   if(url.pathname.endsWith('/header'))return Response.json({level:100,hash:'BBlock100',predecessor:'BBlock99',timestamp:'2026-01-01T00:00:00Z',fitness:['02','00000064','','ffffffff','00000000'],chain_id:'NetFixture',protocol:'PFixture'});
   if(url.pathname.includes('pending_operations'))return Response.json({validated:[{hash:gate.newSelection?'NewSelectedComparison':gate.armed?'ObsoleteSelectionPoison':'PriorCompletedComparison',contents:[{kind:'preattestation',level:101,round:0,slot:1,block_payload_hash:'SelectionP'}]}]});return original(input,options);
  };
 });
 const current=head(100);await prepare(page,false,current);await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));
 for(const [hash,payload] of [['SelectionA','SelectionP'],['SelectionB','SelectionQ']]){const candidate={...head(101),hash:hash!,payload_hash:payload!};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(page.locator('.mainnet .history-choice').filter({hasText:'101 · r0'})).toHaveCount(hash==='SelectionA'?1:2);}
 const panel=page.locator('.network-panel.mainnet');await inspectRetainedCandidate(panel,'SelectionA');await panel.getByText('Sources & observation evidence',{exact:true}).click();await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');
 await compare.click();await expect(result).toContainText('PriorCompletedComparison');const receipt=(await result.textContent())!.match(/received ([^ ]+)/)![1]!;
 await page.evaluate(()=>(window as unknown as {selectionComparisonFixture:{armed:boolean}}).selectionComparisonFixture.armed=true);await compare.click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {selectionComparisonFixture:{waiting:boolean}}).selectionComparisonFixture.waiting)).toBe(true);
 const aborted=await page.evaluate(immediate=>{const gate=(window as unknown as {selectionComparisonFixture:{armed:boolean;newSelection:boolean;signal:AbortSignal;release:()=>void}}).selectionComparisonFixture,releaseOld=gate.release;const button=[...document.querySelectorAll<HTMLButtonElement>('.mainnet .history-choice')].find(value=>value.getAttribute('aria-label')?.includes('SelectionQ'));if(!button)throw new Error('Missing retained candidate control');button.click();const aborted=gate.signal.aborted;if(immediate){gate.armed=false;gate.newSelection=true;const compare=[...document.querySelectorAll<HTMLButtonElement>('.mainnet .source-comparison button')].find(value=>value.textContent==='Compare selected observation');if(!compare)throw new Error('Missing explicit comparison control');compare.dispatchEvent(new MouseEvent('click',{bubbles:true}));}releaseOld();return aborted;},immediateCompare);
 expect(aborted).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(panel.locator('.candidate-evidence')).toContainText('SelectionB');await expect(result).not.toContainText('ObsoleteSelectionPoison');if(immediateCompare){await expect(result).toContainText('NewSelectedComparison');await expect(result).toContainText('SelectionB');await expect(result).not.toContainText('context-invalid');}else{await expect(result).toContainText('PriorCompletedComparison');await expect(result).toContainText('context-invalid');await expect(result).toContainText(`received ${receipt}`);}
});


test('optional pending failure preserves independently proven head agreement and divergence labels',async({page})=>{
 await prepare(page,false);const current=headers.get(page)!.get('BBlock100')!;let fetched={...current,chain_id:'NetFixture',protocol:'PFixture'};
 await page.route('https://tezos-mainnet.octez.io/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/chain_id'))await route.fulfill({json:'NetFixture'});else if(path.endsWith('/head/header'))await route.fulfill({json:fetched});else if(path.includes('pending_operations'))await route.fulfill({status:503,body:'Optional pending unavailable'});else await route.fallback();});
 const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.authority-evidence')).toContainText('chain NetFixture');await panel.getByText('Sources & observation evidence',{exact:true}).click();await choose(panel.getByLabel('Comparison provider'),'https://tezos-mainnet.octez.io');const compare=panel.getByRole('button',{name:'Compare selected observation',exact:true}),result=panel.locator('.comparison-result');
 await compare.click();await expect(result).toContainText('503');await expect(result).toContainText('Head fields: head-agreement');await expect(result).toContainText('partial');
 fetched={...fetched,hash:'DifferentKnownHead'};await compare.click();await expect(result).toContainText('DifferentKnownHead');await expect(result).toContainText('Head fields: divergence');await expect(result).toContainText('503');await expect(result).toContainText('not vote agreement or finality');
});

test('foundations AC-15 coherent prediction expiry remains independent from transport and observed advancement',async({page},testInfo)=>{
 await page.clock.install();const current=head(100,2);await prepare(page,false,current);const panel=page.locator('.network-panel.mainnet');
 await expect(panel.locator('.status-chip')).toHaveText('Progress unknown');await expect(panel.locator('.connection-line')).toContainText('Heads stream · source-local snapshots (proven heads / 6s)');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');await expect(panel.locator('.baker-opportunity').first()).toContainText('round 3');const events=await panel.locator('.event-history').textContent();
 await page.clock.runFor(15000);await expect(panel.locator('.baker-opportunity').first()).toContainText('Awaiting observation');await expect(panel.locator('.status-chip')).toHaveText('Prediction elapsed');await expect(panel.locator('.headline')).toContainText('100');expect(await panel.locator('.event-history').textContent()).toBe(events);await expect(panel.locator('.connection-line')).toContainText('Heads stream · source-local snapshots (proven heads / 6s)');
 await page.route('**/context/constants',route=>route.fulfill({status:503,body:'Exact execution timing unavailable'}));headers.get(page)!.set('MissingTimingParent99',{...head(99),hash:'MissingTimingParent99'});await send(page,'mainnet-head',{...current,hash:'MissingTimingFork',predecessor:'MissingTimingParent99'});await expect(panel).toContainText('Observed same-height reorg');await page.clock.runFor(15000);await expect(panel.locator('.status-chip')).toHaveText('Progress unknown');await expect(panel.locator('.countdown')).toHaveText('Timing unavailable');await expect(panel.locator('.headline')).toContainText('100');
 const advanced={...head(101),predecessor:'MissingTimingFork'};await send(page,'mainnet-head',advanced);await expect(panel.locator('.headline')).toContainText('101');await expect(panel).toContainText('Observed next-level advance');await page.evaluate(()=>window.mockStreams['mainnet-head']!.error(new Error('Observed source head transport interrupted')));await expect(panel.locator('.status-chip')).toHaveText('RPC coverage degraded');await expect(panel).toContainText('Observed next-level advance');await expect(panel).not.toContainText('global chain stall');
 testInfo.annotations.push({type:'foundation-verified',description:'AC-15'});
});

test('pinned phases preserve their independently captured quorum after asymmetric raw retention',async({page})=>{
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await inspectRetainedPayload(panel,'vhPayload101');
 await page.evaluate(async(path)=>{type CapturedMonitor={observations:ObservationStore<Derived>;emit:()=>void};const {NetworkMonitor}=await import(path),original=NetworkMonitor.prototype.pinObservation;NetworkMonitor.prototype.pinObservation=function(this:CapturedMonitor,identity:string){Object.assign(window,{phaseThresholdMonitor:this});return original.call(this,identity);};},inspectionModule());
 await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();
 const facts=await page.evaluate(()=>{
  const monitor=(window as unknown as {phaseThresholdMonitor:{observations:ObservationStore<Derived>;emit:()=>void}}).phaseThresholdMonitor,store=monitor.observations,record=store.acceptedTargets()[0],proof=record?.admission;if(!record||!proof)throw new Error('Actual selected monitor proof unavailable');const source=record.target.source;
  store.addOperations(Array.from({length:10000},(_,index)=>({hash:`phase-threshold-unrelated-${index}`,evidence:{source,receivedAt:2+index,receivedMonotonic:2+index},contents:[]})));
  store.accept({...proof,...store.generation(source),constants:{...proof.constants,quorum:600}});
  store.addOperations([{hash:'phase-threshold-att',evidence:{source,receivedAt:20000,receivedMonotonic:20000},contents:[{kind:'attestation',level:record.target.level,round:record.target.round,slot:0,...(record.target.payload?{block_payload_hash:record.target.payload}:{})}]}]);monitor.emit();const phases=store.inspection().snapshot?.record.phases;return {pre:phases?.pre?.threshold,att:phases?.att?.threshold};
 });
 expect(facts).toEqual({pre:20000,att:600});await expect(panel.locator('.att .quorum-caption')).toContainText('600 power required');await expect(panel.locator('.pre .quorum-caption')).toContainText('19,400 more power to quorum');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await expect(panel.locator('.att .gauge-counts')).toContainText('600 / 30,000 power');
});

test('S9 historical opportunity capture freezes its as-of deadline remaining duration and original context',async({page})=>{
 await page.clock.install();const initial=head(100);await prepare(page,false,initial);const panel=page.locator('.network-panel.mainnet');const candidate={...head(101),hash:'OpportunityHistorical101'};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.baker-opportunity').first()).toContainText('reference OpportunityHistorical101');await inspectRetainedCandidate(panel,'OpportunityHistorical101');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 101');await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.baker-opportunity').first()).toContainText('Captured historical');const captured=await panel.locator('.baker-opportunity').allTextContents();expect(captured[0]).toContain('execution protocol PFixture');expect(captured[0]).toContain('timing source https://mainnet.smartpy.io');
 const newer={...head(102),hash:'OpportunityLive102',predecessor:candidate.hash};await send(page,'mainnet-head',newer);headers.get(page)!.set(newer.hash,newer);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:newer.hash,header:newer});await page.clock.runFor(90000);expect(await panel.locator('.baker-opportunity').allTextContents()).toEqual(captured);await expect(panel.locator('.candidate-evidence')).toContainText(candidate.hash);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await page.clock.setSystemTime(new Date('2030-01-01T00:00:00Z'));await page.clock.runFor(2000);expect(await panel.locator('.baker-opportunity').allTextContents()).toEqual(captured);await panel.getByRole('button',{name:'Latest',exact:true}).click();await panel.getByRole('button',{name:'Follow live',exact:true}).click();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();await expect(panel.locator('.candidate-evidence')).not.toContainText('Observed block hash OpportunityHistorical101');
});

test('S9 missing baking rights preserve independently known branch timing',async({page})=>{
 await prepare(page,false,head(100,0));await page.route('**/helpers/baking_rights?*',route=>route.fulfill({json:[]}));const panel=page.locator('.network-panel.mainnet');const candidate={...head(101,2),hash:'OpportunityNoRights101'};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.baker-opportunity').first()).toContainText('reference OpportunityNoRights101');await expect(panel.locator('.baker-opportunity').nth(0)).toContainText('Conditional timer');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Level 102 · round 0');await expect(panel.locator('.baker-opportunity').nth(1)).toContainText('Conditional timer');await inspectRetainedCandidate(panel,'OpportunityNoRights101');const rows=panel.locator('.baker-opportunity');await expect(rows).toHaveCount(2);await expect(rows.nth(0)).toContainText('Baking rights unavailable');await expect(rows.nth(0)).toContainText('Conditional timer');await expect(rows.nth(0)).toContainText('Level 101 · round 3');await expect(rows.nth(1)).toContainText('Level 102 · round 0');await expect(rows.nth(1)).toContainText('Baking rights unavailable');await expect(rows.nth(1)).toContainText('Conditional timer');
});

test('S9 same-height competing candidate retains its admitted context and independently known timing with missing rights',async({page},testInfo)=>{
 // Use an observer with actual same-source applied-head and validated-proposal streams.
 // A later observed round moves FOLLOW without replacing an equal-support same-round selection.
 await prepare(page,false,head(100,1));await selectNetwork(page,'shadownet');
 await page.evaluate(async(path)=>{type Captured={observations:ObservationStore<Derived>};const {NetworkMonitor}=await import(path),original=NetworkMonitor.prototype.contextAuthorized;NetworkMonitor.prototype.contextAuthorized=function(this:Captured,...args:unknown[]){if(this.observations.acceptedTargets().some(value=>value.target.candidate?.header.hash==='OpportunitySameHeight100'))Object.assign(window,{sameHeightOpportunityMonitor:this});return original.apply(this,args);};},inspectionModule());
 await page.route('**/helpers/baking_rights?*',route=>route.fulfill({json:[]}));const panel=page.locator('.network-panel.shadownet'),candidate={...head(100,2),hash:'OpportunitySameHeight100'};headers.get(page)!.set(candidate.hash,candidate);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 100 · round 3');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');await expect(panel.locator('.baker-opportunity').first()).toContainText('reference OpportunitySameHeight100');
 const branchReads=await page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes('/helpers/baking_rights?')).length);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));expect(await page.evaluate(()=>window.mockRequests.filter(request=>request.url.includes('/helpers/baking_rights?')).length)).toBe(branchReads);
 await inspectRetainedCandidate(panel,'OpportunitySameHeight100');
 const proof=await page.evaluate(()=>{const store=(window as unknown as {sameHeightOpportunityMonitor:{observations:ObservationStore<Derived>}}).sameHeightOpportunityMonitor.observations,record=store.acceptedTargets().find(value=>value.target.candidate?.header.hash==='OpportunitySameHeight100');return {observerHash:record?.admission?.context.observer.header.hash,observerLevel:record?.admission?.context.observer.header.level,candidateHash:record?.target.candidate?.header.hash,targetLevel:record?.target.level,contextInvalid:record?.contextInvalid};});await testInfo.attach('actual-same-height-admission',{body:JSON.stringify(proof),contentType:'application/json'});expect(proof).toEqual({observerHash:'BBlock100',observerLevel:100,candidateHash:candidate.hash,targetLevel:100,contextInvalid:false});
 await testInfo.attach('pin-capture-diagnostic',{body:JSON.stringify(await page.evaluate(()=>{const store=(window as unknown as {sameHeightOpportunityMonitor:{observations:ObservationStore<Derived>}}).sameHeightOpportunityMonitor.observations;const pin=store.inspection();return {selected:pin.selectedIdentity,record:pin.snapshot?.record.identity,candidates:pin.snapshot?.candidates.map(value=>({identity:value.identity,opportunities:value.opportunities})),active:store.acceptedTargets().map(value=>({identity:value.identity,opportunities:value.opportunities}))};})),contentType:'application/json'});
 const rows=panel.locator('.baker-opportunity');await expect(rows).toHaveCount(2);await expect(rows.nth(0)).toContainText('Baking rights unavailable');await expect(rows.nth(0)).toContainText('Conditional timer');await expect(rows.nth(0)).toContainText('Level 100 · round 3');await expect(rows.nth(1)).toContainText('Level 101 · round 0');await expect(rows.nth(1)).toContainText('Baking rights unavailable');await expect(rows.nth(1)).toContainText('Conditional timer');
});

test('S9 missing projected timing preserves independently proven baking rights',async({page})=>{
 const current=head(100,0);await prepare(page,false,current);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');
 const candidate={...head(101,2),hash:'OpportunityRightsOnly101'};headers.get(page)!.set(candidate.hash,candidate);
 // Immutable parent constants still prove admission; only the projected timing consumer fails.
 await page.evaluate(async({path,hash})=>{const module=await import(path),original=module.NetworkData.prototype.opportunityConstants;module.NetworkData.prototype.opportunityConstants=function(head:{hash:string},...args:unknown[]){if(head.hash===hash)return Promise.reject(new Error('Projected timing unavailable'));return original.call(this,head,...args);};},{path:inspectionModule(),hash:candidate.hash});await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await inspectRetainedCandidate(panel,'OpportunityRightsOnly101');const rows=panel.locator('.baker-opportunity');await expect(rows).toHaveCount(2);await expect(rows.nth(0)).toContainText('Level 101 · round 3');await expect(rows.nth(0)).toContainText('proposer source');await expect(rows.nth(0)).toContainText('Timer unavailable');await expect(rows.nth(0)).not.toContainText('Baking rights unavailable');await expect(rows.nth(1)).toContainText('Level 102 · round 0');await expect(rows.nth(1)).toContainText('proposer source');await expect(rows.nth(1)).toContainText('Timer unavailable');
});

test('S9 activation keeps current execution timing separate and successor migration timing explicitly unknown',async({page})=>{
 const current=head(100,0);await prepare(page,false,current);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');const candidate={...head(101,2),hash:'OpportunityMigration101'};headers.get(page)!.set(candidate.hash,candidate);const queried:{level:string|null;round:string|null;anchor:string}[]=[];
 await page.route('**/OpportunityMigration101/protocols',route=>route.fulfill({json:{protocol:'PFixture',next_protocol:'PSuccessor'}}));await page.route('**/OpportunityMigration101/context/constants',route=>route.fulfill({json:{minimal_block_delay:'10',delay_increment_per_round:'4',consensus_threshold_size:20000,consensus_committee_size:30000}}));
 await page.route('**/helpers/baking_rights?*',async route=>{const url=new URL(route.request().url());if(url.hostname==='mainnet.smartpy.io')queried.push({level:url.searchParams.get('level'),round:url.searchParams.get('max_round'),anchor:url.pathname.split('/blocks/')[1]?.split('/')[0]??''});await route.fallback();});
 await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await expect(panel.locator('.baker-opportunity').first()).toContainText('reference OpportunityMigration101');await expect(panel.locator('.baker-opportunity').first()).toContainText(`deadline ${new Date(Date.parse(candidate.timestamp)+12000).toISOString()}`);await expect(panel.locator('.baker-opportunity').nth(1)).toContainText(/migration.*unavailable|migration.*unproven/i);await inspectRetainedCandidate(panel,'OpportunityMigration101');const rows=panel.locator('.baker-opportunity');await expect(rows).toHaveCount(2);await expect(rows.nth(0)).toContainText('Level 101 · round 3');await expect(rows.nth(0)).toContainText(`deadline ${new Date(Date.parse(candidate.timestamp)+12000).toISOString()}`);await expect(rows.nth(0)).toContainText('execution protocol PFixture');await expect(rows.nth(1)).toContainText('Level 102 · round 0');await expect(rows.nth(1)).toContainText('Timer unavailable');await expect(rows.nth(1)).toContainText(/migration.*unavailable|migration.*unproven/i);await expect(rows.nth(1)).not.toContainText('Conditional timer');await expect(rows.nth(1)).toContainText('Future hash unknown');
 expect(queried).toContainEqual({level:'101',round:'3',anchor:'BBlock100'});expect(queried).toContainEqual({level:'102',round:'0',anchor:candidate.hash});
});

test('S9 selection synchronously aborts old baking-right bodies and late completion cannot overwrite the new candidate',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch.bind(window),gate={armed:false,held:false,waiting:false,signal:undefined as AbortSignal|null|undefined,release:()=>{}};Object.assign(window,{opportunitySelectionGate:gate});window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(gate.armed&&!gate.held&&url.hostname==='mainnet.smartpy.io'&&url.pathname.includes('baking_rights')&&url.searchParams.get('level')==='101'&&url.searchParams.get('max_round')==='1'){const body=await response.json();if(!gate.held&&!options?.signal?.aborted){gate.held=true;gate.signal=options?.signal;response.json=()=>new Promise(resolve=>{gate.waiting=true;gate.release=()=>resolve(body.map((entry:object)=>({...entry,delegate:'CancelledOpportunityPoison'})));});}else response.json=async()=>body;}return response;};});
 await prepare(page,false);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');await page.evaluate(()=>(window as unknown as {opportunitySelectionGate:{armed:boolean}}).opportunitySelectionGate.armed=true);
 const first={...head(101),hash:'OpportunitySelectionA'},second={...head(101,1),hash:'OpportunitySelectionB',payload_hash:'OtherOpportunityPayload'};for(const candidate of [first,second])headers.get(page)!.set(candidate.hash,candidate);
 await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:first.hash,header:first});await inspectRetainedCandidate(panel,'OpportunitySelectionA');await expect.poll(()=>page.evaluate(()=>(window as unknown as {opportunitySelectionGate:{waiting:boolean}}).opportunitySelectionGate.waiting)).toBe(true);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:second.hash,header:second});await expect(panel.getByRole('button',{name:/^Inspect retained instance .*OtherOpportunityPayload/})).toBeVisible();
 const aborted=await page.evaluate(()=>{const gate=(window as unknown as {opportunitySelectionGate:{signal:AbortSignal;release:()=>void}}).opportunitySelectionGate;const button=[...document.querySelectorAll<HTMLButtonElement>('.mainnet .history-choice')].find(value=>value.getAttribute('aria-label')?.includes('OtherOpportunityPayload'));if(!button)throw new Error('Retained second candidate control unavailable');button.click();const aborted=gate.signal.aborted;gate.release();return aborted;});expect(aborted).toBe(true);await expect(panel.locator('.candidate-evidence')).toContainText('OpportunitySelectionB');await expect(panel.locator('.baker-opportunity').first()).toContainText('Timer unavailable');await expect(panel.locator('.opportunities')).not.toContainText('CancelledOpportunityPoison');await panel.getByRole('button',{name:'Follow live',exact:true}).click();await expect(panel.locator('.candidate-evidence')).toContainText('OpportunitySelectionB');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.baker-opportunity').first()).toContainText('Captured historical');await expect(panel.locator('.opportunities')).not.toContainText('CancelledOpportunityPoison');
});

test('foundations AC-34 conditional timers never substitute for applied values or invent observed progression',async({page},testInfo)=>{
 await page.clock.install();const current=head(100,2);await prepare(page,false,current);const panel=page.locator('.network-panel.mainnet'),rows=panel.locator('.baker-opportunity');await expect(panel.locator('.applied-context')).toContainText('level 100 · round 2');const originalApplied=await panel.locator('.applied-context').textContent();expect(originalApplied).toContain('block timestamp');
 await expect(rows.nth(0)).toContainText('Level 100 · round 3');await expect(rows.nth(1)).toContainText('Level 101 · round 0');await expect(rows.nth(0)).toContainText('Conditional on continued same-level production');await expect(rows.nth(1)).toContainText('Earliest protocol boundary conditional on hypothetical next-level production');for(const row of [rows.nth(0),rows.nth(1)]){await expect(row).toContainText('Conditional timer');await expect(row).toContainText('timing source https://mainnet.smartpy.io');await expect(row).toContainText('execution protocol PFixture');await expect(row).toContainText('Future hash unknown');await expect(row).toContainText(`deadline ${new Date(Date.parse(current.timestamp)+12000).toISOString()}`);}
 await panel.screenshot({path:`roster/observatory-foundations/slice-9-${testInfo.project.name}.png`});
 const events=await panel.locator('.event-history').textContent();await page.clock.runFor(15000);await expect(rows.nth(0)).toContainText('Awaiting observation');await expect(rows.nth(1)).toContainText('Awaiting observation');await expect(panel.locator('.applied-context')).toHaveText(originalApplied??'');expect(await panel.locator('.event-history').textContent()).toBe(events);await expect(rows.nth(0)).toContainText('Level 100 · round 3');await expect(rows.nth(1)).toContainText('Level 101 · round 0');
 const sameLevel={...head(100,3),hash:'ObservedTimingRound3',timestamp:new Date(Date.parse(current.timestamp)+12000).toISOString()};await send(page,'mainnet-head',sameLevel);await expect(panel.locator('.applied-context')).toContainText('level 100 · round 3');await expect(panel).toContainText('Observed same-level round advance');
 const nextLevel={...head(101),hash:'ObservedTiming101',predecessor:sameLevel.hash,timestamp:new Date(Date.parse(current.timestamp)+27000).toISOString()};await send(page,'mainnet-head',nextLevel);await expect(panel.locator('.applied-context')).toContainText('level 101 · round 0');await expect(panel).toContainText('Observed next-level advance');
 await send(page,'mainnet-head',{...nextLevel,hash:'ObservedTimingFork101'});await expect(panel).toContainText('Observed same-height reorg');await expect(panel.locator('.applied-context')).toContainText('level 101 · round 0');
 const skipped={...head(104),hash:'ObservedTiming104'};await send(page,'mainnet-head',skipped);await expect(panel.locator('.applied-context')).toContainText('level 104 · round 0');await expect(panel).toContainText('Skipped delivered levels; intermediate path unobserved');expect(await panel.locator('.event-history').textContent()).toBe(events);
 await page.route('**/context/constants',route=>route.fulfill({status:503,body:'Exact timing inputs unavailable'}));headers.get(page)!.set('MissingTimingParent103',{...head(103),hash:'MissingTimingParent103'});await send(page,'mainnet-head',{...skipped,hash:'ObservedTimingMissing104',predecessor:'MissingTimingParent103'});await expect(panel).toContainText('Observed same-height reorg');await expect(panel.locator('.countdown')).toHaveText('Timing unavailable');await page.clock.runFor(15000);await expect(panel.locator('.status-chip')).toHaveText('Progress unknown');await expect(panel.locator('.applied-context')).toContainText('level 104 · round 0');expect(await panel.locator('.event-history').textContent()).toBe(events);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-34'});
});

test('valid timing with a large increment keeps a future round-zero clock estimate finite',async({page})=>{
 await page.clock.install({time:new Date(Date.now()-60000)});
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.pathname.endsWith('/context/constants'))return Response.json({...await response.json(),minimal_block_delay:'1',delay_increment_per_round:'3'});return response;};});
 await prepare(page,false,head(100,0));const panel=page.locator('.network-panel.mainnet');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');
 await expect(panel.locator('.timing-detail')).toContainText('estimated round 0');
 await expect(panel.locator('.timing-detail')).not.toContainText('NaN');
 await expect(panel.locator('.timing-detail')).not.toContainText('Invalid Date');
 await expect(panel.locator('.headline')).toContainText('Applied block round0');
});

test('an unsupported computed clock boundary stays unavailable while valid branch deadlines remain independent',async({page})=>{
 const observed=head(100,0);await page.clock.install({time:new Date(Date.parse(observed.timestamp)+5000)});
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.pathname.endsWith('/context/constants'))return Response.json({...await response.json(),minimal_block_delay:'1',delay_increment_per_round:'8640000000000'});return response;};});
 await prepare(page,false,observed);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.baker-opportunity').first()).toContainText('Conditional timer');
 await expect(panel.locator('.timing-detail')).not.toContainText('Invalid Date');await expect(panel.locator('.timing-detail')).not.toContainText('NaN');
 await expect(panel.locator('.countdown')).toHaveText('Timing unavailable');await expect(panel.locator('.timing-detail')).toContainText('Independent clock estimate unavailable');
 await expect(panel.locator('.baker-opportunity').first()).toContainText('Level 100 · round 1');await expect(panel.locator('.headline')).toContainText('Applied block round0');
});

test('the independent clock estimate identifies its applied reference and actual helper separately from selected branch deadlines',async({page})=>{
 const observed=head(100,2);await prepare(page,false,observed);const panel=page.locator('.network-panel.mainnet'),rows=panel.locator('.baker-opportunity'),detail=panel.locator('.timing-detail');
 await expect(rows.first()).toContainText('Conditional timer');await expect(detail).toContainText('Independent clock estimate');await expect(detail).toContainText('next estimated round boundary');await expect(detail).toContainText('separate from selected branch deadlines');
 await expect(detail).toContainText('applied reference BBlock100');await expect(detail).toContainText('observer https://mainnet.smartpy.io');await expect(detail).toContainText('parameters responder https://mainnet.smartpy.io');await expect(detail).toContainText('target 101');await expect(detail).toContainText('execution protocol PFixture');
 await expect(detail).toContainText(new Date(Date.parse(observed.timestamp)+18000).toISOString());
 for(const row of [rows.first(),rows.nth(1)])await expect(row).toContainText(`deadline ${new Date(Date.parse(observed.timestamp)+12000).toISOString()}`);
});

test('a fully retired first observed quorum replay retains uncertain power without recreating its event',async({page})=>{
 const current=head(100);await prepare(page,false,current,100,false,false,{total:5,quorum:4,powers:[3,1,1]});const panel=page.locator('.network-panel.mainnet'),events=panel.locator('.event-history li');
 const packet=(hash:string,payload:string,slots=[0,1,2])=>({hash,contents:slots.map(slot=>({kind:'preattestation',level:101,round:0,slot,block_payload_hash:payload}))});
 const original=packet('retired-original-quorum','vhRetiredOriginal');await send(page,'mainnet-operations',[original]);await expect(events.filter({hasText:'vhRetiredOriginal'})).toHaveCount(1);await expect(events.filter({hasText:'vhRetiredOriginal'})).toContainText('Preattestation observed quorum');
 for(let index=0;index<14;index++){await send(page,'mainnet-operations',[packet(`evict-event-${index}`,`vhEvictEvent${index}`)]);await expect(events.filter({hasText:`vhEvictEvent${index} `})).toHaveCount(1);}
 await expect(events.filter({hasText:'vhRetiredOriginal'})).toHaveCount(0);await expect(events).toHaveCount(12);
 await send(page,'mainnet-operations',Array.from({length:151},(_,index)=>packet(`retire-owner-${index}`,`vhRetireOwner${index}`,[0])));await expect(panel).toContainText('Crossing history partial');
 await send(page,'mainnet-operations',Array.from({length:10000},(_,index)=>({hash:`retired-unrelated-${index}`,contents:[{kind:'transaction',source:'tz1Source',destination:'tz1Destination',fee:'1',counter:'1',gas_limit:'100',storage_limit:'0',amount:'1'}]})));
 const priorEvents=await events.allTextContents();await send(page,'mainnet-operations',[original]);await inspectRetainedPayload(panel,'vhRetiredOriginal');await expect(panel.locator('.pre .gauge-counts')).toContainText('5 / 5 power');await expect(panel.locator('.pre .quorum-caption')).toContainText('Quorum reached · 4 power required');await expect(panel).toContainText('Crossing history partial');await expect(events.filter({hasText:'vhRetiredOriginal'})).toHaveCount(0);await expect(events).toHaveText(priorEvents);
});

test("foundations AC-3 autonomous B authority remains readable without primary applied head",async({page},testInfo)=>{
 await prepare(page,false,head(120),120,true,true);await page.locator('.network-tab.shadownet').click();
 const current=head(122);headers.get(page)?.set(current.hash,current);headers.get(page)?.set(current.predecessor,head(121));
 await page.route("https://tezos-shadownet.octez.io/chains/main/blocks/head/header",route=>route.fulfill({json:{...current,chain_id:"NetFixture"}}));
 await page.evaluate(async(inspectionPath)=>{
   const original=window.fetch.bind(window);let primaryHeld=false;
   window.fetch=async(input,options)=>{
     const url=String(input);
     if(url.includes('/monitor/heads/')&&url.includes('shadownet'))return new Response(new ReadableStream());
     if(url.includes('/blocks/head/header')&&url.includes('rpc.shadownet.teztnets.com')&&!primaryHeld){primaryHeld=true;return new Promise<Response>(()=>undefined);}
     return original(input,options);
   };
   const module=await import(inspectionPath);
   const originalAccept=module.ObservationStore.prototype.accept;
   module.ObservationStore.prototype.accept=function(proof:unknown){const result=originalAccept.call(this,proof);if(this.network==="shadownet")(window as unknown as {independentAccepted:number}).independentAccepted=this.acceptedTargets().find((record:{phases?:{pre?:{power:number}}})=>record.phases?.pre?.power===600)?1:0;return result;};
   window.mockHidden=false;document.dispatchEvent(new Event('visibilitychange'));
 },inspectionModule());
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mockStreams['shadownet-operations']))).toBe(true);
 await send(page,'shadownet-operations',[vote(0,123)]);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {independentAccepted:number}).independentAccepted)).toBeGreaterThan(0);
 const panel=page.locator('.network-panel.shadownet');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
 await expect(panel.locator('.pre .quorum-caption')).toContainText('19,400 more power');await expect(panel.locator('.att .gauge-counts')).toContainText('Voting power unavailable');
 await expect(panel.locator('.authority-evidence')).toContainText('authority observer https://tezos-shadownet.octez.io');await expect(panel.locator('.authority-evidence')).toContainText('context head BBlock122');await expect(panel.locator('.authority-evidence')).toContainText('target 123');
 await expect(panel.locator('.applied-context')).toHaveText('Last applied block unavailable');await expect(panel.locator('.headline strong')).toHaveText(['—','—']);await expect(panel.locator('.timing-detail')).toHaveText('Independent clock estimate unavailable');
 await panel.getByText('Sources & observation evidence',{exact:true}).click();await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await expect(panel.locator('.authority-evidence')).toContainText('Captured source/context');
 await page.getByRole('button',{name:'Pause',exact:true}).click();const reads=await page.evaluate(()=>window.mockRequests.length);await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');await expect(panel.locator('.applied-context')).toHaveText('Last applied block unavailable');await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');await panel.getByText('Committee evidence',{exact:false}).click();expect(await page.evaluate(()=>window.mockRequests.length)).toBe(reads);
 testInfo.annotations.push({type:'foundation-verified',description:'AC-3'});
});


test('V3 AC-22 theme is explicit persistent and follows system only in system mode',async({page},info)=>{
 const states:unknown[]=[];const capture=async()=>states.push(await page.evaluate(()=>({at:performance.now(),osDark:matchMedia('(prefers-color-scheme: dark)').matches,resolved:document.documentElement.dataset.theme,selected:document.querySelector('.appearance input:checked')?.getAttribute('value')})));
 await prepare(page,false);
 const theme=page.getByLabel('Appearance');
 await expect(theme).toBeVisible();
 await choose(theme,'light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await capture();
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await capture();
 await page.reload();await expect(theme.locator("..").locator("input:checked" )).toHaveValue('light');
 await choose(theme,'system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await capture();
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await capture();
 await info.attach('actual-system-preference-transition',{body:JSON.stringify(states),contentType:'application/json'});
 await expect(page.getByRole('heading',{name:'Tezos Observatory',exact:true})).toBeVisible();
});


test('V3 first observation renders exact paired evidence in both themes across useful widths',async({page},testInfo)=>{
 await prepare(page,false);
 await send(page,'mainnet-operations',[vote(0),vote(1)]);
 const panel=page.locator('.network-panel.mainnet');
 await expect(panel.locator('.pre .gauge-exact')).toHaveText('1,200 / 30,000');
 await expect(panel.locator('.att .gauge-exact')).toHaveText('Unavailable');
 await expect(panel.locator('.selected-title')).toHaveText('101 / r0');
 await expect(panel.locator('.selected-kind')).toContainText('proposal hash and producer unavailable');
 for(const width of [390,1440,3440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===390?844:1440});
  await choose(page.getByLabel('Appearance'),theme);
  await page.screenshot({path:testInfo.outputPath(`workspace-${testInfo.project.name}-${width}-${theme}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 }
 const mark=page.locator('.header-mark');
 for(const theme of ['light','dark']){await choose(page.getByLabel('Appearance'),theme);await mark.screenshot({path:testInfo.outputPath(`mark-${testInfo.project.name}-${theme}-native.png`)});await mark.evaluate(node=>{(node as HTMLElement).style.width='160px';(node as HTMLElement).style.height='160px';});await mark.screenshot({path:testInfo.outputPath(`mark-${testInfo.project.name}-${theme}-160.png`)});await mark.evaluate(node=>{(node as HTMLElement).style.width='';(node as HTMLElement).style.height='';});}
});


test('V3 AC-29 observed junction places next round above and next level right with readable phone targets',async({page},info)=>{
 await prepare(page,false);
 await send(page,'mainnet-operations',[vote(0,101,0)]);
 const panel=page.locator('.network-panel.mainnet');
 for(const width of [360,390,1440,3440,5120]){
  await page.setViewportSize({width,height:width<400?800:1440});
  const selected=panel.locator('.navigator-current'),up=panel.locator('.baker-opportunity').first(),right=panel.locator('.baker-opportunity').nth(1);
  await expect(selected).toContainText('101');await expect(selected).toContainText('r0');
  await expect(up).toContainText('Level 101 · round 1');await expect(right).toContainText('Level 102 · round 0');
  const samples:unknown[]=[];
  try {
   // Viewport changes deliver ResizeObserver asynchronously. Read all slots in
   // one browser task, then wait for the unchanged geometry contract to hold.
   await expect.poll(async()=>{
    const boxes=await panel.evaluate(node=>{
     const rect=(selector:string)=>{const target=node.querySelector(selector);if(!target)return undefined;const {x,y,width,height}=target.getBoundingClientRect();return {x,y,width,height};};
     return {at:performance.now(),current:rect('.navigator-current'),up:rect('[data-branch="same-level"]'),right:rect('[data-branch="next-level"]')};
    });
    samples.push(boxes);const {current:a,up:b,right:c}=boxes;
    if(!a||!b||!c)return {present:false,positive:false,above:false,aligned:false,right:false,sameRow:false};
    return {present:true,positive:[a,b,c].every(rect=>rect.width>0&&rect.height>0),above:b.y+b.height<=a.y,aligned:Math.abs(b.x-a.x)<2,right:c.x>a.x,sameRow:Math.abs(c.y-a.y)<2};
   }).toEqual({present:true,positive:true,above:true,aligned:true,right:true,sameRow:true});
  } finally {
   const path=info.outputPath(`junction-responsive-${width}.json`);await writeFile(path,JSON.stringify({width,samples},null,2));await info.attach(`junction-responsive-${width}`,{path,contentType:'application/json'});
  }
  expect(await up.locator('.branch-target').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
  await expect(up.locator('.branch-critical')).toBeVisible();await expect(right.locator('.branch-critical')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 }
});


test('V3 AC-04 selecting a retained candidate immediately pins and Previous follows receipts',async({page})=>{
 await prepare(page,false);
 const panel=page.locator('.network-panel.mainnet');
 for(const hash of ['V3FirstCandidate','V3SecondCandidate']){const candidate={...head(101),hash};headers.get(page)!.set(hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash,header:candidate});await expect(panel.getByLabel('Retained session instance').locator('..').locator('.choice-option').filter({hasText:'vhPayload101'})).toContainText(`${hash.includes('First')?1:2} candidates`);}
 await inspectRetainedCandidate(panel,'V3SecondCandidate');
 await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');
 await panel.getByRole('button',{name:'Previous observation',exact:true}).click();
 await expect(panel.locator('.candidate-evidence')).toContainText('Observed block hash V3FirstCandidate');
 await expect(panel.getByRole('button',{name:'Previous observation',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Latest',exact:true}).click();
 await expect(panel.locator('.candidate-evidence')).toContainText('Observed block hash V3SecondCandidate');
 await expect(panel.locator('.session-controls')).toContainText('Pinned retained session instance');
});


test('V3 AC-02 actual round progress moves the observed card down for an upward camera and duplicates stay still',async({page})=>{
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0,101,0)]);
 const panel=page.locator('.network-panel.mainnet'),scene=panel.locator('.navigator-junction');
 await expect(panel.locator('.navigator-current')).toContainText('r0');
 await page.evaluate(()=>{
  const scene=document.querySelector('.mainnet .navigator-junction');if(!scene)throw new Error('Scene missing');
  const samples:{direction:string;duration:number;transform:string}[]=[];(window as unknown as {cameraSamples:typeof samples}).cameraSamples=samples;
  new MutationObserver(()=>{const direction=(scene as HTMLElement).dataset.direction;if(direction==='up'||direction==='right')requestAnimationFrame(()=>{const animation=scene.querySelector('.navigator-stage')?.getAnimations()[0];if(animation)samples.push({direction,duration:Number(animation.effect?.getTiming().duration),transform:getComputedStyle(scene.querySelector('.navigator-stage')!).transform});});}).observe(scene,{attributes:true,attributeFilter:['data-direction']});
 });
 await send(page,'mainnet-operations',[vote(1,101,1)]);
 await expect(scene).toHaveAttribute('data-direction','up');await expect(scene).toHaveAttribute('data-camera-x','0');await expect(scene).toHaveAttribute('data-camera-y','-1');
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {cameraSamples:{transform:string}[]}).cameraSamples.length)).toBeGreaterThan(0);
 const samples=await page.evaluate(()=>(window as unknown as {cameraSamples:{direction:string;duration:number;transform:string}[]}).cameraSamples);
 expect(samples.some(sample=>sample.duration===1200&&Number(sample.transform.slice(7,-1).split(',')[5])<0)).toBe(true);
 await expect.poll(()=>scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
 await send(page,'mainnet-operations',[vote(1,101,1)]);await send(page,'mainnet-operations',[vote(2,101,1)]);
 await expect(scene).toHaveAttribute('data-camera-y','-1');await expect(panel.locator('.navigator-current')).toContainText('r1');
 await page.emulateMedia({reducedMotion:'reduce'});await send(page,'mainnet-operations',[vote(3,101,2)]);
 await expect(panel.locator('.navigator-current')).toContainText('r2');expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
});

test('V3 AC-04 dropdown and promoted first hash retain original navigation order',async({page})=>{
 await prepare(page,false);const panel=page.locator('.network-panel.mainnet');
 await send(page,'mainnet-operations',[vote(0)]);await expect(panel.locator('.pre .gauge-counts')).toContainText('600 / 30,000 power');
 const q=vote(1);q.contents[0]!.block_payload_hash='V3Q';await send(page,'mainnet-operations',[q]);
 await openDetails(panel.locator('.observed-proposals'));await expect(panel.locator('.observed-proposals').getByRole('button',{name:'Inspect payload V3Q',exact:true})).toBeVisible();
 const promoted={...head(101),hash:'V3PromotedP'};headers.get(page)!.set(promoted.hash,promoted);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:promoted.hash,header:promoted});
 await expect(panel.locator('.observed-proposals').getByRole('button',{name:'Inspect candidate V3PromotedP',exact:true})).toBeVisible();
 const select=panel.getByLabel('Retained session instance');const qValue=await select.locator('..').locator('.choice-option').filter({hasText:'V3Q'}).getAttribute('data-value');expect(qValue).toBeTruthy();await choose(select,qValue!);
 await expect(panel.locator('.selection-label')).toHaveAttribute('title','V3Q');await panel.getByRole('button',{name:'Previous observation',exact:true}).click();
 await expect(panel.locator('.candidate-evidence')).toContainText('Observed block hash V3PromotedP');await expect(panel.getByRole('button',{name:'Previous observation',exact:true})).toBeDisabled();
 const pValue=await select.locator('..').locator('.choice-option').filter({hasText:'vhPayload101'}).getAttribute('data-value');await choose(select,pValue!);await expect(capturedCandidate(panel,'V3PromotedP')).toHaveAttribute('aria-pressed','true');
});

test('V3 AC-37 proven next level preserves camera Y after high round',async({page})=>{
 await prepare(page,false);await selectNetwork(page,'shadownet');const panel=page.locator('.network-panel.shadownet'),scene=panel.locator('.navigator-junction');
 const candidate={...head(101,118),hash:'V3High118'};headers.get(page)!.set(candidate.hash,candidate);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});
 await expect(panel.locator('.navigator-current')).toContainText('101 · r118');const y=await scene.getAttribute('data-camera-y');
 const next={...head(102,0),hash:'V3Next102',predecessor:candidate.hash};headers.get(page)!.set(next.hash,next);
 await send(page,'shadownet-head',candidate);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:next.hash,header:next});
 await expect(panel.locator('.navigator-current')).toContainText('102 · r0');await expect(scene).toHaveAttribute('data-direction','right');await expect(scene).toHaveAttribute('data-camera-y',y??'0');
 await expect.poll(()=>scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
 const coords=await scene.evaluate(node=>[node.getAttribute('data-camera-x'),node.getAttribute('data-camera-y')]);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:next.hash,header:next});expect(await scene.evaluate(node=>[node.getAttribute('data-camera-x'),node.getAttribute('data-camera-y')])).toEqual(coords);
});

test('V3 AC-09 real hash-pinned metadata attributes block baker independently from payload proposer',async({page},testInfo)=>{
 const protocol='PsUshuai9QapM5TGj1JpuVGkdxz5GykdnEvS6Rh8SUVrARvZLCY',baker='tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',other='tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';
 await prepare(page,false,head(),100,false,false,undefined,undefined,protocol);
 const reads:string[]=[];await page.route('**/blocks/*/metadata',async route=>{reads.push(route.request().url());const hash=new URL(route.request().url()).pathname.split('/blocks/')[1]!.split('/')[0];await route.fulfill({json:{protocol,next_protocol:protocol,baker:hash==='V3ProducerH2'?baker:other,proposer:hash==='V3ProducerH2'?other:baker,level_info:{level:101,level_position:100,cycle:0,cycle_position:100,expected_commitment:false},balance_updates:[],consumed_milligas:'0',deactivated:[]}});});
 const panel=page.locator('.network-panel.mainnet');await send(page,'mainnet-operations',[{...vote(0),contents:[{...vote(0).contents[0],block_payload_hash:'P'}]}]);await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');
 for(const [hash,payload,producer] of [['V3ProducerH1','P',other],['V3ProducerH2','P',baker],['V3ProducerH3','Q',other]] as const){
  const candidate={...head(101),hash,payload_hash:payload};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});await inspectRetainedCandidate(panel,hash);
  await expect(panel.locator('.candidate-evidence')).toContainText(`Block producer / baker ${producer}`);await expect(panel.locator('.candidate-evidence')).toContainText(`metadata requested hash ${hash}`);await expect(panel.locator('.candidate-evidence')).toContainText('metadata source https://rpc.tzkt.io/mainnet');await expect(panel.locator('.candidate-evidence')).toContainText('metadata chain NetFixture');await expect(panel.locator('.pre .gauge-exact')).toHaveText(payload==='P'?'600 / 30,000':'Unavailable');if(hash==='V3ProducerH2')await expect(panel.locator('.candidate-evidence')).toContainText('Shared payload evidence');
 }
 expect(reads).toHaveLength(3);await inspectRetainedCandidate(panel,'V3ProducerH2');await expect(panel.locator('.candidate-evidence')).toContainText(`Block producer / baker ${baker}`);
 await panel.getByRole('button',{name:'Previous observation',exact:true}).click();await expect(panel.locator('.candidate-evidence')).toContainText('V3ProducerH1');await panel.getByRole('button',{name:'Latest',exact:true}).click();await panel.getByRole('button',{name:'Follow live',exact:true}).click();await choose(page.getByLabel('Appearance'),'dark');await page.waitForTimeout(100);expect(reads).toHaveLength(3);
 testInfo.annotations.push({type:'v3-verified',description:'AC-09'});
});

test('V3 AC-01 exact high-round applied and successor votes retain independent identity and paired scales',async({page},testInfo)=>{
 const applied=head(5489251,118),powers=[...Array.from({length:23},()=>279),272,311];await prepare(page,false,applied,applied.level,false,false,{total:7000,quorum:4667,powers});
 const pre=Array.from({length:24},(_,slot)=>vote(slot,5489252,0));const att={hash:'V3ExactAtt',contents:[{kind:'attestations_aggregate',consensus_content:{level:5489252,round:0,block_payload_hash:'vhPayload5489252'},committee:Array.from({length:24},(_,slot)=>({slot}))}]};
 await send(page,'mainnet-operations',[...pre,att]);const panel=page.locator('.network-panel.mainnet');
 await expect(panel.locator('.headline')).toHaveText('Applied block level5,489,251Applied block round118');
 for(const phase of ['pre','att']){await expect(panel.locator(`.${phase} .gauge-counts`)).toContainText('6,689 / 7,000 power');await expect(panel.locator(`.${phase} .gauge-counts`)).toContainText('24 / 25 signers');await expect(panel.locator(`.${phase} .quorum-caption`)).toContainText('4,667 power required');}
 await expect(panel.locator('.selected-title')).toHaveText('5,489,252 / r0');await expect(panel.locator('.navigator-current')).toContainText('Proposal hash unavailable');await expect(panel.locator('.candidate-evidence')).toContainText('Producer unknown');
 await page.evaluate(()=>window.mockStreams['mainnet-head']!.error(new Error('Fixture source interruption')));await expect(panel.locator('.status-chip')).toHaveText('RPC coverage degraded');await expect(panel.locator('.network-notice')).toContainText('Heads connection interrupted');await expect(panel.locator('.network-notice')).not.toContainText('chain stalled');
 testInfo.annotations.push({type:'v3-verified',description:'AC-01'});
});


for(const reader of ['settled','rapid','delayed'] as const)test(reader==='settled'?'V3 AC-13 adjacent burst settles its final right destination without queued motion or reader movement':reader==='rapid'?'V3 AC-13 rapid admission burst preserves the actual final destination':'V3 AC-13 delayed rendering spends the existing animation budget instead of restarting it',async({page},testInfo)=>{
 await prepare(page,false);await selectNetwork(page,'shadownet');const panel=page.locator('.network-panel.shadownet'),scene=panel.locator('.navigator-junction');
 await page.evaluate(async path=>{const {NetworkMonitor}=await import(path),original=NetworkMonitor.prototype.emit;const trace:unknown[]=[];Object.assign(window,{burstDomainTrace:trace});NetworkMonitor.prototype.emit=function(){if(this.options.network==='shadownet')trace.push({at:performance.now(),accepted:this.observations.acceptedTargets(),coherent:this.observations.acceptedTargets().filter((record:ObservationTarget<Derived>)=>record.admission&&!record.contextInvalid&&this.observations.contextAuthorized(record.admission.context)).map((record:ObservationTarget<Derived>)=>record.target.candidate?.header.hash).filter(Boolean),unresolved:this.observations.unresolvedTargets(),snapshot:this.state.snapshot(),progression:this.progression});return original.call(this);};},inspectionModule());
 if(reader==='delayed')await page.evaluate(async path=>{
  const {NetworkMonitor}=await import(path),emit=NetworkMonitor.prototype.emit;let installed=false,held=false;
  NetworkMonitor.prototype.emit=function(){if(this.options.network==='shadownet'&&!installed){installed=true;const update=this.options.onUpdate;this.options.onUpdate=(view:import('../../src/monitor/networkMonitor').NetworkMonitorView<Derived>)=>{
   if(!held&&view.observationTargets.some(record=>record.target.candidate?.header.hash==='Burst102'&&record.admission&&!record.contextInvalid)){held=true;const until=performance.now()+70;while(performance.now()<until){/* Deliberately reproduce synchronous view/render work after acceptance. */}}
   update(view);
  };}return emit.call(this);};
 },inspectionModule());
 const first={...head(101,0),hash:'Burst101R0'},round={...head(101,1),hash:'Burst101R1'},next={...head(102,0),hash:'Burst102',predecessor:round.hash};
 for(const header of [first,round,next])headers.get(page)!.set(header.hash,header);
 await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:first.hash,header:first});await expect(panel.locator('.navigator-current')).toContainText('101 · r0');
 const search=panel.getByPlaceholder('Find participant by alias or address');if(reader==='settled'){await search.focus();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}else await search.evaluate(node=>(node as HTMLElement).focus({preventScroll:true}));await page.evaluate(()=>scrollTo(0,200));if(reader==='settled')await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const scroll=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>{
  const node=document.querySelector('.shadownet .navigator-junction')!,current=node.querySelector('.navigator-current')!,stage=node.querySelector('.navigator-stage')!;
  const frames:{at:number;identity:string;direction:string;animations:number;transform:string;scrollY:number;documentHeight:number;focus:string}[]=[];(window as unknown as {burstFrames:typeof frames}).burstFrames=frames;
  const start=performance.now();const sample=()=>{frames.push({at:performance.now(),identity:current.textContent??'',direction:(node as HTMLElement).dataset.direction??'',animations:node.getAnimations({subtree:true}).length,transform:getComputedStyle(stage).transform,scrollY,documentHeight:document.documentElement.scrollHeight,focus:document.activeElement?.getAttribute('aria-label')??document.activeElement?.tagName??''});if(performance.now()-start<1900)requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:round.hash,header:round});await expect(scene).toHaveAttribute('data-direction','up');
 await send(page,'shadownet-head',round);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:next.hash,header:next});await expect(panel.locator('.navigator-current')).toContainText('102 · r0');await expect(scene).toHaveAttribute('data-direction','right');
 await expect.poll(()=>scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);await page.waitForTimeout(40);
 const frames=await page.evaluate(()=>(window as unknown as {burstFrames:{at:number;identity:string;direction:string;animations:number;transform:string;scrollY:number;documentHeight:number;focus:string}[]}).burstFrames);await testInfo.attach('actual-camera-frame-trace',{body:JSON.stringify(frames),contentType:'application/json'});
 expect(Math.max(...frames.map(frame=>frame.animations))).toBeLessThanOrEqual(1);expect(frames.some(frame=>frame.animations===1)).toBe(true);const final=frames.filter(frame=>frame.identity.includes('102 · r0'));const admissions=await page.evaluate(()=>(window as unknown as {burstDomainTrace:{at:number;coherent:string[]}[]}).burstDomainTrace.flatMap(sample=>sample.coherent.map(hash=>({at:sample.at,hash,coherent:true}))));const measurement=burstSettlement(admissions,final,next.hash);await testInfo.attach('accepted-observation-to-settlement',{body:JSON.stringify(measurement),contentType:'application/json'});expect(measurement.visibleElapsed).toBeGreaterThanOrEqual(1100);expect(measurement.visibleElapsed).toBeLessThanOrEqual(1450);if(reader==='delayed')expect(measurement.visibleStartedAt-measurement.acceptedAt).toBeGreaterThanOrEqual(70);expect(final.filter(frame=>frame.at>=measurement.settledAt).every(frame=>frame.animations===0)).toBe(true);
 await expect(search).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThanOrEqual(1);
 const replacement={...next,hash:'BurstReplacement102'};headers.get(page)!.set(replacement.hash,replacement);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:replacement.hash,header:replacement});await inspectRetainedCandidate(panel,replacement.hash);await expect(scene).toHaveAttribute('data-direction','static');await expect(panel.locator('.navigator-status')).toContainText('Pinned observation · stationary');expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
 const requests=await page.evaluate(()=>window.mockRequests.length);await page.emulateMedia({reducedMotion:'reduce'});expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);
});


for(const storage of ['missing','corrupt','denied'] as const)test(`V3 AC-22 ${storage} storage preserves system mode and explicit session choice`,async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.addInitScript(mode=>{if(mode==='corrupt')localStorage.setItem('observatory:theme','broken-value');else localStorage.removeItem('observatory:theme');if(mode==='denied'){Storage.prototype.getItem=()=>{throw new DOMException('Storage denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('Storage denied','SecurityError');};}},storage);
 await prepare(page,false);const theme=page.getByLabel('Appearance');await expect(theme.locator("..").locator("input:checked" )).toHaveValue('system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await choose(theme,'dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 if(storage==='denied')await expect(page.locator('.theme-notice')).toHaveText('Theme saved for this session only');else await expect(page.locator('.theme-notice')).toBeHidden();
});

test('V3 AC-13 reduced motion enabled during an actual transition cancels immediately and keeps the observed destination',async({page},info)=>{
 await page.addInitScript(()=>{
  const match=window.matchMedia.bind(window),queries:MediaQueryList[]=[];
  window.matchMedia=query=>{const media=match(query);if(query==='(prefers-reduced-motion: reduce)')queries.push(media);return media;};
  Object.assign(window,{reducedMotionQueries:queries});
 });
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0,101,0)]);const panel=page.locator('.network-panel.mainnet'),scene=panel.locator('.navigator-junction');await expect(panel.locator('.navigator-current')).toContainText('101 · r0');
 await send(page,'mainnet-operations',[vote(1,101,1)]);await expect(scene).toHaveAttribute('data-direction','up');
 await scene.evaluate(node=>{
  const state=window as unknown as {reducedMotionQueries:MediaQueryList[];reducedMotionDelivery:{matches:boolean;animations:number;playState:AnimationPlayState;ghosts:number;at:number}[]};
  const panels=[...document.querySelectorAll('.network-panel')],panel=node.closest('.network-panel'),index=panel?panels.indexOf(panel):-1,media=state.reducedMotionQueries[index],animation=node.querySelector('.navigator-stage')?.getAnimations()[0];
  if(state.reducedMotionQueries.length!==panels.length||!media||!animation||animation.playState!=='running')throw new Error('Actual panel media query and active camera are required');
  state.reducedMotionDelivery=[];
  // The renderer registered first: this observer must see cancellation in that same dispatch.
  media.addEventListener('change',event=>state.reducedMotionDelivery.push({matches:event.matches,animations:node.getAnimations({subtree:true}).length,playState:animation.playState,ghosts:node.querySelectorAll('.navigator-motion-card').length,at:performance.now()}));
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {reducedMotionDelivery:unknown[]}).reducedMotionDelivery.length)).toBe(1);
 const delivery=await page.evaluate(()=>(window as unknown as {reducedMotionDelivery:{matches:boolean;animations:number;playState:string;ghosts:number;at:number}[]}).reducedMotionDelivery);await info.attach('reduced-motion-event-delivery',{body:JSON.stringify(delivery),contentType:'application/json'});
 expect(delivery[0]).toMatchObject({matches:true,animations:0,playState:'idle',ghosts:0});expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);await expect(panel.locator('.navigator-status')).toContainText('Reduced motion');await expect(panel.locator('.navigator-current')).toContainText('101 · r1');
 await send(page,'mainnet-operations',[vote(2,101,2)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r2');expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
});


for(const malformed of ['att','pre'] as const)test(`V3 AC-10 independently complete ${malformed==='att'?'pre':'att'} phase keeps measured zero in LIVE and pin`,async({page},info)=>{
 const current=head();await prepare(page,false,current);await page.route('https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header',route=>route.fulfill({json:{...current,chain_id:'NetFixture'}}));
 const bad={hash:'MalformedPhaseOnly',contents:[{kind:malformed==='att'?'attestations_aggregate':'preattestations_aggregate',consensus_content:{level:101,round:0,block_payload_hash:'vhPayload101'},committee:malformed==='att'?[{slot:0},{slot:-1}]:[0,-1]}]};
 await page.route('https://rpc.tzkt.io/mainnet/chains/main/mempool/pending_operations?*',route=>route.fulfill({json:{validated:[bad],refused:[],outdated:[],branch_refused:[],branch_delayed:[],unprocessed:[]}}));
 const candidate={...head(101),hash:'PhaseCoverageProbe'};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});const panel=page.locator('.network-panel.mainnet'),known=malformed==='att'?'pre':'att';
 for(const mode of ['live','pin']){
  if(mode==='pin')await inspectRetainedCandidate(panel,'PhaseCoverageProbe');
  await expect(panel.locator(`.${known} .gauge-exact`)).toHaveText('0 / 30,000');await expect(panel.locator(`.${malformed} .gauge-exact`)).toHaveText('Unavailable');
  await expect(panel.locator(`.${known} .phase-evidence`)).toContainText('Source-snapshot coverage captured');await expect(panel.locator(`.${known} .phase-evidence`)).toContainText('Received');await expect(panel.locator(`.${malformed} .phase-evidence`)).toHaveText('Phase source and receipt unavailable');
  const result={mode,known,pre:await panel.locator('.pre .gauge-exact').textContent(),att:await panel.locator('.att .gauge-exact').textContent(),evidence:await panel.locator('.network-notice').textContent()};await info.attach(`phase-coverage-${mode}`,{body:JSON.stringify(result),contentType:'application/json'});
  const row=panel.locator('.committee-evidence tbody tr').first();await expect(row).toContainText('Absent in selected source snapshot');await expect(row).toContainText('Partial / unavailable');
 }
});


test('V3 AC-23 native disclosure radio groups support keyboard selection focus and stable data controls',async({page})=>{
 await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);
 const panel=page.locator('.network-panel.mainnet'),appearance=page.getByLabel('Appearance'),root=appearance.locator('..');
 await expect(page.locator('select')).toHaveCount(0);
 await expect(page.getByLabel('Colour palette',{exact:true})).toHaveText('Graphite & pollen');
 await appearance.focus();await page.keyboard.press('Enter');await expect(root).toHaveAttribute('open','');
 await page.keyboard.press('Tab');await expect(root.locator('input[value="system"]')).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(root.locator('input[value="light"]')).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.keyboard.press('ArrowDown');await expect(root.locator('input[value="dark"]')).toBeFocused();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.keyboard.press('Escape');await expect(root).not.toHaveAttribute('open','');await expect(appearance).toBeFocused();
 await page.keyboard.press('Space');await expect(root).toHaveAttribute('open','');await page.keyboard.press('Escape');
 const query=panel.getByRole('searchbox',{name:'Search committee alias or address'});await query.fill('Baker');
 const filter=panel.getByLabel('Committee phase receipt filter'),group=filter.locator('..');await filter.focus();await page.keyboard.press('Enter');await expect(group).toHaveAttribute('open','');await page.keyboard.press('Tab');
 await expect(group.locator('input[value="all"]')).toBeFocused();await page.keyboard.press('ArrowDown');await expect(group.locator('input[value="pre:received"]')).toBeChecked();
 await page.keyboard.press('Escape');await expect(filter).toBeFocused();await expect(query).toHaveValue('Baker');
 await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');
 await filter.press('Enter');await appearance.click();await expect(group).not.toHaveAttribute('open','');await page.keyboard.press('Escape');
});

test.afterEach(async({},info)=>annotateV3(info));


test('V3 AC-15 early pin aborts unresolved timing and never invents historical capture after a late body',async({page})=>{
 await prepare(page,false);const panel=page.locator('.network-panel.mainnet');
 await page.evaluate(()=>{const original=window.fetch.bind(window),gate={waiting:false,signal:undefined as AbortSignal|null|undefined,release:()=>{}};Object.assign(window,{earlyTimingGate:gate});window.fetch=async(input,options)=>{const response=await original(input,options),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.pathname.endsWith('/EarlyTiming101/context/constants')){const body=await response.json();gate.signal=options?.signal;response.json=()=>new Promise(resolve=>{gate.waiting=true;gate.release=()=>resolve(body);});}return response;};});
 const candidate={...head(101),hash:'EarlyTiming101'};headers.get(page)?.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {earlyTimingGate:{waiting:boolean}}).earlyTimingGate.waiting)).toBe(true);
 await inspectRetainedCandidate(panel,'EarlyTiming101');expect(await page.evaluate(()=>(window as unknown as {earlyTimingGate:{signal?:AbortSignal}}).earlyTimingGate.signal?.aborted)).toBe(true);
 const rows=panel.locator('.baker-opportunity');await expect(rows.first()).toContainText('Historical timing and rights not captured');const captured=await rows.allTextContents();
 await page.evaluate(()=>(window as unknown as {earlyTimingGate:{release:()=>void}}).earlyTimingGate.release());await send(page,'mainnet-operations',[vote(0)]);await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');expect(await rows.allTextContents()).toEqual(captured);
 await expect(panel.locator('.session-mode')).toContainText('Pinned');await expect(panel.locator('.candidate-evidence')).toContainText('EarlyTiming101');
});

test.afterEach(async({page},info)=>attachFailureTrace(page,info));

test('V3 AC-23 status narration ignores ticks votes and replays while naming actual mode and progress once',async({page},info)=>{
 await page.clock.install();await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);const panel=page.locator('.network-panel.mainnet');await expect(panel.locator('.navigator-current')).toContainText('101 · r0');
 await page.evaluate(()=>{const status=document.querySelector('[role=status][aria-live=polite]');if(!status)throw new Error('Missing native live status');const messages:string[]=[];Object.assign(window,{statusMessages:messages});new MutationObserver(()=>messages.push(status.textContent??'')).observe(status,{childList:true,subtree:true,characterData:true});});
 await send(page,'mainnet-operations',[vote(0),vote(1)]);await page.clock.runFor(1000);expect(await page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages)).toEqual([]);
 const pin=panel.getByRole('button',{name:'Pin selected instance',exact:true});await pin.focus();await page.keyboard.press('Enter');await expect(panel.locator('.session-mode')).toContainText('Pinned');await expect.poll(()=>page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages.length)).toBe(1);await expect(page.locator('[role=status][aria-live=polite]')).toContainText('Pinned');
 await choose(page.getByLabel('Appearance'),'dark');await send(page,'mainnet-operations',[vote(1),vote(2)]);await page.clock.runFor(1000);expect(await page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages.length)).toBe(1);
 const follow=panel.getByRole('button',{name:'Follow live',exact:true});await follow.focus();await page.keyboard.press('Space');await expect(panel.locator('.session-mode')).toContainText('Following live');await expect.poll(()=>page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages.length)).toBe(2);
 await send(page,'mainnet-operations',[vote(0,101,1)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r1');await expect.poll(()=>page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages.length)).toBe(3);await expect(page.locator('[role=status][aria-live=polite]')).toContainText('round 1');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();const requests=await page.evaluate(()=>window.mockRequests.length);await choose(page.getByLabel('Appearance'),'light');await panel.getByRole('button',{name:'Latest',exact:true}).click();await panel.getByRole('button',{name:'Follow live',exact:true}).click();await page.clock.runFor(1000);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);
 await info.attach('actual-status-announcements',{body:JSON.stringify(await page.evaluate(()=>(window as unknown as {statusMessages:string[]}).statusMessages)),contentType:'application/json'});
});


test('V3 AC-23 keyboard alone reaches candidate history navigation disclosures and explicit comparison',async({page},info)=>{
 await prepare(page,false);const panel=page.locator('.network-panel.mainnet');
 for(const hash of ['KeyboardFirst101','KeyboardSecond101']){const candidate={...head(101),hash};headers.get(page)?.set(hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash,header:candidate});await expect(panel.getByLabel('Retained session instance').locator('..').locator('.choice-option').filter({hasText:'vhPayload101'})).toContainText(`${hash.includes('First')?1:2} candidates`);}
 const visited:string[]=[];
 const reach=async(target:import('@playwright/test').Locator)=>{for(let count=0;count<250;count++){if(await target.evaluate(node=>node===document.activeElement)){await expect(target).toBeFocused();return;}const key=await target.evaluate(node=>document.activeElement&&(document.activeElement.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_PRECEDING)?'Shift+Tab':'Tab');await page.keyboard.press(key);visited.push(key+': '+await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim().slice(0,80)??''));}await info.attach('unreachable-keyboard-target',{body:JSON.stringify({target:await target.evaluate(node=>node.outerHTML),visited}),contentType:'application/json'});throw new Error('Keyboard target unreachable within bounded complete tab journey');};
 const activate=async(target:import('@playwright/test').Locator,key='Enter')=>{await reach(target);await page.keyboard.press(key);};
 await activate(panel.getByRole('button',{name:/^Inspect retained instance .*vhPayload101/}));await activate(panel.getByText('Selected identity & phase provenance',{exact:true}));await activate(panel.locator('.captured-candidates > summary'));await activate(capturedCandidate(panel,'KeyboardSecond101'));await expect(panel.locator('.session-mode')).toContainText('Pinned');
 await activate(panel.getByRole('button',{name:'Previous observation',exact:true}),'Space');await expect(panel.locator('.candidate-evidence')).toContainText('KeyboardFirst101');
 await activate(panel.getByRole('button',{name:'Latest',exact:true}));await expect(panel.locator('.candidate-evidence')).toContainText('KeyboardSecond101');
 await activate(panel.getByRole('button',{name:'Follow live',exact:true}));await expect(panel.locator('.session-mode')).toContainText('Following live');
 await send(page,'mainnet-operations',[vote(0,101,1)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r1');
 const history=panel.getByLabel('Retained session instance');await activate(history);await page.keyboard.press('Tab');await page.keyboard.press('ArrowDown');await expect(panel.locator('.session-mode')).toContainText('Pinned');await page.keyboard.press('Escape');await expect(history).toBeFocused();
 const disclosure=panel.locator('[data-branch="same-level"] summary');await activate(disclosure);await expect(disclosure.locator('..')).toHaveAttribute('open','');await page.keyboard.press('Space');await expect(disclosure.locator('..')).not.toHaveAttribute('open','');
 const provider=panel.getByLabel('Comparison provider');await activate(provider);await page.keyboard.press('Tab');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
 const before=await page.evaluate(()=>window.mockRequests.length);await activate(panel.getByRole('button',{name:'Compare selected observation',exact:true}),'Space');await expect.poll(()=>page.evaluate(()=>window.mockRequests.length)).toBeGreaterThan(before);await expect(panel.locator('.comparison-result')).not.toHaveText('');
 await info.attach('keyboard-native-task-journey',{body:JSON.stringify({visited,selected:await panel.locator('.navigator-current').textContent(),comparison:await panel.locator('.comparison-result').textContent()}),contentType:'application/json'});
});


test('V3 AC-01 applied tuple votes and unchanged-head age never imply next-level progress',async({page},info)=>{
 test.setTimeout(240000);
 await page.clock.install();const initial=head(100,209);await prepare(page,false,initial);await selectNetwork(page,'shadownet');await send(page,'shadownet-operations',[vote(0,100,209)]);const panel=page.locator('.network-panel.shadownet');
 await expect(panel.locator('.selected-title')).toHaveText('100 / r209');await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');
 await expect(panel.locator('.selected-relationship')).toContainText('already-applied');await expect(panel.locator('.next-proposal-observation')).toContainText('No coherent next-level proposal observed');
 const age=panel.locator('.applied-stability');await expect(age).toContainText('unchanged in this session');const before=await age.getAttribute('data-since');expect(before).not.toBeNull();
 await page.clock.runFor(10000);await send(page,'shadownet-head',initial);await expect(age).toHaveAttribute('data-since',before??'');await expect(age).toContainText('10s');await expect(panel.locator('.navigator-current')).toContainText('100 · r209');
 const fork={...initial,hash:'SameTupleDifferentBlock100'};headers.get(page)?.set(fork.hash,fork);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:fork.hash,header:fork});await inspectRetainedCandidate(panel,'SameTupleDifferentBlock100');await expect(panel.locator('.selected-relationship')).toContainText('selected block hash differs');
 const next={...head(101),hash:'NextObserved101'};next.fitness[3]=(0xffffffff-209).toString(16).padStart(8,'0');headers.get(page)?.set(next.hash,next);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash:next.hash,header:next});await panel.getByRole('button',{name:'Follow live',exact:true}).click();await expect(panel.locator('.selected-relationship')).toContainText('next level');await expect(panel.locator('.next-proposal-observation')).toContainText('Coherent next-level proposal observed');
 await send(page,'shadownet-head',next);await expect(age).not.toHaveAttribute('data-since',before??'');await expect(panel.locator('.applied-context')).toContainText('level 101');await send(page,'shadownet-operations',[vote(1,101,0)]);await expect(panel.locator('.selected-relationship')).toContainText('already-applied');
 const nextSince=await age.getAttribute('data-since');await page.clock.runFor(5000);const returnedFork={...next,hash:'NextObservedFork101'};await send(page,'shadownet-head',returnedFork);await expect.poll(async()=>Number(await age.getAttribute('data-since'))).toBeGreaterThan(Number(nextSince));const forkSince=await age.getAttribute('data-since');await page.clock.runFor(7000);await send(page,'shadownet-head',next);await expect.poll(async()=>Number(await age.getAttribute('data-since'))).toBeGreaterThan(Number(forkSince));const returnedSince=await age.getAttribute('data-since');expect(Number(returnedSince)).toBeGreaterThan(Number(nextSince));await page.clock.runFor(3000);await send(page,'shadownet-head',next);await expect(age).toHaveAttribute('data-since',returnedSince??'');
 await info.attach('applied-tuple-material-progress',{body:JSON.stringify({initialSince:before,finalSince:await age.getAttribute('data-since'),relationship:await panel.locator('.selected-relationship').textContent(),next:await panel.locator('.next-proposal-observation').textContent()}),contentType:'application/json'});
});


test('V3 AC-01 phase receipts remain distinct through staggered arrival replay and retained pin',async({page},info)=>{
 await page.clock.install({time:new Date('2026-10-15T12:00:30Z')});await prepare(page,false,head(100));
 const panel=page.locator('.network-panel.mainnet');await send(page,'mainnet-operations',[vote(0)]);
 await expect(panel.locator('.pre .gauge-exact')).toHaveText('600 / 30,000');
 const pre=panel.locator('.pre .phase-evidence'),att=panel.locator('.att .phase-evidence');
 await expect(pre).toContainText('Received');const first=await pre.getAttribute('data-received');
 await page.clock.runFor(5000);const packet={...vote(1),hash:'phase-receipt-later-att',contents:[{...vote(1).contents[0],kind:'attestation'}]};
 await send(page,'mainnet-operations',[packet]);await expect(panel.locator('.att .gauge-exact')).toHaveText('600 / 30,000');
 await expect(att).toContainText('Received');const second=await att.getAttribute('data-received');
 expect(Date.parse(second??'')-Date.parse(first??'')).toBeGreaterThanOrEqual(5000);
 for(const node of [pre,att]){await expect(node).toContainText('Observer https://rpc.tzkt.io/mainnet');await expect(node).toContainText('Chain NetFixture');await expect(node).toContainText('Rights responder');await expect(node).toContainText('Context head');}
 await page.clock.runFor(2000);await send(page,'mainnet-operations',[packet]);await expect(att).toHaveAttribute('data-received',second??'');await expect(pre).toHaveAttribute('data-received',first??'');
 await panel.getByText('Preattestations source & receipt',{exact:true}).click();await panel.getByText('Attestations source & receipt',{exact:true}).click();
 const age=async(phase:string)=>Number((await panel.locator(`.${phase} .phase-age`).innerText()).match(/(\d+)s/)?.[1]);expect(await age('att')).toBeGreaterThanOrEqual(2);expect((await age('pre'))-(await age('att'))).toBeGreaterThanOrEqual(5);
 await panel.getByRole('button',{name:'Pin selected instance',exact:true}).click();
 await expect(att).toHaveAttribute('data-received',second??'');await expect(pre).toHaveAttribute('data-received',first??'');
 await expect(att).toContainText('Historical as-of');await expect(pre).toContainText('Historical as-of');
 for(let index=0;index<151;index++){const candidate={...head(101),hash:`PhaseFreeze${index}`,payload_hash:`PhasePayload${index}`};headers.get(page)!.set(candidate.hash,candidate);await send(page,'mainnet-proposals',{chain_id:'NetFixture',hash:candidate.hash,header:candidate});}
 await expect(panel.locator('.session-controls')).toContainText('Pinned frozen snapshot');
 await expect(att).toHaveAttribute('data-received',second??'');await expect(pre).toHaveAttribute('data-received',first??'');

 await info.attach('phase-receipts',{body:JSON.stringify({first,second,pre:await pre.textContent(),att:await att.textContent()}),contentType:'application/json'});
});


for(const width of [390,1440,3440])test(`Postdeploy stable equal navigator slots at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await prepare(page,false);
 const panel=page.locator('.network-panel.mainnet'),scene=panel.locator('.navigator-junction');
 const geometry=()=>scene.evaluate(node=>({frame:{width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height},slots:[...node.querySelectorAll('.navigator-previous,.navigator-current,.baker-opportunity')].map(slot=>({width:slot.getBoundingClientRect().width,height:slot.getBoundingClientRect().height})),bottom:node.getBoundingClientRect().bottom+scrollY,regionBottom:node.closest('.opportunities')!.getBoundingClientRect().bottom+scrollY}));
 const before=await geometry();
 for(const theme of ['light','dark']){await choose(page.getByLabel('Appearance'),theme);await send(page,'mainnet-operations',[vote(theme==='light'?0:1,101,0)]);await expect(panel.locator('.navigator-current')).toContainText('101 · r0');
  const after=await geometry();await info.attach(`slot-geometry-${theme}`,{body:JSON.stringify({before,after}),contentType:'application/json'});
  expect(after.slots).toHaveLength(4);for(const slot of after.slots){expect(Math.abs(slot.width-after.slots[0]!.width)).toBeLessThan(1);expect(Math.abs(slot.height-after.slots[0]!.height)).toBeLessThan(1);}
  expect(after.frame).toEqual(before.frame);expect(Math.abs(after.bottom-before.bottom)).toBeLessThan(1);expect(Math.abs(after.regionBottom-before.regionBottom)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await panel.locator('.baker-opportunity').first().locator('summary').click();expect((await geometry()).frame).toEqual(before.frame);await panel.locator('.baker-opportunity').first().locator('summary').click();
  await scene.screenshot({path:info.outputPath(`equal-slots-${theme}.png`)});
 }
});

// CDP touch input exercises native browser scrolling, unlike dispatchEvent pointer fixtures.
test('mobile timeline lets vertical touch swipes scroll the page and horizontal swipes pan history',async({page,browserName})=>{
 if(browserName!=='chromium'){await prepare(page,false);test.skip(true,'Native touch injection uses Chromium CDP');}
 await page.setViewportSize({width:390,height:844});
 const context=page.context();
 const touchClient=await context.newCDPSession(page);
 await touchClient.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 try{
  await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);
  const scene=page.locator('.network-panel.mainnet .navigator-junction');
  await expect(scene).toHaveAttribute('data-camera-following','true');
  await scene.evaluate(element=>window.scrollTo(0,window.scrollY+element.getBoundingClientRect().top-80));
  const box=await scene.boundingBox();if(!box)throw new Error('Timeline frame missing');
  const client=await context.newCDPSession(page);
  const settleScroll=()=>page.evaluate(()=>new Promise<void>(resolve=>{let last=window.scrollY,stable=0;const sample=()=>{const next=window.scrollY;stable=next===last?stable+1:0;last=next;if(stable>=10)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);}));
  const swipe=async(x:number,y:number,dx:number,dy:number)=>{
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=12;step++){
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/12,y:y+dy*step/12}]});
    await new Promise(resolve=>setTimeout(resolve,16));
   }
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await scene.locator('.navigator-current').evaluate(element=>{element.scrollTop=element.scrollHeight;});
  const requests=await page.evaluate(()=>window.mockRequests.length);
  const before=await page.evaluate(()=>window.scrollY),camera=await scene.getAttribute('data-view-y'),cameraX=await scene.getAttribute('data-view-x');
  await swipe(box.x+box.width/2,box.y+box.height/2,0,-160);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(before+80);
  await expect(scene).toHaveAttribute('data-camera-following','true');
  await expect(scene).toHaveAttribute('data-view-y',camera??'');
  await expect(scene).toHaveAttribute('data-view-x',cameraX??'');
  await settleScroll();
  // Start the reverse gesture within the frame after the page has moved.
  const reverse=await scene.boundingBox();if(!reverse)throw new Error('Timeline frame missing after scrolling');
  await scene.locator('.navigator-current').evaluate(element=>{element.scrollTop=0;});
  const downStart=await page.evaluate(()=>window.scrollY);
  await swipe(reverse.x+reverse.width/2,Math.max(100,reverse.y+reverse.height/2),0,160);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(downStart-80);
  await expect(scene).toHaveAttribute('data-camera-following','true');
  await expect(scene).toHaveAttribute('data-view-y',camera??'');
  await expect(scene).toHaveAttribute('data-view-x',cameraX??'');
  await settleScroll();
  const horizontal=await scene.boundingBox();if(!horizontal)throw new Error('Timeline frame missing for panning');
  const viewX=Number(await scene.getAttribute('data-view-x')),viewY=await scene.getAttribute('data-view-y');
  const horizontalY=await scene.evaluate(element=>{const style=getComputedStyle(element);return element.getBoundingClientRect().top+parseFloat(style.gridTemplateRows.split(' ')[0]??'0')+parseFloat(style.rowGap)/2;});
  const scrollBeforeHorizontal=await page.evaluate(()=>window.scrollY);
  await swipe(horizontal.x+horizontal.width*.8,horizontalY,-140,0);
  await expect(scene).toHaveAttribute('data-camera-following','false');
  await expect.poll(async()=>Number(await scene.getAttribute('data-view-x'))).toBeGreaterThan(viewX);
  await expect(scene).toHaveAttribute('data-view-y',viewY??'');
  expect(await page.evaluate(()=>window.scrollY)).toBe(scrollBeforeHorizontal);
  const down=page.getByRole('button',{name:'Pan path down',exact:true});await down.click();
  await expect.poll(async()=>Number(await scene.getAttribute('data-view-y'))).toBeGreaterThan(Number(viewY));
  await page.getByRole('button',{name:'Return to live',exact:true}).click();
  await expect(scene).toHaveAttribute('data-camera-following','true');
  await scene.scrollIntoViewIfNeeded();
  const cardText=scene.locator('.navigator-current > .eyebrow');const textBox=await cardText.boundingBox();if(!textBox)throw new Error('Missing card text touch target');
  const stepX=await scene.evaluate(element=>{const card=element.querySelector('.navigator-current');if(!card)throw new Error('Missing current card');return card.getBoundingClientRect().width+parseFloat(getComputedStyle(element).columnGap);});
  await swipe(textBox.x+textBox.width*.8,textBox.y+textBox.height/2,-60,0);
  await expect(scene).toHaveAttribute('data-camera-following','false');
  expect(Number(await scene.getAttribute('data-view-x'))).toBeGreaterThan(Number(cameraX)+45/stepX);
  await page.getByRole('button',{name:'Return to live',exact:true}).click();
  const mouseBox=await scene.boundingBox();if(!mouseBox)throw new Error('Missing mouse frame');
  const mouseY=await scene.evaluate(element=>{const style=getComputedStyle(element);return element.getBoundingClientRect().top+parseFloat(style.gridTemplateRows.split(' ')[0]??'0')+parseFloat(style.rowGap)/2;});
  await page.mouse.move(mouseBox.x+mouseBox.width*.7,mouseY);await page.mouse.down();await page.mouse.move(mouseBox.x+mouseBox.width*.4,mouseY-40,{steps:6});await page.mouse.up();
  await expect(scene).toHaveAttribute('data-camera-following','false');
  expect(Number(await scene.getAttribute('data-view-x'))).toBeGreaterThan(Number(cameraX));
  expect(Number(await scene.getAttribute('data-view-y'))).toBeGreaterThan(Number(camera));
  expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);
  await client.detach();
 }finally{await touchClient.detach();}
});
