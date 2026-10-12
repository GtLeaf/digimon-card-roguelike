import { describe, expect, it } from 'vitest';
import { calibrateAction } from '../src/game/balance';
import { cardTags } from '../src/game/cardIndex';
import { cardDefinition, cardText } from '../src/game/data';
import { previewAction, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import type { Card, Save } from '../src/game/types';
import { balanceScenario } from './helpers/balanceScenario';

const card = (id: string, upgraded = false, uid = id): Card => ({ id, upgraded, uid });
const play = (s: Save, uid: string) => reduceGame(s, { type: 'play', uid });
const dark = (cards: Card[], enemies = ['core']) => {
  const s = balanceScenario(cards, 'blackwargrowlmon', enemies);
  s.run!.inherit = 'ward';
  return s;
};

describe('符咒与解印的资源兑现', () => {
  it.each([
    [false, 15, 4],
    [true, 18, 7],
  ] as const)('强化=%s：两层符印兑现为%s伤害，保留%s护盾', (upgraded, damage, shield) => {
    const s = balanceScenario([card('talisman', upgraded), card('seal', upgraded)]);
    const marked = play(s, 'talisman');
    expect(marked.run!.battle!.enemies[0].mark).toBe(2);
    const after = play(marked, 'seal').run!;
    expect(after.battle!.enemies[0]).toMatchObject({ hp: 100 - damage, mark: 0 });
    expect(after.battle!).toMatchObject({ energy: 1, block: shield });
    expect(cardText(card('talisman', upgraded))).toContain('施加 2 符印');
    expect(after.activity.counts.markBursts).toBe(1);
  });
});

describe('黑暗过载的一次性攻击增幅', () => {
  it.each([
    [false, 10],
    [true, 14],
  ] as const)('强化=%s：自损3、增伤%s；自身不返能抽牌，读档保留增幅和耗竭', (upgraded, bonus) => {
    const s = dark([card('darkOverload', upgraded)]);
    s.run!.battle!.draw = [card('guard')];
    const after = play(s, 'darkOverload');
    expect(after.run!.hp).toBe(57);
    expect(after.run!.battle!).toMatchObject({
      energy: 4, // 黑大古拉兽首次自损被动＋1
      nextAttackBonus: bonus,
      selfCostThisTurn: true,
      hand: [],
      draw: [card('guard')],
      exhaust: [card('darkOverload', upgraded)],
    });
    const loaded = parseSave(JSON.stringify(after));
    expect(loaded.run).toEqual(after.run);
    expect(play(loaded, 'darkOverload')).toEqual(loaded);
  });

  it('中间技能不消费增幅，多段只加在首段，后续攻击不再加成', () => {
    let s = dark([card('darkOverload'), card('guard'), card('doublecut'), card('rock')]);
    s = play(play(s, 'darkOverload'), 'guard');
    expect(s.run!.battle!.nextAttackBonus).toBe(10);
    const action = { type: 'play', uid: 'doublecut' } as const;
    expect(previewAction(s, action).map((n) => n.amount)).toEqual([14, 4]);
    s = reduceGame(s, action);
    expect(s.run!.battle!.nextAttackBonus).toBe(0);
    expect(s.run!.battle!.enemies[0].hp).toBe(82);
    expect(play(s, 'rock').run!.battle!.enemies[0].hp).toBe(73);
  });

  it.each([
    ['heatwave', 8],
    ['giantMissile', 18],
  ] as const)('%s：群体或散射只获得10点总增伤', (id, baseDamage) => {
    const s = play(dark([card('darkOverload'), card(id)], ['core', 'core']), 'darkOverload');
    const after = play(s, id).run!.battle!;
    expect(after.enemies.reduce((sum, e) => sum + 100 - e.hp, 0)).toBe(baseDamage + 10);
    expect(after.nextAttackBonus).toBe(0);
  });

  it('多张过载可叠加增幅，但首次自损只返1行动力', () => {
    let s = dark([card('darkOverload', false, 'a'), card('darkOverload', true, 'b'), card('rock')]);
    s = play(play(s, 'a'), 'b');
    expect(s.run!.hp).toBe(54);
    expect(s.run!.battle!.energy).toBe(4);
    expect(s.run!.battle!.nextAttackBonus).toBe(24);
    const after = play(s, 'rock').run!.battle!;
    expect(after.enemies[0].hp).toBe(67);
    expect(after.exhaust.map((c) => c.uid)).toEqual(['a', 'b']);
  });

  it('回合结束清除未使用增幅及自损条件；敌方伤害不解锁条件回血', () => {
    let s = play(dark([card('darkOverload'), card('darkDrain')], ['monodramon']), 'darkOverload');
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!).toMatchObject({ nextAttackBonus: 0, selfCostThisTurn: false });
    expect(s.run!.hp).toBeLessThan(57);
    expect(s.run!.battle!.exhaust.map((c) => c.id)).toEqual(['darkOverload']);
    const hp = s.run!.hp;
    expect(play(s, 'darkDrain').run!.hp).toBe(hp);
  });

  it('致命自损立即失败，不授予攻击增幅或回血', () => {
    const s = dark([card('darkOverload'), card('darkDrain')]);
    s.run!.hp = 3;
    const after = play(s, 'darkOverload').run!;
    expect(after).toMatchObject({ hp: 0, screen: 'result' });
    expect(after.battle!.nextAttackBonus).toBe(0);
    expect(after.battle!.enemies[0].hp).toBe(100);
  });
});

