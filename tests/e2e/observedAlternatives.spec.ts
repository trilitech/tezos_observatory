import {expect,test} from '@playwright/test';
import {head,prepare,selectNetwork,send,vote,headers,inspectionModule,choose} from './productionFixture';

test('qualified competing observations retain separate hashes and phase facts without collection or layout changes',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});await prepare(page,false,head(),100,false,false,{total:5,quorum:4,powers:[1,1,1,1,1]});await selectNetwork(page,'shadownet');
 const panel=page.locator('.network-panel.shadownet'),scene=panel.locator('.navigator-junction');
 for(const [hash,payload] of [['ObservedChoiceA','ChoicePayloadA'],['ObservedChoiceB','ChoicePayloadB'],['ObservedChoiceC','ChoicePayloadA']]){const candidate={...head(101),hash:hash!,payload_hash:payload!};headers.get(page)!.set(hash!,candidate);await send(page,'shadownet-proposals',{chain_id:'NetFixture',hash,header:candidate});}
 const packet=(slot:number,payload:string,kind='preattestation')=>({...vote(slot),hash:`${payload}-${kind}-${slot}`,contents:[{...vote(slot).contents[0]!,block_payload_hash:payload,kind}]});
 await send(page,'shadownet-operations',[packet(0,'ChoicePayloadA'),packet(1,'ChoicePayloadA'),packet(2,'ChoicePayloadA'),packet(3,'ChoicePayloadB','attestation')]);
 await expect(panel.locator('.pre .gauge-exact')).toHaveText('3 / 5');
 const badge=panel.getByRole('button',{name:'Inspect observed alternatives for level 101 round 0',exact:true}).first();await expect(badge).toBeEnabled();
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
 const requests=await page.evaluate(()=>window.mockRequests.length);let frame=await scene.boundingBox();
 await badge.click();const dialog=panel.getByRole('dialog',{name:'Retained observed proposals'});await expect(dialog).toBeVisible();
 for(const hash of ['ObservedChoiceA','ObservedChoiceB','ObservedChoiceC'])await expect(dialog.locator('.path-observation').filter({hasText:hash})).toHaveCount(1);
 const a=dialog.locator('.path-observation').filter({hasText:'ObservedChoiceA'}),b=dialog.locator('.path-observation').filter({hasText:'ObservedChoiceB'}),c=dialog.locator('.path-observation').filter({hasText:'ObservedChoiceC'});
 await expect(a).toContainText('pre 3/5');await expect(c).toContainText('pre 3/5');await expect(b).toContainText('pre unknown · att 1/5');await expect(dialog).toContainText('not a canonical-chain or uncle claim');
 for(const theme of ['light','dark'] as const){await page.emulateMedia({colorScheme:theme});await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await dialog.screenshot({path:info.outputPath(`observed-alternatives-${theme}.png`)});}
 await dialog.getByRole('button',{name:'Close observed proposals',exact:true}).click();await expect(badge).toBeFocused();
 const select=panel.getByLabel('History length',{exact:true});await select.scrollIntoViewIfNeeded();frame=await scene.boundingBox();expect(await select.locator('..').locator('input[type=radio]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value))).toEqual(['25','50','100','250','500','1000','unlimited']);await expect(select).toHaveText('500');
 await choose(select,'25');await expect(page.locator('.network-panel.mainnet').getByLabel('History length',{exact:true})).toHaveText('25');expect(await page.evaluate(()=>localStorage.getItem('observatory:path-length'))).toBe('25');
 await choose(select,'unlimited');await expect(panel.locator('.path-camera-status')).toContainText('unlimited (memory grows)');expect(await scene.boundingBox()).toEqual(frame);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);
 await scene.screenshot({path:info.outputPath('observed-alternatives.png')});
});

