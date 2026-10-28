import {expect, test, type Page} from '@playwright/test';
import {createServer, type Server} from 'node:http';
import {head, headers, prepare} from './productionFixture';

const MAINNET = 'NetXdQprcVkpaWU', SHADOWNET = 'NetXsqzbfFenSTS';
const cors = {'access-control-allow-origin': '*'};
const version = {version: {major: 24, minor: 1, additional_info: 'release'}, network_version: {chain_name: 'TEZOS'}};
const nodeHeader = (chain: string) => ({chain_id: chain, level: 100, hash: 'BBlock100', predecessor: 'BBlock99', timestamp: new Date().toISOString(), fitness: ['02', '00000064', '', 'ffffffff', '00000000'], payload_hash: 'vhPayload100'});
const row = (page: Page, url: string, network = 'mainnet') => page.locator(`.network-panel.${network} .custom-source[data-url="${url}"]`);
const panel = (page: Page, network = 'mainnet') => page.locator(`.network-panel.${network} .custom-sources`);

/** A healthy mainnet node and an ACL-restricted one; every other external host is unreachable. */
async function nodes(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort('blockedbyclient'));
  await page.route(/^https:\/\/(ok|ok2)\.example:8732\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/version') return route.fulfill({headers: cors, json: version});
    if (path.endsWith('/header')) return route.fulfill({headers: cors, json: nodeHeader(MAINNET)});
    if (path === '/monitor/heads/main') return route.fulfill({headers: cors, body: `${JSON.stringify(nodeHeader(MAINNET))}\n`, contentType: 'application/json'});
    return route.fulfill({headers: cors, status: 404, body: 'Not found'});
  });
  await page.route(/^https:\/\/acl2\.example:8732\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/header')) return route.fulfill({headers: cors, json: nodeHeader(MAINNET)});
    return route.fulfill({headers: cors, status: 403, body: 'Unauthorized RPC access'});
  });
}
const loads = (page: Page): {count: number} => {const counter = {count: 0}; page.on('load', () => counter.count++); return counter;};

test('H1 a wrong-chain ?rpc= source neither fixes the network identity nor displaces built-in data', async ({page}) => {
  await prepare(page);
  await page.route(/^https:\/\/wrong-chain\.example\//, async route => {
    const path = new URL(route.request().url()).pathname;
    // Delay the startup probe so the runtime first derives a context from this node.
    if (path === '/chains/main/blocks/head/header') await new Promise(resolve => setTimeout(resolve, 4_000));
    if (path === '/version') return route.fulfill({headers: cors, json: version});
    if (path.endsWith('/header')) {
      const hash = path.split('/blocks/')[1]?.split('/')[0] ?? '', observed = hash === 'head' ? head(100) : headers.get(page)?.get(hash);
      return observed ? route.fulfill({headers: cors, json: {...observed, chain_id: SHADOWNET}}) : route.fulfill({headers: cors, status: 404, json: {error: 'Unobserved header'}});
    }
    if (path.endsWith('/protocols')) return route.fulfill({headers: cors, json: {protocol: 'PFixture', next_protocol: 'PFixture'}});
    return route.fulfill({headers: cors, status: 404, body: 'Not found'});
  });
  await page.goto('/?rpc=https://wrong-chain.example');
  const wrong = row(page, 'https://wrong-chain.example');
  await expect(wrong.locator('.source-diagnosis')).toContainText('Wrong chain: NetXsqzbfFenSTS is not Tezos mainnet');
  await expect(wrong.locator('.custom-source-status')).toContainText('Not used for reads or streams');
  const identity = () => page.evaluate(() => {
    const trace = (window as unknown as {fixtureDomainTrace?: {network: string; networkIdentity?: {chainId: string; source: {baseUrl: string}} | null}[]}).fixtureDomainTrace ?? [];
    const latest = trace.filter(frame => frame.network === 'mainnet').at(-1)?.networkIdentity;
    return latest ? `${latest.chainId} ${latest.source.baseUrl}` : 'none';
  });
  await expect.poll(identity, {timeout: 20_000}).toMatch(/^NetFixture https:\/\/(?!wrong-chain)/);
  await expect(page.locator('.mainnet .headline')).toContainText('100');
  await expect(page.locator('.network-panel.mainnet .connection-line')).not.toContainText('wrong-chain.example');
});