describe('暗黑汲取的自损回收条件', () => {
  it.each([
    [false, 6],
    [true, 9],
  ] as const)('强化=%s：未自损只造成%s伤害，主动自损并命中后回血4', (upgraded, damage) => {
    const s = dark([card('darkDrain', upgraded)]);
    const plain = play(s, 'darkDrain').run!;
    expect(plain.hp).toBe(60);
    expect(plain.battle!.enemies[0].hp).toBe(100 - damage);
    expect(plain.activity.counts.heals ?? 0).toBe(0);
    s.run!.battle!.selfCostThisTurn = true;
    const restored = parseSave(JSON.stringify(s));
    expect(previewAction(restored, { type: 'play', uid: 'darkDrain' }).at(-1)).toEqual({
      target: 'player',
      kind: 'heal',
      amount: 4,
    });
    const healed = play(restored, 'darkDrain').run!;
    expect(healed.hp).toBe(64);
    expect(healed.activity.counts.heals).toBe(1);
  });

  it('全格挡不回血；实际造成生命伤害才回血，并封顶最大生命', () => {
    const s = dark([card('darkDrain')]);
    s.run!.battle!.selfCostThisTurn = true;
    s.run!.battle!.enemies[0].block = 6;
    const blocked = play(s, 'darkDrain').run!;
    expect(blocked.hp).toBe(60);
    expect(blocked.activity.counts.heals ?? 0).toBe(0);
    s.run!.battle!.enemies[0].block = 5;
    s.run!.hp = 98;
    const action = { type: 'play', uid: 'darkDrain' } as const;
    expect(previewAction(s, action).map((n) => n.amount)).toEqual([1, 2]);
    expect(reduceGame(s, action).run!.hp).toBe(100);
  });

  it('汲取先打不回溯回血，后续主动自损仍能解锁下一次汲取', () => {
    let s = dark([
      card('darkDrain', false, 'early'),
      card('bloodedge'),
      card('darkDrain', false, 'late'),
    ]);
    s = play(s, 'early');
    expect(s.run!.hp).toBe(60);
    s = play(s, 'bloodedge');
    expect(s.run!.hp).toBe(57);
    expect(play(s, 'late').run!.hp).toBe(61);
  });

  it('危险过载和生命汲取保持原调度与稳定续航，专属牌图鉴标签已区分', () => {
    let s = dark([card('sacrifice', true), card('drain', true)]);
    s.run!.battle!.draw = [card('guard', false, 'g1'), card('guard', false, 'g2')];
    s = play(s, 'sacrifice');
    expect(s.run!.battle!.energy).toBe(6);
    expect(s.run!.battle!.hand.filter((c) => c.id === 'guard')).toHaveLength(2);
    expect(s.run!.battle!.nextAttackBonus).toBe(0);
    s.run!.battle!.selfCostThisTurn = false;
    expect(play(s, 'drain').run!.hp).toBe(59);
    expect(cardTags(cardDefinition(card('darkOverload')))).toEqual(
      expect.arrayContaining(['selfCost', 'damage', 'conditional', 'exhaust']),
    );
    expect(cardTags(cardDefinition(card('darkOverload')))).not.toContain('draw');
    expect(cardTags(cardDefinition(card('darkOverload')))).not.toContain('energy');
    expect(cardTags(cardDefinition(card('darkDrain')))).toContain('conditional');
    expect(cardTags(cardDefinition(card('drain')))).not.toContain('conditional');
  });

  it('审核复用真实的下一次攻击资源与回血条件，不虚构立即伤害或治疗', () => {
    const producer = dark([card('darkOverload'), card('rock')]);
    const boost = calibrateAction(producer, { type: 'play', uid: 'darkOverload' });
    expect(boost).toMatchObject({ legal: true, damage: 0, nextAttack: 10, cards: 0, lifeCost: 3 });
    const drain = dark([card('darkDrain')]);
    expect(calibrateAction(drain, { type: 'play', uid: 'darkDrain' })).toMatchObject({
      healing: 0,
    });
    drain.run!.battle!.selfCostThisTurn = true;
    expect(calibrateAction(drain, { type: 'play', uid: 'darkDrain' })).toMatchObject({
      healing: 4,
    });
  });
});