test('UI boundary: history selection bounds all rivals, paginates locally, survives reload and handles unavailable storage',async({page})=>{
 await page.setViewportSize({width:1440,height:1200});await page.emulateMedia({reducedMotion:'reduce'});await prepare(page,false);await page.getByRole('button',{name:'Pause',exact:true}).click();const requests=await page.evaluate(()=>window.mockRequests.length);
 await page.evaluate(async module=>{
  const {createDashboard}=await import(module);document.querySelector<HTMLElement>('.consensus-app')!.hidden=true;
  const root=document.createElement('div');root.id='alternatives-boundary';document.body.append(root);const callbacks:string[]=[],called=()=>{callbacks.push('authority callback');};
  const view=createDashboard(root,{onSelect:called,onPin:called,onFollow:called,onLatest:called,onNetworkChange:called,onReconnect:called,onRetry:called});
  const anchor:import('../../src/dashboardView').ObservedNavigatorView={identity:'current',source:'https://observer',chain:'Net',protocol:'P',contextHead:'B100',contextParent:'B100',level:101,round:0,hash:'BoundaryCurrent',payload:'CurrentPayload',coherent:true,receivedAt:Date.now(),receivedMonotonic:100};
  const observations=Array.from({length:39},(_,index)=>({anchor:{...anchor,identity:`rival${index}`,hash:`BoundaryRival${index}`,payload:`RivalPayload${index}`,receivedMonotonic:101+index},pre:{power:index%5,total:5}}));
  const model:import('../../src/dashboardView').NetworkViewModel={status:'healthy',observation:anchor,pathObservations:observations,session:{mode:'follow',frozen:false,newer:0,newerPartial:false,canPin:true,accepted:40,unresolved:0,raw:0,instances:[]}};view.update('mainnet',model);Object.assign(window,{alternativesBoundary:{view,model,callbacks}});
 },inspectionModule());
 const root=page.locator('#alternatives-boundary'),panel=root.locator('.network-panel.mainnet'),scene=panel.locator('.navigator-junction'),select=panel.getByLabel('History length',{exact:true});
 await expect(panel.locator('.path-camera-status')).toContainText('40/500 observed proposals');await select.scrollIntoViewIfNeeded();const frame=await scene.boundingBox();
 await choose(select,'25');await expect(panel.locator('.path-camera-status')).toContainText('25/25 observed proposals');await expect(panel.locator('.navigator-current')).toContainText('BoundaryC');await expect(panel.locator('.navigator-path-card')).toHaveCount(0);
 await panel.getByRole('button',{name:'Inspect retained proposals',exact:true}).click();const dialog=panel.getByRole('dialog');await expect(dialog.locator('.path-observation')).toHaveCount(10);await dialog.getByRole('button',{name:'Next page',exact:true}).click();await expect(dialog.locator('.path-observation')).toHaveCount(10);await dialog.getByRole('button',{name:'Next page',exact:true}).click();await expect(dialog.locator('.path-observation')).toHaveCount(5);await expect(dialog).toContainText('BoundaryCurrent');await dialog.getByRole('button',{name:'Close observed proposals',exact:true}).click();
 for(const value of ['1000','unlimited']){await choose(select,value);await expect(panel.locator('.path-camera-status')).toContainText('25');}
 await choose(select,'250');expect(await scene.boundingBox()).toEqual(frame);
 await page.evaluate(()=>{const state=(window as unknown as {alternativesBoundary:{view:{update:(network:'mainnet',model:import('../../src/dashboardView').NetworkViewModel)=>void};model:import('../../src/dashboardView').NetworkViewModel}}).alternativesBoundary;state.view.update('mainnet',{...state.model,navigatorDiscontinuity:'same-scope-reorg',observation:{...state.model.observation!,identity:'reorg-current',hash:'ReorgCurrent',receivedMonotonic:200},pathObservations:[]});});
 await expect(panel.locator('.path-camera-status')).toContainText('26/250 observed proposals');await panel.getByRole('button',{name:'Inspect retained proposals',exact:true}).click();await expect(dialog.locator('.path-observation').filter({hasText:'ReorgCurrent'})).toHaveCount(1);await expect(dialog.locator('.path-observation')).toHaveCount(10);await dialog.getByRole('button',{name:'Close observed proposals',exact:true}).click();expect(await scene.boundingBox()).toEqual(frame);
 await page.evaluate(async module=>{const {createDashboard}=await import(module),root=document.createElement('div');root.id='history-reloaded';document.body.append(root);createDashboard(root);},inspectionModule());await expect(page.locator('#history-reloaded .network-panel.mainnet').getByLabel('History length',{exact:true})).toHaveText('250');
 await page.evaluate(async module=>{const {createDashboard}=await import(module);Object.defineProperties(Storage.prototype,{getItem:{configurable:true,value:()=>{throw new Error('Storage blocked');}},setItem:{configurable:true,value:()=>{throw new Error('Storage blocked');}}});const root=document.createElement('div');root.id='storage-blocked';document.body.append(root);createDashboard(root);},inspectionModule());const fallback=page.locator('#storage-blocked .network-panel.mainnet').getByLabel('History length',{exact:true});await expect(fallback).toHaveText('500');await choose(fallback,'50');await expect(fallback).toHaveText('50');
 expect(await page.evaluate(()=>(window as unknown as {alternativesBoundary:{callbacks:string[]}}).alternativesBoundary.callbacks)).toEqual([]);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);
});
