import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { generateSW } from 'workbox-build';

// 专用构建和临时浏览器存储，不读取、修改日常试玩存档或正式站点。
const root = resolve('.pwa-check');
const versionA = join(root, 'dist');
const versionB = join(root, 'version-b');
const prefix = '/digimon-card-roguelike/';
const saveKey = 'digimon-journey-v1';
const screenshots = resolve('docs/reports/offline');
const manifest = JSON.parse(await readFile(join(versionA, 'offline-files.json'), 'utf8'));
const sw = await readFile(join(versionA, 'sw.js'), 'utf8');
const cached = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]));
assert(manifest.length > 100);
for (const file of [...manifest, 'offline-files.json']) {
  assert(cached.has(file), `未纳入预缓存: ${file}`);
  assert((await stat(join(versionA, file))).size > 0, `缺失文件: ${file}`);
}
assert(!manifest.some((file) => /tests|manual|previews/.test(file)));
const appManifest = JSON.parse(await readFile(join(versionA, 'manifest.webmanifest'), 'utf8'));
assert.equal(appManifest.start_url, './');
assert.equal(appManifest.scope, './');
assert.equal(appManifest.display, 'standalone');
for (const icon of appManifest.icons) assert(manifest.includes(icon.src));

await rm(versionB, { recursive: true, force: true });
await cp(versionA, versionB, { recursive: true, force: true });
const titleA = '数码旅途 · 卡片抽换之旅';
const titleB = '数码旅途 · 离线更新验收';
await writeFile(join(versionB, 'index.html'), (await readFile(join(versionB, 'index.html'), 'utf8')).replace(titleA, titleB));
await writeFile(join(versionB, 'THIRD_PARTY_NOTICES.txt'), (await readFile(join(versionB, 'THIRD_PARTY_NOTICES.txt'), 'utf8')) + '\n离线更新验收版本 B\n');
await generateSW({
  globDirectory: versionB,
  swDest: join(versionB, 'sw.js'),
  globPatterns: ['**/*.{html,js,css,png,jpg,jpeg,svg,json,txt,webmanifest}'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  cacheId: 'digimon-journey',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/\.[a-z0-9]+$/i],
  importScripts: ['pwa-guard.js'],
});

