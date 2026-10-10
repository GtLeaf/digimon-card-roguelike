import { describe, expect, it } from 'vitest';
import { beginBattle, beginEnemyTurn, enemyStep, finishEnemyTurn } from '../src/game/battle';
import { CARDS } from '../src/game/data';
import { ENCOUNTERS } from '../src/game/encounters';
import {
  cardTarget,
  emptySave,
  enemyCountdown,
  enemyEnrage,
  enemyIntents,
  intent,
  makeRun,
  reduceGame,
} from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import type { EnemyModifier, MapNode, Save } from '../src/game/types';

function fight(
  enemies: string[],
  chapter = 0,
  kind: MapNode['kind'] = 'battle',
  enemyModifiers?: EnemyModifier[],
): Save {
  const save = emptySave();
  const r = makeRun('guilmon', 42, false);
  r.row = chapter * r.chapterRows;
  r.hp = r.maxHp = 10000; // 保证长周期规则验证不中途死亡；不用于玩家胜率。
  const node: MapNode = {
    id: 'ai-test',
    row: r.row,
    lane: 0,
    kind,
    label: '审核',
    enemies,
    enemyModifiers,
    next: [],
  };
  r.currentNode = node;
  beginBattle(r, node);
  save.run = r;
  return save;
}
function hand(s: Save, ids: string[]) {
  s.run!.battle!.hand = ids.map((id, i) => ({ id, uid: `card${i}`, upgraded: false }));
  s.run!.battle!.energy = 30;
}

describe('enemy intent and execution agreement', () => {
  it('projects a preceding buff, refreshes when its source dies, and never mutates the save', () => {
    const s = fight(['gekomon', 'monodramon'], 1);
    const r = s.run!,
      b = r.battle!;
    const before = structuredClone(s);
    expect(intent(r, b.enemies[1]).damage).toBe(5);
    expect(s).toEqual(before);
    b.enemies[0].hp = 0;
    expect(intent(r, b.enemies[1]).damage).toBe(4);
    const reversed = fight(['monodramon', 'gekomon'], 1);
    expect(intent(reversed.run!, reversed.run!.battle!.enemies[0]).damage).toBe(4);
  });

  it('does not apply the same buff twice during queued execution or after reloading', () => {
    let s = fight(['gekomon', 'monodramon'], 1);
    s = reduceGame(s, { type: 'beginEnemyTurn' });
    s = reduceGame(s, { type: 'enemyStep' });
    s = parseSave(JSON.stringify(s));
    const e = s.run!.battle!.enemies[1];
    expect(e.strength).toBe(1);
    expect(intent(s.run!, e).damage).toBe(5);
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'enemyStep' });
    expect(hp - s.run!.hp).toBe(10);
  });

  it('projects a heal that removes a later attacker from its half-health rage', () => {
    let s = fight(['gekomon', 'phantomon']);
    const r = s.run!,
      b = r.battle!;
    b.turn = 2;
    b.enemies[1].hp = b.enemies[1].maxHp / 2;
    expect(intent(r, b.enemies[1]).name).toBe('灵魂收割');
    const hp = r.hp;
    s = reduceGame(s, { type: 'endTurn' });
    expect(hp - s.run!.hp).toBe(8);
    expect(s.run!.battle!.enemies[1].hp).toBe(31);
  });

  it('projects new summons into a later core pulse without allowing the minion to attack', () => {
    let s = fight(['machinedramon', 'core'], 0, 'battle', [{}, { phaseOffset: 3 }]);
    expect(intent(s.run!, s.run!.battle!.enemies[1]).damage).toBe(32);
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'endTurn' });
    expect(hp - s.run!.hp).toBe(32);
    expect(s.run!.battle!.enemies).toHaveLength(3);
  });

  it('shows freshly summoned minions as waiting with zero current damage', () => {
    let s = fight(['machinedramon']);
    s = reduceGame(s, { type: 'beginEnemyTurn' });
    s = reduceGame(s, { type: 'enemyStep' });
    const e = s.run!.battle!.enemies[1];
    expect(intent(s.run!, e)).toMatchObject({ name: '增援待机', damage: 0, hits: 0 });
  });

  it.each(ENCOUNTERS)('$id matches real action damage for twelve turns', (formation) => {
    const s = fight(formation.enemies, formation.chapter, 'battle', formation.enemyModifiers);
    const r = s.run!,
      b = r.battle!;
    for (let turn = 1; turn <= 12; turn++) {
      b.block = turn % 2 ? 0 : 15;
      const before = structuredClone(s);
      const plans = enemyIntents(r);
      expect(s).toEqual(before);
      beginEnemyTurn(r);
      while (b.enemyTurnIndex! < b.enemies.length) {
        const e = b.enemies[b.enemyTurnIndex!];
        const plan = plans.get(e.uid);
        let shield = b.block;
        const expected = Array.from({ length: plan?.type === 'attack' ? plan.hits : 0 }, () => {
          const absorbed = plan!.pierce ? 0 : Math.min(shield, plan!.damage);
          shield -= absorbed;
          return { target: 'player', kind: 'damage', amount: plan!.damage - absorbed };
        });
        b.feedback = [];
        enemyStep(r, s.meta);
        if (e.hp > 0 && e.summonedTurn !== turn) {
          const hits = b.feedback.filter((f) => f.target === 'player');
          expect(hits).toEqual(expected);
        }
      }
      finishEnemyTurn(r, s.meta);
    }
  });
});

