import {expect, test, type Page} from '@playwright/test';

const MAINNET = 'NetXdQprcVkpaWU', SHADOWNET = 'NetXsqzbfFenSTS';
const version = {version: {major: 24, minor: 1, additional_info: 'release'}, network_version: {chain_name: 'TEZOS_MAINNET'}};
const header = (chain = MAINNET) => ({chain_id: chain, level: 100, hash: 'BBlock100', predecessor: 'BBlock99', timestamp: new Date().toISOString(), fitness: ['02', '00000064', '', 'ffffffff', '00000000'], payload_hash: 'vhPayload100'});
const cors = {'access-control-allow-origin': '*'};
const shots = process.env['OBSERVATORY_SCREENSHOT_DIR'];

/** Deterministic custom nodes, one per failure class the browser can distinguish. */
async function nodes(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort('blockedbyclient'));
  await page.route(/^https:\/\/(ok|ok2)\.example:8732\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/version') return route.fulfill({headers: cors, json: version});
    if (path.endsWith('/header')) return route.fulfill({headers: cors, json: header()});
    if (path === '/monitor/heads/main') return route.fulfill({headers: cors, body: `${JSON.stringify(header())}\n`, contentType: 'application/json'});
    return route.fulfill({headers: cors, status: 404, body: 'Not found'});
  });
  await page.route(/^https:\/\/acl2?\.example:8732\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/version') return route.fulfill({headers: cors, json: version});
    if (path.endsWith('/header')) return route.fulfill({headers: cors, json: header()});
    return route.fulfill({headers: cors, status: 403, body: 'Unauthorized RPC access'});
  });
  await page.route(/^https:\/\/shadow\.example\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/version') return route.fulfill({headers: cors, json: {...version, network_version: {chain_name: 'TEZOS_SHADOWNET_2025-08-07T20:00:00Z'}}});
    if (path.endsWith('/header')) return route.fulfill({headers: cors, json: header(SHADOWNET)});
    if (path === '/monitor/heads/main') return route.fulfill({headers: cors, body: `${JSON.stringify(header(SHADOWNET))}\n`, contentType: 'application/json'});
    return route.fulfill({headers: cors, status: 404, body: 'Not found'});
  });
  await page.route(/^https:\/\/down\.example:8732\//, route => route.abort('connectionrefused'));
  await page.route(/^https:\/\/wrong\.example\//, route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({headers: cors, json: path === '/version' ? version : header('NetXsqzbfFenSTS')});
  });
  await page.route(/^https:\/\/html\.example\//, route => route.fulfill({headers: cors, body: '<!doctype html><title>It works</title>', contentType: 'text/html'}));
  await page.route(/^https:\/\/nf\.example\//, route => route.fulfill({headers: cors, status: 404, body: 'Not found'}));
}

const row = (page: Page, url: string, network = 'mainnet') => page.locator(`.network-panel.${network} .custom-source[data-url="${url}"]`);

test('custom mainnet sources from ?rpc= are probed and each failure class gets an actionable diagnosis', async ({page}, info) => {
  await nodes(page);
  // At most four custom sources per network: the six failure classes take two page loads.
  await page.goto('/?rpc=https://ok.example:8732/,https://acl.example:8732&rpc=https://down.example:8732&rpc=https://wrong.example&rpc=https://user:pw@ok.example');
  const panel = page.locator('.network-panel.mainnet .custom-sources');
  await expect(panel).toBeVisible();
  await expect(row(page, 'https://ok.example:8732')).toContainText('Custom · ok.example:8732');
  await expect(row(page, 'https://ok.example:8732')).toContainText('from ?rpc=');
  await expect(row(page, 'https://ok.example:8732').locator('.custom-source-status')).toHaveText(/Mainnet ✓ · Octez 24\.1 · TEZOS_MAINNET · head stream delivering/);
  const acl = row(page, 'https://acl.example:8732');
  await expect(acl.locator('.custom-source-diagnosis .source-diagnosis')).toHaveAttribute('data-class', 'acl');
  await expect(acl.locator('.custom-source-status')).toContainText('Failed at /monitor/heads/main');
  await expect(acl.locator('.custom-source-diagnosis')).toContainText('--allow-all-rpc <public-address>:8732');
  await expect(acl.locator('.custom-source-diagnosis')).toContainText('GET /chains/*/mempool/monitor_operations');
  const down = row(page, 'https://down.example:8732').locator('.custom-source-diagnosis .source-diagnosis');
  await expect(down).toHaveAttribute('data-class', 'unreachable-or-cors');
  await expect(down).toContainText("--cors-origin 'http://127.0.0.1");
  await expect(down).toContainText('--rpc-addr <public-address>:8732');
  await expect(row(page, 'https://wrong.example').locator('.source-diagnosis')).toContainText('Wrong chain: NetXsqzbfFenSTS is not Tezos mainnet');
  await expect(panel.locator('.custom-source.rejected')).toContainText('Credentials in the URL');
  // Custom sources join the shared source list used for streams and RPC reads.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.startsWith('https://ok.example:8732/monitor/')))).toBe(true);
  if (shots && info.project.name === 'chromium')
    for (const [name, url] of [['acl', 'https://acl.example:8732'], ['unreachable-or-cors', 'https://down.example:8732'], ['wrong-chain', 'https://wrong.example'], ['ok', 'https://ok.example:8732']] as const)
      await row(page, url).screenshot({path: `${shots}/custom-source-${name}.png`});
  await page.goto('/?rpc=https://html.example&rpc=https://nf.example/prefix');
  await expect(row(page, 'https://html.example').locator('.custom-source-diagnosis .source-diagnosis')).toContainText('Not an Octez node RPC: the response is not JSON');
  await expect(row(page, 'https://nf.example/prefix').locator('.custom-source-diagnosis .source-diagnosis')).toHaveAttribute('data-class', 'not-exposed');
  if (shots && info.project.name === 'chromium') {
    for (const [name, url] of [['not-json', 'https://html.example'], ['not-exposed', 'https://nf.example/prefix']] as const)
      await row(page, url).screenshot({path: `${shots}/custom-source-${name}.png`});
    await panel.screenshot({path: `${shots}/custom-source-panel.png`});
  }
});

test('adding a custom source probes it, refuses failures and persists successes; removal restores built-ins', async ({page}) => {
  await nodes(page);
  await page.goto('/');
  const panel = page.locator('.network-panel.mainnet .custom-sources');
  await expect(panel).toContainText('No custom source');
  const input = panel.getByLabel('Mainnet node RPC URL'), add = panel.getByRole('button', {name: 'Check & add'});
  await input.fill('ftp://node.example');await add.click();
  await expect(panel.locator('.custom-source-result')).toContainText('Only http:// and https://');
  await input.fill('https://acl2.example:8732/');await add.click();
  await expect(panel.locator('.custom-source-result')).toContainText('Not added: https://acl2.example:8732 failed at /monitor/heads/main');
  await expect(panel.locator('.custom-source-result .source-diagnosis')).toHaveAttribute('data-class', 'acl');
  expect(await page.evaluate(() => localStorage.getItem('observatory:mainnet:custom-rpc'))).toBeNull();
  await input.fill('https://ok2.example:8732/');
  await Promise.all([page.waitForEvent('load'), add.click()]);
  await expect(row(page, 'https://ok2.example:8732')).toContainText('saved in this browser');
  expect(await page.evaluate(() => localStorage.getItem('observatory:mainnet:custom-rpc'))).toBe('["https://ok2.example:8732"]');
  await Promise.all([page.waitForEvent('load'), row(page, 'https://ok2.example:8732').getByRole('button', {name: /Remove/}).click()]);
  await expect(panel).toContainText('No custom source');
  expect(await page.evaluate(() => localStorage.getItem('observatory:mainnet:custom-rpc'))).toBe('[]');
});

test('shadownet has its own ?rpc_shadownet= sources, chain check and panel', async ({page}) => {
  await nodes(page);
  await page.goto('/?rpc_shadownet=https://shadow.example,https://ok.example:8732');
  await page.locator('.network-tab.shadownet').click();
  const panel = page.locator('.network-panel.shadownet .custom-sources');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h4')).toHaveText('Custom Shadownet RPC sources');
  await expect(row(page, 'https://shadow.example', 'shadownet')).toContainText('from ?rpc_shadownet=');
  await expect(row(page, 'https://shadow.example', 'shadownet').locator('.custom-source-status')).toHaveText(/Shadownet ✓ · Octez 24\.1 · TEZOS_SHADOWNET_2025-08-07T20:00:00Z · head stream delivering/);
  const wrong = row(page, 'https://ok.example:8732', 'shadownet').locator('.custom-source-diagnosis .source-diagnosis');
  await expect(wrong).toHaveAttribute('data-class', 'wrong-network');
  await expect(wrong).toContainText('Wrong chain: NetXdQprcVkpaWU is not Tezos shadownet');
  await expect(wrong).toContainText('add it to the Mainnet panel instead');
  await expect(page.locator('.network-panel.mainnet .custom-sources')).toContainText('No custom source');
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.startsWith('https://shadow.example/monitor/')))).toBe(true);
  await Promise.all([page.waitForEvent('load'), row(page, 'https://shadow.example', 'shadownet').getByRole('button', {name: /Remove/}).click()]);
  expect(new URL(page.url()).searchParams.getAll('rpc_shadownet')).toEqual(['https://ok.example:8732']);
});
