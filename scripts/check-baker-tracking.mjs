import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {classifyUnits,classifyBrowsers} from './check-observatory-block-intervals.mjs';

const selections={2:['profile (?:validates|commits)',2],3:['rights and inclusion',4],4:['baker evidence rewards excludes',1],5:['DAL counters',3],6:['included DAL',3],8:['request budget',5],9:['lifecycle',3],10:['failure and stale',3]};
const browser={1:['address and alias selection validates input and resolves only exact cached matches','AC-1'],7:['global DAL has contextual raw observations and no baker or consensus reads','AC-7'],11:['readability and geometry supports phone desktop themes and keyboard controls','AC-11']};
export function classifyBakerUnits(report,status,pattern,minimum,log=''){
 const selectedPattern=new RegExp(pattern);const all=report?.testResults?.flatMap(suite=>suite.assertionResults??[])??[],cases=all.filter(test=>selectedPattern.test(test.fullName));
 if(cases.length!==minimum||all.some(test=>!selectedPattern.test(test.fullName)&&test.status!=='skipped'))throw Error('Missing or unexpected baker test selection');
 // Vitest reports deliberately grep-deselected tests as skipped. Preserve the raw
 // report; only the explicit selected inventory is passed to the shared classifier.
 const selected={...report,numTotalTests:cases.length,numPendingTests:cases.filter(test=>test.status==='skipped').length,numTodoTests:0,testResults:[{assertionResults:cases}]};
 return classifyUnits(selected,status,cases.map(test=>test.fullName),log,'bakerAssertions');
}
export function runBakerCheck(number){
 if(!Number.isInteger(number)||number<1||number>12)throw Error('Expected CHECK number 1..12');
 const directory=mkdtempSync(join(tmpdir(),'baker-check-')),output=join(directory,'report.json');
 const execute=args=>{const result=spawnSync(process.execPath,args,{encoding:'utf8',env:process.env,timeout:600000,maxBuffer:20000000});if(result.error||result.signal)throw result.error??Error('Runner terminated');return result;};
 if(browser[number]){const [title,criterion]=browser[number],result=execute(['node_modules/@playwright/test/cli.js','test','tests/e2e/bakerTracking.spec.ts','--grep',title,'--reporter=json']);let report;try{report=JSON.parse(result.stdout);}catch{throw Error(`Invalid browser report: ${result.stderr}`);}return classifyBrowsers(report,result.status,[{title,annotation:{type:'baker-verified',description:criterion}}]).code;}
 const [pattern,minimum]=selections[number]??['',27];
 const result=execute(['node_modules/vitest/vitest.mjs','run','tests/unit/bakerTracking.test.ts',...(pattern?['-t',pattern]:[]),'--reporter=json',`--outputFile=${output}`]);
 const verdict=classifyBakerUnits(JSON.parse(readFileSync(output,'utf8')),result.status,pattern,minimum,result.stdout+result.stderr);if(verdict.code)return verdict.code;
 if(number===12){for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vitest/vitest.mjs','run'],['node_modules/vite/bin/vite.js','build']]){const checked=execute(args);if(checked.status!==0)throw Error(`Full gate failed: ${checked.stdout}\n${checked.stderr}`);}}
 return 0;
}
if(process.argv[1]?.endsWith('/check-baker-tracking.mjs')){try{process.exitCode=runBakerCheck(Number(process.argv[2]));}catch(error){console.error(error instanceof Error?error.stack:error);process.exitCode=2;}}
