import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const module:unknown=await import(new URL('../../scripts/v3-evidence-contract.mjs',import.meta.url).href);
if(typeof module!=='object'||module===null||!('loadV3Evidence' in module)||typeof module.loadV3Evidence!=='function'||!('requireIndependentReceipt' in module)||typeof module.requireIndependentReceipt!=='function')throw new Error('Evidence contract module unavailable');
const load=module.loadV3Evidence,receipt=module.requireIndependentReceipt;
it('rejects absent or empty release evidence as execution incomplete',()=>{
 expect(()=>load(undefined)).toThrow('V3_RELEASE_EVIDENCE');const root=mkdtempSync(join(tmpdir(),'v3-evidence-'));
 try{expect(()=>load(root)).toThrow();writeFileSync(join(root,'manifest.json'),JSON.stringify({namespace:'observatory-v3',version:1,sources:{},contracts:{},artifacts:{}}));expect(()=>load(root)).toThrow('Source inventory is not exhaustive');}finally{rmSync(root,{recursive:true,force:true});}
});
it('independent receipt cannot be author supplied, wrong source, missing, duplicated or planned',()=>{
 const valid={role:'reviewer',kind:'visual',criteria:['AC-34'],actor:'independent-reviewer',sourceCombined:'source',contractCombined:'contract',verdict:'PASS',report:'report.md',evidence:['render.png']};
 const bundle=(receipts:unknown[])=>({root:'.',manifest:{author:'author',sourceCombined:'source',contractCombined:'contract',receipts},artifacts:{}});
 for(const records of [[],[valid,valid],[{...valid,actor:'author'}],[{...valid,sourceCombined:'older'}],[{...valid,verdict:'PLANNED'}],[valid]])expect(()=>receipt(bundle(records),'AC-34','reviewer','visual')).toThrow();
});

it('surface coverage rejects missing cells, duplicates, unbound captures and absent zoom geometry',()=>{
 if(!('validateSurfaceRecords' in module)||typeof module.validateSurfaceRecords!=='function')throw new Error('Surface consumer unavailable');
 const validate=module.validateSurfaceRecords,manifest={sourceCombined:'s',contractCombined:'c',productionCombined:'p'};
 const records=['chromium','firefox'].flatMap(engine=>['light','dark'].map(theme=>({...manifest,engine,theme,surface:'browser-zoom',status:'PASS',screenshot:'zoom.png',screenshotSha256:'hash',baseline:{width:1440},measured:{width:720,documentWidth:720,regions:[1,2,3].map(()=>({width:100,x:0,right:100}))},nativeBaseline:'WINDOW=123\nX=0\nY=0\nWIDTH=1440\nHEIGHT=900\nSCREEN=0',nativeMeasured:'WINDOW=123\nX=0\nY=0\nWIDTH=1440\nHEIGHT=900\nSCREEN=0'})));
 expect(validate(manifest,records,'browser-zoom')).toHaveLength(4);
 for(const physical of [undefined,'','physical','WINDOW=1\nSCREEN=0\nX=0\nY=0\nWIDTH=0\nHEIGHT=900'])expect(()=>validate(manifest,records.map(record=>({...record,nativeBaseline:physical,nativeMeasured:physical})),'browser-zoom')).toThrow('geometry');
 expect(()=>validate(manifest,records.slice(1),'browser-zoom')).toThrow('Incomplete');
 expect(()=>validate(manifest,[records[0],records[0],records[2],records[3]],'browser-zoom')).toThrow('duplicate');
 expect(()=>validate(manifest,records.map(record=>({...record,productionCombined:'older'})),'browser-zoom')).toThrow('different source');
 expect(()=>validate(manifest,records.map(record=>({...record,baseline:{}})),'browser-zoom')).toThrow('geometry');
 expect(()=>validate(manifest,records,'native-title-tooltip')).toThrow('Incomplete');
});


it('ordinary discovery retains every product scenario while official discovery adds exactly five required release consumers',()=>{
 const titles=(config:string)=>{const report=JSON.parse(execFileSync(process.execPath,['node_modules/@playwright/test/cli.js','test',`--config=${config}`,'--list','--reporter=json'],{cwd:process.cwd(),encoding:'utf8',timeout:30000}));const result:string[]=[];const visit=(suites:{specs?:{title:string}[];suites?:unknown[]}[])=>{for(const suite of suites){result.push(...(suite.specs??[]).map(spec=>spec.title));visit((suite.suites??[]) as typeof suites);}};visit(report.suites);return [...new Set(result)].sort();};
 const ordinary=titles('playwright.config.ts'),release=titles('playwright.v3.config.ts');
 expect(ordinary).toContain('V3 production inspection exports share actual classes and import without external work');
 expect(ordinary.filter(title=>!release.includes(title))).toEqual([]);
 expect(release.filter(title=>!ordinary.includes(title))).toEqual([
 'V3 AC-08 independent release prerequisites bind exact production source',
 'V3 AC-24 foundation interfaces and independent semantic receipts remain source bound',
 'V3 AC-25 complete production variant manifest rejects incomplete evidence',
 'V3 AC-34 independent visual receipt binds actual dense production',
 'V3 AC-36 native and zoom surface evidence is complete and source bound',
 ]);
},60000);

it('production binding rejects omitted, extra and mutated unbound imported assets through the real loader',async()=>{
 const fixture:unknown=await import(new URL('./productionInventoryFixture.mjs',import.meta.url).href);
 if(!fixture||typeof fixture!=='object'||!('productionInventoryProbe' in fixture)||typeof fixture.productionInventoryProbe!=='function')throw new Error('Fixture unavailable');
 const result=fixture.productionInventoryProbe(process.cwd());
 expect(result.baseline.accepted).toBe(true);expect(result.packagedAuthor).toBe('explicit-author-fixture');
 for(const name of ['omitted','mutated','extra'])expect(result[name]).toMatchObject({accepted:false,error:expect.stringContaining('Production inventory is not exhaustive')});
});


it.each([undefined,'',' ',' actor','actor\nforged'])('packager rejects missing or malformed explicit author %s',author=>{
 let diagnostic='';try{execFileSync(process.execPath,['scripts/package-v3-evidence.mjs','.'],{encoding:'utf8',env:{...process.env,V3_EVIDENCE_AUTHOR:author??''},stdio:'pipe'});}catch(error){diagnostic=String((error as {stderr?:unknown}).stderr);}
 expect(diagnostic).toContain('V3_EVIDENCE_AUTHOR must explicitly name the actual capture author');
});
