import {spawnSync} from 'node:child_process';

// Ratchet check for the custom-rpc-sources review (H1): a viewer-supplied source on another
// chain must never fix, or be authorized under, the network identity.
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/unit/customSourceSafety.test.ts','-t','H1: chain identity is pinned for custom sources'],{encoding:'utf8',timeout:600000,maxBuffer:20000000});
const output=`${result.stdout??''}${result.stderr??''}`;
process.stdout.write(output);
// Require the selected tests to have actually run and passed: an empty selection is not a pass.
const passed=/Tests\s+(\d+) passed/.exec(output);
process.exitCode=result.status===0&&passed&&Number(passed[1])>=3?0:1;
