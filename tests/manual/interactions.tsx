// 仅在隔离端口构造测试存档，不进入生产入口。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { emptySave, reduceGame } from '../../src/game/engine';
import { EVENTS } from '../../src/game/events';
import { RELICS } from '../../src/game/data';
import { writeSave } from '../../src/game/storage';
import type { MapNode } from '../../src/game/types';
import '../../src/styles.css';

const scenarios = [
  '商店',
  '低金币商店',
  '长牌组商店',
  '仅剩一件装置商店',
  '全部装置已拥有商店',
  '营地',
  '满血营地',
  '无行动营地',
  '奖励',
  'reader',
  'shelter',
  'laboratory',
  'training',
  'research',
  'supply',
  '磁盘已满',
  '低血量事件',
  '旧事件',
];
function Preview() {
  const [key, setKey] = useState(0);
  function open(scenario: string) {
    if (location.port !== '5179') throw Error('请使用隔离验收端口 5179。');
    const save = reduceGame(
        reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 }),
        { type: 'bless', id: 'guard' },
      ),
      run = save.run!;
    run.row = 5;
    run.hp = 74;
    run.gold = 180;
    run.message = '';
    save.settings.reducedMotion = true;
    let kind: MapNode['kind'] = 'event';
    if (scenario.includes('商店')) {
      kind = 'shop';
      run.screen = 'shop';
      run.shopStock = ['strike', 'guard', 'charge'];
      run.shopRelicStock = ['armor', 'firewall', 'reader'];
      run.gold = scenario === '低金币商店' ? 20 : 180;
      if (scenario === '仅剩一件装置商店') {
        run.relics = Object.keys(RELICS).filter((id) => id !== 'armor');
        run.shopRelicStock = ['armor'];
      }
      if (scenario === '全部装置已拥有商店') {
        run.relics = Object.keys(RELICS);
        run.shopRelicStock = [];
      }
      if (scenario === '长牌组商店') {
        run.deck = Array.from({ length: 32 }, (_, i) => ({
          ...run.deck[i % run.deck.length],
          uid: `long-${i}`,
          upgraded: i % 3 === 0,
        }));
        run.seq = 32;
      }
    } else if (scenario.includes('营地')) {
      kind = 'camp';
      run.screen = 'camp';
      run.hp = scenario === '营地' ? 88 : run.maxHp;
      if (scenario === '无行动营地') {
        run.deck.forEach((card) => (card.upgraded = true));
        run.form = 'dukemon';
        run.stage = 3;
        run.branch = 'duke';
        run.formHistory.push('growlmon', 'wargrowlmon', 'dukemon');
      }
    } else if (scenario === '奖励') {
      kind = 'battle';
      run.screen = 'reward';
      run.reward = {
        cards: ['strike', 'guard', 'charge'],
        gold: 24,
        scans: [{ id: 'hagurumon', before: 50, after: 100 }],
        gains: ['攻击行为 ＋3'],
      };
      save.meta.scans.hagurumon = 100;
    } else run.screen = 'event';
    const eventId =
      scenario === '磁盘已满' ? 'supply' : scenario === '低血量事件' ? 'reader' : scenario;
    run.currentNode = {
      ...run.nodes[5][0],
      id: 'interaction-preview',
      kind,
      label: scenario,
      enemies: [],
      ...(eventId in EVENTS ? { eventId } : {}),
    };
    if (scenario === '磁盘已满') run.potions = 2;
    if (scenario === '低血量事件') run.hp = 3;
    if (scenario === '旧事件') run.row = 9;
    writeSave(save);
    setKey((value) => value + 1);
  }
  return (
    <>
      <details style={{ padding: 10, fontSize: 12 }}>
        <summary style={{ minHeight: 44 }}>独立交互验收 · 选择场景</summary>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 8 }}>
          {scenarios.map((scenario) => (
            <button style={{ minHeight: 44 }} key={scenario} onClick={() => open(scenario)}>
              {scenario}
            </button>
          ))}
        </div>
      </details>
      {key > 0 && <App key={key} />}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
