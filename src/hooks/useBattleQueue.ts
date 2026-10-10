import { useCallback, useEffect, useRef, useState } from 'react';
import { intent, previewAction } from '../game/engine';
import type { Action, BattleNumber, Save } from '../game/types';

export type BattleMotion = {
  actor: 'player' | 'enemy' | 'effect';
  enemyIds: string[];
  phase: 'windup' | 'impact';
  playerHit: boolean;
};
export type FloatingNumber = BattleNumber & { key: number; left: number; top: number };
export type BattleActor = BattleMotion['actor'];
export type QueueAction = (
  action: Action,
  actor: BattleActor,
  enemyIds?: string[],
  playerHit?: boolean,
) => void;
export type SupportCutInState = { key: number; partner: string; reducedMotion: boolean };

// 战斗动作队列：先预览结算数值并播放动效/飘字，结束后才真正派发动作。
export function useBattleQueue(
  state: Save,
  dispatch: (action: Action) => void,
  send: (action: Action) => void,
) {
  const [motion, setMotion] = useState<BattleMotion | null>(null);
  const [floatingNumber, setFloatingNumber] = useState<FloatingNumber | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const [supportCutIn, setSupportCutIn] = useState<SupportCutInState | null>(null);
  const pendingSupport = useRef<{ key: number; resume: () => void } | null>(null);
  const busyRef = useRef(false);
  const timers = useRef<number[]>([]);
  const sequence = useRef(0);
  const enemyStepKey = useRef('');
  const r = state.run,
    b = r?.battle;

  useEffect(
    () => () => {
      sequence.current++;
      pendingSupport.current = null;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const finishSupportCutIn = useCallback((key: number) => {
    const pending = pendingSupport.current;
    if (!pending || pending.key !== key || sequence.current !== key) return;
    // 先消费回调，防止跳过和自然播放结束在同一帧重复结算。
    pendingSupport.current = null;
    setSupportCutIn(null);
    pending.resume();
  }, []);

  const queueAction = useCallback<QueueAction>(
    (action, actor, enemyIds = [], playerHit = false) => {
      if (busyRef.current) return;
      if (
        action.type === 'support' &&
        (state.run?.screen !== 'battle' ||
          !state.run.battle ||
          state.run.battle.enemyTurnIndex !== null ||
          state.run.battle.supportUsed)
      )
        return;
      const feedback = previewAction(state, action);
      const reduced =
        state.settings.reducedMotion ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      busyRef.current = true;
      setBattleBusy(true);
      const current = ++sequence.current;
      const schedule = (callback: () => void, delay: number) => {
        timers.current.push(
          window.setTimeout(() => {
            if (sequence.current === current) callback();
          }, delay),
        );
      };
      const playFeedback = () => {
        if (!reduced) setMotion({ actor, enemyIds, phase: 'windup', playerHit });
        const start = reduced ? 0 : 170;
        feedback.forEach((number, index) => {
          schedule(
            () => {
              const combatants = document.querySelectorAll('.battle-stage .enemies .enemy');
              const enemyIndex =
                state.run?.battle?.enemies.findIndex((enemy) => enemy.uid === number.target) ?? -1;
              const element =
                number.target === 'player'
                  ? document.querySelector('.battle-stage .player-unit')
                  : combatants[enemyIndex];
              const bounds = element?.getBoundingClientRect();
              if (bounds)
                setFloatingNumber({
                  ...number,
                  key: current * 100 + index,
                  left: Math.max(
                    42,
                    Math.min(window.innerWidth - 42, bounds.left + bounds.width / 2),
                  ),
                  top: Math.max(
                    78,
                    Math.min(window.innerHeight - 56, bounds.top + bounds.height * 0.38),
                  ),
                });
              if (!reduced)
                setMotion({
                  actor,
                  enemyIds: number.target === 'player' ? [] : [number.target],
                  phase: 'impact',
                  playerHit: number.target === 'player' && number.kind === 'damage',
                });
              if (index < feedback.length - 1 && !reduced)
                schedule(() => setMotion({ actor, enemyIds, phase: 'windup', playerHit }), 220);
            },
            start + index * (reduced ? 580 : 390),
          );
        });
        if (!feedback.length && !reduced)
          schedule(() => setMotion({ actor, enemyIds, phase: 'impact', playerHit }), start);
        const finish = start + (feedback.length ? feedback.length * (reduced ? 580 : 390) : 140);
        schedule(() => {
          send(action);
          setFloatingNumber(null);
          setMotion(null);
          busyRef.current = false;
          setBattleBusy(false);
          timers.current = [];
        }, finish);
      };
      if (action.type === 'support') {
        pendingSupport.current = { key: current, resume: playFeedback };
        setSupportCutIn({ key: current, partner: state.run!.support, reducedMotion: reduced });
      } else playFeedback();
    },
    [send, state],
  );

  useEffect(() => {
    if (r?.screen !== 'battle' || !b || b.enemyTurnIndex === null || battleBusy) return;
    const key = `${state.meta.games}-${r.currentNode?.id}-${b.turn}-${b.enemyTurnIndex}`;
    if (enemyStepKey.current === key) return;
    enemyStepKey.current = key;
    if (b.enemyTurnIndex >= b.enemies.length) {
      if (b.enemies.some((enemy) => enemy.hp > 0 && enemy.burn > 0))
        queueAction({ type: 'finishEnemyTurn' }, 'effect');
      else dispatch({ type: 'finishEnemyTurn' });
      return;
    }
    const enemy = b.enemies[b.enemyTurnIndex];
    if (enemy.hp <= 0 || enemy.summonedTurn === b.turn) {
      dispatch({ type: 'enemyStep' });
      return;
    }
    queueAction({ type: 'enemyStep' }, 'enemy', [enemy.uid], intent(r, enemy).type === 'attack');
  }, [r, b, battleBusy, queueAction, dispatch, state.meta.games]);

  return { motion, floatingNumber, battleBusy, queueAction, supportCutIn, finishSupportCutIn };
}
