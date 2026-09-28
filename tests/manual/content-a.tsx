// 仅供独立测试端口使用；不进入生产入口，不使用正常游戏存档。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { emptySave, reduceGame } from '../../src/game/engine';
import { EVENTS } from '../../src/game/events';
import { writeSave } from '../../src/game/storage';
import '../../src/styles.css';
function Preview() {
  const [key, setKey] = useState(0);
  function open(id: string) {
    if (location.port !== '5179') throw Error('请在独立验收端口5179打开，避免覆盖游玩存档。');
    let s = reduceGame(reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 }), {
      type: 'bless',
      id: 'guard',
    });
    if (id in EVENTS) {
      s.run!.hp = 40;
      s.run!.row = 5;
      s.run!.currentNode = {
        id: 'preview-event',
        kind: 'event',
        label: EVENTS[id].title,
        eventId: id,
        row: 5,
        lane: 0,
        enemies: [],
        next: [],
      };
      s.run!.screen = 'event';
    } else if (id !== 'map') {
      s.run!.nodes[0][0].enemies = [id];
      s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
    }
    writeSave(s);
    setKey((k) => k + 1);
  }
  return (
    <>
      <aside style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <b>仅测试夹具</b>
        {[
          'map',
          'shelter',
          'laboratory',
          'research',
          'machinedramon',
          'skullgreymon',
          'gekomon',
        ].map((id) => (
          <button key={id} onClick={() => open(id)}>
            {id}
          </button>
        ))}
      </aside>
      {key > 0 && <App key={key} />}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
