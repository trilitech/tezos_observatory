import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test,expect} from '@playwright/test';
import {prepare} from './productionFixture';
import {annotateV3} from './v3Verification';
const loaded:unknown=await import(new URL('../../scripts/v3-evidence-contract.mjs',import.meta.url).href);
if(typeof loaded!=='object'||loaded===null||!('loadV3Evidence' in loaded)||typeof loaded.loadV3Evidence!=='function'||!('requireIndependentReceipt' in loaded)||typeof loaded.requireIndependentReceipt!=='function')throw new Error('Missing evidence contract consumer');
const loadEvidence=loaded.loadV3Evidence,requireReceipt=loaded.requireIndependentReceipt;
const load=()=>loadEvidence(process.env['V3_RELEASE_EVIDENCE']);
const receipt=(bundle:unknown,criterion:string,role:string,kind:string)=>requireReceipt(bundle,criterion,role,kind);
test.afterEach(async({},info)=>annotateV3(info));
async function actualProduct(page:import('@playwright/test').Page){await prepare(page,false);await expect(page.getByRole('heading',{name:'Tezos Observatory',exact:true})).toBeVisible();await expect(page.locator('.mainnet .navigator-junction')).toBeVisible();}

test('V3 AC-08 independent release prerequisites bind exact production source',async({page})=>{
 await actualProduct(page);const bundle=load();receipt(bundle,'AC-08','reviewer','semantic');receipt(bundle,'AC-08','qa','deterministic');receipt(bundle,'AC-08','reviewer','visual');
});
test('V3 AC-24 foundation interfaces and independent semantic receipts remain source bound',async({page})=>{
 await actualProduct(page);const foundation=readFileSync('specs/observatory-foundations.md');expect(createHash('sha256').update(foundation).digest('hex')).toBe('851b2b63b9d75554825a8429fcd6405882d9d28703350dc55113e2130907a7fa');expect(createHash('sha256').update(readFileSync('specs/observatory-v3.md')).digest('hex')).toBe('36e802b2ac81224d792e519406ab8e50d60cad05eba11796d973387f9014a40b');const bundle=load();receipt(bundle,'AC-24','reviewer','semantic');receipt(bundle,'AC-24','qa','deterministic');
});
test('V3 AC-25 complete production variant manifest rejects incomplete evidence',async({page})=>{
 await actualProduct(page);const bundle=load();expect(bundle.manifest.namespace).toBe('observatory-v3');
});
test('V3 AC-34 independent visual receipt binds actual dense production',async({page})=>{
 await actualProduct(page);const bundle=load();receipt(bundle,'AC-34','reviewer','visual');
});
test('V3 AC-36 native and zoom surface evidence is complete and source bound',async({page})=>{
 await actualProduct(page);const bundle=load();expect(bundle.manifest.additionalSurfaces).toContain('native-title-tooltip');expect(bundle.manifest.additionalSurfaces).toContain('browser-zoom');
});
