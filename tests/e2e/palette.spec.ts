import {expect,test} from '@playwright/test';
import {prepare,choose} from './productionFixture';

test('palette defaults to pollen, persists, and preserves the explicit appearance preference',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('observatory:theme','light'));
 await prepare(page,false);
 await expect(page.locator('html')).toHaveAttribute('data-palette','pollen');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByLabel('Appearance',{exact:true}).click();
 const palette=page.getByLabel('Colour palette',{exact:true});
 await expect(palette).toHaveText('Graphite & pollen');
 await choose(palette,'cinabre');
 await expect(page.locator('html')).toHaveAttribute('data-palette','cinabre');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-palette','cinabre');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await choose(page.getByLabel('Appearance',{exact:true}),'dark');
 await expect(page.locator('html')).toHaveAttribute('data-palette','cinabre');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('observatory:palette'))).toBe('cinabre');
});

for(const storage of ['unknown','denied'] as const)test(`palette fallback remains usable with ${storage} storage`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(mode=>{localStorage.setItem('observatory:palette','unknown-palette');if(mode==='denied'){Storage.prototype.getItem=()=>{throw new DOMException('Storage denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('Storage denied','SecurityError');};}},storage);
 await prepare(page,false);
 await expect(page.locator('html')).toHaveAttribute('data-palette','pollen');
 await page.getByLabel('Appearance',{exact:true}).click();
 await choose(page.getByLabel('Colour palette',{exact:true}),'braise');
 await expect(page.locator('html')).toHaveAttribute('data-palette','braise');
 if(storage==='denied')await expect(page.locator('.palette-notice')).toBeVisible();
 expect(errors).toEqual([]);
});

test('palette roles retain readable contrast and stable responsive layout in both appearances',async({page},info)=>{
 await prepare(page,false);
 const luminance=(hex:string)=>{const c=hex.match(/[\da-f]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]!*.2126+c[1]!*.7152+c[2]!*.0722;};
 const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const width of [390,1440,3440])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:1000});await choose(page.getByLabel('Appearance',{exact:true}),mode);
  for(const id of ['pollen','braise','cinabre','ocre','reference']){
   const appearance=page.getByLabel('Appearance',{exact:true});
   if(!await appearance.locator('..').evaluate(node=>(node as HTMLDetailsElement).open))await appearance.click();
   await choose(page.getByLabel('Colour palette',{exact:true}),id);
   const values=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {overflow:document.documentElement.scrollWidth>innerWidth,tokens:Object.fromEntries(['paper','surface','ink','muted','selected','forest','copper','pre','att','bad','focus','line'].map(k=>[k,s.getPropertyValue('--'+k).trim()]))};});
   expect(values.overflow,`${id}/${mode}/${width}`).toBe(false);
   for(const bg of ['paper','surface','selected'])for(const fg of ['ink','muted'])expect(contrast(values.tokens[fg]!,values.tokens[bg]!),`${id}/${mode}/${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
   for(const fg of ['forest','copper','pre','att','bad','focus','line'])expect(contrast(values.tokens[fg]!,values.tokens.surface!),`${id}/${mode}/${fg}`).toBeGreaterThanOrEqual(fg==='line'?3:4.5);
  }
  if(width!==3440){await choose(page.getByLabel('Colour palette',{exact:true}),'pollen');await page.getByLabel('Appearance',{exact:true}).click();await page.screenshot({path:info.outputPath(`pollen-${width}-${mode}.png`),fullPage:true});}
 }
});

for(const width of [390,1440])test(`palette and history choices preserve keyboard focus, theme ownership and anchored layout at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{localStorage.setItem('observatory:theme','light');const writes:string[]=[];Object.assign(window,{preferenceWrites:writes});const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){writes.push(key);return original.call(this,key,value);};});
 await prepare(page,false);await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('.mainnet .status-chip')).toHaveText('Paused');
 const requests=await page.evaluate(()=>window.mockRequests.length),geometry=()=>page.evaluate(()=>({scroll:scrollY,regions:['.masthead','.network-tabs','.mainnet .navigator-junction','.mainnet .selected-inspector'].map(selector=>{const node=document.querySelector(selector);if(!node)throw new Error('Anchored region missing');const rect=node.getBoundingClientRect();return {selector,x:rect.x,y:rect.y,width:rect.width,height:rect.height};})}));
 const writesBefore=await page.evaluate(()=>(window as unknown as {preferenceWrites:string[]}).preferenceWrites.length);
 const initial=await geometry(),appearance=page.getByLabel('Appearance',{exact:true}),palette=page.getByLabel('Colour palette',{exact:true});
 await appearance.click();await palette.click();const braise=palette.locator('..').getByRole('radio',{name:'Braise',exact:true});await braise.focus();await page.keyboard.press('Space');
 await expect(page.locator('html')).toHaveAttribute('data-palette','braise');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect.poll(()=>page.evaluate(index=>(window as unknown as {preferenceWrites:string[]}).preferenceWrites.slice(index),writesBefore)).toEqual(['observatory:palette']);
 await expect(page.locator('.theme-notice')).toBeHidden();await page.keyboard.press('Escape');await expect(palette).toBeFocused();await expect(palette.locator('..')).not.toHaveAttribute('open','');await expect(appearance.locator('..')).toHaveAttribute('open','');
 await page.keyboard.press('Escape');await expect(appearance).toBeFocused();await expect(appearance.locator('..')).not.toHaveAttribute('open','');expect(await geometry()).toEqual(initial);
 const history=page.locator('.mainnet').getByLabel('History length',{exact:true});await history.scrollIntoViewIfNeeded();const before=await geometry();await history.click();const options=history.locator('..').getByRole('group',{name:'History length'});await expect(options).toBeVisible();
 expect(await geometry()).toEqual(before);await options.getByRole('radio',{name:'1000',exact:true}).focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');await expect(history).toBeFocused();await expect(history).toHaveText('1000');await expect(page.locator('.shadownet').getByLabel('History length',{exact:true})).toHaveText('1000');
 expect(await geometry()).toEqual(before);expect(await page.evaluate(()=>window.mockRequests.length)).toBe(requests);await expect(page.locator('select')).toHaveCount(0);
});
