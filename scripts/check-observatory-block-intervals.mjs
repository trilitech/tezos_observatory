import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clean=value=>String(value??'').replace(/\u001b\[[0-9;]*m/g,'');
const assertionFailure=message=>/(?:AssertionError|(?:^|\n)(?:Error: )?expect\()/.test(clean(message));
const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid ${label}`);return value;};
const array=(value,label)=>{if(!Array.isArray(value))throw new Error(`Missing ${label}`);return value;};
const readJSON=path=>JSON.parse(readFileSync(path,'utf8'));

/** Classify every actual result before selecting RED; any execution error wins. */
export function classifyUnits(report,status,expected,runtimeLog='',assertionField='blockIntervalAssertions'){
 object(report,'Vitest report');const cases=array(report.testResults,'unit suites').flatMap(suite=>array(suite.assertionResults,'unit cases'));
 if(/Vitest caught \d+ unhandled error|Unhandled Rejection|Unhandled Exception|PromiseRejectionHandledWarning/.test(clean(runtimeLog)))throw new Error('Unhandled unit runtime failure');
 if(cases.length!==expected.length||new Set(cases.map(test=>test.fullName)).size!==expected.length||expected.some(name=>!cases.some(test=>test.fullName===name)))throw new Error('Incomplete unit execution inventory');
 if(report.numPendingTests||report.numTodoTests||report.numTotalTests!==cases.length)throw new Error('Skipped/incomplete unit execution');
 let assertions=0;const failures=[],errors=[];
 for(const test of cases){
  const count=test.meta?.[assertionField];if(!Number.isInteger(count)||count<1){errors.push(`Zero/missing executed assertions: ${test.fullName}`);continue;}assertions+=count;
  const messages=array(test.failureMessages,'unit failure messages');
  if(test.status==='passed'){if(messages.length)errors.push('Passed unit contains errors');continue;}
  if(test.status!=='failed'||!messages.length){errors.push(`Incomplete unit result: ${test.status}`);continue;}
  for(const message of messages)(assertionFailure(message)?failures:errors).push(message);
 }
 if(errors.length)throw new Error(errors.join('\n'));
 if(failures.length){if(status!==1)throw new Error(`Inconsistent unit assertion exit: ${status}`);return {code:1,assertions,failures};}
 if(status!==0||report.success!==true||report.numFailedTests)throw new Error(`Unit runtime/report failure despite completed assertions: ${status}`);
 return {code:0,assertions,failures:[]};
}
export function classifyBrowsers(report,status,expected){
 object(report,'Playwright report');const errors=[...array(report.errors,'browser errors')],failures=[],tests=[];
 const visit=suite=>{for(const spec of suite.specs??[])for(const test of spec.tests??[])tests.push({title:spec.title,...test});for(const child of suite.suites??[])visit(child);};
 for(const suite of array(report.suites,'browser suites'))visit(suite);
 if(tests.length!==expected.length*2)throw new Error('Missing/extra required production scenarios or engines');
 const stats=object(report.stats,'browser summary');if(['expected','skipped','unexpected','flaky'].some(field=>!Number.isSafeInteger(stats[field])||stats[field]<0)||stats.expected+stats.skipped+stats.unexpected+stats.flaky!==tests.length||stats.skipped||stats.flaky)throw new Error('Invalid/incomplete native browser summary');
 const seen=new Set();let completed=0;
 for(const test of tests){
  const entry=expected.find(value=>value.title===test.title),key=JSON.stringify([test.title,test.projectName]);
  if(!entry||!['chromium','firefox'].includes(test.projectName)||seen.has(key)){errors.push('Missing/duplicate/unexpected required production scenario');continue;}seen.add(key);
  if(test.results?.length!==1){errors.push('Missing/retried browser result');continue;}
  const result=test.results[0];
  if(!Array.isArray(result.errors)){errors.push('Missing browser result error inventory');continue;}
  if(result.status==='passed'){
   if(result.errors?.length){errors.push(...result.errors);continue;}
   if(!test.annotations?.some(value=>value.type===entry.annotation.type&&value.description===entry.annotation.description)){errors.push(`Missing completed production assertion marker: ${key}`);continue;}completed++;continue;
  }
  if(result.status!=='failed'||!result.errors?.length){errors.push(`Incomplete browser result: ${result.status}`);continue;}
  for(const error of result.errors)(assertionFailure(error.message)?failures:errors).push(error.message??error);
 }
 for(const entry of expected)for(const engine of ['chromium','firefox'])if(!seen.has(JSON.stringify([entry.title,engine])))errors.push(`Missing ${engine}: ${entry.title}`);
 if(errors.length)throw new Error(JSON.stringify(errors));
 if(stats.expected!==completed||stats.unexpected!==tests.length-completed)throw new Error('Incoherent native browser summary/results');
 if(failures.length){if(status!==1)throw new Error(`Inconsistent browser assertion exit: ${status}`);return {code:1,completed,failures};}
 if(status!==0||report.stats?.skipped||report.stats?.unexpected||report.stats?.flaky||completed!==expected.length*2)throw new Error('Inconsistent/incomplete production browser report');
 return {code:0,completed,failures:[]};
}
function sourceBinding(){
 const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\n').filter(path=>/^(src\/|tests\/|scripts\/|specs\/|roster\/observatory-block-intervals\/(?:check-coverage|render-variants)\.json$|(?:README\.md|tsconfig\.json)$|package(?:-lock)?\.json$|(?:playwright(?:\.(?:v3|native))?|vite)\.config\.ts$)/.test(path)).sort();
 const files=Object.fromEntries(paths.map(path=>[path,sha(readFileSync(path))]));
 return {revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files,combined:sha(JSON.stringify(files))};
}
function child(args,directory,name,extraEnv={}){
 const result=spawnSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',env:{...process.env,...extraEnv},maxBuffer:20_000_000,timeout:600_000});
 writeFileSync(resolve(directory,`${name}.stdout.log`),result.stdout??'');writeFileSync(resolve(directory,`${name}.stderr.log`),result.stderr??'');
 if(result.error||result.signal)throw result.error??new Error(`${name} terminated: ${result.signal}`);
 return result;
}
/** Validate actual metric DOM observations after the shared loader verifies artifacts. */
export function validateMetricObservation(record,parent,manifest){
 object(record,'metric observation');object(parent,'parent render');const metric=object(record.metric,'metric DOM measurements');
 for(const field of ['sourceCombined','contractCombined','productionCombined'])if(record[field]!==manifest[field]||parent[field]!==manifest[field])throw new Error(`Metric uses a different ${field}`);
 if(record.namespace!=='observatory-block-intervals'||record.state!==parent.state||record.engine!==parent.engine||record.theme!==parent.theme||JSON.stringify(record.viewport)!==JSON.stringify(parent.viewport)||record.screenshotSha256!==parent.screenshotSha256)throw new Error('Metric observation does not match its captured parent');
 const rows=array(metric.rows,'three metric windows'),typography=array(metric.typography,'actual metric typography');let assertions=0;const failures=[];
 const check=(condition,message)=>{assertions++;if(!condition)failures.push(message);};
 const bounded=box=>box&&[box.x,box.y,box.width,box.height,box.right].every(Number.isFinite)&&box.width>0&&box.height>0&&box.x>=-1&&box.right<=record.viewport.width+1;
 check(rows.length===3&&rows.every((row,index)=>row.label===['1 week','24 hours','1 hour'][index]),'Three named metric windows are not visible');
 check(metric.sourceHref==='https://api.tzkt.io/v1/blocks'&&metric.sourceText==='TzKT-reported indexed spans','Missing linked TzKT metric qualification');check(bounded(metric.bounds),'Metric region is clipped or empty');
 for(const row of rows){check(bounded(row.bounds)&&typeof row.mean==='string'&&row.mean.length>0,'Metric row is clipped or empty');}
 check(typography.length>=5&&typography.every(text=>Number.isFinite(text.size)&&text.size>=(text.selector==='interval-evidence'?12:14)),'Metric text is below critical/metadata minimum');
 check(metric.refresh?.tag==='BUTTON'&&metric.refresh.bounds?.width>=44&&metric.refresh.bounds?.height>=44,'Metric Refresh is not a native44px target');check(metric.details?.tag==='DETAILS'&&metric.details.summaryBounds?.height>=24,'Metric evidence is not a native24px disclosure');
 const state=record.state,numeric=row=>/^(?:<0\.01|\d+\.\d{2}) s$/.test(row.mean??''),available=['metric-values','metric-refreshing-retained','metric-stale-retained','metric-whole-failure-retained','metric-long-details'].includes(state);
 if(available)check(rows.every(row=>numeric(row)&&/intervals.*actual coverage/.test(row.coverage??'')&&/Level .*Z → .*Z/.test(row.endpoints??'')),'Available metric lacks real coverage/UTC endpoints');
 if(state==='metric-partial')check(rows.every(numeric)&&rows.slice(0,2).every(row=>row.coverage?.includes('Partial available history')),'Partial metric history is not identified');
 if(state==='metric-insufficient')check(rows.every(row=>row.mean==='Insufficient data'),'Insufficient metric data is presented numerically');
 if(state==='metric-window-unavailable')check(rows[0]?.mean==='Unavailable'&&rows.slice(1).every(numeric),'Window-local unavailable state was not preserved');
 if(state==='metric-no-prior-unavailable')check(rows.every(row=>row.mean==='—')&&metric.status?.includes('HTTP 503'),'No-prior failure is not explicit');
 if(state==='metric-loading')check(rows.every(row=>row.mean==='—')&&metric.status?.includes('Loading')&&metric.refresh.disabled,'Initial loading is not explicit');
 if(state==='metric-refreshing-retained')check(metric.status?.includes('Refreshing block intervals')&&metric.refresh.disabled,'Retained refresh is not explicit');
 if(state==='metric-stale-retained'||state==='metric-whole-failure-retained')check(metric.status?.includes('Stale retained evidence'),'Retained stale evidence is not identified');
 if(state==='metric-whole-failure-retained')check(metric.status?.includes('HTTP 503'),'Retained provider failure is not identified');
 if(state==='metric-prohibited-not-collected')check(rows.every(row=>row.mean==='—')&&metric.status?.includes('Not yet collected')&&metric.requestCount===0&&metric.refresh.disabled,'Prohibited metric collection issued reads or showed fabricated values');
 check(metric.details?.open===(state==='metric-long-details'),'Metric disclosure state differs from its captured variant');
 if(state==='metric-long-details')check(typeof metric.evidenceText==='string'&&metric.evidenceText.includes('IndexedEnd104')&&metric.evidenceText.includes('(E.timestamp − S.timestamp) / 1000 / (E.level − S.level)'),'Expanded metric evidence omits full endpoint/formula provenance');
 return {code:failures.length?1:0,assertions,failures};
}
export function validateMetricInventory(bundle,inventory){
 const manifest=bundle.manifest,artifacts=bundle.artifacts??manifest.artifacts;let assertions=0;const failures=[];
 const read=name=>{if(typeof name!=='string'||!artifacts||!(name in artifacts))throw new Error('Missing hashed actual metric observation');return readJSON(resolve(bundle.root,name));};
 for(const state of inventory.variants){
  const renders=manifest.renders.filter(render=>render.variant===state);if(!manifest.variants.includes(state)||renders.length!==36)throw new Error(`Missing actual complete metric matrix: ${state}`);
  const names=manifest.surfaceEvidence?.[`observatory-block-intervals/${state}`];if(!Array.isArray(names)||names.length!==36)throw new Error(`Missing actual metric cell observations: ${state}`);
  const seen=new Set();
  for(const name of names){
   const record=read(name),key=JSON.stringify([record.engine,record.theme,`${record.viewport?.width}x${record.viewport?.height}`]);if(seen.has(key))throw new Error('Duplicate actual metric cell');seen.add(key);
   const parent=renders.find(render=>JSON.stringify([render.engine,render.theme,render.base])===key);if(!parent||record.state!==state)throw new Error('Metric cell has no exact parent render');
   if(resolve(bundle.root,dirname(name),record.parentMeasurement??'')!==resolve(bundle.root,parent.measurement)||resolve(bundle.root,dirname(name),record.screenshot??'')!==resolve(bundle.root,parent.screenshot)||record.screenshotSha256!==artifacts[parent.screenshot])throw new Error('Metric screenshot/measurement parent mismatch');
   const result=validateMetricObservation(record,read(parent.measurement),manifest);assertions+=result.assertions;failures.push(...result.failures);
  }
 }
 for(const surface of inventory.additionalSurfaces){
  if(!manifest.additionalSurfaces.includes(surface))throw new Error(`Missing actual metric surface: ${surface}`);
  const names=manifest.surfaceEvidence?.[surface];if(!Array.isArray(names)||!names.length)throw new Error(`Missing actual metric surface: ${surface}`);
  const records=names.filter(name=>name.endsWith('.metric.json')).map(name=>({name,record:read(name)})),expected=/system-(?:light|dark)$/.test(surface)?2:4,seen=new Set();if(records.length!==expected)throw new Error(`Incomplete actual native metric surface: ${surface}`);
  for(const {name,record} of records){
   const key=JSON.stringify([record.engine,record.theme]);if(seen.has(key)||!['chromium','firefox'].includes(record.engine)||!['light','dark'].includes(record.theme)||record.surface!==surface)throw new Error('Unexpected native metric surface cell');seen.add(key);
   const parentPath=resolve(bundle.root,dirname(name),record.parentMeasurement??''),parentName=Object.keys(artifacts).find(path=>resolve(bundle.root,path)===parentPath);if(!parentName)throw new Error('Native metric surface has no hashed measured parent');
   const parent=read(parentName);if(resolve(bundle.root,dirname(name),record.screenshot??'')!==resolve(bundle.root,dirname(parentName),parent.screenshot??'')||record.screenshotSha256!==artifacts[Object.keys(artifacts).find(path=>resolve(bundle.root,path)===resolve(bundle.root,dirname(name),record.screenshot??''))])throw new Error('Native metric screenshot binding mismatch');
   const result=validateMetricObservation(record,parent,manifest);assertions+=result.assertions;failures.push(...result.failures);
   const check=(condition,message)=>{assertions++;if(!condition)failures.push(message);};
   if(surface.startsWith('metric-system-')){const native=object(record.native,'actual system preference observation'),theme=surface.endsWith('-light')?'light':'dark';check(native.systemTheme===theme&&record.theme===theme,'Metric system preference was not applied');}
   if(surface.startsWith('metric-storage-')){const native=object(record.native,'actual storage observation');check(native.storageCase===surface.slice('metric-storage-'.length)&&native.appearanceUsable===true,'Metric storage fallback was not exercised');}
   if(surface==='metric-zoom-200'){
    const native=object(record.native,'actual browser zoom observation');
    // Exact physicalWindow() shape from the existing X11 native zoom helper.
    const screen=value=>{if(typeof value!=='string')return false;const fields=value.match(/^WINDOW=(\d+)\nX=(-?\d+)\nY=(-?\d+)\nWIDTH=(\d+)\nHEIGHT=(\d+)\nSCREEN=(\d+)$/)?.slice(1).map(Number);return fields?.length===6&&fields.every(Number.isSafeInteger)&&fields[0]>0&&fields[3]>0&&fields[4]>0&&fields[5]>=0;};
    if(!screen(native.nativeBaseline)||!screen(native.nativeMeasured))throw new Error('Missing/malformed actual native screen observation');
    check(native.baseline?.width/native.measured?.width>=1.8&&native.nativeBaseline===native.nativeMeasured&&native.measured?.documentWidth<=native.measured?.width,'Metric surface does not establish actual native browser zoom');
   }
   if(surface==='metric-refresh-focus')check(record.metric.refresh.focused===true&&record.metric.refresh.keyboardOperated===true,'Metric Refresh native focus/keyboard operation is unproved');
   if(surface==='metric-refresh-disabled')check(record.metric.refresh.disabled===true,'Disabled metric Refresh is not captured');
   if(surface==='metric-details-open')check(record.metric.details.open===true,'Open native metric disclosure is not captured');
   if(surface==='metric-reader-preservation'){const native=object(record.native,'actual reader preservation observation'),reader=object(native.readerPreservation,'reader preservation results');check(['focus','pin','scroll','disclosure','search','noIncidentalReads','noMetricMotion'].every(field=>reader[field]===true),'Metric reader preservation was not actually established');}
  }
 }
 return {code:failures.length?1:0,assertions,failures};
}
async function independentMatrix(){
 // Reuse the product-local shared contract. Never invent an author-written GO receipt.
 const {loadV3Evidence,requireIndependentReceipt}=await import('./v3-evidence-contract.mjs');
 const bundle=loadV3Evidence(process.env.V3_RELEASE_EVIDENCE,process.cwd()),inventory=readJSON('roster/observatory-block-intervals/render-variants.json');
 const contract='specs/observatory-block-intervals.md';
 if(bundle.manifest.contracts[contract]!==sha(readFileSync(contract)))throw new Error('Final bundle does not bind the current metric contract');
 const observations=validateMetricInventory(bundle,inventory);
 const roles=['reviewer','qa'].map(role=>requireIndependentReceipt(bundle,'observatory-block-intervals/AC-15',role,'visual'));
 if(roles[0].actor===roles[1].actor)throw new Error('Independent reviewer and QA must be different actual actors');
 return {...observations,sourceCombined:bundle.manifest.sourceCombined,contractCombined:bundle.manifest.contractCombined,roles:roles.map(role=>({actor:role.actor,report:role.report}))};
}

export async function run(args){
 if(!Array.isArray(args)||args.length!==3||!/^AC-(?:[1-9]|1[0-9]|20)$/.test(args[0])||args[1]!=='--browsers'||args[2]!=='chromium,firefox')throw new Error('Expected exactly AC-1…AC-20 --browsers chromium,firefox');
 const criterion=args[0],number=Number(criterion.slice(3)),directory=mkdtempSync('/var/tmp/observatory-block-interval-check-'),before=sourceBinding();
 const evidence={namespace:'observatory-block-intervals',criterion,command:args,source:before,started:new Date().toISOString(),boundary:'real production collector/controller and, when required, actual served dist Chromium and Firefox',outcome:'ERROR'};
 try {
  const coverage=readJSON('roster/observatory-block-intervals/check-coverage.json');if(coverage.namespace!=='observatory-block-intervals'||!coverage.unitCases?.length||!coverage.browserCases?.length)throw new Error('Missing feature execution inventory');
  if(number===15)evidence.independent=await independentMatrix();
  const unitPath=resolve(directory,'units.json'),unit=child(['node_modules/vitest/vitest.mjs','run',resolve('tests/unit/blockIntervals.test.ts'),'--reporter=default','--reporter=json',`--outputFile=${unitPath}`],directory,'units');
  const units=classifyUnits(readJSON(unitPath),unit.status,coverage.unitCases,(unit.stdout??'')+(unit.stderr??''));evidence.units={...units,report:unitPath};
  let code=units.code||evidence.independent?.code||0,assertions=units.assertions+(evidence.independent?.assertions??0);
  if(coverage.readerCriteria.includes(number)||number===15){
   const browserPath=resolve(directory,'browsers.json'),port=process.env.OBSERVATORY_TEST_PORT??'5269';
   const browser=child(['node_modules/@playwright/test/cli.js','test','tests/e2e/blockIntervals.spec.ts','tests/e2e/dashboard.spec.ts','--grep','block intervals|independent production:|V3 AC-13 .*burst','--project','chromium','--project','firefox','--workers=2','--reporter=json'],directory,'browsers',{OBSERVATORY_TEST_PRODUCTION:'1',OBSERVATORY_TEST_PORT:port,PLAYWRIGHT_JSON_OUTPUT_FILE:browserPath});
   const result=classifyBrowsers(readJSON(browserPath),browser.status,coverage.browserCases);evidence.browsers={...result,report:browserPath};if(result.code)code=1;
  }
  if(number===16){
   const readme=readFileSync('README.md','utf8');
   const failures=[];for(const fact of ['mean seconds = (E.timestamp − S.timestamp) / 1000 / (E.level − S.level)','TzKT-reported indexed spans','entire interval crossing','partial available history','60 seconds','120 seconds','16 KiB']){assertions++;try{assert.ok(readme.includes(fact),`Missing metric interpretation: ${fact}`);}catch(error){if(error.code!=='ERR_ASSERTION')throw error;failures.push(error.message);code=1;}}evidence.documentation={failures};
   const claims=child(['.harness/bin/claims-reconcile.js','check','--root','.'],directory,'claims');if(claims.status!==0||readJSONFromText(claims.stdout).fresh!==true)throw new Error('Managed claims are not fresh');
  }
  if(sourceBinding().combined!==before.combined)throw new Error('Source changed during metric verification');
  evidence.outcome=code?'RED':'PASS';evidence.assertions=assertions;evidence.completed=new Date().toISOString();writeFileSync(resolve(directory,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({criterion,code,assertions,evidence:resolve(directory,'evidence.json')}));return {code,assertions};
 }catch(error){
  evidence.error=clean(error?.stack??error);evidence.completed=new Date().toISOString();writeFileSync(resolve(directory,'evidence.json'),JSON.stringify(evidence,null,2));
  console.error(`Metric execution evidence: ${resolve(directory,'evidence.json')}`);throw error;
 }
}
function readJSONFromText(text){return JSON.parse(text);}