test('M4 a link-supplied source is announced next to the network header with a way to review it', async ({page}) => {
  await nodes(page);
  await page.goto('/');
  await expect(page.locator('.network-panel.mainnet .custom-source-notice')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('observatory:mainnet:custom-rpc', JSON.stringify(['https://ok2.example:8732'])));
  await page.goto('/?rpc=https://ok.example:8732');
  const notice = page.locator('.network-panel.mainnet .observer-summary .custom-source-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText('Using 2 custom RPC sources: ok.example:8732 (from this link), ok2.example:8732 (saved in this browser) · Review');
  await notice.getByRole('button', {name: 'Review custom Mainnet RPC sources'}).click();
  await expect(panel(page).locator('h4')).toBeFocused();
  await expect(panel(page).locator('h4')).toBeInViewport();
  await expect(page.locator('.network-panel.shadownet .custom-source-notice')).toHaveCount(0);
});

test('M5 adding keeps focus, ties errors to the input, announces briefly and labels the diagnosis by its title', async ({page}) => {
  await nodes(page);
  await page.goto('/');
  const input = panel(page).getByLabel('Mainnet node RPC URL'), add = panel(page).getByRole('button', {name: 'Check & add'});
  await input.fill('ftp://node.example'); await add.click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const described = await input.getAttribute('aria-describedby');
  expect(described).toBeTruthy();
  await expect(page.locator(`#${described}`)).toContainText('Only http:// and https://');
  await input.fill('https://acl2.example:8732');
  await add.focus(); await page.keyboard.press('Enter');
  await expect(add).toBeFocused();
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter'); // ignored while probing
  await expect(panel(page).locator('.custom-source-result .source-diagnosis')).toHaveAttribute('data-class', 'acl');
  await expect(add).toBeFocused();
  await expect(add).toHaveAttribute('aria-disabled', 'false');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const live = panel(page).locator('[aria-live]');
  await expect(live).toHaveCount(1);
  const announced = await live.textContent() ?? '';
  expect(announced).toContain('Not added: https://acl2.example:8732 failed at /monitor/heads/main');
  expect(announced.length).toBeLessThan(200);
  await expect(live.locator('.source-diagnosis')).toHaveCount(0);
  const group = panel(page).locator('.custom-source-result .source-diagnosis');
  expect(await group.getAttribute('aria-label')).toBeNull();
  const title = await group.getAttribute('aria-labelledby');
  await expect(page.locator(`#${title}`)).toHaveText(/^HTTP 403: the node's RPC ACL refuses/);
  for (const summary of await panel(page).locator('.custom-source-result summary').all())
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.9); // Sub-pixel layout in Firefox.
  await input.fill('https://ok.example:8732');
  await Promise.all([page.waitForEvent('load'), add.click()]);
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

test('L3 and T1 built-in and duplicate URLs are refused before probing, and built-ins from a link are reported', async ({page}) => {
  await nodes(page);
  await page.goto('/?rpc=https://ok.example:8732&rpc=https://rpc.tzkt.io/mainnet/');
  const loaded = loads(page);
  await expect(panel(page).locator('.custom-source.rejected')).toContainText('Already a built-in provider');
  const input = panel(page).getByLabel('Mainnet node RPC URL'), add = panel(page).getByRole('button', {name: 'Check & add'}), result = panel(page).locator('.custom-source-result');
  const probes: string[] = [];
  page.on('request', request => {if (request.url().endsWith('/chains/main/blocks/head/header')) probes.push(request.url());});
  await input.fill('https://mainnet.smartpy.io/'); await add.click();
  await expect(result).toContainText('https://mainnet.smartpy.io is already a built-in provider');
  await input.fill('https://ok.example:8732/'); await add.click();
  await expect(result).toContainText('https://ok.example:8732 is already a custom source');
  await page.waitForTimeout(300);
  expect(probes.filter(url => url.startsWith('https://mainnet.smartpy.io') || url.startsWith('https://ok.example'))).toEqual([]);
  expect(loaded.count).toBe(0);
});

test('L1 rejected link input is shown bounded, without bidi controls', async ({page}) => {
  await nodes(page);
  await page.goto(`/?rpc=${encodeURIComponent(`‮ftp://${'y'.repeat(6_000)}`)}`);
  const echo = await panel(page).locator('.custom-source.rejected strong').textContent() ?? '';
  expect(echo.length).toBeLessThanOrEqual(120);
  expect(echo).not.toContain('‮');
});

test('T1 without storage an added source is carried in the link, and Remove then drops it', async ({page}) => {
  await page.addInitScript(() => {Storage.prototype.setItem = () => {throw new DOMException('blocked', 'SecurityError');};});
  await nodes(page);
  await page.goto('/');
  const input = panel(page).getByLabel('Mainnet node RPC URL');
  await input.fill('https://ok2.example:8732');
  await Promise.all([page.waitForEvent('load'), panel(page).getByRole('button', {name: 'Check & add'}).click()]);
  expect(new URL(page.url()).searchParams.getAll('rpc')).toEqual(['https://ok2.example:8732']);
  await expect(row(page, 'https://ok2.example:8732')).toContainText('from ?rpc=');
  await Promise.all([page.waitForEvent('load'), row(page, 'https://ok2.example:8732').getByRole('button', {name: /Remove/}).click()]);
  expect(new URL(page.url()).searchParams.getAll('rpc')).toEqual([]);
  await expect(panel(page)).toContainText('No custom source');
});

test('L4 Remove clears the URL from the link and from storage at once', async ({page}) => {
  await nodes(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('observatory:mainnet:custom-rpc', JSON.stringify(['https://ok.example:8732', 'https://ok2.example:8732'])));
  await page.goto('/?rpc=https://ok.example:8732/');
  await expect(row(page, 'https://ok.example:8732')).toContainText('from ?rpc=');
  await Promise.all([page.waitForEvent('load'), row(page, 'https://ok.example:8732').getByRole('button', {name: /Remove/}).click()]);
  expect(new URL(page.url()).searchParams.getAll('rpc')).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('observatory:mainnet:custom-rpc'))).toBe('["https://ok2.example:8732"]');
  await expect(row(page, 'https://ok.example:8732')).toHaveCount(0);
});

test('L4 a failed storage write on Remove is reported instead of reloading', async ({page}) => {
  await page.addInitScript(() => {
    try {localStorage.setItem('observatory:mainnet:custom-rpc', JSON.stringify(['https://ok2.example:8732']));} catch { /* Already blocked. */ }
    Storage.prototype.setItem = () => {throw new DOMException('quota', 'QuotaExceededError');};
  });
  await nodes(page);
  await page.goto('/');
  const loaded = loads(page);
  await row(page, 'https://ok2.example:8732').getByRole('button', {name: /Remove/}).click();
  await expect(row(page, 'https://ok2.example:8732').locator('[role=alert]')).toContainText('could not be removed from this browser\'s storage');
  await page.waitForTimeout(300);
  expect(loaded.count).toBe(0);
});

/**
 * Local nodes whose streams stay open: /silent/… never sends a message; /flaky/… (shadownet)
 * refuses its head stream with HTTP 403 while `flaky.failing`, then sends a head and stays open.
 */
let silentServer: Server, silentPort = 0;
const flaky = {failing: true};
test.beforeAll(async () => {
  silentServer = createServer((request, response) => {
    response.setHeader('access-control-allow-origin', '*');
    const [, node = '', ...rest] = (request.url ?? '').split('?')[0]!.split('/'), path = `/${rest.join('/')}`;
    const chain = node === 'flaky' ? SHADOWNET : MAINNET;
    if (path.endsWith('/header')) {response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(nodeHeader(chain))); return;}
    if (node === 'flaky' && path === '/monitor/heads/main') {
      if (flaky.failing) {response.statusCode = 403; response.end('Unauthorized RPC access'); return;}
      response.writeHead(200, {'content-type': 'application/json'}); response.write(`${JSON.stringify(nodeHeader(chain))}\n`); return; // Stays open.
    }
    if (node === 'silent' && path.startsWith('/monitor/')) {response.writeHead(200, {'content-type': 'application/json'}); response.flushHeaders(); return;} // Open, never sends.
    response.statusCode = 404; response.end('Not found');
  });
  await new Promise<void>(resolve => silentServer.listen(0, '127.0.0.1', () => resolve()));
  silentPort = (silentServer.address() as {port: number}).port;
});
test.afterAll(() => {silentServer.closeAllConnections(); silentServer.close();});

test('M1 a head stream that opens but sends nothing is a warning, not a check mark', async ({page}, info) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort('blockedbyclient'));
  const base = `http://127.0.0.1:${silentPort}/silent`;
  await page.goto(`/?rpc=${base}`);
  const status = row(page, base).locator('.custom-source-status');
  // Firefox resolves fetch() only with the first body byte, so the same node is a probe timeout there.
  if (info.project.name === 'firefox') {
    await expect(status).toHaveAttribute('data-state', 'failed', {timeout: 20_000});
    await expect(status).toContainText('No answer from 127.0.0.1');
    return;
  }
  await expect(status).toHaveAttribute('data-state', 'warning', {timeout: 20_000});
  await expect(status).toContainText('Mainnet ⚠');
  await expect(status).toContainText('head stream open but no block within 10 s');
  await expect(status).not.toContainText('✓');
});

test('T1 a live stream error on a custom source is cleared once the source delivers again', async ({page}) => {
  test.setTimeout(90_000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort('blockedbyclient'));
  const base = `http://127.0.0.1:${silentPort}/flaky`;
  await page.goto(`/?rpc_shadownet=${base}`);
  await page.locator('.network-tab.shadownet').click();
  const live = row(page, base, 'shadownet').locator('.custom-source-live').filter({has: page.locator('summary', {hasText: 'Live error on /monitor/heads/main:'})});
  await expect(live).toContainText('HTTP 403', {timeout: 20_000});
  for (const summary of await row(page, base, 'shadownet').locator('.custom-source-live > summary').all())
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.9); // Sub-pixel layout in Firefox.
  flaky.failing = false;
  await expect(live).toHaveCount(0, {timeout: 60_000});
});
