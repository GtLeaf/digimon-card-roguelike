import type { Action, Meta, Run } from '../game/types';
import { EvolutionTree } from '../components/EvolutionTree';

export function EvolutionScreen({
  run,
  meta,
  send,
  onDeck,
}: {
  run: Run;
  meta: Meta;
  send: (action: Action) => void;
  onDeck: () => void;
}) {
  const r = run;
  return (
    <div className="new-evolution-screen">
      <div className="screen-heading">
        <span className="eyebrow">DIGIVOLUTION / YOUR CHOICE</span>
        <h1>你们，可以成为谁？</h1>
        <p>
          {r.evolutionReturn === 'camp'
            ? '补进化会消耗本次营地行动；返回不会消耗。'
            : '选择满足条件的下一阶段形态，也可以暂缓，在营地完成。'}
        </p>
      </div>
      <EvolutionTree
        key={`${r.form}-${r.evolutionReturn}`}
        run={r}
        meta={meta}
        choose
        onAction={send}
        onDeck={onDeck}
      />
    </div>
  );
}
