import { EVOLUTIONS } from '../../src/game/evolution';
import { emptySave, reduceGame } from '../../src/game/engine';
import type { Card } from '../../src/game/types';

// 校准与回归共用的固定场景；不触碰玩家存档。
export function balanceScenario(cards: Card[], form = 'renamon', enemies = ['goblimon']) {
  const d = EVOLUTIONS[form];
  let s = reduceGame(reduceGame(emptySave(), { type: 'start', partner: d.partner, seed: 42 }), {
    type: 'bless',
    id: 'guard',
  });
  s.run!.nodes[0][0].enemies = enemies;
  s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
  Object.assign(s.run!, {
    form,
    stage: d.stage,
    branch: d.branch ?? null,
    formHistory: [d.partner, form],
    hp: 60,
    maxHp: 100,
    blessing: '',
    inherit: 'flow',
    training: 'defense',
    deck: structuredClone(cards),
  });
  Object.assign(s.run!.battle!, {
    hand: structuredClone(cards),
    draw: [],
    discard: [],
    exhaust: [],
    block: 0,
    charge: 0,
  });
  for (const e of s.run!.battle!.enemies) Object.assign(e, { hp: 100, maxHp: 100 });
  return s;
}
