import { describe, expect, it } from 'vitest';
import { CARDS, cardDefinition } from '../src/game/data';
import { calibrateAction, calibrateSequence, contextualBalanceOptions } from '../src/game/balance';
import { reduceGame } from '../src/game/engine';
import { balanceScenario } from './helpers/balanceScenario';
import { combatCandidates, simulateJourney, upgradeValue } from './helpers/journeySimulation';
import type { Card } from '../src/game/types';
const card = (id: string, uid = id, upgraded = true): Card => ({ id, uid, upgraded });
const metric = (...args: Parameters<typeof calibrateAction>) => {
  const result = calibrateAction(...args);
  if (!result.legal) throw Error('预期合法出牌');
  return result;
};

describe('第二轮校准终局与序列', () => {
  it('清场后的额外抽牌、剩余力量/蓄能不获得正未来价值', () => {
    const s = balanceScenario([card('rapidFire'), card('strike')], 'rapidmon');
    s.run!.battle!.strength = 2;
    s.run!.battle!.charge = 3;
    s.run!.battle!.enemies[0].hp = 1;
    s.run!.battle!.draw = [card('battery', 'draw')];
    const result = metric(s, { type: 'play', uid: 'rapidFire' });
    expect(result).toMatchObject({
      terminal: true,
      screen: 'reward',
      cards: 0,
      drawn: 1,
      energy: -1,
      paid: 1,
    });
    expect(result.future).toBeLessThanOrEqual(0);
  });
  it('灼烧终结的胜利回复不再重复计作防伤', () => {
    const s = balanceScenario([card('apocalypse')]);
    s.run!.relics = ['memory'];
    s.run!.battle!.enemies[0].hp = 1;
    const result = metric(s, { type: 'play', uid: 'apocalypse' });
    expect(result.prevented).toBe(0);
    expect(result.endTurnHp).toBe(56);
    expect(result.healing).toBe(0);
  });
  it('符印、灼烧、蓄能和力量共享剩余生命预算', () => {
    const s = balanceScenario([card('spirit')], 'kyubimon');
    s.run!.battle!.enemies[0].hp = 10;
    const result = metric(s, { type: 'play', uid: 'spirit' });
    expect(result.damage + result.future).toBeLessThanOrEqual(10);
    const low = balanceScenario([card('ritual')], 'taomon');
    low.run!.battle!.charge = 20;
    low.run!.battle!.enemies[0].hp = 2;
    expect(metric(low, { type: 'play', uid: 'ritual' }).future).toBe(0);
  });
  it.each(['battery', 'mend', 'ritual', 'leaf'])(
    '复制 %s 后支付并使用复制品，初末能量和资源只核算一次',
    (source) => {
      const s = balanceScenario(
        [card('illusion'), card(source)],
        source === 'ritual' ? 'taomon' : 'renamon',
      );
      const action = { type: 'play' as const, uid: 'illusion', copyUid: source };
      const after = reduceGame(s, action),
        copy = after.run!.battle!.hand.find((c) => c.copied)!;
      const second = { type: 'play' as const, uid: copy.uid };
      const result = calibrateSequence(s, [action, second], contextualBalanceOptions(s));
      expect(result.legal).toBe(true);
      if (!result.legal) return;
      const end = reduceGame(after, second);
      expect(result.plays).toBe(2);
      expect(result.energy).toBe(end.run!.battle!.energy - s.run!.battle!.energy);
      expect(result.state).toEqual(end);
      expect(result.damage).toBe(end.run!.damageDealt - s.run!.damageDealt);
      expect(result.healing).toBe(end.run!.hp - s.run!.hp);
    },
  );
  it('复制来源有牌但支付不起第二步，返回失败步骤且不提交部分状态', () => {
    const s = balanceScenario([card('illusion'), card('leaf')]);
    s.run!.battle!.energy = 1;
    const original = structuredClone(s);
    const action = { type: 'play' as const, uid: 'illusion', copyUid: 'leaf' },
      copy = reduceGame(s, action).run!.battle!.hand.find((c) => c.copied)!;
    expect(calibrateSequence(s, [action, { type: 'play', uid: copy.uid }])).toMatchObject({
      legal: false,
      reason: 'rejected-action',
      index: 1,
    });
    expect(s).toEqual(original);
  });
  it('无消费出口估值为0，已耗竭出口不算可用出口', () => {
    const s = balanceScenario([card('charge'), card('talisman')]);
    s.run!.battle!.exhaust = [card('cannon'), card('seal')];
    expect(contextualBalanceOptions(s)).toMatchObject({
      markChance: 0,
      chargeChance: 0,
      futureHits: 0,
    });
    const withOutlet = balanceScenario([card('charge'), card('cannon')]);
    expect(contextualBalanceOptions(withOutlet)).toMatchObject({ chargeChance: 1 });
    withOutlet.run!.battle!.energy = 1;
    expect(contextualBalanceOptions(withOutlet)).toMatchObject({ chargeChance: 0.75 });
  });
  it('只加力量而没有攻击段时无输出收益', () => {
    const s = balanceScenario([card('ritual'), card('guard')], 'taomon');
    expect(metric(s, { type: 'play', uid: 'ritual' }, contextualBalanceOptions(s)).strength).toBe(
      0,
    );
  });
});

