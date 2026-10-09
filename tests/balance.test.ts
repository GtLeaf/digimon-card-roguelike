import { describe, expect, it } from 'vitest';
import { CARDS, cardDefinition, copyCandidates } from '../src/game/data';
import { burnValue, calibrateAction } from '../src/game/balance';
import { cardCost, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';
import type { Card, Save } from '../src/game/types';

const card = (id: string, uid = id, upgraded = true): Card => ({ id, uid, upgraded });
const play = (s: Save, uid: string, copyUid?: string) =>
  reduceGame(s, { type: 'play', uid, copyUid });
const validMetric = (...args: Parameters<typeof calibrateAction>) => {
  const metric = calibrateAction(...args);
  if (!metric.legal) throw Error('预期合法校准');
  return metric;
};

describe('独立强化实际结算', () => {
  it('全部正常牌至少改变一个效果或可用操作，重复功能牌仍支付费用', () => {
    for (const d of Object.values(CARDS).filter((d) => d.kind !== 'status')) {
      const effective = cardDefinition(card(d.id));
      const keys = Object.keys(d.upgrade).filter(
        (key) => key !== 'text',
      ) as (keyof typeof effective)[];
      expect(
        keys.some((key) => effective[key] !== d[key]),
        d.id,
      ).toBe(true);
    }
    for (const id of ['study', 'illusion', 'mend']) expect(cardCost(card(id))).toBe(1);
  });
  it.each([
    ['haste', 2, 0],
    ['purge', 2, 0],
    ['sacrifice', 2, 2],
    ['insight', 3, 0],
    ['study', 3, -1],
    ['battery', 1, 1],
  ] as const)('%s 强化产生实际抽牌/返能收益', (id, draw, energy) => {
    const s = balanceScenario([card(id)]),
      b = s.run!.battle!;
    b.draw = Array.from({ length: 5 }, (_, i) => card('guard', `draw-${i}`, false));
    const after = play(s, id).run!;
    expect(after.battle!.hand).toHaveLength(draw);
    expect(after.battle!.energy).toBe(3 + energy);
    if (id === 'sacrifice') expect(after.hp).toBe(57);
    expect(after.battle![id === 'study' ? 'discard' : 'exhaust'].some((c) => c.uid === id)).toBe(
      true,
    );
  });
  it('净化抽牌前清故障；治疗按真实缺血生效且耗竭', () => {
    let s = balanceScenario([card('purge'), card('fault')]);
    s.run!.battle!.draw = [card('guard', 'd1'), card('guard', 'd2')];
    s = play(s, 'purge');
    expect(s.run!.battle!.hand.map((c) => c.id)).toEqual(['guard', 'guard']);
    expect(s.run!.battle!.exhaust.map((c) => c.id)).toEqual(['fault', 'purge']);
    s = play(balanceScenario([card('mend')]), 'mend');
    expect(s.run!.hp).toBe(67);
    expect(s.run!.battle!.energy).toBe(2);
    expect(s.run!.battle!.exhaust[0].id).toBe('mend');
  });
  it.each([
    ['doublecut', 14],
    ['leaf', 10],
  ] as const)('%s 强化的双段伤害保留力量协同', (id, damage) => {
    const s = balanceScenario([card(id)]);
    s.run!.battle!.strength = 2;
    expect(play(s, id).run!.battle!.enemies[0].hp).toBe(100 - damage - 4);
  });
});

describe('复制选择、计数与存档', () => {
  it('指定第二张目标并继承强化；复制品耗竭且不能再次复制', () => {
    let s = balanceScenario([card('illusion'), card('guard'), card('battery')]);
    s = play(s, 'illusion', 'battery');
    const b = s.run!.battle!,
      copy = b.hand.find((c) => c.copied)!;
    expect(copy).toMatchObject({ id: 'battery', upgraded: true, temporary: true, copied: true });
    expect(copy.uid).not.toBe('battery');
    expect(b.copyUses).toBe(1);
    expect(b.energy).toBe(2);
    expect(copyCandidates(b.hand, 'unused')).not.toContain(copy);
    s = play(s, copy.uid);
    expect(s.run!.battle!.energy).toBe(3);
    expect(s.run!.battle!.exhaust.some((c) => c.uid === copy.uid)).toBe(true);
  });
  it.each([undefined, 'absent', 'illusion', 'another-copy', 'fault', 'generated'])(
    '无效复制目标 %s 不消耗能量/出牌/进度',
    (copyUid) => {
      const s = balanceScenario([
        card('illusion'),
        card('illusion', 'another-copy'),
        card('fault'),
        { ...card('guard', 'generated'), copied: true },
        card('guard'),
      ]);
      expect(play(s, 'illusion', copyUid)).toEqual(s);
    },
  );
  it('基础版仍复制最左可用牌；无候选的强化牌保持原状态', () => {
    let s = balanceScenario([card('illusion', 'base', false), card('fault'), card('guard')]);
    s = play(s, 'base');
    expect(s.run!.battle!.hand.find((c) => c.copied)?.id).toBe('guard');
    const empty = balanceScenario([card('illusion'), card('fault')]);
    expect(play(empty, 'illusion')).toEqual(empty);
  });
  it('不同来源合计两次，刷新保留计数，下一回合重置', () => {
    let s = balanceScenario([
      card('illusion', 'a', false),
      card('illusion', 'b'),
      card('illusion', 'c'),
      card('battery'),
    ]);
    s = play(s, 'a');
    s = play(s, 'b', 'battery');
    s.run!.battle!.energy = 3;
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded).toEqual(s);
    expect(loaded.run!.battle!.copyUses).toBe(2);
    expect(play(loaded, 'c', 'battery')).toEqual(loaded);
    s = reduceGame(loaded, { type: 'endTurn' });
    expect(s.run!.battle!.copyUses).toBe(0);
    const copy = s.run!.battle!.hand.find((c) => c.id === 'illusion')!;
    expect(play(s, copy.uid, 'battery').run!.battle!.copyUses).toBe(1);
  });
  it.each([1, 2])('版本 %s 缺失复制计数时默认0，其他战斗数据保留', (version) => {
    const s = balanceScenario([card('study'), card('illusion'), card('guard')]);
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = version;
    delete raw.run.battle.copyUses;
    const loaded = parseSave(JSON.stringify(raw));
    expect(loaded.run!.battle).toEqual(s.run!.battle);
    expect(loaded.run!.deck).toEqual(s.run!.deck);
    expect(loaded.run!.rng).toBe(s.run!.rng);
    expect(loaded.run!.hp).toBe(60);
  });
});

