import { CARDS } from '../../src/game/data';
import { skillUnlocked } from '../../src/game/cardSkills';
import { playCost, reduceGame } from '../../src/game/engine';
import { balanceScenario } from './balanceScenario';
import type { Card } from '../../src/game/types';

// 定向回归：同一回合只按实际手牌连续出牌，不补牌/补能。
// 达到步数上限只报告风险见证，不把有限模拟当作数学上的无限证明。
export function inspectDrawCycle(id: string, form: string, upgraded = true, limit = 120) {
  const card = (id: string, uid: string): Card => ({ id, uid, upgraded });
  const finisher = id === 'curtainSpin' ? 'strike' : 'runeShard';
  let s = balanceScenario(
    [
      card(id, 'a'),
      card(id, 'b'),
      card(finisher, 'finisher'),
      card('guard', 'g1'),
      card('guard', 'g2'),
    ],
    form,
  );
  if (id === 'kaguraBell' || id === 'izuna')
    s.run!.formHistory = ['renamon', 'youkomon', 'doumon', form];
  if (s.run!.deck.some((c) => !skillUnlocked(s.run!, CARDS[c.id])))
    throw Error('循环场景来源未解锁');
  const original = structuredClone(s);
  if (id === 'curtainSpin') s = reduceGame(s, { type: 'play', uid: 'finisher' });
  const initial = { energy: s.run!.battle!.energy, turn: s.run!.battle!.turn, hp: s.run!.hp };
  const trajectory: { energy: number; hp: number; turn: number; marks: number }[] = [];
  for (let step = 0; step < limit && s.run!.screen === 'battle'; step++) {
    const b = s.run!.battle!;
    const c = b.hand.find((c) => c.id === id && playCost(s.run, c) <= b.energy);
    if (!c) break;
    const after = reduceGame(s, { type: 'play', uid: c.uid });
    if (after.run!.battle!.played !== b.played + 1) break;
    s = after;
    trajectory.push({
      energy: s.run!.battle!.energy,
      hp: s.run!.hp,
      turn: s.run!.battle!.turn,
      marks: s.run!.battle!.enemies.reduce((n, e) => n + e.mark, 0),
    });
  }
  const sustained =
    trajectory.length === limit &&
    trajectory.every(
      (t, i) =>
        t.turn === initial.turn &&
        t.hp >= initial.hp &&
        t.energy >= (trajectory[i - 1]?.energy ?? initial.energy),
    );
  const cycleEnd = structuredClone(s);
  let finishActions = 0;
  while (sustained && s.run!.screen === 'battle' && finishActions < 150) {
    const b = s.run!.battle!;
    const c =
      b.hand.find((c) => c.uid === 'finisher' && playCost(s.run, c) <= b.energy) ??
      b.hand.find((c) => c.id === id && playCost(s.run, c) <= b.energy);
    if (!c) break;
    const after = reduceGame(s, { type: 'play', uid: c.uid });
    if (after.run!.battle!.played !== b.played + 1) break;
    s = after;
    finishActions++;
  }
  return {
    id,
    form,
    upgraded,
    limit,
    steps: trajectory.length,
    verdict: sustained
      ? 'sustained-cycle-risk'
      : trajectory.length === limit
        ? 'step-limit-inconclusive'
        : 'terminated',
    setup: {
      deck: original.run!.deck,
      history: original.run!.formHistory,
      preparationPlays: id === 'curtainSpin' ? 1 : 0,
    },
    initial,
    trajectory,
    cycleScreen: cycleEnd.run!.screen,
    finishActions,
    finishScreen: s.run!.screen,
  };
}
