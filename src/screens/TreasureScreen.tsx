import { ArrowRight, Box } from 'lucide-react';
import { RELICS } from '../game/data';
import type { Action, Run } from '../game/types';

export function TreasureScreen({ run, send }: { run: Run; send: (action: Action) => void }) {
  const r = run;
  return (
    <div className="choice-screen">
      <Box className="large-icon" />
      <span className="eyebrow">A GIFT FROM THE DIGITAL WORLD</span>
      <h1>被遗忘的数据。</h1>
      <p>{r.message}</p>
      <div className="treasure-art">
        <Box size={88} />
      </div>
      {r.relics.length > 0 && <p>{RELICS[r.relics[r.relics.length - 1]]?.text}</p>}
      <button className="primary" onClick={() => send({ type: 'continue' })}>
        收好，继续前进
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
