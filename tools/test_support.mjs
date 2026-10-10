import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// 独立浏览器与内存战斗，不触碰玩家存档。先启动项目本地开发服务器。
const origin = process.env.SUPPORT_TEST_URL ?? 'http://127.0.0.1:5181';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const checks = [];
function passed(text) { checks.push(text); console.log(`✓ ${text}`); }
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/tests/manual/support.html`);
  const state = () => page.getByTestId('battle-state').evaluate((el) => JSON.parse(el.textContent));
  const count = () => page.getByTestId('applied').evaluate((el) => Number(el.textContent));
  const call = () => page.locator('.support-btn').click();
  const skip = () => page.getByRole('button', { name: '跳过演出', exact: true }).click();
  const settled = () => expect.poll(async () => (await state()).busy).toBe(false);
  const reset = () => page.getByRole('button', { name: '重置战斗', exact: true }).click();

  const before = await state();
  await call();
  const overlay = page.locator('.support-cut-in');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.support-cut-in__dialogue')).toHaveText('狮子兽“别害怕，我与你并肩！”');
  await expect(overlay).not.toContainText('伙伴支援');
  await expect(overlay).not.toContainText('兽王咆哮');
  assert.equal((await state()).used, false);
  assert.equal(await count(), 0);
  assert.equal((await state()).rng, before.rng);
  const timing = await overlay.evaluate((el) => new Promise((resolve) => {
    const ribbon = el.querySelector('.support-cut-in__ribbon');
    let enteredAt, movedRight = false;
    Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished))
      .then(() => { enteredAt = performance.now(); });
    const sample = () => {
      const x = new DOMMatrix(getComputedStyle(ribbon).transform).m41;
      if (x > 1) movedRight = true;
      if (!el.isConnected) {
        resolve({ holdMs: performance.now() - enteredAt, movedRight });
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  assert(timing.holdMs >= 1490 && timing.holdMs < 1750, `实际停留 ${timing.holdMs}ms`);
  assert.equal(timing.movedRight, false);
  await settled();
  assert.equal(await count(), 1);
  assert.equal((await state()).weakened, 2);
  passed(`完全进场后停留 ${Math.round(timing.holdMs)}ms，直接消失并结算一次`);

  await page.getByRole('button', { name: '重复支援验收', exact: true }).click();
  await expect(overlay).toHaveCount(0);
  assert.equal(await count(), 1);
  passed('已用过的支援不会再次播放或结算');

  // 普通出牌与敌人队列仍可继续。
  const card = page.locator('.hand .game-card').first();
  const handBefore = (await state()).hand;
  await card.click();
  await card.click();
  await expect.poll(async () => (await state()).hand).toBe(handBefore - 1);
  await settled();
  await page.getByRole('button', { name: '结束回合', exact: true }).click();
  await expect.poll(async () => (await state()).turn).toBe(2);
  await expect.poll(async () => (await state()).enemyTurnIndex).toBe(null);
  await settled();
  passed('支援结束后可继续出牌和结束回合');

  const expected = {
    hagurumon: ['block', 10], mushmon: ['weakened', 2], picodevimon: ['enemyHp', 42],
    impmon: ['enemyHp', 42], andromon: ['block', 12], gotsumon: ['charge', 2],
    betamon: ['hand', 7], lopmon: ['hp', before.hp + 6], keramon: ['block', 8], default: ['block', 8],
  };
  for (const [partner, [field, value]] of Object.entries(expected)) {
    await page.getByRole('combobox', { name: '验收伙伴' }).selectOption(partner);
    const calls = await count();
    const currentBefore = await state();
    await page.getByRole('button', { name: '并发支援验收', exact: true }).click();
    await expect(overlay).toBeVisible();
    if (partner !== 'default') await expect.poll(() => overlay.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    else await expect(overlay.locator('.support-cut-in__program')).toBeVisible();
    await skip();
    await settled();
    assert.equal(await count(), calls + 1);
    assert.equal((await state())[field], partner === 'betamon' ? currentBefore.hand + 2 : value, partner);
  }
  passed('全部 10 位伙伴和应急程序可展示，跳过与连续调用均只结算一次');

  await page.getByRole('combobox', { name: '验收伙伴' }).selectOption('hagurumon');
  await page.getByRole('checkbox', { name: '减少动画', exact: true }).check();
  await call();
  await expect(page.locator('.support-cut-in--reduced')).toBeVisible();
  assert.equal(await overlay.evaluate((el) => el.getAnimations({ subtree: true }).length), 0);
  await page.waitForTimeout(700);
  await expect(overlay).toBeVisible();
  assert.equal((await state()).used, false);
  await expect(overlay).toHaveCount(0, { timeout: 1500 });
  await settled();
  assert.equal((await state()).block, 10);
  passed('游戏减少动画设置：静态展示后正确结算');

  await page.getByRole('checkbox', { name: '减少动画', exact: true }).uncheck();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset();
  await call();
  await expect(page.locator('.support-cut-in--reduced')).toBeVisible();
  await page.keyboard.press('Escape');
  await settled();
  assert.equal((await state()).block, 10);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  passed('系统减少动画偏好和 Escape 跳过生效');

  await reset();
  const callsBeforeUnmount = await count();
  await call();
  await page.getByRole('button', { name: '重置战斗', exact: true }).evaluate((button) => button.click());
  await page.waitForTimeout(2300);
  assert.equal(await count(), callsBeforeUnmount);
  assert.equal((await state()).used, false);
  await expect(overlay).toHaveCount(0);
  passed('播放中卸载清除动画与计时器，不结算已取消的动作');

  await page.getByRole('combobox', { name: '验收伙伴' }).selectOption('picodevimon');
  await page.getByRole('checkbox', { name: '最后一击', exact: true }).check();
  await call();
  await skip();
  await settled();
  assert.equal((await state()).screen, 'reward');
  await expect(overlay).toHaveCount(0);
  passed('击败最后一个敌人可正常进入奖励，横幅无残留');

  await page.getByRole('checkbox', { name: '最后一击', exact: true }).uncheck();
  await page.getByRole('combobox', { name: '验收伙伴' }).selectOption('leomon');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await reset();
    await call();
    await page.waitForTimeout(400);
    const bounds = await overlay.locator('.support-cut-in__dialogue').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    const art = await overlay.locator('img').boundingBox();
    const band = await overlay.locator('.support-cut-in__ribbon').boundingBox();
    assert(art.y >= band.y && art.y + art.height <= band.y + band.height, '立绘应完整位于横幅内');
    assert.equal(await overlay.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: `/private/tmp/digimon-support-game-${width}.png` });
    await skip();
    await settled();
  }
  passed('320 / 390 / 1280px 布局无横向溢出，立绘与台词完整可见');
  assert.deepEqual(errors, []);
  passed('浏览器无新增错误');
  console.log(`${checks.length} 项伙伴支援验收全部通过`);
} finally {
  await browser.close();
}
