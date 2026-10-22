import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Validate every result before classifying assertions: runtime failure always wins. */
export function classifyBrowserReport(report,status,criterion,titles){
 if(!Array.isArray(titles)||!titles.length||new Set(titles).size!==titles.length)throw new Error('Missing or duplicate required scenarios');
 if(report.errors?.length)throw new Error('Browser runner reported execution errors');
 const records=[];
 const visit=suite=>{for(const spec of suite.specs??[])for(const test of spec.tests??[])records.push({title:spec.title,test});for(const nested of suite.suites??[])visit(nested);};
 for(const suite of report.suites??[])visit(suite);
 if(records.length!==titles.length*2)throw new Error('Incomplete required scenario/engine matrix');
 const stats=report.stats;if(!stats||!['expected','unexpected','skipped','flaky'].every(key=>Number.isSafeInteger(stats[key])&&stats[key]>=0)||stats.skipped||stats.flaky||stats.expected+stats.unexpected!==records.length)throw new Error('Missing/malformed/incomplete native browser summary');
 if(stats.expected!==records.filter(record=>record.test.results?.[0]?.status==='passed').length)throw new Error('Native summary differs from scenario results');
 const seen=new Set(),failures=[];
 for(const {title,test} of records){
  const key=JSON.stringify([title,test.projectName]);
  if(!titles.includes(title)||!['chromium','firefox'].includes(test.projectName)||seen.has(key))throw new Error('Unexpected or duplicate scenario/engine');seen.add(key);
  if(test.expectedStatus!=='passed'||test.results?.length!==1)throw new Error('Skipped, expected-failure, retried or missing scenario result');
  const result=test.results[0];
  if(result.status==='passed'){
   if(result.errors?.length||!test.annotations?.some(value=>value.type==='v3-verified'&&value.description===criterion))throw new Error('Missing completed V3 assertions');
  }else if(result.status==='failed'&&result.errors?.length){
   for(const error of result.errors){const message=(error.message??'').replace(/\u001b\[[0-9;]*m/g,'');if(!/(?:^|\n)(?:Error: )?expect\(/.test(message))throw new Error('Scenario runtime/fixture failure');failures.push(message);}
  }else throw new Error('Incomplete, skipped, timed-out or interrupted scenario');
 }
 if(failures.length){if(status!==1)throw new Error('Inconsistent assertion process status');return 1;}
 if(status!==0)throw new Error('Nonzero process despite passed scenarios');return 0;
}
export async function run(args,spawn=spawnSync){
 try{
  const [criterion,...options]=args;
  if(!/^AC-(?:0[1-9]|[12][0-9]|3[0-7])$/.test(criterion??'')||options.length!==2||options[0]!=='--browsers'||options[1]!=='chromium,firefox')throw new Error('Use AC-01 through AC-37 --browsers chromium,firefox; CHECK-38 is independent manual review');
  const manifest=JSON.parse(readFileSync(new URL('../roster/observatory-v3/check-scenarios.json',import.meta.url),'utf8'));
  const titles=manifest[criterion];if(!titles?.length)throw new Error(`Required scenarios not implemented: ${criterion}`);
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const reportRoot=process.env.V3_CHECK_REPORT_DIR??tmpdir();mkdirSync(reportRoot,{recursive:true});const directory=mkdtempSync(resolve(reportRoot,`observatory-v3-${criterion}-`));const reportPath=resolve(directory,`${criterion}.playwright.json`);
  const child=spawn('rtk',['proxy',process.execPath,'node_modules/@playwright/test/cli.js','test','--config=playwright.v3.config.ts','--grep',titles.map(escape).join('|'),'--project','chromium','--project','firefox','--reporter=json'],{encoding:'utf8',maxBuffer:50_000_000,timeout:900_000,env:{...process.env,PLAYWRIGHT_JSON_OUTPUT_FILE:reportPath}});
  writeFileSync(resolve(directory,`${criterion}.stdout.log`),child.stdout??'');writeFileSync(resolve(directory,`${criterion}.stderr.log`),child.stderr??'');
  let body;try{body=readFileSync(reportPath);}finally{console.error(JSON.stringify({namespace:'observatory-v3',criterion,reportPath,reportSha256:body?createHash('sha256').update(body).digest('hex'):null}));}
  if(child.error||child.signal)throw child.error??new Error('Browser process interrupted');
  const report=JSON.parse(body.toString('utf8'));const code=classifyBrowserReport(report,child.status,criterion,titles);
  console.log(JSON.stringify({namespace:'observatory-v3',criterion,result:code===0?'PASS':'ASSERTION_FAILED',scenarios:titles.length,engines:['chromium','firefox']}));return code;
 }catch(error){console.error(error);return 2;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await run(process.argv.slice(2));
