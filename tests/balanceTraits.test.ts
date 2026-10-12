import { describe, expect, it } from 'vitest';
import { calibrateAction } from '../src/game/balance';
import { reduceGame, withoutTraits } from '../src/game/engine';
import { balanceScenario } from './helpers/balanceScenario';

const ok = (r: ReturnType<typeof calibrateAction>) => {
  if (!r.legal) throw Error('校准不合法');
  return r;
};

describe('卡牌本体分与特性贡献分', () => {
  it('关闭特性只在调用期间生效：红莲首次护盾＋3与灵巧继承＋2均被移除', () => {
    const s = balanceScenario([{ id: 'guard', uid: 'g', upgraded: false }], 'dukemon');
    const base = withoutTraits(() => reduceGame(s, { type: 'play', uid: 'g' }));
    expect(base.run!.battle!.block).toBe(7);
    const full = reduceGame(s, { type: 'play', uid: 'g' });
    expect(full.run!.battle!.block).toBe(7 + 3 + 2);
  });

  it('无特性的成长期攻击牌：特性贡献为0', () => {
    const s = balanceScenario([{ id: 'strike', uid: 's', upgraded: false }], 'renamon');
    const r = ok(calibrateAction(s, { type: 'play', uid: 's' }));
    expect(r.baseScore).toBe(r.score);
    expect(r.traitScore).toBe(0);
  });

  it('古拉兽追击只计入特性贡献，本体伤害不含＋2', () => {
    const s = balanceScenario([{ id: 'doublecut', uid: 'd', upgraded: false }], 'growlmon');
    s.run!.battle!.enemies[0].burn = 3;
    const r = ok(calibrateAction(s, { type: 'play', uid: 'd' }));
    expect(r.damage).toBe(5 * 2 + 2);
    expect(r.baseBreakdown!.damage).toBe(5 * 2);
    expect(r.traitScore).toBeGreaterThan(0);
    expect(r.baseScore! + r.traitScore!).toBeCloseTo(r.score);
  });

  it('依赖觉醒减费才能打出的牌：本体分为null并说明原因', () => {
    const s = balanceScenario([{ id: 'strike', uid: 's', upgraded: false }], 'matadormonAwakened');
    Object.assign(s.run!.battle!, { attackPlays: 1, energy: 0 });
    const r = ok(calibrateAction(s, { type: 'play', uid: 's' }));
    expect(r.baseScore).toBeNull();
    expect(r.traitScore).toBeNull();
    expect(r.baseReason).toBe('rejected-action');
  });

  it('评分结束后特性恢复，正常结算不受影响', () => {
    const s = balanceScenario([{ id: 'guard', uid: 'g', upgraded: false }], 'dukemon');
    calibrateAction(s, { type: 'play', uid: 'g' });
    expect(reduceGame(s, { type: 'play', uid: 'g' }).run!.battle!.block).toBe(12);
  });
});