describe('guard and scatter rules', () => {
  it.each(['talisman', 'taunt'])('keeps the selected ally for pure status skill %s', (id) => {
    let s = fight(['knightmon', 'clockmon'], 2);
    hand(s, [id]);
    const e = s.run!.battle!.enemies[1];
    expect(cardTarget(s.run!, CARDS[id], e.uid)?.uid).toBe(e.uid);
    s = reduceGame(s, { type: 'play', uid: 'card0', target: e.uid });
    expect(s.run!.battle!.enemies[0]).toMatchObject({ mark: 0, weakened: 0 });
    expect(s.run!.battle!.enemies[1][id === 'talisman' ? 'mark' : 'weakened']).toBe(
      id === 'talisman' ? 3 : 2,
    );
  });

  it('intercepts targeted attacks but respects choosing a guard and using area attacks', () => {
    let s = fight(['knightmon', 'rookchessmon', 'clockmon']);
    hand(s, ['strike', 'strike', 'heatwave']);
    const [guard, other, ally] = s.run!.battle!.enemies;
    expect(cardTarget(s.run!, CARDS.strike, ally.uid)?.uid).toBe(guard.uid);
    s = reduceGame(s, { type: 'play', uid: 'card0', target: ally.uid });
    expect(s.run!.battle!.enemies[0].hp).toBeLessThan(guard.hp);
    expect(s.run!.battle!.enemies[1].hp).toBe(other.hp);
    const hp = s.run!.battle!.enemies[0].hp;
    s = reduceGame(s, { type: 'play', uid: 'card1', target: guard.uid });
    expect(s.run!.battle!.enemies[0].hp).toBeLessThan(hp);
    expect(s.run!.battle!.enemies[1].hp).toBe(other.hp);
    s = reduceGame(s, { type: 'play', uid: 'card2', target: ally.uid });
    expect(s.run!.battle!.enemies[2].hp).toBeLessThan(ally.hp);
  });

  it('counts scatter once per wounded target, never once per segment', () => {
    let s = fight(['vajramon'], 1, 'elite');
    s.run!.battle!.enemies[0].block = 0;
    hand(s, ['giantMissile']);
    s = reduceGame(s, { type: 'play', uid: 'card0' });
    const e = s.run!.battle!.enemies[0];
    expect(e.effectiveAttacks).toBe(1);
    expect(intent(s.run!, e).damage).toBe(10);
    let group = fight(['vajramon', 'leomon', 'goblimon']);
    for (const x of group.run!.battle!.enemies) x.hp = x.maxHp = 100;
    hand(group, ['giantMissile']);
    group = reduceGame(group, { type: 'play', uid: 'card0' });
    for (const x of group.run!.battle!.enemies)
      expect(x.effectiveAttacks ?? 0).toBe(x.hp < 100 ? 1 : 0);
  });

  it('does not count fully blocked scatter, but counts a lethal hit', () => {
    let s = fight(['vajramon']);
    s.run!.battle!.enemies[0].block = 100;
    hand(s, ['giantMissile']);
    s = reduceGame(s, { type: 'play', uid: 'card0' });
    expect(s.run!.battle!.enemies[0].effectiveAttacks ?? 0).toBe(0);
    let lethal = fight(['goblimon']);
    lethal.run!.battle!.enemies[0].hp = 1;
    hand(lethal, ['giantMissile']);
    lethal = reduceGame(lethal, { type: 'play', uid: 'card0' });
    expect(lethal.run!.battle!.enemies[0].effectiveAttacks).toBe(1);
  });

  it('interrupts skullgreymon with three scattered attack cards even below 18 life damage', () => {
    let s = fight(['skullgreymon'], 1, 'elite');
    s.run!.battle!.turn = 3;
    hand(s, ['giantMissile', 'giantMissile', 'giantMissile']);
    for (let n = 0; n < 3; n++) {
      s.run!.battle!.enemies[0].block = 17;
      s = reduceGame(s, { type: 'play', uid: `card${n}` });
    }
    const e = s.run!.battle!.enemies[0];
    expect(e.stagger).toBe(3);
    expect(e.effectiveAttacks).toBe(3);
    expect(intent(s.run!, e).name).toBe('蓄力被打断');
  });
});

