import { describe, expect, it } from 'vitest';
import { emptySave, previewAction, reduceGame } from '../src/game/engine';

function battle() {
  let save = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 });
  save = reduceGame(save, { type: 'bless', id: 'guard' });
  return reduceGame(save, { type: 'node', id: save.run!.nodes[0][0].id });
}

describe('battle feedback numbers', () => {
  it('records every actual hit, including the capped lethal hit', () => {
    let save = battle();
    const encounter = save.run!.battle!;
    encounter.hand = [{ uid: 'multi', id: 'doublecut', upgraded: false }];
    encounter.enemies[0].hp = 6;
    encounter.enemies[0].block = 3;
    expect(previewAction(save, { type: 'play', uid: 'multi' })).toEqual([
      { target: encounter.enemies[0].uid, kind: 'damage', amount: 2 },
      { target: encounter.enemies[0].uid, kind: 'damage', amount: 4 },
    ]);
    save = reduceGame(save, { type: 'play', uid: 'multi' });
    expect(save.run!.screen).toBe('reward');
  });

  it('records zero for blocked hits and each enemy hit separately', () => {
    let save = battle();
    const encounter = save.run!.battle!;
    encounter.enemies[0].id = 'beelzebumon';
    encounter.block = 7;
    save = reduceGame(save, { type: 'beginEnemyTurn' });
    expect(previewAction(save, { type: 'enemyStep' })).toEqual([
      { target: 'player', kind: 'damage', amount: 0 },
      { target: 'player', kind: 'damage', amount: 3 },
      { target: 'player', kind: 'damage', amount: 5 },
    ]);
  });

  it('shows only actual healing for cards, drain, and recovery disks', () => {
    let save = battle();
    save.run!.hp = save.run!.maxHp - 2;
    save.run!.battle!.energy = 10;
    save.run!.battle!.hand = [
      { uid: 'heal', id: 'mend', upgraded: false },
      { uid: 'drain', id: 'drain', upgraded: false },
    ];
    expect(previewAction(save, { type: 'play', uid: 'heal' })).toEqual([
      { target: 'player', kind: 'heal', amount: 2 },
    ]);
    save = reduceGame(save, { type: 'play', uid: 'heal' });
    save.run!.hp -= 4;
    expect(previewAction(save, { type: 'play', uid: 'drain' }).at(-1)).toEqual({
      target: 'player',
      kind: 'heal',
      amount: 3,
    });
    save = reduceGame(save, { type: 'play', uid: 'drain' });
    save.run!.hp = save.run!.maxHp - 1;
    expect(previewAction(save, { type: 'potion' })).toEqual([
      { target: 'player', kind: 'heal', amount: 1 },
    ]);
    save = reduceGame(save, { type: 'potion' });
    expect(save.run!.battle!.log[0]).toContain('回复 1 生命');
  });
});
