import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sourceBindings,loadV3Evidence,combinedHashes,sha256} from '../../scripts/v3-evidence-contract.mjs';
export function productionInventoryProbe(repository) {
// Synthetic loader unit fixture only: no UI render, independent receipt or acceptance claim.
const root=mkdtempSync(join(tmpdir(),'v3-production-inventory-')),repo=join(root,'repo'),bundle=join(root,'bundle');
for(const p of [repo,bundle,join(repo,'dist/assets'),join(repo,'specs'),join(repo,'roster/observatory-v3')])mkdirSync(p,{recursive:true});
execFileSync('git',['init','-q'],{cwd:repo});
for(const name of ['observatory-foundations.md','observatory-v3.md','observatory-block-intervals.md','claims-authority.json'])writeFileSync(join(repo,'specs',name),readFileSync(join(repository,'specs',name)));
writeFileSync(join(repo,'roster/observatory-v3/render-variants.json'),JSON.stringify({variants:[],additionalSurfaces:[]}));
writeFileSync(join(repo,'dist/index.html'),'<script type="module" src="./assets/imported.js"></script>');
writeFileSync(join(repo,'dist/assets/imported.js'),'document.title="original asset";');
execFileSync('git',['add','.'],{cwd:repo});execFileSync('git',['-c','user.name=Diagnostic Fixture','-c','user.email=fixture@example.invalid','commit','-qm','synthetic loader unit fixture'],{cwd:repo});
const binding=sourceBindings(repo);writeFileSync(join(bundle,'diagnostic.txt'),'Synthetic loader diagnostic, not production evidence or a receipt.');
const manifest={namespace:'observatory-v3',version:1,author:'synthetic-unit-fixture',...binding,variants:[],additionalSurfaces:[],surfaceEvidence:{},artifacts:{'diagnostic.txt':sha256(readFileSync(join(bundle,'diagnostic.txt')))},renders:[],receipts:[]};
// Mechanical native unit records are synthetic test inputs, never real surface evidence.
const pixels='synthetic unit fixture bytes',screenshot='synthetic-native.bin';writeFileSync(join(bundle,screenshot),pixels);manifest.artifacts[screenshot]=sha256(pixels);
const common={sourceCombined:binding.sourceCombined,contractCombined:binding.contractCombined,productionCombined:binding.productionCombined,screenshot,screenshotSha256:sha256(pixels)};
const bases=['360x800','390x844','768x1024','1440x900','1920x1080','2560x1440','3440x1440','5120x1440','390x568'];
const records={
 'native-title-tooltip':['chromium','firefox'].flatMap(engine=>['light','dark'].flatMap(theme=>bases.map(base=>{const [width,height]=base.split('x').map(Number);return {...common,engine,theme,viewport:{width,height},surface:'native-title-tooltip',status:'CAPTURED',title:'synthetic unit title',histogram:{},changed:{},dimensions:{},tooltipBounds:{},pixelContrast:{foreground:{contrast:7}}}}))),
 'browser-zoom':['chromium','firefox'].flatMap(engine=>['light','dark'].map(theme=>({...common,engine,theme,surface:'browser-zoom',status:'PASS',baseline:{width:1440},measured:{width:720,documentWidth:720,regions:[1,2,3].map(()=>({width:100,x:0,right:100}))},nativeBaseline:'WINDOW=123\nX=0\nY=0\nWIDTH=1440\nHEIGHT=900\nSCREEN=0',nativeMeasured:'WINDOW=123\nX=0\nY=0\nWIDTH=1440\nHEIGHT=900\nSCREEN=0'})))
};
for(const [name,value] of Object.entries(records)){const file=name+'.json';writeFileSync(join(bundle,file),JSON.stringify(value));manifest.artifacts[file]=sha256(readFileSync(join(bundle,file)));manifest.surfaceEvidence[name]=[file];}
const load=()=>{writeFileSync(join(bundle,'manifest.json'),JSON.stringify(manifest));try{loadV3Evidence(bundle,repo);return {accepted:true};}catch(e){return {accepted:false,error:String(e)}}};
const baseline=load();mkdirSync(join(bundle,'matrix'));writeFileSync(join(bundle,'matrix/source.json'),JSON.stringify(binding));writeFileSync(join(bundle,'surface-evidence.json'),JSON.stringify(manifest.surfaceEvidence));execFileSync(process.execPath,[resolve(repository,'scripts/package-v3-evidence.mjs'),bundle],{cwd:repo,env:{...process.env,V3_EVIDENCE_AUTHOR:'explicit-author-fixture'},stdio:'pipe'});const packagedAuthor=JSON.parse(readFileSync(join(bundle,'manifest.json'),'utf8')).author;delete manifest.production['assets/imported.js'];manifest.productionCombined=combinedHashes(manifest.production);for(const [name,value] of Object.entries(records)){for(const record of value)record.productionCombined=manifest.productionCombined;const file=name+'.json';writeFileSync(join(bundle,file),JSON.stringify(value));manifest.artifacts[file]=sha256(readFileSync(join(bundle,file)));}const omitted=load();
writeFileSync(join(repo,'dist/assets/imported.js'),'throw new Error("mutated unbound imported production asset");');const mutated=load();
manifest.production['assets/extra.js']=sha256('absent');manifest.productionCombined=combinedHashes(manifest.production);const extra=load();
rmSync(root,{recursive:true,force:true});
return {baseline,omitted,mutated,extra,packagedAuthor};
}
