import { useState } from 'react';
import { Layers } from 'lucide-react';
import { BLESSINGS, CARDS, RELICS } from '../game/data';
import { cardCost } from '../game/engine';
import type { Card, CardKind, Run } from '../game/types';
import { GameCard } from './GameCard';
export type Pile = 'deck' | 'hand' | 'draw' | 'discard' | 'exhaust';
const names: Record<Pile, string> = {
  deck: '永久卡组',
  hand: '手牌',
  draw: '抽牌堆',
  discard: '弃牌堆',
  exhaust: '耗竭区',
};
export function DeckViewer({ run, initialPile = 'deck' }: { run: Run; initialPile?: Pile }) {
  const [pile, setPile] = useState<Pile>(initialPile),
    [kind, setKind] = useState<CardKind | 'all'>('all'),
    [sort, setSort] = useState('cost');
  const activePile = run.screen === 'battle' ? pile : 'deck',
    cards = activePile === 'deck' ? run.deck : (run.battle?.[activePile] ?? []);
  const groups = new Map<string, { card: Card; count: number }>();
  for (const c of cards) {
    if (kind !== 'all' && CARDS[c.id].kind !== kind) continue;
    const key = `${c.id}-${c.upgraded}-${!!c.temporary}-${!!c.copied}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { card: c, count: 1 });
  }
  const sorted = [...groups.values()].sort((a, b) =>
    sort === 'name'
      ? CARDS[a.card.id].name.localeCompare(CARDS[b.card.id].name, 'zh')
      : cardCost(a.card) - cardCost(b.card) ||
        CARDS[a.card.id].name.localeCompare(CARDS[b.card.id].name, 'zh'),
  );
  const curve = [0, 1, 2, 3].map(
    (cost) => cards.filter((c) => (cost === 3 ? cardCost(c) >= 3 : cardCost(c) === cost)).length,
  );
  return (
    <div className="deck-viewer">
      <div className="pile-tabs" role="tablist" aria-label="选择牌堆">
        {(run.screen === 'battle' ? Object.keys(names) : ['deck']).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={activePile === id}
            onClick={() => {
              setPile(id as Pile);
            }}
          >
            {names[id as Pile]}{' '}
            <b>
              {id === 'deck'
                ? run.deck.length
                : (run.battle?.[id as Exclude<Pile, 'deck'>].length ?? 0)}
            </b>
          </button>
        ))}
      </div>
      <p className="modal-note">
        {activePile === 'draw'
          ? '按费用／名称展示，不透露真实抽取顺序。'
          : '同名、同强化、同临时状态的卡牌合并展示。'}
      </p>
      <div className="deck-summary">
        <span>
          <Layers size={16} />
          {cards.length} 张
        </span>
        <div className="cost-curve" aria-label="费用分布">
          {curve.map((count, i) => (
            <span key={i}>
              <i style={{ height: Math.max(3, Math.min(28, count * 4)) }} />
              <small>
                {i === 3 ? '3+' : i}费 · {count}
              </small>
            </span>
          ))}
        </div>
      </div>
      <div className="deck-filters">
        <div aria-label="卡牌类型筛选">
          {(['all', 'attack', 'skill', 'power', 'status'] as const).map((k) => (
            <button aria-pressed={kind === k} key={k} onClick={() => setKind(k)}>
              {{ all: '全部', attack: '攻击', skill: '技能', power: '强化', status: '故障' }[k]}
            </button>
          ))}
        </div>
        <select aria-label="卡牌排序" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="cost">费用从低到高</option>
          <option value="name">名称排序</option>
        </select>
      </div>
      <div className="deck-grid">
        {sorted.map(({ card, count }) => (
          <div
            className="deck-entry"
            key={`${card.id}-${card.upgraded}-${card.temporary}-${card.copied}`}
          >
            <GameCard run={run} card={card} compact />
            <span className="card-quantity">
              ×{count}
              {card.temporary ? ' · 临时' : ''}
              {card.copied ? ' · 复制' : ''}
            </span>
          </div>
        ))}
      </div>
      {!sorted.length && <p className="empty-pile">这里暂时没有符合条件的卡牌。</p>}
      <div className="deck-relics">
        <h3>装置与祝福</h3>
        <p>
          {BLESSINGS[run.blessing]?.name ?? '暂无祝福'} · {BLESSINGS[run.blessing]?.text}
        </p>
        {run.relics.map((id) => (
          <p key={id}>
            {RELICS[id].name} · {RELICS[id].text}
          </p>
        ))}
      </div>
    </div>
  );
}
