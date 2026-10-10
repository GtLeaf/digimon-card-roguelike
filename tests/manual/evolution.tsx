// 全部状态仅驻留内存，可确认进化与返回，不读取或写入玩家存档。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EvolutionTree } from '../../src/components/EvolutionTree';
import { EvolutionScreen } from '../../src/screens/EvolutionScreen';
import { DeckViewer } from '../../src/components/DeckViewer';
import { JourneyPanel } from '../../src/components/JourneyPanel';
import { emptySave, reduceGame } from '../../src/game/engine';
import { EVOLUTIONS, formName } from '../../src/game/evolution';
import type { Action } from '../../src/game/types';
import '../../src/styles.css';

function scenario(form: string) {
  const d = EVOLUTIONS[form];
  const save = reduceGame(emptySave(), { type: 'start', partner: d.partner, seed: 42 });
  Object.assign(save.run!, {
    screen: 'evolution',
    form,
    stage: d.stage,
    row: d.stage === 0 ? 3 : d.stage === 1 ? 19 : 29,
    bosses: d.stage === 0 ? 0 : d.stage === 1 ? 2 : 3,
    victories: 6,
    formHistory: [d.partner, form],
    inherit: d.partner === 'renamon' ? 'seal' : 'ember',
    training: 'defense',
  });
  save.run!.activity.counts = {
    attacks: 48,
    fire: 32,
    selfCosts: 6,
    heals: 4,
    detonations: 4,
    burnKills: 18,
    skills: 20,
    marks: 12,
    defenses: 20,
    markBursts: 8,
  };
  save.run!.deck = [
    ...d.cards,
    'guard',
    'guard',
    'strike',
    'strike',
    'fireball',
    'rock',
    'ignite',
    'roar',
  ].map((id, i) => ({ id, uid: `evo-qa-${i}`, upgraded: i % 2 === 0 }));
  save.meta.unlockedRoutes = ['chaos', 'purification', 'mechanical'];
  return save;
}
function Preview() {
  const [save, setSave] = useState(() => scenario('growlmon')),
    [browse, setBrowse] = useState(false),
    [key, setKey] = useState(0),
    [deck, setDeck] = useState(false),
    [last, setLast] = useState<Action | null>(null);
  function open(form: string, view = false, mode?: 'blocked' | 'camp') {
    const next = scenario(form);
    if (mode === 'blocked') {
      next.meta.unlockedRoutes = [];
      next.run!.activity.counts = {};
    }
    if (mode === 'camp') next.run!.evolutionReturn = 'camp';
    setSave(next);
    setBrowse(view);
    setKey((k) => k + 1);
    setLast(null);
  }
  function act(action: Action) {
    setLast(action);
    setSave((s) => reduceGame(s, action));
  }
  const run = save.run!;
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div className="journey-filters">
        <button onClick={() => open('growlmon')}>完全体赠牌验收</button>
        <button onClick={() => open('blackwargrowlmon')}>究极体赠牌验收</button>
        <button onClick={() => open('renamon')}>招式强化验收</button>
        <button onClick={() => open('doumon', true)}>进化树浏览验收</button>
        <button onClick={() => open('blackwargrowlmon', false, 'blocked')}>缺少条件验收</button>
        <button onClick={() => open('growlmon', false, 'camp')}>营地补进化验收</button>
      </div>
      <p className="modal-note">独立内存验收 · 不影响玩家存档</p>
      {last?.type === 'evolve' ? (
        <section aria-label="进化验收结果">
          <h2>进化成功：{formName(run.form)}</h2>
          <p className="modal-note">牌组 {run.deck.length} 张 · 新招式直接入组，已有招式自动强化</p>
          <DeckViewer run={run} />
        </section>
      ) : last?.type === 'deferEvolution' ? (
        <p>已返回旅途，卡牌保持原样。</p>
      ) : browse ? (
        <EvolutionTree
          key={key}
          run={run}
          meta={save.meta}
          onAction={act}
          onDeck={() => setDeck(true)}
        />
      ) : (
        <EvolutionScreen
          key={key}
          run={run}
          meta={save.meta}
          send={act}
          onDeck={() => setDeck(true)}
        />
      )}
      {deck && (
        <JourneyPanel
          title="查看当前卡组"
          wide
          onClose={() => setDeck(false)}
          footer={
            <div>
              <button className="secondary" onClick={() => setDeck(false)}>
                返回进化
              </button>
            </div>
          }
        >
          <DeckViewer run={run} />
        </JourneyPanel>
      )}
    </main>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
