import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, cardTags, searchCards } from '../src/game/cardIndex';
import { cardPool, skillLabel } from '../src/game/cardSkills';
import { CARDS, cardDefinition, cardText } from '../src/game/data';
import { cardTarget, makeRun, reduceGame } from '../src/game/engine';
import { EVOLUTIONS } from '../src/game/evolution';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';

const amplify = (uid = 'amplify', upgraded = false) => ({
  id: 'burnAmplify',
  uid,
  upgraded,
});

describe('大古拉兽熔火增幅', () => {
  it.each([
    [false, 1],
    [true, 0],
  ] as const)('强化=%s：精准翻倍、消耗%s行动力并耗竭，存档后不能重复使用', (upgraded, cost) => {
    const s = balanceScenario([amplify('amplify', upgraded)], 'wargrowlmon');
    s.run!.inherit = 'ward';
    s.run!.battle!.enemies[0].burn = 4;
    const after = reduceGame(s, { type: 'play', uid: 'amplify' });
    const b = after.run!.battle!;
    expect(b.enemies[0]).toMatchObject({ hp: 100, burn: 8 });
    expect(b.energy).toBe(3 - cost);
    expect(b.block).toBe(2);
    expect(b.burned).toBe(true);
    expect(after.run!.activity.counts.fire).toBe(1);
    expect(after.run!.activity.counts.detonations ?? 0).toBe(0);
    expect(b.hand).toEqual([]);
    expect(b.discard).toEqual([]);
    expect(b.exhaust).toEqual([amplify('amplify', upgraded)]);
    expect(cardText(amplify('amplify', upgraded))).toContain('已有的灼烧层数翻倍');
    const loaded = parseSave(JSON.stringify(after));
    expect(loaded.run).toEqual(after.run);
    expect(reduceGame(loaded, { type: 'play', uid: 'amplify' })).toEqual(loaded);
  });

  it('纯状态技能保留所选目标，不被护卫截走，也不影响其他敌人的灼烧', () => {
    const s = balanceScenario([amplify()], 'wargrowlmon', ['knightmon', 'clockmon']);
    s.run!.inherit = 'ward';
    const [guard, target] = s.run!.battle!.enemies;
    guard.burn = 2;
    target.burn = 5;
    expect(cardTarget(s.run!, CARDS.burnAmplify, target.uid)?.uid).toBe(target.uid);
    const after = reduceGame(s, { type: 'play', uid: 'amplify', target: target.uid }).run!.battle!;
    expect(after.enemies[0]).toMatchObject({ hp: 100, burn: 2 });
    expect(after.enemies[1]).toMatchObject({ hp: 100, burn: 10 });
  });

  it.each(['wargrowlmon', 'blackgrowmon', 'megidramon'])(
    '%s：不会额外套用首烧特性、火种徽章或火种继承',
    (form) => {
      const s = balanceScenario([amplify()], form);
      Object.assign(s.run!, { inherit: 'ember', relics: ['firebrand', 'firewall'] });
      s.run!.battle!.enemies[0].burn = 3;
      const after = reduceGame(s, { type: 'play', uid: 'amplify' }).run!.battle!;
      expect(after.enemies[0].burn).toBe(6);
      expect(after.block).toBe(form === 'wargrowlmon' ? 5 : 3);
      expect(after.burned).toBe(true);
    },
  );

  it('零灼烧仍为零；不会提前消费实际首烧奖励或首烧加层', () => {
    let s = balanceScenario(
      [amplify(), { id: 'fireball', uid: 'fire', upgraded: false }],
      'wargrowlmon',
    );
    Object.assign(s.run!, { inherit: 'ember', relics: ['firebrand', 'firewall'] });
    s = reduceGame(s, { type: 'play', uid: 'amplify' });
    expect(s.run!.battle!.enemies[0].burn).toBe(0);
    expect(s.run!.battle!.block).toBe(0);
    expect(s.run!.battle!.burned).toBe(false);
    expect(s.run!.battle!.exhaust.map((c) => c.id)).toEqual(['burnAmplify']);
    s = reduceGame(s, { type: 'play', uid: 'fire' });
    expect(s.run!.battle!.enemies[0].burn).toBe(4); // 火球2＋火种继承1＋徽章1
    expect(s.run!.battle!.block).toBe(5);
    expect(s.run!.battle!.burned).toBe(true);
    expect(s.run!.activity.counts.fire).toBe(2);
  });

  it('连续增幅只领取一次每回合护盾，耗竭牌不会在下一回合洗回手牌', () => {
    let s = balanceScenario([amplify('a'), amplify('b')], 'wargrowlmon');
    Object.assign(s.run!, { inherit: 'ward', relics: ['firewall'] });
    s.run!.battle!.enemies[0].burn = 3;
    s = reduceGame(s, { type: 'play', uid: 'a' });
    expect(s.run!.battle!.block).toBe(5);
    s = reduceGame(s, { type: 'play', uid: 'b' });
    expect(s.run!.battle!.enemies[0].burn).toBe(12);
    expect(s.run!.battle!.block).toBe(5);
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.screen).toBe('battle');
    expect(s.run!.battle!.burned).toBe(false);
    expect(s.run!.battle!.exhaust.map((c) => c.uid)).toEqual(['a', 'b']);
    expect(s.run!.battle!.hand).toEqual([]);
    expect(s.run!.battle!.draw).toEqual([]);
    expect(s.run!.battle!.discard).toEqual([]);
  });

  it('失效目标遵循现有重选规则；没有存活目标时不耗费行动力或耗竭', () => {
    const s = balanceScenario([amplify()], 'wargrowlmon', ['core', 'core']);
    s.run!.inherit = 'ward';
    const [dead, alive] = s.run!.battle!.enemies;
    dead.hp = 0;
    dead.burn = 7;
    alive.burn = 3;
    const after = reduceGame(s, { type: 'play', uid: 'amplify', target: dead.uid }).run!.battle!;
    expect(after.enemies[0].burn).toBe(7);
    expect(after.enemies[1].burn).toBe(6);
    const empty = structuredClone(s);
    empty.run!.battle!.enemies[1].hp = 0;
    const rejected = reduceGame(empty, { type: 'play', uid: 'amplify', target: dead.uid });
    expect(rejected).toEqual(empty);
  });

  it('增幅后引爆按翻倍后的层数计伤并消费灼烧', () => {
    let s = balanceScenario(
      [amplify(), { id: 'ignite', uid: 'ignite', upgraded: false }],
      'wargrowlmon',
    );
    s.run!.inherit = 'ward';
    s.run!.battle!.enemies[0].burn = 4;
    s = reduceGame(s, { type: 'play', uid: 'amplify' });
    s = reduceGame(s, { type: 'play', uid: 'ignite' });
    expect(s.run!.battle!.enemies[0]).toMatchObject({ hp: 73, burn: 0 }); // 3＋8×3
    expect(s.run!.battle!.block).toBe(2);
    expect(s.run!.activity.counts.detonations).toBe(1);
  });

  it('继承后可先增幅再圣炎化盾，转换翻倍后的全部灼烧', () => {
    let s = balanceScenario([amplify(), { id: 'aegis', uid: 'aegis', upgraded: false }], 'dukemon');
    s.run!.inherit = 'ember';
    s.run!.battle!.enemies[0].burn = 4;
    s = reduceGame(s, { type: 'play', uid: 'amplify' });
    s = reduceGame(s, { type: 'play', uid: 'aegis' });
    expect(s.run!.battle!.enemies[0]).toMatchObject({ hp: 100, burn: 0 });
    expect(s.run!.battle!.block).toBe(4 + 8 * 3 + 3);
    expect(s.run!.activity.counts.detonations).toBe(1);
  });

  it('奖励和商店只在实际到达大古拉兽后开放，后续进化继承且保持两张进化赠牌', () => {
    for (const partner of ['guilmon', 'renamon', 'terriermon', 'impmon'] as const)
      expect(cardPool(makeRun(partner, 42))).not.toContain('burnAmplify');
    const dark = balanceScenario([], 'blackwargrowlmon').run!;
    expect(cardPool(dark)).not.toContain('burnAmplify');
    const war = balanceScenario([], 'wargrowlmon').run!;
    expect(cardPool(war)).toContain('burnAmplify');
    expect(skillLabel(CARDS.burnAmplify, war)).toBe('形态专属');
    const duke = balanceScenario([], 'dukemon').run!;
    expect(cardPool(duke)).toContain('burnAmplify');
    expect(skillLabel(CARDS.burnAmplify, duke)).toBe('继承技能');
    expect(EVOLUTIONS.wargrowlmon.cards).toEqual(['flare', 'emberCannon']);
  });

  it('图鉴按施加、利用、条件与耗竭检索；强化版进入0费筛选', () => {
    expect(cardTags(cardDefinition(amplify()))).toEqual([
      'burnApply',
      'burnUse',
      'exhaust',
      'conditional',
    ]);
    const context = { collected: () => true };
    const query = { ...DEFAULT_QUERY, text: '灼烧 翻倍', tags: ['burnUse', 'exhaust'] as const };
    expect(
      searchCards({ ...query, tags: [...query.tags] }, context).results.map((r) => r.entry.id),
    ).toContain('burnAmplify');
    expect(
      searchCards({ ...DEFAULT_QUERY, costs: [0], upgradedView: true }, context).results.map(
        (r) => r.entry.id,
      ),
    ).toContain('burnAmplify');
    expect(
      searchCards({ ...DEFAULT_QUERY, costs: [0] }, context).results.map((r) => r.entry.id),
    ).not.toContain('burnAmplify');
  });
});
