// 使用真实战斗页面与动作队列；所有场景只存在于内存，不读写玩家存档。
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beginBattle } from '../../src/game/battle';
import { emptySave, makeRun, reduceGame } from '../../src/game/engine';
import type { Action } from '../../src/game/types';
import { useBattleQueue } from '../../src/hooks/useBattleQueue';
import { BattleScreen } from '../../src/screens/BattleScreen';
import '../../src/styles.css';

const scenarios = {
  1: '首轮连射',
  2: '压制射击',
  3: '加农压制',
  4: '装填窗口',
  13: '狂暴连射',
  15: '狂暴加农',
  114: '其他首领狂暴',
};
function setup(turn: number) {
  const save = emptySave();
  const run = makeRun('guilmon', 42, false);
  Object.assign(run, {
    form: 'growlmon',
    stage: 1,
    formHistory: ['guilmon', 'growlmon'],
    training: 'defense',
    blessing: 'guard',
    row: 19,
    bosses: 1,
  });
  const node = { ...run.nodes[19][0], enemies: [turn === 114 ? 'core' : 'beelzebumon'] };
  run.currentNode = node;
  run.screen = 'battle';
  beginBattle(run, node);
  const cards = ['strike', 'strike', 'strike', 'guard', 'fortify'].map((id, index) => ({
    id,
    uid: `qa-${index}`,
    upgraded: false,
  }));
  run.deck = cards;
  Object.assign(run.battle!, {
    turn: turn === 114 ? 14 : turn,
    hand: cards,
    draw: [],
    discard: [],
    block: 0,
  });
  run.battle!.enemies[0].devour = turn % 4 === 3 ? 2 : turn % 4 === 2 ? 1 : 0;
  save.run = run;
  save.settings.reducedMotion = true;
  return save;
}
function Sandbox({ turn }: { turn: number }) {
  const [save, setSave] = useState(() => setup(turn));
  const send = useCallback(
    (action: Action) => setSave((current) => reduceGame(current, action)),
    [],
  );
  const queue = useBattleQueue(save, send, send);
  const run = save.run!,
    battle = run.battle!;
  return (
    <>
      <p role="status">
        内存验收 · 回合 {battle.turn} · 生命 {run.hp}/{run.maxHp} · 直接伤害{' '}
        {battle.enemies[0].stagger}
      </p>
      {run.screen === 'battle' ? (
        <BattleScreen
          run={run}
          battle={battle}
          theme="forest"
          motion={queue.motion}
          battleBusy={queue.battleBusy}
          queueAction={queue.queueAction}
          send={send}
          openDeck={() => {}}
          onHelp={() => {}}
        />
      ) : (
        <p>战斗已结束：{run.screen}</p>
      )}
    </>
  );
}
function Preview() {
  const [scene, setScene] = useState({ turn: 3, key: 0 });
  return (
    <main className="main-content">
      <div className="journey-filters">
        {Object.entries(scenarios).map(([turn, label]) => (
          <button
            key={turn}
            onClick={() => setScene((current) => ({ turn: Number(turn), key: current.key + 1 }))}
          >
            {label}
          </button>
        ))}
      </div>
      <Sandbox key={scene.key} turn={scene.turn} />
    </main>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
