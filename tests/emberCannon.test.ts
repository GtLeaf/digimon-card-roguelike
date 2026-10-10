import { describe, expect, it } from 'vitest';
import { CARDS, cardText } from '../src/game/data';
import { cardPool, skillLabel } from '../src/game/cardSkills';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';

describe('大古拉兽炎核重炮', () => {
  it.each([
    [false, 0, 12],
    [false, 1, 16],
    [false, 3, 24],
    [true, 0, 15],
    [true, 1, 19],
    [true, 3, 27],
  ] as const)('强化=%s、蓄能=%s：结算%s伤害与实际灼烧护盾', (upgraded, charge, damage) => {
    const s = balanceScenario([{ id: 'emberCannon', uid: 'shot', upgraded }], 'wargrowlmon');
    s.run!.battle!.charge = charge;
    const after = reduceGame(s, { type: 'play', uid: 'shot' }).run!;
    expect(after.battle!.enemies[0].hp).toBe(100 - damage);
    expect(after.battle!.enemies[0].burn).toBe(2);
    expect(after.battle!.charge).toBe(0);
    expect(after.battle!.energy).toBe(1);
    expect(after.battle!.block).toBe(2);
    expect(after.activity.counts.fire).toBe(1);
    expect(after.activity.counts.cannonShots ?? 0).toBe(charge ? 1 : 0);
    expect(after.activity.counts.defenses ?? 0).toBe(0);
    expect(after.battle!.discard.map((c) => c.id)).toEqual(['emberCannon']);
    expect(cardText({ id: 'emberCannon', upgraded })).toContain(`造成 ${upgraded ? 15 : 12} 伤害`);
    expect(parseSave(JSON.stringify({ ...s, run: after })).run).toEqual(after);
  });

  it('直接击杀不施加灼烧或领取护盾，蓄能仍正常消耗', () => {
    const s = balanceScenario(
      [{ id: 'emberCannon', uid: 'shot', upgraded: false }],
      'wargrowlmon',
      ['core', 'core'],
    );
    s.run!.battle!.charge = 1;
    s.run!.battle!.enemies[0].hp = 5;
    const after = reduceGame(s, { type: 'play', uid: 'shot' }).run!;
    expect(after.battle!.enemies[0].hp).toBe(0);
    expect(after.battle!.enemies[0].burn).toBe(0);
    expect(after.battle!.enemies[1].hp).toBe(100);
    expect(after.battle!.burned).toBe(false);
    expect(after.battle!.block).toBe(0);
    expect(after.battle!.charge).toBe(0);
  });

  it('重炮点燃后可引爆，护盾每回合只触发一次', () => {
    const s = balanceScenario(
      [
        { id: 'emberCannon', uid: 'shot', upgraded: false },
        { id: 'ignite', uid: 'ignite', upgraded: false },
      ],
      'wargrowlmon',
    );
    s.run!.battle!.charge = 1;
    const fired = reduceGame(s, { type: 'play', uid: 'shot' });
    const after = reduceGame(fired, { type: 'play', uid: 'ignite' }).run!;
    expect(after.battle!.enemies[0].hp).toBe(75); // 重炮16＋引爆(3＋2×3)
    expect(after.battle!.enemies[0].burn).toBe(0);
    expect(after.battle!.block).toBe(2);
    expect(after.activity.counts.detonations).toBe(1);
  });

  it('仅到达大古拉兽后开放，后续进化继承，通用脉冲炮仍可获取', () => {
    for (const partner of ['guilmon', 'renamon', 'terriermon', 'impmon'] as const) {
      const r = makeRun(partner, 42);
      expect(cardPool(r)).not.toContain('emberCannon');
      expect(cardPool(r)).toContain('cannon');
    }
    const r = makeRun('guilmon', 42);
    r.form = 'blackwargrowlmon';
    r.stage = 2;
    r.formHistory = ['guilmon', 'blackgrowmon', 'blackwargrowlmon'];
    expect(cardPool(r)).not.toContain('emberCannon');
    r.form = 'wargrowlmon';
    r.formHistory = ['guilmon', 'growlmon', 'wargrowlmon'];
    expect(cardPool(r)).toContain('emberCannon');
    expect(skillLabel(CARDS.emberCannon, r)).toBe('形态专属');
    r.form = 'dukemon';
    r.stage = 3;
    r.formHistory.push('dukemon');
    expect(cardPool(r)).toContain('emberCannon');
    expect(skillLabel(CARDS.emberCannon, r)).toBe('继承技能');
    expect(makeRun('terriermon', 42).deck.map((c) => c.id)).toContain('cannon');
  });

  it('进化赠送新重炮，保留已有通用炮，并可使用开战蓄能', () => {
    let s = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 });
    Object.assign(s.run!, { screen: 'evolution', form: 'growlmon', stage: 1, bosses: 2, row: 19 });
    s.run!.formHistory.push('growlmon');
    s.run!.deck.push({ id: 'cannon', uid: 'owned-cannon', upgraded: true });
    const before = structuredClone(s.run!.deck);
    s = reduceGame(s, {
      type: 'evolve',
      form: 'wargrowlmon',
      training: 'defense',
      inherit: 'ward',
    });
    expect(s.run!.deck.slice(0, before.length)).toEqual(before);
    expect(s.run!.deck.slice(before.length).map((c) => [c.id, c.upgraded])).toEqual([
      ['flare', false],
      ['emberCannon', false],
    ]);
    const shot = s.run!.deck.find((c) => c.id === 'emberCannon')!;
    Object.assign(s.run!, { screen: 'map', row: 0, path: [], currentNode: null, blessing: '' });
    s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
    expect(s.run!.battle!.charge).toBe(1);
    s.run!.battle!.hand = [shot];
    const hp = s.run!.battle!.enemies[0].hp;
    s = reduceGame(s, { type: 'play', uid: shot.uid });
    expect(s.run!.battle!.enemies[0].hp).toBe(hp - 16);
    expect(s.run!.battle!.enemies[0].burn).toBe(2);
    expect(s.run!.battle!.block).toBe(5); // 守护训练3＋首次实际灼烧2
  });

  it('已进化旧存档保留原有脉冲炮，不补发或替换新技能', () => {
    const s = emptySave();
    s.run = makeRun('guilmon', 42);
    Object.assign(s.run, {
      form: 'wargrowlmon',
      stage: 2,
      formHistory: ['guilmon', 'growlmon', 'wargrowlmon'],
    });
    s.run.deck.push({ id: 'cannon', uid: 'old-cannon', upgraded: true });
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.run!.deck).toEqual(s.run.deck);
    expect(loaded.run!.rng).toBe(s.run.rng);
    expect(loaded.run!.deck.some((c) => c.id === 'emberCannon')).toBe(false);
    expect(cardPool(loaded.run!)).toContain('emberCannon');
    expect(cardPool(loaded.run!)).toContain('cannon');
  });
});