// 反复选取真实可出的牌，不向回合中补充资源；120只是测试超时保护。
function runLoop(s: Save, source?: string) {
  let steps = 0;
  while (steps < 120 && s.run!.screen === 'battle') {
    const b = s.run!.battle!;
    const options = b.hand.filter(
      (c) =>
        cardCost(c) <= b.energy &&
        !(
          c.id === 'illusion' &&
          (b.copyUses >= 2 || !copyCandidates(b.hand, c.uid).some((c) => c.id === source))
        ),
    );
    const priority = (c: Card) =>
      c.copied
        ? 0
        : c.id === 'illusion'
          ? 1
          : c.id === 'battery'
            ? 2
            : c.id === source
              ? 3
              : c.id === 'study'
                ? 5
                : 4;
    const c = options.sort((a, b) => priority(a) - priority(b))[0];
    if (!c) break;
    const target = copyCandidates(b.hand, c.uid).find((c) => c.id === source);
    const next = play(s, c.uid, target?.uid);
    if (next.run!.battle!.played === b.played) break;
    s = next;
    steps++;
  }
  return { s, steps };
}
describe('薄牌组资源循环回归', () => {
  it('双紧急分析与地狱咆哮不再无限灼烧', () => {
    const { s, steps } = runLoop(
      balanceScenario([card('study', 's1'), card('study', 's2'), card('apocalypse')]),
    );
    expect(steps).toBeLessThan(10);
    expect(s.run!.battle!.energy).toBe(0);
    expect(s.run!.battle!.enemies[0].burn).toBeLessThanOrEqual(21);
  });
  it.each(['mend', 'ritual'])('双抽牌复制 %s 无法无限恢复/力量', (source) => {
    const { s, steps } = runLoop(
      balanceScenario([
        card('study', 's1'),
        card('study', 's2'),
        card('illusion', 'i1'),
        card('illusion', 'i2'),
        card(source),
      ]),
      source,
    );
    expect(steps).toBeLessThan(20);
    expect(s.run!.battle!.copyUses).toBeLessThanOrEqual(2);
    if (source === 'mend') expect(s.run!.hp).toBeLessThanOrEqual(84);
    else expect(s.run!.battle!.strength).toBeLessThanOrEqual(3);
  });
  it('强化返能+复制+双分析的六牌组合有限，不能持续复制返能', () => {
    const { s, steps } = runLoop(
      balanceScenario([
        card('battery'),
        card('illusion', 'i1'),
        card('illusion', 'i2'),
        card('study', 's1'),
        card('study', 's2'),
        card('leaf'),
      ]),
      'battery',
    );
    expect(steps).toBeLessThan(30);
    expect(s.run!.battle!.copyUses).toBe(2);
    expect(s.run!.battle!.energy).toBeLessThan(3);
  });
});

