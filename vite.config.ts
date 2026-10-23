import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";

export default defineConfig({
  base: "./",
  define: {__APP_REVISION__: JSON.stringify(execFileSync("git",["rev-parse","--short","HEAD"]).toString().trim())},
  root: "src",
  build: {outDir: "../dist", emptyOutDir: true, manifest:true, rollupOptions:{preserveEntrySignatures:"strict",input:Object.fromEntries(["index.html","baker.html","inspection.ts","fixtures/opportunities.html","fixtures/missing.html"].map(path=>[path,fileURLToPath(new URL(`./src/${path}`,import.meta.url))]))}},
  test: {include: ["../tests/unit/**/*.test.ts"]},
});
