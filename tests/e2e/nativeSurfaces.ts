import {metricFixture,captureMetricSurface} from './metricFixture';
import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {prepare,send,vote,choose} from './productionFixture';
import {bases,getBinding} from './v3Evidence';

// Native title bubbles live outside browser-content screenshots. The removed OS
// select popup is deliberately not represented as passing replacement evidence.
test('V3 AC-36 real native title tooltip surfaces are captured in both themes at every base',async({page},info)=>{
 const binding=getBinding();test.setTimeout(240000);const display=process.env['DISPLAY'],directory=process.env['V3_EVIDENCE_DIR'],xdotool=process.env['V3_XDOTOOL'];
 if(!display||!directory||!xdotool)throw new Error('Native capture requires isolated DISPLAY, V3_XDOTOOL and V3_EVIDENCE_DIR');
 await mkdir(directory,{recursive:true});const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
 await page.clock.install();await prepare(page,false);await send(page,'mainnet-operations',[vote(0)]);await expect(page.locator('.mainnet .pre .gauge-exact')).toHaveText('600 / 30,000');await expect(page.locator('select')).toHaveCount(0);await expect(page.getByLabel('Colour palette')).toHaveCount(1);
 await page.clock.pauseAt(new Date(Date.now()+1000));
 const records:unknown[]=[];
 const geometry=()=>page.evaluate(()=>({screenX,screenY,outerWidth,outerHeight,innerWidth,innerHeight,devicePixelRatio,assets:[...document.scripts].map(script=>script.src).filter(Boolean)}));
 const capture=(path:string)=>execFileSync('import',['-display',display,'-window','root',path],{timeout:15000});
 for(const viewport of bases.filter(base=>!process.env['V3_NATIVE_BASE']||`${base.width}x${base.height}`===process.env['V3_NATIVE_BASE']))for(const theme of ['light','dark']){
  await page.setViewportSize(viewport);await choose(page.getByLabel('Appearance'),theme);
  const target=page.locator('.mainnet .navigator-current [title]').first();await expect(target).toHaveAttribute('title',/./);await target.scrollIntoViewIfNeeded();
  const box=await target.boundingBox(),window=await geometry();if(!box)throw new Error('Native tooltip target has no bounds');
  execFileSync(xdotool,['mousemove','--sync','0','0'],{timeout:15000});await page.waitForTimeout(200);
  const stem=`native-${info.project.name}-${viewport.width}x${viewport.height}-${theme}-tooltip`,before=join(directory,`${stem}-before.png`),after=join(directory,`${stem}.png`);
  capture(before);execFileSync(xdotool,['mousemove','--sync',String(Math.round(window.screenX+box.x+box.width/2)),String(Math.round(window.screenY+window.outerHeight-window.innerHeight+box.y+box.height/2))],{timeout:15000});await page.waitForTimeout(1800);capture(after);
  const changed=execFileSync('convert',[before,after,'-compose','difference','-composite','-threshold','0','-format','%@','info:'],{encoding:'utf8',timeout:15000}).trim();
  const match=/^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(changed);if(!match||Number(match[1])<20||Number(match[2])<10)throw new Error(`Native tooltip was not observably captured: ${changed}`);
  const components=execFileSync('convert',[before,after,'-compose','difference','-composite','-threshold','0','-define','connected-components:verbose=true','-connected-components','8','null:'],{encoding:'utf8',timeout:15000});
  const candidates=[...components.matchAll(/\d+: (\d+x\d+\+\d+\+\d+) [\d.,]+ ([\d.e+]+) srgb\(255,255,255\)/g)].map(match=>({bounds:match[1],area:Number(match[2])})).sort((a,b)=>b.area-a.area);
  const tooltipBounds=candidates[0]?.bounds;if(!tooltipBounds)throw new Error('Native tooltip has no isolated changed pixel component');
  const crop=join(directory,`${stem}-surface.png`);execFileSync('convert',[after,'-crop',tooltipBounds,'+repage',crop],{timeout:15000});
  const dimensions=execFileSync('identify',['-format','%wx%h',after],{encoding:'utf8',timeout:15000});
  const histogram=execFileSync('convert',[crop,'-depth','8','-format','%c','histogram:info:'],{encoding:'utf8',timeout:15000});
  const colors=[...histogram.matchAll(/(\d+):.*#([A-Fa-f0-9]{6})(?:[A-Fa-f0-9]{2})?\s/g)].map(match=>({count:Number(match[1]),hex:match[2]})).filter((color):color is {count:number;hex:string}=>!!color.hex).sort((a,b)=>b.count-a.count);
  const luminance=(hex:string)=>{const channels=[0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return (channels[0]??0)*.2126+(channels[1]??0)*.7152+(channels[2]??0)*.0722;};
  const background=colors[0];if(!background)throw new Error('Native tooltip pixel histogram empty');const backgroundL=luminance(background.hex);
  const measuredColors=colors.filter(color=>color.count>=10).map(color=>({...color,contrast:(Math.max(backgroundL,luminance(color.hex))+.05)/(Math.min(backgroundL,luminance(color.hex))+.05)})).sort((a,b)=>b.contrast-a.contrast),foreground=measuredColors[0];if(!foreground)throw new Error('Native tooltip foreground pixels unavailable');
  expect(foreground.contrast).toBeGreaterThanOrEqual(4.5);
  records.push({sourceCombined:binding.sourceCombined,contractCombined:binding.contractCombined,productionCombined:binding.productionCombined,status:'CAPTURED',engine:info.project.name,viewport,theme,surface:'native-title-tooltip',screenshot:`${stem}.png`,screenshotSha256:createHash('sha256').update(readFileSync(after)).digest('hex'),before:`${stem}-before.png`,crop:`${stem}-surface.png`,changed,tooltipBounds,components,pixelContrast:{background,foreground,method:'Dominant background and contrasting repeated solid pixels; independent visual review must confirm these are actual tooltip glyph colors, not merely a border'},dimensions,window,bounds:box,title:await target.getAttribute('title'),histogram,measurement:'Actual X11 difference and pixels. Independent visual identification and contrast interpretation required; difference alone is not a tooltip PASS.'});
  execFileSync(xdotool,['mousemove','--sync','0','0'],{timeout:15000});
 }
 await writeFile(join(directory,`native-${info.project.name}.json`),JSON.stringify(records,null,2));if(failures.length)throw new Error(failures.join('\n'));
});

test('V3 AC-32 actual browser zoom retains current and both critical branches without horizontal pan',async({page},info)=>{
 const binding=getBinding();test.setTimeout(90000);const xdotool=process.env['V3_XDOTOOL'],directory=process.env['V3_EVIDENCE_DIR'];if(!xdotool||!process.env['DISPLAY']||!directory)throw new Error('Actual browser zoom requires isolated headed X11 input');
 await page.setViewportSize({width:1440,height:900});await metricFixture(page);await prepare(page,false);await expect(page.locator('.mainnet .interval-mean')).toHaveText(['7200.29 s','3601.00 s','906.00 s']);await send(page,'mainnet-operations',[vote(0)]);await mkdir(directory,{recursive:true});
 const physicalWindow=()=>{const id=execFileSync(xdotool,['getwindowfocus'],{encoding:'utf8',timeout:15000}).trim();return execFileSync(xdotool,['getwindowgeometry','--shell',id],{encoding:'utf8',timeout:15000}).trim();};const nativeBaseline=physicalWindow();
 const baseline=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,outerWidth,outerHeight}));await page.locator('h1').click();for(let step=0;step<12&&await page.evaluate(()=>innerWidth)>baseline.width*.55;step++){const prior=await page.evaluate(()=>innerWidth);execFileSync(xdotool,['key','--clearmodifiers','ctrl+plus'],{timeout:15000});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBeLessThan(prior);}
 await expect.poll(()=>page.evaluate(()=>innerWidth)).toBeLessThanOrEqual(baseline.width*.55);
 for(const theme of ['light','dark']){
  const appearance=page.getByLabel('Appearance'),options=appearance.locator('..');await appearance.focus();await page.keyboard.press('Enter');await options.locator(`input[value="${theme}"]`).focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');await expect(page.locator('html')).toHaveAttribute('data-theme',theme);const measured=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio,outerWidth,outerHeight,regions:['.navigator-current','[data-branch=same-level]','[data-branch=next-level]'].map(selector=>{const node=document.querySelector(`.mainnet ${selector}`);if(!node)throw new Error('Missing critical zoom region');const box=node.getBoundingClientRect();return {selector,text:node.textContent,x:box.x,right:box.right,width:box.width};})}));
  expect(measured.documentWidth).toBeLessThanOrEqual(measured.width);expect(physicalWindow()).toBe(nativeBaseline);expect(baseline.width/measured.width).toBeGreaterThanOrEqual(1.8);for(const region of measured.regions){expect(region.width).toBeGreaterThan(0);expect(region.x).toBeGreaterThanOrEqual(0);expect(region.right).toBeLessThanOrEqual(measured.width);}
  await captureMetricSurface(page,info,'metric-zoom-200',{baseline,nativeBaseline,measured,nativeMeasured:physicalWindow()},true);
  const stem=`zoom-${info.project.name}-${theme}`;await page.screenshot({path:join(directory,`${stem}.png`),fullPage:true});await writeFile(join(directory,`${stem}.json`),JSON.stringify({sourceCombined:binding.sourceCombined,contractCombined:binding.contractCombined,productionCombined:binding.productionCombined,status:'PASS',engine:info.project.name,surface:'browser-zoom',baseline,nativeBaseline,measured,nativeMeasured:physicalWindow(),theme,screenshot:`${stem}.png`,screenshotSha256:createHash('sha256').update(readFileSync(join(directory,`${stem}.png`))).digest('hex'),method:'Actual X11 browser Ctrl+plus input, verified innerWidth reduction at unchanged physical X11 window geometry; CSS outer dimensions and DPR recorded separately'},null,2));
 }
 execFileSync(xdotool,['key','--clearmodifiers','ctrl+0'],{timeout:15000});await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(baseline.width);
});