describe('炮击同形态比较', () => {
  it.each([0, 3, 6])('蓄能 %s 比较重装齐射与黑色导弹且保留耗竭', (charge) => {
    for (const upgraded of [false, true])
      for (const id of ['heavySalvo', 'blackMissile']) {
        const s = balanceScenario([card(id, id, upgraded)], 'blacksaintgalgomon');
        s.run!.battle!.charge = charge;
        const b = play(s, id).run!.battle!;
        expect(100 - b.enemies[0].hp).toBe(
          (id === 'heavySalvo' ? 12 : 15) +
            (upgraded ? 3 : 0) +
            charge * (id === 'heavySalvo' ? 6 : 4),
        );
        expect(b.charge).toBe(0);
        expect(b.energy).toBe(1);
        expect(b.block).toBe(charge ? 6 : 0);
        expect(b.exhaust.length).toBe(id === 'heavySalvo' ? 1 : 0);
      }
  });
});

describe('校准公式的边界与真实结算', () => {
  it('灼烧按边际池、折现、生命上限计算', () => {
    expect(burnValue(5, 3)).toBe(12);
    expect(burnValue(10, 3) - burnValue(5, 3)).toBe(15);
    expect(burnValue(5, 3, 0.8)).toBeCloseTo(10.12);
    expect(burnValue(10, 3, 0.8) - burnValue(5, 3, 0.8)).toBeCloseTo(12.2);
    expect(burnValue(5, 3, 0.8, 3)).toBe(3);
  });
  it('实际伤害排除格挡和溢出，记录击杀保护并保持输入纯净', () => {
    const s = balanceScenario([card('strike', 'strike', false)]);
    Object.assign(s.run!.battle!.enemies[0], { hp: 2, block: 3 });
    const before = structuredClone(s);
    const metric = calibrateAction(s, { type: 'play', uid: 'strike' });
    expect(metric).toMatchObject({
      legal: true,
      damage: 2,
      prevented: 7,
      energy: -1,
      screen: 'reward',
    });
    expect(s).toEqual(before);
  });
  it('群体效果只放大敌方状态；自身护盾只计算一次', () => {
    const s = balanceScenario([card('flare', 'flare', false)], 'renamon', ['goblimon', 'goblimon']);
    const metric = calibrateAction(s, { type: 'play', uid: 'flare' });
    expect(metric).toMatchObject({ prevented: 8, energy: -1 });
    if (!metric.legal) throw Error('预期合法校准');
    expect(metric.burn).toBe(2);
  });
  it('满血治疗为0、手牌上限抽牌不虚增', () => {
    const s = balanceScenario([card('mend')]);
    s.run!.hp = 100;
    expect(validMetric(s, { type: 'play', uid: 'mend' }).healing).toBe(0);
    const full = balanceScenario([
      card('study'),
      ...Array.from({ length: 7 }, (_, i) => card('guard', `h${i}`)),
    ]);
    full.run!.battle!.draw = [card('strike', 'd1'), card('strike', 'd2'), card('strike', 'd3')];
    expect(validMetric(full, { type: 'play', uid: 'study' }).cards).toBe(1);
  });
  it('消费符印/蓄能扣去已有池，避免重复计算资源', () => {
    const s = balanceScenario([card('seal', 'seal', false)]);
    s.run!.battle!.enemies[0].mark = 3;
    expect(calibrateAction(s, { type: 'play', uid: 'seal' })).toMatchObject({
      damage: 20,
      marks: -9,
    });
    const cannon = balanceScenario([card('cannon', 'cannon', false)]);
    cannon.run!.battle!.charge = 3;
    expect(calibrateAction(cannon, { type: 'play', uid: 'cannon' })).toMatchObject({
      damage: 26,
      charge: -9,
      energy: -2,
    });
  });
  it('灼烧在攻击后结算；反应敌人可以令防伤价值为负', () => {
    const s = balanceScenario([card('apocalypse')]);
    s.run!.battle!.enemies[0].hp = 1;
    expect(calibrateAction(s, { type: 'play', uid: 'apocalypse' })).toMatchObject({
      prevented: 0,
      endTurnScreen: 'reward',
    });
    const reactive = balanceScenario([card('battery')], 'renamon', ['sinduramon']);
    reactive.run!.battle!.turn = 2;
    expect(validMetric(reactive, { type: 'play', uid: 'battery' }).prevented).toBe(-2);
  });
  it('无消费出口估值为0；自损致死不授予防伤/抽牌/返能收益', () => {
    const s = balanceScenario([card('charge')]);
    expect(validMetric(s, { type: 'play', uid: 'charge' }, { chargeChance: 0 }).charge).toBe(0);
    const lethal = balanceScenario([card('sacrifice')]);
    lethal.run!.hp = 2;
    expect(calibrateAction(lethal, { type: 'play', uid: 'sacrifice' })).toMatchObject({
      lifeCost: 2,
      prevented: 0,
      cards: 0,
      energy: 0,
      screen: 'result',
    });
    expect(calibrateAction(s, { type: 'play', uid: 'missing' })).toEqual({
      legal: false,
      score: 0,
    });
  });
});
