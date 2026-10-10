// 独立内存验收，使用真实页面与结算，不读取或修改玩家存档。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExplorationMap } from '../../src/components/ExplorationMap';
import { CampView, RewardView } from '../../src/components/JourneyScreens';
import { StoryEventView } from '../../src/components/StoryEvent';
import { EvolutionScreen } from '../../src/screens/EvolutionScreen';
import { RestScreen } from '../../src/screens/CampScreen';
import { emptySave, makeRun, reduceGame } from '../../src/game/engine';
import { EVENTS } from '../../src/game/events';
import type { Action } from '../../src/game/types';
import '../../src/styles.css';

function scenario(id: string) {
  const save = emptySave();
  save.run = makeRun('guilmon', 42, false);
  const run = save.run;
  run.screen = 'map';
  run.blessing = 'guard';
  if (id === 'chapter2' || id === 'chapter5' || id === 'legacy') {
    run.row = id === 'chapter2' ? 14 : 44;
    run.path = [run.nodes[run.row - 1][0].id];
    Object.assign(
      run,
      id === 'chapter2'
        ? { form: 'growlmon', stage: 1, bosses: 1, victories: 5 }
        : { form: 'dukemon', stage: 3, bosses: 4, victories: 20 },
    );
    if (id === 'legacy') {
      run.nodes[44][0].kind = 'evolution';
      run.nodes[44][0].label = '进化之光';
      run.hp = 40;
    }
  } else if (id === 'boss1' || id === 'boss2') {
    run.row = id === 'boss1' ? 9 : 19;
    Object.assign(run, {
      form: 'growlmon',
      stage: 1,
      bosses: id === 'boss1' ? 1 : 2,
      victories: 10,
    });
    run.currentNode = run.nodes[run.row][0];
    run.screen = 'reward';
    run.reward = { cards: [], gold: 65, scans: [] };
  } else if (id === 'camp') {
    run.row = 8;
    run.currentNode = run.nodes[8][0];
    run.screen = 'camp';
    run.hp = 40;
    Object.assign(run, { form: 'growlmon', stage: 1, bosses: 1 });
  } else if (id in EVENTS) {
    run.row = 7;
    run.currentNode = { ...run.nodes[7][0], kind: 'event', eventId: id, label: EVENTS[id].title };
    run.screen = 'event';
    run.hp = 40;
  } else {
    run.row = 1;
    run.path = [run.nodes[0][0].id];
  }
  return save;
}
function Preview() {
  const [save, setSave] = useState(() => scenario('map')),
    [key, setKey] = useState(0);
  const run = save.run!;
  const act = (action: Action) => setSave((current) => reduceGame(current, action));
  return (
    <main className="main-content">
      <div className="journey-filters">
        {Object.entries({
          map: '首战后选路',
          chapter2: '第二章研究',
          chapter5: '第五章事件',
          legacy: '旧地图休整',
          boss1: '第一章首领奖励',
          boss2: '第二章首领奖励',
          camp: '营地',
          spring: '数据泉',
          blackmarket: '黑市',
          research: '研究事件',
        }).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setSave(scenario(id));
              setKey((n) => n + 1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status">
        内存验收 · 页面 {run.screen} · 层 {run.row + 1} · 生命 {run.hp}/{run.maxHp} · 金币{' '}
        {run.gold} · 卡组 {run.deck.length} 张
      </p>
      {run.screen === 'map' && (
        <ExplorationMap
          key={key}
          run={run}
          onEnter={(id) => act({ type: 'node', id })}
          onTree={() => {}}
        />
      )}
      {run.screen === 'event' && (
        <StoryEventView key={key} run={run} meta={save.meta} onAction={act} />
      )}
      {run.screen === 'camp' && <CampView key={key} run={run} onAction={act} />}
      {run.screen === 'rest' && <RestScreen run={run} send={act} />}
      {run.screen === 'reward' && <RewardView run={run} meta={save.meta} onAction={act} />}
      {run.screen === 'evolution' && (
        <EvolutionScreen run={run} meta={save.meta} send={act} onDeck={() => {}} />
      )}
      {run.screen === 'blessing' && <p>首领结算已衔接祝福选择。</p>}
    </main>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