let current = versionA;
let failAsset = false;
let transientFailures = 1;
let noticesRequests = 0;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/other/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<title>Other project</title>other project');
    return;
  }
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
  if (url.pathname.endsWith('THIRD_PARTY_NOTICES.txt')) {
    noticesRequests += 1;
    if (failAsset || transientFailures > 0) {
      if (transientFailures > 0) transientFailures -= 1;
      res.writeHead(503); res.end(); return;
    }
  }
  const name = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  const file = resolve(current, name);
  if (!file.startsWith(current + '/')) { res.writeHead(404); res.end(); return; }
  try {
    const content = await readFile(file);
    res.setHeader('Content-Type', types[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + prefix;
const browser = await chromium.launch(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {});
await mkdir(screenshots, { recursive: true });
const results = [];
const errors = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
function watch(page) { page.on('pageerror', (error) => errors.push(error.message)); }
async function settings(page) { await page.getByRole('button', { name: '设置', exact: true }).click(); }
async function closeSettings(page) { await page.getByRole('button', { name: '关闭', exact: true }).click(); }
async function save(page) { return page.evaluate((key) => localStorage.getItem(key), saveKey); }
function sameSave(actual, expected) { assert.deepEqual(JSON.parse(actual), JSON.parse(expected)); }
function result(name) { results.push(name); console.log(`✓ ${name}`); }
try {
  let page = await context.newPage();
  watch(page);
  await page.goto(url);
  await expect(page.getByText('已可离线游玩 · 断网后也能重新打开')).toBeVisible({ timeout: 30_000 });
  assert.equal(transientFailures, 0);
  assert.equal(noticesRequests, 2);
  result('首次资源短暂下载失败后自动重试成功，无需手动刷新且不残留失败提示');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), url);
  await page.screenshot({ path: join(screenshots, 'home-390.png'), fullPage: true });
  result(`完整预缓存覆盖 ${manifest.length} 个资源，项目子路径正确`);

  // 在真实界面开始旅途、出牌，随后关闭页面并断网重启。
  await page.getByRole('button', { name: '与基尔兽出发', exact: true }).click();
  await page.getByRole('button', { name: /守护之心/ }).click();
  await page.getByRole('button', { name: /^1层 .*点击出发/ }).first().click();
  await page.locator('.hand .game-card').first().click();
  await page.getByRole('button', { name: /^使用 / }).click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).run.battle.played === 1, saveKey);
  const battleSave = await save(page);
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  watch(page);
  await page.goto(url);
  await expect(page.locator('.hand .game-card').first()).toBeVisible();
  sameSave(await save(page), battleSave);
  await page.reload();
  await expect(page.locator('.hand .game-card').first()).toBeVisible();
  sameSave(await save(page), battleSave);
  assert(await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0)));
  const allResources = await page.evaluate(async (files) => {
    for (const file of files) {
      const response = await fetch(new URL(file, location.href));
      if (!response.ok) return file;
      if (/\.(png|jpg)$/.test(file) && !response.headers.get('content-type')?.startsWith('image/')) return file;
    }
    return null;
  }, manifest);
  assert.equal(allResources, null);
  result('断网关闭再打开与刷新：已出牌的手牌、随机状态和存档完整恢复；全部资源可读取');
  await settings(page);
  await expect(page.getByRole('button', { name: /导入存档备份/ })).toBeDisabled();
  await closeSettings(page);

  // 从游戏界面结束旧局；离线导入需要显式确认，取消与错误文件不改存档。
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('button', { name: '结束当前旅途，重新选择搭档' }).click();
  await page.getByRole('button', { name: '重新出发', exact: true }).click();
  const ended = await save(page);
  await settings(page);
  await page.getByLabel('选择存档备份').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('alert')).toContainText('无法读取');
  assert.equal(await save(page), ended);
  await page.getByLabel('选择存档备份').setInputFiles({ name: 'battle.json', mimeType: 'application/json', buffer: Buffer.from(battleSave) });
  await expect(page.getByRole('region', { name: '存档导入预览' })).toBeVisible();
  assert.equal(await save(page), ended);
  await page.getByRole('button', { name: '取消导入' }).click();
  assert.equal(await save(page), ended);
  await page.getByLabel('选择存档备份').setInputFiles({ name: 'battle.json', mimeType: 'application/json', buffer: Buffer.from(battleSave) });
  await page.getByRole('button', { name: '确认替换并导入' }).click();
  await expect(page.locator('.hand .game-card').first()).toBeVisible();
  sameSave(await save(page), battleSave);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key + '-before-import'), saveKey), ended);
  result('离线导入：错误文件和取消不覆盖，确认后备份旧记录并恢复战斗，战斗内导入禁用');

  // 模拟发布：新资源失败时保留旧版；重试成功后新版本等待玩家确认。
  await context.setOffline(false);
  current = versionB;
  failAsset = true;
  await settings(page);
  await page.getByRole('button', { name: '检查离线资源与更新' }).click();
  await expect(page.getByText('离线资源下载未完成，请联网后重试。')).toBeVisible({ timeout: 30_000 });
  assert.equal(await page.title(), titleA);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hand .game-card').first()).toBeVisible();
  assert.equal(await page.title(), titleA);
  sameSave(await save(page), battleSave);
  result('新版下载失败后，旧版仍可断网重启并恢复存档');
  failAsset = false;
  await context.setOffline(false);
  await settings(page);
  await page.getByRole('button', { name: '检查离线资源与更新' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /保存并更新/ })).toBeDisabled({ timeout: 30_000 });
  assert.equal(await page.title(), titleA);
  await closeSettings(page);
  await page.getByRole('button', { name: '稍后', exact: true }).click();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('button', { name: '结束当前旅途，重新选择搭档' }).click();
  await page.getByRole('button', { name: '重新出发', exact: true }).click();
  await settings(page);
  const otherGame = await context.newPage();
  watch(otherGame);
  await otherGame.goto(url);
  await expect(otherGame.getByRole('button', { name: '与基尔兽出发', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /^保存并更新/ }).click();
  await expect(page.getByRole('alert')).toContainText('关闭其他数码旅途窗口');
  assert.equal(await page.title(), titleA);
  await otherGame.close();
  const unrelated = await context.newPage();
  await unrelated.goto(origin + '/other/');
  const beforeUpdate = await save(page);
  await page.getByRole('dialog').getByRole('button', { name: /^保存并更新/ }).click();
  await expect(page).toHaveTitle(titleB, { timeout: 30_000 });
  sameSave(await save(page), beforeUpdate);
  await unrelated.close();
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  watch(page);
  await page.goto(url);
  await expect(page).toHaveTitle(titleB);
  await expect(page.getByText('已可离线游玩 · 断网后也能重新打开')).toBeVisible();
  sameSave(await save(page), beforeUpdate);
  result('提示式更新：战斗中禁用、多游戏窗口阻止切换、其他项目不受影响；新版断网重启保留进度');

  // 离线从头开新局和手机布局。
  await page.getByRole('button', { name: '与基尔兽出发', exact: true }).click();
  await expect(page.getByRole('heading', { name: '带上一份祝福。' })).toBeVisible();
  await page.getByRole('button', { name: /守护之心/ }).click();
  await settings(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
    await page.screenshot({ path: join(screenshots, `settings-${width}.png`), fullPage: true });
  }
  result('离线新开局正常；320／390px 设置无横向溢出');
  await closeSettings(page);
  await page.getByRole('button', { name: /^1层 .*点击出发/ }).first().click();
  await page.getByRole('button', { name: '结束回合', exact: true }).click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).run.battle.turn === 2, saveKey);
  const later = await save(page);
  await page.reload();
  await expect(page.locator('.hand .game-card').first()).toBeVisible();
  sameSave(await save(page), later);
  result('离线敌方行动与下回合存档恢复正常');

  // 首次下载不完整不能宣称就绪，联网重试后才可以离线使用。
  failAsset = true;
  const requestsBeforeFailure = noticesRequests;
  const fresh = await browser.newContext();
  try {
    const first = await fresh.newPage();
    watch(first);
    await first.goto(url);
    await expect.poll(() => noticesRequests - requestsBeforeFailure, { timeout: 15_000 }).toBe(3);
    await expect(first.getByText('离线资源下载未完成，请在设置中重试离线准备。', { exact: false })).toBeVisible();
    await expect(first.getByText('离线资源尚未准备完成 · 请保持联网', { exact: false })).toBeVisible({ timeout: 30_000 });
    assert.equal(noticesRequests - requestsBeforeFailure, 3, '持续失败时仅自动重试两次');
    failAsset = false;
    await settings(first);
    await first.getByRole('button', { name: /重试离线准备/ }).click();
    await expect(first.getByRole('dialog').getByText('已可离线游玩', { exact: true })).toBeVisible({ timeout: 30_000 });
    await fresh.setOffline(true);
    await first.reload();
    await expect(first.getByText('已可离线游玩 · 断网后也能重新打开')).toBeVisible();
    result('首次资源下载失败不显示就绪，联网重试可修复并离线重启');
  } finally { await fresh.close(); failAsset = false; }

  // 关闭整个浏览器进程，保留独立测试资料目录，再在断网下重新启动。
  const profile = await mkdtemp(join(root, 'profile-'));
  const options = { ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}), headless: true, viewport: { width: 390, height: 844 } };
  let cold = await chromium.launchPersistentContext(profile, options);
  try {
    let first = await cold.newPage();
    watch(first);
    await first.goto(url);
    await expect(first.getByText('已可离线游玩 · 断网后也能重新打开')).toBeVisible({ timeout: 30_000 });
    await first.getByRole('button', { name: '与基尔兽出发', exact: true }).click();
    await first.getByRole('button', { name: /守护之心/ }).click();
    const saved = await save(first);
    await cold.close();
    cold = await chromium.launchPersistentContext(profile, options);
    await cold.setOffline(true);
    first = await cold.newPage();
    watch(first);
    await first.goto(url);
    await expect(first.getByRole('button', { name: /^1层 .*点击出发/ }).first()).toBeVisible();
    sameSave(await save(first), saved);
    result('关闭整个浏览器进程后，断网冷启动与存档恢复成功');
  } finally { await cold.close(); }
  assert.deepEqual(errors, [], '存在浏览器未捕获异常');
  await writeFile(join(screenshots, 'verification.json'), JSON.stringify({ date: '2026-10-10', resources: manifest.length, browser: await browser.version(), results, uncaughtErrors: errors, limits: '桌面Chromium手机视口；未做iOS／Android真机或真实安装验收。' }, null, 2) + '\n');
  console.log(`离线浏览器验收通过，共 ${results.length} 组；报告位于 docs/reports/offline/。`);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
