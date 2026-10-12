import { describe, expect, it } from 'vitest';
import { CARDS, cardText } from '../src/game/data';
import { cardPool } from '../src/game/cardSkills';
import { reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';

const play = (s: ReturnType<typeof balanceScenario>, uid: string) =>
  reduceGame(s, { type: 'play', uid, target: s.run!.battle!.enemies[0].uid });

describe('红莲骑士兽圣炎化盾', () => {
  it.each([
    [false, 0, 4 + 3 + 2],
    [false, 4, 4 + 12 + 3 + 2],
    [true, 0, 7 + 3 + 2],
    [true, 5, 7 + 15 + 3 + 2],
  ] as const)('圣炎之盾 强化=%s、灼烧=%s：获得%s护盾并清空灼烧', (upgraded, burn, shield) => {
    const s = balanceScenario([{ id: 'aegis', uid: 'a', upgraded }], 'dukemon');
    s.run!.battle!.enemies[0].burn = burn;
    s.run!.battle!.draw = [{ id: 'guard', uid: 'g', upgraded: false }];
    const after = play(s, 'a').run!;
    const b = after.battle!;
    expect(b.block).toBe(shield); // 含红莲首次护盾牌＋3、夹具流转继承首张技能＋2
    expect(b.enemies[0].burn).toBe(0);
    expect(b.enemies[0].hp).toBe(100);
    expect(b.hand.map((c) => c.id)).toEqual(['guard']);
    expect(after.activity.counts.fire).toBe(1);
    expect(after.activity.counts.defenses).toBe(1);
    expect(after.activity.counts.detonations ?? 0).toBe(burn ? 1 : 0);
    expect(parseSave(JSON.stringify({ ...s, run: after })).run).toEqual(after);
  });

  it('只消耗所选目标的灼烧', () => {
    const s = balanceScenario([{ id: 'aegis', uid: 'a', upgraded: false }], 'dukemon', [
      'core',
      'core',
    ]);
    const [e1, e2] = s.run!.battle!.enemies;
    e1.burn = 2;
    e2.burn = 6;
    const after = reduceGame(s, { type: 'play', uid: 'a', target: e2.uid }).run!.battle!;
    expect(after.enemies[0].burn).toBe(2);
    expect(after.enemies[1].burn).toBe(0);
    expect(after.block).toBe(4 + 18 + 3 + 2);
  });

  it.each([
    [false, 0, 6],
    [false, 10, 26],
    [true, 10, 30],
  ] as const)('终极神圣光束 强化=%s、护盾=%s：造成%s伤害并清空护盾', (upgraded, block, damage) => {
    const s = balanceScenario([{ id: 'finalElysion', uid: 'f', upgraded }], 'dukemon');
    s.run!.battle!.block = block;
    s.run!.battle!.energy = 2;
    const b = play(s, 'f').run!.battle!;
    expect(b.enemies[0].hp).toBe(100 - damage);
    expect(b.block).toBe(0);
    expect(b.energy).toBe(0);
    expect(b.exhaust.map((c) => c.id)).toEqual(['finalElysion']);
    expect(cardText({ id: 'finalElysion', upgraded })).toContain(`造成 ${upgraded ? 10 : 6} 伤害`);
  });

  it('炎核重炮 → 圣炎之盾 → 终极神圣光束：灼烧化盾再转为伤害', () => {
    let s = balanceScenario(
      [
        { id: 'emberCannon', uid: 'c', upgraded: false },
        { id: 'aegis', uid: 'a', upgraded: false },
        { id: 'finalElysion', uid: 'f', upgraded: false },
      ],
      'dukemon',
    );
    s.run!.battle!.energy = 5;
    s = play(s, 'c');
    expect(s.run!.battle!.enemies[0].burn).toBe(4);
    s = play(s, 'a');
    expect(s.run!.battle!.block).toBe(4 + 12 + 3);
    s = play(s, 'f');
    const b = s.run!.battle!;
    expect(b.enemies[0].hp).toBe(100 - 12 - (6 + 19 * 2));
    expect(b.block).toBe(0);
  });

  it('到达红莲骑士兽后开放终极神圣光束，其他终点不开放', () => {
    const duke = balanceScenario([], 'dukemon').run!;
    expect(cardPool(duke)).toEqual(expect.arrayContaining(['aegis', 'finalElysion', 'gramLance']));
    const megidra = balanceScenario([], 'megidramon').run!;
    expect(cardPool(megidra)).not.toContain('finalElysion');
    expect(CARDS.aegis.name).toBe('圣炎之盾');
  });
});
