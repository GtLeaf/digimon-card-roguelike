import { Activity, ArrowRight, Heart, Shield, Sparkles } from 'lucide-react';
import { BLESSINGS } from '../game/data';
import type { Action, Run } from '../game/types';

export function BlessingScreen({ run, send }: { run: Run; send: (action: Action) => void }) {
  return (
    <div className="choice-screen">
      <Sparkles className="large-icon" />
      <span className="eyebrow">A LITTLE LIGHT FOR THE JOURNEY</span>
      <h1>{run.currentNode ? '新的力量，新的旅途。' : '带上一份祝福。'}</h1>
      <p>{run.currentNode ? '选择新祝福，替换当前祝福。' : '选择一种祝福，陪伴这次冒险。'}</p>
      <div className="option-list">
        {Object.entries(BLESSINGS).map(([id, d]) => (
          <button key={id} className="option" onClick={() => send({ type: 'bless', id })}>
            <span className="option-icon">
              {id === 'bond' ? <Activity /> : id === 'guard' ? <Shield /> : <Heart />}
            </span>
            <span>
              <strong>{d.name}</strong>
              <small>{d.text}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
