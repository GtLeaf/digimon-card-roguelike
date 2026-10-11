import { describe, expect, it } from 'vitest';
import { cardText } from '../src/game/data';
import { previewAction, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';

describe('基尔兽卡牌定位', () => {
  it.each([
    [false, 0, 8],
    [false, 1, 10],
    [false, 5, 10],
    [true, 0, 12],
    [true, 1, 14],
  ] as const)('双刃斩强化=%s、灼烧=%s：总伤害%s且保留灼烧', (upgraded, burn, damage) => {
    const s = balanceScenario([{ id: 'doublecut', uid: 'cut', upgraded }], 'wargrowlmon');
    s.run!.battle!.enemies[0].burn = burn;
    const action = { type: 'play', uid: 'cut' } as const;
    expect(previewAction(s, action).map((n) => n.amount)).toEqual([damage / 2, damage / 2]);
    const after = reduceGame(parseSave(JSON.stringify(s)), action).run!;
    expect(after.battle!.enemies[0]).toMatchObject({ hp: 100 - damage, burn });
    expect(after.battle!.energy).toBe(2);
    expect(after.activity.counts.attacks).toBe(1);
    expect(after.activity.counts.fire ?? 0).toBe(0);
  });

  it('灼烧加成与逐段力量、训练、同步及古拉兽一次追击独立叠加', () => {
    const s = balanceScenario([{ id: 'doublecut', uid: 'cut', upgraded: false }], 'growlmon');
    Object.assign(s.run!.battle!, { strength: 2, burst: 3 });
    s.run!.training = 'attack';
    s.run!.battle!.enemies[0].burn = 2;
    expect(previewAction(s, { type: 'play', uid: 'cut' }).map((n) => n.amount)).toEqual([12, 10]);
    const after = reduceGame(s, { type: 'play', uid: 'cut' }).run!;
    expect(after.battle!.enemies[0]).toMatchObject({ hp: 78, burn: 2 });
    expect(after.battle!.burnFollowupUsed).toBe(true);
  });

  it('双刃斩对实际目标判定灼烧，未灼烧护卫不会借用同伴状态', () => {
    const s = balanceScenario([{ id: 'doublecut', uid: 'cut', upgraded: false }], 'wargrowlmon', [
      'knightmon',
      'core',
    ]);
    const [guard, ally] = s.run!.battle!.enemies;
    guard.block = 0;
    ally.burn = 3;
    const after = reduceGame(s, { type: 'play', uid: 'cut', target: ally.uid }).run!;
    expect(after.battle!.enemies[0]).toMatchObject({ hp: 92, burn: 0 });
    expect(after.battle!.enemies[1]).toMatchObject({ hp: 100, burn: 3 });
  });

  it.each([false, true])('热浪强化=%s：全体伤害与2灼烧，仍只计一次出牌', (upgraded) => {
    const s = balanceScenario([{ id: 'heatwave', uid: 'wave', upgraded }], 'growlmon', [
      'core',
      'core',
    ]);
    const damage = upgraded ? 6 : 4;
    const after = reduceGame(s, { type: 'play', uid: 'wave' }).run!;
    expect(after.battle!.enemies.map((e) => ({ hp: e.hp, burn: e.burn }))).toEqual([
      { hp: 100 - damage, burn: 2 },
      { hp: 100 - damage, burn: 2 },
    ]);
    expect(after.activity.counts.attacks).toBe(1);
    expect(after.activity.counts.fire).toBe(1);
    expect(cardText({ id: 'heatwave', upgraded })).toContain(`造成 ${damage} 伤害，施加 2 灼烧`);
  });

  it('热浪点燃后双刃斩获得逐段加成和古拉兽追击', () => {
    let s = balanceScenario(
      [
        { id: 'heatwave', uid: 'wave', upgraded: false },
        { id: 'doublecut', uid: 'cut', upgraded: false },
      ],
      'growlmon',
      ['core', 'core'],
    );
    s = reduceGame(s, { type: 'play', uid: 'wave' });
    const after = reduceGame(s, { type: 'play', uid: 'cut' }).run!;
    expect(after.battle!.enemies.map((e) => e.hp)).toEqual([84, 96]);
    expect(after.battle!.enemies.map((e) => e.burn)).toEqual([2, 2]);
  });

  it.each([false, true])('岩石粉碎强化=%s：固定9/12伤害，不获得灼烧加成', (upgraded) => {
    const s = balanceScenario([{ id: 'rock', uid: 'rock', upgraded }], 'wargrowlmon');
    s.run!.battle!.enemies[0].burn = 2;
    const damage = upgraded ? 12 : 9;
    expect(reduceGame(s, { type: 'play', uid: 'rock' }).run!.battle!.enemies[0].hp).toBe(
      100 - damage,
    );
    expect(cardText({ id: 'rock', upgraded })).toBe(`造成 ${damage} 点伤害。`);
  });
});