describe('enemy pacing and formation persistence', () => {
  it('gives beelzebumon a real reload window in each four-turn cycle', () => {
    let s = fight(['beelzebumon'], 1, 'boss');
    const names: string[] = [],
      damage: number[] = [];
    for (let n = 0; n < 8; n++) {
      const b = s.run!.battle!,
        e = b.enemies[0];
      const plan = intent(s.run!, e);
      names.push(plan.name);
      damage.push(plan.damage * plan.hits);
      if (n % 4 === 3) expect(enemyCountdown(s.run!, e)).toBe('装填窗口');
      const hp = s.run!.hp;
      s = reduceGame(s, { type: 'endTurn' });
      expect(hp - s.run!.hp).toBe([18, 15, 21, 0][n % 4]);
      if (n % 4 === 3) expect(s.run!.battle!.enemies[0]).toMatchObject({ devour: 0, block: 12 });
    }
    expect(names).toEqual(Array(2).fill(['连续射击', '压制射击', '死亡加农', '重新装填']).flat());
    expect(damage).toEqual([18, 15, 21, 0, 18, 15, 21, 0]);
  });

  it.each([
    [4, 17, 21],
    [3, 18, 14],
  ])(
    'only weakens the cannon when three strikes pass the 18 HP threshold (shield %s)',
    (shield, stagger, damage) => {
      let s = fight(['beelzebumon'], 1, 'boss');
      s.run!.battle!.turn = 3;
      s.run!.battle!.enemies[0].block = shield;
      hand(s, ['strike', 'strike', 'strike']);
      for (let n = 0; n < 3; n++) s = reduceGame(s, { type: 'play', uid: `card${n}` });
      const e = s.run!.battle!.enemies[0];
      expect(e.stagger).toBe(stagger);
      expect(intent(s.run!, e)).toMatchObject({
        name: '死亡加农',
        type: 'attack',
        damage,
        hits: 1,
      });
      expect(enemyCountdown(s.run!, e)).toContain(stagger === 18 ? '已压制' : '17/18');
      const hp = s.run!.hp;
      s = reduceGame(s, { type: 'endTurn' });
      expect(hp - s.run!.hp).toBe(damage);
    },
  );

  it('persists a weakened cannon through reload, stacks weakness, clears devour and resets the next cycle', () => {
    let s = fight(['beelzebumon'], 1, 'boss');
    s.run!.battle!.turn = 3;
    s.run!.battle!.enemies[0].devour = 2;
    s.run!.battle!.enemies[0].block = 3; // 三张攻击指令共21伤害，扣盾后刚好18生命伤害。
    hand(s, ['strike', 'strike', 'strike', 'taunt']);
    for (let n = 0; n < 4; n++) s = reduceGame(s, { type: 'play', uid: `card${n}` });
    s = parseSave(JSON.stringify(s));
    const e = s.run!.battle!.enemies[0];
    expect(e).toMatchObject({ stagger: 18, weakened: 2, devour: 2 });
    expect(intent(s.run!, e)).toMatchObject({ name: '死亡加农', damage: 12, hits: 1 });
    s = reduceGame(s, { type: 'beginEnemyTurn' });
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'enemyStep' });
    expect(hp - s.run!.hp).toBe(12);
    expect(s.run!.battle!.enemies[0]).toMatchObject({ devour: 0, weakened: 0 });
    s = parseSave(JSON.stringify(s));
    s = reduceGame(s, { type: 'finishEnemyTurn' });
    expect(s.run!.battle!.enemies[0].stagger).toBe(0);
    for (let n = 0; n < 3; n++) s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!.turn).toBe(7);
    expect(enemyCountdown(s.run!, s.run!.battle!.enemies[0])).toContain('0/18');
    expect(intent(s.run!, s.run!.battle!.enemies[0])).toMatchObject({
      name: '死亡加农',
      damage: 21,
    });
  });

  it('keeps an old saved early cannon suppressible before the third beat', () => {
    let s = fight(['beelzebumon'], 1, 'boss');
    s.run!.battle!.enemies[0].devour = 2;
    s.run!.battle!.enemies[0].block = 3;
    s = parseSave(JSON.stringify(s));
    expect(s.run!.battle!.turn).toBe(1);
    expect(intent(s.run!, s.run!.battle!.enemies[0])).toMatchObject({
      name: '死亡加农',
      damage: 21,
      hits: 1,
    });
    hand(s, ['strike', 'strike', 'strike']);
    for (let n = 0; n < 3; n++) s = reduceGame(s, { type: 'play', uid: `card${n}` });
    s = parseSave(JSON.stringify(s));
    const e = s.run!.battle!.enemies[0];
    expect(e).toMatchObject({ devour: 2, stagger: 18 });
    expect(enemyCountdown(s.run!, e)).toBe('加农已压制');
    expect(intent(s.run!, e)).toMatchObject({ name: '死亡加农', damage: 14, hits: 1 });
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'beginEnemyTurn' });
    s = reduceGame(s, { type: 'enemyStep' });
    expect(hp - s.run!.hp).toBe(14);
    expect(s.run!.battle!.enemies[0].devour).toBe(0);
    s = reduceGame(s, { type: 'finishEnemyTurn' });
    expect(s.run!.battle!.enemies[0].stagger).toBe(0);
  });

  it('neither shield absorption nor an 18-point burn tick contributes to the cannon threshold', () => {
    let blocked = fight(['beelzebumon'], 1, 'boss');
    blocked.run!.battle!.turn = 3;
    blocked.run!.battle!.enemies[0].block = 21;
    hand(blocked, ['strike', 'strike', 'strike']);
    for (let n = 0; n < 3; n++) blocked = reduceGame(blocked, { type: 'play', uid: `card${n}` });
    expect(blocked.run!.battle!.enemies[0]).toMatchObject({ hp: 148, stagger: 0 });
    expect(intent(blocked.run!, blocked.run!.battle!.enemies[0]).damage).toBe(21);

    let burning = fight(['beelzebumon'], 1, 'boss');
    burning.run!.battle!.turn = 2;
    hand(burning, Array(6).fill('apocalypse'));
    for (let n = 0; n < 6; n++) burning = reduceGame(burning, { type: 'play', uid: `card${n}` });
    expect(burning.run!.battle!.enemies[0]).toMatchObject({ burn: 18, hp: 148, stagger: 0 });
    burning = reduceGame(burning, { type: 'beginEnemyTurn' });
    burning = reduceGame(burning, { type: 'enemyStep' });
    burning = reduceGame(burning, { type: 'finishEnemyTurn' });
    expect(burning.run!.battle!.enemies[0]).toMatchObject({ burn: 17, hp: 130, stagger: 0 });
    expect(burning.run!.damageDealt).toBe(18);
    expect(intent(burning.run!, burning.run!.battle!.enemies[0]).damage).toBe(21);
  });

  it('keeps weakness applied during reload for the following volley and then consumes it', () => {
    let s = fight(['beelzebumon'], 1, 'boss');
    s.run!.battle!.turn = 4;
    hand(s, ['taunt']);
    s = reduceGame(s, { type: 'play', uid: 'card0' });
    s = reduceGame(s, { type: 'endTurn' });
    s = parseSave(JSON.stringify(s));
    expect(s.run!.battle!.enemies[0]).toMatchObject({ weakened: 2, block: 12, devour: 0 });
    expect(intent(s.run!, s.run!.battle!.enemies[0])).toMatchObject({ damage: 4, hits: 3 });
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'endTurn' });
    expect(hp - s.run!.hp).toBe(12);
    expect(s.run!.battle!.enemies[0].weakened).toBe(0);
    expect(intent(s.run!, s.run!.battle!.enemies[0])).toMatchObject({
      name: '压制射击',
      damage: 5,
      hits: 3,
    });
  });

  it('matches the capped total-action rage budget to queued damage from turn 13 through 19', () => {
    let s = fight(['beelzebumon'], 1, 'boss');
    s.run!.battle!.turn = 13;
    const totals = [21, 18, 27, 0, 24, 21, 27];
    for (let n = 0; n < totals.length; n++) {
      const r = s.run!;
      const e = r.battle!.enemies[0];
      expect(r.battle!.turn).toBe(13 + n);
      expect(enemyEnrage(r, e)).toBe(n < 2 ? 3 : 6);
      const before = structuredClone(s);
      const plan = intent(r, e);
      expect(s).toEqual(before);
      expect(plan.damage * plan.hits).toBe(totals[n]);
      const hp = r.hp;
      s = reduceGame(s, { type: 'beginEnemyTurn' });
      s = reduceGame(s, { type: 'enemyStep' });
      expect(hp - s.run!.hp).toBe(totals[n]);
      s = reduceGame(s, { type: 'finishEnemyTurn' });
    }
    const ordinary = fight(['beelzebumon'], 1);
    ordinary.run!.battle!.turn = 13;
    ordinary.run!.battle!.enemies[0].strength = 0;
    expect(enemyEnrage(ordinary.run!, ordinary.run!.battle!.enemies[0])).toBe(0);
    expect(intent(ordinary.run!, ordinary.run!.battle!.enemies[0]).damage).toBe(6);
  });

  it.each([
    [13, 2, 2, 13, 2],
    [14, 0, 4, 20, 1],
    [15, 0, 6, 17, 2],
    [19, 2, 6, 17, 2],
  ])('other bosses retain their per-hit rage at turn %s', (turn, offset, rage, damage, hits) => {
    let s = fight(['diaboromon'], 3, 'boss', [{ phaseOffset: offset }]);
    s.run!.battle!.turn = turn;
    const e = s.run!.battle!.enemies[0];
    expect(enemyEnrage(s.run!, e)).toBe(rage);
    expect(intent(s.run!, e)).toMatchObject({ damage, hits });
    const hp = s.run!.hp;
    s = reduceGame(s, { type: 'beginEnemyTurn' });
    s = reduceGame(s, { type: 'enemyStep' });
    expect(hp - s.run!.hp).toBe(damage * hits);
  });

  it('stays predictable after saving an offset formation or loading old saves without modifiers', () => {
    const formation = ENCOUNTERS.find((e) => e.id === 'steel-trio')!;
    let s = fight(formation.enemies, 2, 'battle', formation.enemyModifiers);
    const before = enemyIntents(s.run!);
    s = parseSave(JSON.stringify(s));
    expect(enemyIntents(s.run!)).toEqual(before);
    expect(s.run!.currentNode!.enemyModifiers).toEqual(formation.enemyModifiers);
    expect(s.run!.battle!.enemies.map((e) => e.phaseOffset)).toEqual([0, 1, 2]);
    for (const e of s.run!.battle!.enemies) {
      delete e.phaseOffset;
      delete e.damageScale;
    }
    delete s.run!.currentNode!.enemyModifiers;
    s = parseSave(JSON.stringify(s));
    s.run!.battle!.turn = 2;
    expect([...enemyIntents(s.run!).values()].reduce((n, p) => n + p.damage * p.hits, 0)).toBe(36);
  });

  it('generates small chess elite teams with bounded HP and three-turn damage', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const r = makeRun('guilmon', seed * 7919 + 42, false);
      for (const node of r.nodes
        .flat()
        .filter(
          (n) => n.kind === 'elite' && ['rookchessmon', 'bishopchessmon'].includes(n.enemies[0]),
        )) {
        seen.add(node.enemies[0]);
        expect(node.enemies).toHaveLength(2);
        const s = fight(node.enemies, 2, 'elite', node.enemyModifiers);
        expect(s.run!.battle!.enemies.reduce((n, e) => n + e.maxHp, 0)).toBeLessThanOrEqual(100);
        for (let turn = 0; turn < 3; turn++) {
          const plans = enemyIntents(s.run!);
          expect(
            [...plans.values()].reduce((n, p) => n + p.damage * p.hits, 0),
          ).toBeLessThanOrEqual(20);
          beginEnemyTurn(s.run!);
          while (s.run!.battle!.enemyTurnIndex! < s.run!.battle!.enemies.length)
            enemyStep(s.run!, s.meta);
          finishEnemyTurn(s.run!, s.meta);
        }
      }
    }
    expect(seen).toEqual(new Set(['rookchessmon', 'bishopchessmon']));
  });

  it('shows the chess roles acting on their teammates', () => {
    const r = makeRun('guilmon', 42, false);
    // 独立用地图实际配置，确保编队预算没有只存在于测试夹具。
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
      r.nodes = makeRun('guilmon', seed * 7919 + 42, false).nodes;
      const node = r.nodes
        .flat()
        .find((n) => n.kind === 'elite' && n.enemies[0] === 'bishopchessmon');
      if (!node) continue;
      let s = fight(node.enemies, 2, 'elite', node.enemyModifiers);
      s = reduceGame(s, { type: 'endTurn' });
      expect(s.run!.battle!.enemies[1].strength).toBe(1);
      const e = s.run!.battle!.enemies[1];
      e.hp -= 15;
      const hp = e.hp;
      s = reduceGame(s, { type: 'endTurn' });
      expect(s.run!.battle!.enemies[1].hp).toBe(hp + 10);
      return;
    }
    throw new Error('未生成相棋编队');
  });

  it('caps summoned replica growth while retaining ordinary buff enemy behavior', () => {
    let s = fight(['core'], 4, 'boss');
    for (let n = 0; n < 28; n++) {
      s = reduceGame(s, { type: 'endTurn' });
      expect(s.run!.battle!.enemies.every((e) => e.strength <= 6)).toBe(true);
    }
    expect(s.run!.battle!.enemies[0].strength).toBe(6);
    expect(s.run!.battle!.enemies.filter((e) => e.id === 'replica')).toHaveLength(2);
    let ordinary = fight(['replica', 'goblimon'], 4);
    ordinary = reduceGame(ordinary, { type: 'endTurn' });
    expect(ordinary.run!.battle!.enemies[1].strength).toBe(4);
  });

  it.each(['daemon', 'barbamon'])('%s only gains strength for itself in a mixed team', (id) => {
    let s = fight([id, 'goblimon']);
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!.enemies[0].strength).toBe(id === 'daemon' ? 2 : 1);
    expect(s.run!.battle!.enemies[1].strength).toBe(0);
  });
});