describe('固定策略合法性与可复现性', () => {
  it('强化复制明确选目标；达到上限后不再提供复制行动', () => {
    const s = balanceScenario([card('illusion'), card('battery'), card('guard')]);
    const candidates = combatCandidates(s, 'synergy', 'kuzuha');
    const copy = candidates.find((c) => c.action.uid === 'illusion')!;
    expect(copy.action.copyUid).toBeDefined();
    expect(copy.next.run!.battle!.copyUses).toBe(1);
    s.run!.battle!.copyUses = 2;
    expect(combatCandidates(s, 'synergy', 'kuzuha').some((c) => c.action.uid === 'illusion')).toBe(
      false,
    );
  });
  it('排除致死自损与无目标复制；所有提供的行动均能推进状态', () => {
    const s = balanceScenario([card('sacrifice'), card('illusion'), card('guard')]);
    s.run!.hp = 2;
    const candidates = combatCandidates(s, 'survival', 'chaos');
    expect(candidates.some((c) => c.action.uid === 'sacrifice')).toBe(false);
    for (const c of candidates) expect(c.next.run!.battle!.played).toBe(1);
    const empty = balanceScenario([card('illusion'), card('fault')]);
    expect(
      combatCandidates(empty, 'survival', 'sakuya').some((c) => c.action.uid === 'illusion'),
    ).toBe(false);
  });
  it('同手牌不同隐藏抽牌顺序不改变动作选择', () => {
    const s = balanceScenario([card('study'), card('guard'), card('strike')]);
    s.run!.battle!.draw = [card('battery'), card('mend')];
    const reversed = structuredClone(s);
    reversed.run!.battle!.draw.reverse();
    expect(
      combatCandidates(s, 'survival', 'sakuya').map((c) => ({ action: c.action, score: c.score })),
    ).toEqual(
      combatCandidates(reversed, 'survival', 'sakuya').map((c) => ({
        action: c.action,
        score: c.score,
      })),
    );
  });
  it('强化选择依据收益而不是基础牌的面板强度', () => {
    const s = balanceScenario([
      card('fortify', 'fortify', false),
      card('battery', 'battery', false),
    ]);
    expect(upgradeValue(s.run!, s.run!.battle!.hand[1], 'survival', 'duke')).toBeGreaterThan(
      upgradeValue(s.run!, s.run!.battle!.hand[0], 'survival', 'duke'),
    );
    expect(cardDefinition(card('battery')).draw).toBeGreaterThan(CARDS.battery.draw ?? 0);
  });
  it.each(['duke', 'megidra', 'chaos', 'sakuya', 'kuzuha', 'saint', 'blacksaint'] as const)(
    '%s 固定策略真实行动结束；未达成路线说明原因，预算一致，无停滞',
    (branch) => {
      const run = simulateJourney(branch, 42, 'synergy');
      expect(run.diagnostics).toEqual([]);
      expect(run.won).toBe(true);
      if (!run.reached) expect(run.targetMissing.length).toBeGreaterThan(0);
      expect(run.deck.length).toBeLessThanOrEqual(16);
      expect(run.purchases).toBeLessThanOrEqual(2);
      expect(run.removals).toBeLessThanOrEqual(2);
    },
  );
});

describe('第二轮卡牌实际收益与代价', () => {
  it.each([false, true])('血色利刃强化=%s 提高输出，保留3生命代价及自损被动', (upgraded) => {
    for (const form of ['blackgrowmon', 'blackwargrowlmon', 'chaosdukemon']) {
      const s = balanceScenario([card('bloodedge', 'bloodedge', upgraded)], form);
      const after = reduceGame(s, { type: 'play', uid: 'bloodedge' }).run!;
      expect(after.battle!.enemies[0].hp).toBe(upgraded ? 81 : 84);
      expect(after.hp).toBe(57);
      expect(after.battle!.energy).toBe(form === 'blackwargrowlmon' ? 3 : 2);
      expect(after.battle!.block).toBe(form === 'chaosdukemon' ? 6 : 0);
      expect(after.activity.counts.selfCosts).toBe(1);
    }
  });
  it.each([false, true])('小型龙卷风强化=%s 单/双敌有效，但群体只计一次出牌', (upgraded) => {
    const s = balanceScenario([card('tinyTwister', 'tinyTwister', upgraded)], 'terriermon', [
      'goblimon',
      'goblimon',
    ]);
    const after = reduceGame(s, { type: 'play', uid: 'tinyTwister' }).run!;
    expect(after.battle!.enemies.map((e) => e.hp)).toEqual(upgraded ? [92, 92] : [95, 95]);
    expect(after.activity.counts.attacks).toBe(1);
    expect(after.battle!.energy).toBe(2);
  });
  it('狐变虚＋先复制指定目标再抽1；手牌满时不突破上限', () => {
    const s = balanceScenario([card('illusion'), card('battery')]);
    s.run!.battle!.draw = [card('guard', 'extra')];
    const after = reduceGame(s, { type: 'play', uid: 'illusion', copyUid: 'battery' }).run!.battle!;
    expect(after.hand.map((c) => c.id)).toEqual(['battery', 'battery', 'guard']);
    expect(after.energy).toBe(2);
    expect(after.copyUses).toBe(1);
    const full = balanceScenario([
      card('illusion'),
      card('battery'),
      ...Array.from({ length: 6 }, (_, i) => card('guard', `h${i}`)),
    ]);
    full.run!.battle!.draw = [card('strike', 'extra')];
    const b = reduceGame(full, { type: 'play', uid: 'illusion', copyUid: 'battery' }).run!.battle!;
    expect(b.hand).toHaveLength(8);
    expect(b.discard.some((c) => c.uid === 'extra')).toBe(true);
    expect(b.copyUses).toBe(1);
  });
});
