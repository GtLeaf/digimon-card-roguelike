import { describe, expect, it } from 'vitest';
import { calibrateAction, contextualBalanceOptions } from '../src/game/balance';
import { balanceScenario } from './helpers/balanceScenario';
import { inspectDrawCycle } from './helpers/balanceLoop';
import type { Card } from '../src/game/types';
const card = (id: string, upgraded = false): Card => ({ id, uid: id, upgraded });
const metric = (...args: Parameters<typeof calibrateAction>) => {
  const result = calibrateAction(...args);
  if (!result.legal) throw Error('预期合法出牌');
  return result;
};

describe('唯一校准公式 v3', () => {
  it('终局第二张攻击按真实0费计价，不误扣7分', () => {
    const s = balanceScenario([card('strike')], 'matadormonAwakened');
    s.run!.battle!.attackPlays = 1;
    s.run!.battle!.enemies[0].hp = 1;
    expect(metric(s, { type: 'play', uid: 'strike' })).toMatchObject({
      paid: 0,
      energy: 0,
      terminal: true,
      modelVersion: 3,
    });
  });
  it.each([
    ['study', 1],
    ['kaguraBell', 0],
    ['curtainSpin', 0],
  ] as const)('强化 %s 读取唯一强化定义', (id, paid) => {
    const s = balanceScenario([card(id, true)]);
    expect(metric(s, { type: 'play', uid: id }).paid).toBe(paid);
  });
  it('单体段数不随敌人数放大；只有群攻逐目标计段', () => {
    const s = balanceScenario([card('doublecut')], 'growlmon', [
      'goblimon',
      'goblimon',
      'goblimon',
    ]);
    expect(contextualBalanceOptions(s).futureHits).toBe(2);
    s.run!.battle!.hand = [card('tinyTwister')];
    expect(contextualBalanceOptions(s).futureHits).toBe(3);
    s.run!.battle!.hand = [card('giantMissile')];
    expect(contextualBalanceOptions(s).futureHits).toBe(3);
  });
  it('符印碎击按4倍估值，消费时扣存款；无出口不虚构价值', () => {
    const s = balanceScenario([card('runeShard')], 'doumon');
    s.run!.battle!.enemies[0].mark = 3;
    expect(metric(s, { type: 'play', uid: 'runeShard' }).marks).toBeCloseTo(-7.2);
    const empty = balanceScenario([card('talisman')]);
    expect(metric(empty, { type: 'play', uid: 'talisman' }).marks).toBe(0);
  });
  it.each(['giantMissile', 'blazingShot'])('%s 是蓄能出口', (id) => {
    const s = balanceScenario([card('charge'), card(id)], 'saintgalgomon');
    expect(contextualBalanceOptions(s).chargeChance).toBe(1);
    expect(metric(s, { type: 'play', uid: 'charge' }).charge).toBeGreaterThan(0);
  });
  it('噬能产生/消费有价值，6层存款大于3层；耗竭出口排除', () => {
    const s = balanceScenario([card('prank'), card('devourTrick')], 'impmon');
    const b = s.run!.battle!;
    expect(metric(s, { type: 'play', uid: 'prank' }).devour).toBeGreaterThan(0);
    b.devour = 3;
    const three = metric(s, { type: 'play', uid: 'devourTrick' });
    expect(three.devour).toBeLessThan(0);
    b.devour = 6;
    const six = metric(s, { type: 'play', uid: 'devourTrick' });
    expect(six.resourceBefore.devour).toBeGreaterThan(three.resourceBefore.devour);
    expect(six.devour).toBeLessThan(0);
    b.hand = [card('prank')];
    b.exhaust = [card('devourTrick')];
    b.devour = 0;
    expect(metric(s, { type: 'play', uid: 'prank' }).devour).toBe(0);
  });
  it('易伤依赖后续攻击；追加段数只对本回合能打出的攻击估值', () => {
    const s = balanceScenario([card('devourCorrode'), card('strike')], 'belialvamdemon');
    expect(metric(s, { type: 'play', uid: 'devourCorrode' }).vulnerable).toBeGreaterThan(0);
    const w = balanceScenario([card('windPressure'), card('strike')], 'beelzebumonblaster');
    expect(metric(w, { type: 'play', uid: 'windPressure' }).nextAttack).toBeGreaterThan(0);
    w.run!.battle!.energy = 1;
    expect(metric(w, { type: 'play', uid: 'windPressure' }).nextAttack).toBe(0);
    w.run!.battle!.energy = 3;
    w.run!.battle!.draw = [card('strike')];
    w.run!.battle!.hand = [card('windPressure')];
    expect(metric(w, { type: 'play', uid: 'windPressure' }).nextAttack).toBe(0);
  });
  it('资源试算不修改输入；新增资源共享逐目标生命预算', () => {
    const s = balanceScenario(
      [card('prank'), card('gustCannon'), card('strike')],
      'beelzebumonblaster',
    );
    Object.assign(s.run!.battle!.enemies[0], { hp: 8, burn: 2, vulnerable: 2 });
    s.run!.battle!.strength = 3;
    const before = structuredClone(s),
      result = metric(s, { type: 'play', uid: 'prank' });
    expect(s).toEqual(before);
    expect(Object.values(result.resourceAfter).reduce((n, x) => n + x, 0)).toBeLessThanOrEqual(8);
    expect(Number.isFinite(result.score)).toBe(true);
  });
  it('暂未计价的容量提升单列，不冒充完整分数', () => {
    const s = balanceScenario([card('devourAura')], 'sorcerymon');
    expect(metric(s, { type: 'play', uid: 'devourAura' }).unpricedEffects).toContain(
      'devour-capacity',
    );
  });
});

describe('真实出牌定向循环诊断', () => {
  it('耗竭返能牌不能持续循环', () => {
    expect(inspectDrawCycle('battery', 'doumon').verdict).toBe('terminated');
  });
  it.each([
    ['kaguraBell', 'sakuyamon'],
    ['izuna', 'kuzuhamon'],
    ['curtainSpin', 'matadormonAwakened'],
  ])('%s 风险被报告，区分基础与强化', (id, form) => {
    const result = inspectDrawCycle(id, form);
    expect(result.verdict).toBe('sustained-cycle-risk');
    expect(result.steps).toBe(120);
    expect(result.finishScreen).toBe('reward');
    expect(inspectDrawCycle(id, form, false).verdict).toBe(
      id === 'curtainSpin' ? 'sustained-cycle-risk' : 'terminated',
    );
  });
});
