// 使用真实战斗队列与结算，全部状态驻留内存，不读取或写入玩家存档。
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SupportCutIn } from '../../src/components/SupportCutIn';
import { emptySave, reduceGame } from '../../src/game/engine';
import { ENEMIES } from '../../src/game/data';
import type { Action } from '../../src/game/types';
import { useBattleQueue } from '../../src/hooks/useBattleQueue';
import { BattleScreen } from '../../src/screens/BattleScreen';
import '../../src/styles.css';

const partners = [
  'leomon',
  'hagurumon',
  'mushmon',
  'picodevimon',
  'impmon',
  'andromon',
  'gotsumon',
  'betamon',
  'lopmon',
  'keramon',
  'default',
];

function scenario(partner: string, reducedMotion: boolean, lethal: boolean) {
  let save = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 });
  save = reduceGame(save, { type: 'bless', id: 'guard' });
  save = reduceGame(save, { type: 'node', id: save.run!.nodes[0][0].id });
  const run = save.run!,
    battle = run.battle!;
  run.support = partner;
  run.hp = run.maxHp - 6;
  battle.block = 0;
  battle.charge = 0;
  battle.enemies = [battle.enemies[0]];
  Object.assign(battle.enemies[0], { hp: lethal ? 1 : 50, maxHp: 50, block: 0 });
  save.settings.reducedMotion = reducedMotion;
  return save;
}

function BattlePreview({
  partner,
  reduced,
  lethal,
  onApplied,
}: {
  partner: string;
  reduced: boolean;
  lethal: boolean;
  onApplied: () => void;
}) {
  const [save, setSave] = useState(() => scenario(partner, reduced, lethal));
  const dispatch = useCallback((action: Action) => setSave((s) => reduceGame(s, action)), []);
  const send = useCallback(
    (action: Action) => {
      if (action.type === 'support') onApplied();
      dispatch(action);
    },
    [dispatch, onApplied],
  );
  const { motion, floatingNumber, battleBusy, queueAction, supportCutIn, finishSupportCutIn } =
    useBattleQueue(save, dispatch, send);
  const run = save.run!,
    battle = run.battle!;
  return (
    <>
      <div className="journey-filters">
        <button
          onClick={() => {
            queueAction({ type: 'support' }, 'effect');
            queueAction({ type: 'support' }, 'effect');
          }}
        >
          并发支援验收
        </button>
        <button onClick={() => queueAction({ type: 'support' }, 'effect')}>重复支援验收</button>
      </div>
      <output data-testid="battle-state" style={{ display: 'block', overflowWrap: 'anywhere' }}>
        {JSON.stringify({
          used: battle.supportUsed,
          block: battle.block,
          charge: battle.charge,
          weakened: battle.enemies[0].weakened,
          enemyHp: battle.enemies[0].hp,
          hand: battle.hand.length,
          hp: run.hp,
          rng: run.rng,
          screen: run.screen,
          busy: battleBusy,
          enemyTurnIndex: battle.enemyTurnIndex,
          turn: battle.turn,
        })}
      </output>
      {run.screen === 'battle' ? (
        <BattleScreen
          run={run}
          battle={battle}
          theme="factory"
          motion={motion}
          battleBusy={battleBusy}
          queueAction={queueAction}
          send={send}
          openDeck={() => {}}
          onHelp={() => {}}
        />
      ) : (
        <p>支援后战斗结束：{run.screen}</p>
      )}
      {floatingNumber && (
        <output
          className="battle-number"
          style={{
            left: floatingNumber.left,
            top: floatingNumber.top,
          }}
        >
          {floatingNumber.amount}
        </output>
      )}
      {supportCutIn && <SupportCutIn cutIn={supportCutIn} onComplete={finishSupportCutIn} />}
    </>
  );
}

function Preview() {
  const [partner, setPartner] = useState('leomon');
  const [reduced, setReduced] = useState(false);
  const [lethal, setLethal] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [applied, setApplied] = useState(0);
  const onApplied = useCallback(() => setApplied((count) => count + 1), []);
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <div className="journey-filters">
        <select aria-label="验收伙伴" value={partner} onChange={(e) => setPartner(e.target.value)}>
          {partners.map((id) => (
            <option key={id} value={id}>
              {ENEMIES[id]?.name ?? '应急防御程序'}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
          减少动画
        </label>
        <label>
          <input type="checkbox" checked={lethal} onChange={(e) => setLethal(e.target.checked)} />
          最后一击
        </label>
        <button onClick={() => setGeneration((value) => value + 1)}>重置战斗</button>
      </div>
      <p className="modal-note">
        独立内存验收 · 已结算 <output data-testid="applied">{applied}</output> 次支援
      </p>
      <BattlePreview
        key={`${partner}-${reduced}-${lethal}-${generation}`}
        partner={partner}
        reduced={reduced}
        lethal={lethal}
        onApplied={onApplied}
      />
    </main>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
