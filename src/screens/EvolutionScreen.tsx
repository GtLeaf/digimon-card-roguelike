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
        <h1>选择进化</h1>
        <p>
          {r.evolutionReturn === 'camp'
            ? '补进化会消耗本次营地行动；返回不会消耗。'
            : '选择形态，获得新招式。'}
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
