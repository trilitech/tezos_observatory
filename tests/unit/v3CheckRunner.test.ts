import {expect,it} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const loaded:unknown=await import(new URL('../../scripts/check-observatory-v3.mjs',import.meta.url).href);
if(typeof loaded!=='object'||loaded===null||!('classifyBrowserReport' in loaded)||typeof loaded.classifyBrowserReport!=='function')throw new Error('Missing V3 classifier');
const classify=loaded.classifyBrowserReport as (report:unknown,status:number,criterion:string,titles:string[])=>number;
const scenario=(projectName:string,status='passed',errors:unknown[]=[],verified=true)=>({projectName,expectedStatus:'passed',annotations:verified?[{type:'v3-verified',description:'AC-02'}]:[],results:[{status,errors}]});
const report=(tests:ReturnType<typeof scenario>[])=>({stats:{expected:tests.filter(test=>test.results[0]?.status==='passed').length,unexpected:tests.filter(test=>test.results[0]?.status!=='passed').length,skipped:0,flaky:0},suites:[{specs:[{title:'Observed camera',tests}]}],errors:[]});
const run=(value:unknown,status=0)=>classify(value,status,'AC-02',['Observed camera']);
it('V3 requires complete exact engine and scenario manifests',()=>{
 expect(run(report([scenario('chromium'),scenario('firefox')]))).toBe(0);
 for(const value of [null,{},report([]),report([scenario('chromium')]),report([scenario('chromium'),scenario('chromium')]),report([scenario('chromium','skipped'),scenario('firefox')]),report([scenario('chromium','passed',[],false),scenario('firefox')])])expect(()=>run(value)).toThrow();
});
it.each([false,true])('V3 runtime errors take precedence over behavioral failures in either order %s',reverse=>{
 const cases=[scenario('chromium','failed',[{message:'Error: expect(received).toBe(expected) failed'}]),scenario('firefox','failed',[{message:'Fixture body failed'}])];if(reverse)cases.reverse();expect(()=>run(report(cases),1)).toThrow('runtime');
});
it('V3 returns assertion red only for completed matchers and rejects inconsistent processes',()=>{
 expect(run(report([scenario('chromium','failed',[{message:'Error: expect(received).toBe(expected) failed'}]),scenario('firefox')]),1)).toBe(1);
 expect(()=>run(report([scenario('chromium'),scenario('firefox')]),1)).toThrow();
 for(const status of ['timedOut','interrupted','skipped'])expect(()=>run(report([scenario('chromium',status),scenario('firefox')]),1)).toThrow();
});

it('V3 rejects absent malformed or incoherent native summaries despite passed scenario records',()=>{
 const valid=report([scenario('chromium'),scenario('firefox')]);
 for(const stats of [undefined,{}, {expected:2,unexpected:0,skipped:0}, {...valid.stats,expected:1}, {...valid.stats,skipped:1}, {...valid.stats,flaky:1}])expect(()=>run({...valid,stats})).toThrow();
});

it('V3 required scenarios all exist in the actual configured Playwright discovery matrix',()=>{
 const directory=mkdtempSync(join(tmpdir(),'v3-discovery-'));const path=join(directory,'report.json');
 try{
  const child=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=playwright.v3.config.ts','--list','--reporter=json'],{encoding:'utf8',env:{...process.env,PLAYWRIGHT_JSON_OUTPUT_FILE:path},timeout:60_000});
  expect(child.error).toBeUndefined();expect(child.status).toBe(0);
  const discovery=JSON.parse(readFileSync(path,'utf8')) as {suites:DiscoverySuite[]};
  type DiscoverySuite={specs?:{title:string;tests:{projectName:string}[]}[];suites?:DiscoverySuite[]};
  const found=new Map<string,Set<string>>();
  const visit=(suite:DiscoverySuite)=>{for(const spec of suite.specs??[]){const engines=found.get(spec.title)??new Set<string>();for(const test of spec.tests)engines.add(test.projectName);found.set(spec.title,engines);}for(const nested of suite.suites??[])visit(nested);};
  for(const suite of discovery.suites)visit(suite);
  const manifest=JSON.parse(readFileSync('roster/observatory-v3/check-scenarios.json','utf8')) as Record<string,string[]>;
  for(const titles of Object.values(manifest))for(const title of titles)expect([...found.get(title)??[]].sort(),title).toEqual(['chromium','firefox']);
 }finally{rmSync(directory,{recursive:true,force:true});}
},70_000);

it('V3 reads complete file reports and preserves runtime precedence and process status',async()=>{
 if(!('run' in loaded)||typeof loaded.run!=='function')throw new Error('Missing V3 runner');
 const execute=loaded.run as (args:string[],spawn:typeof spawnSync)=>Promise<number>;
 const manifest=JSON.parse(readFileSync('roster/observatory-v3/check-scenarios.json','utf8')) as Record<string,string[]>;
 const titles=manifest['AC-02'];if(!titles)throw new Error('Missing AC-02 manifest');
 const complete={stats:{expected:titles.length*2,unexpected:0,skipped:0,flaky:0},suites:[{specs:titles.map(title=>({title,tests:[scenario('chromium'),scenario('firefox')]}))}],errors:[]};
 const assertion=structuredClone(complete);assertion.stats.expected--;assertion.stats.unexpected++;const first=assertion.suites[0]?.specs[0];if(!first)throw new Error('Missing first scenario');first.tests[0]=scenario('chromium','failed',[{message:'Error: expect(received).toBe(expected) failed'}]);
 const runtime={...assertion,errors:[{message:'Worker failed'}]};
 const large={...complete,attachment:{body:'x'.repeat(50_000_001)}};
 for(const [body,status,interrupted,expected] of [[JSON.stringify(complete),0,false,0],[JSON.stringify(large),0,false,0],[JSON.stringify(assertion),1,false,1],[JSON.stringify(runtime),1,false,2],[JSON.stringify(complete),1,false,2],[undefined,0,false,2],['',0,false,2],['{',0,false,2],[JSON.stringify(complete),0,true,2]] as const){
  let reportPath:string|undefined;
  const fake=((_command:unknown,_args:unknown,options:{env:Record<string,string>})=>{const path=options.env['PLAYWRIGHT_JSON_OUTPUT_FILE'];if(!path)throw new Error('Missing direct JSON report destination');reportPath=path;if(body!==undefined)writeFileSync(path,body);return {stdout:'',stderr:'fixture diagnostic',status,signal:interrupted?'SIGTERM':null};}) as typeof spawnSync;
  try{expect(await execute(['AC-02','--browsers','chromium,firefox'],fake)).toBe(expected);if(!reportPath)throw new Error('Missing report path');expect(readFileSync(join(dirname(reportPath),'AC-02.stderr.log'),'utf8')).toBe('fixture diagnostic');if(body!==undefined)expect(readFileSync(reportPath,'utf8')).toBe(body);}finally{if(reportPath)rmSync(dirname(reportPath),{recursive:true,force:true});}
 }
});
