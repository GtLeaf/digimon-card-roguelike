import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cardDefinition } from '../game/data';
import type { Card, CardKind, Run } from '../game/types';
import { GameCard } from './GameCard';
import { CardEffectPreview, JourneyPanel } from './JourneyPanel';

// 每次只编辑一个固定槽位，另一槽位的旧牌不可重复使用。
export function EvolutionReplacementPanel({
  run,
  index,
  incoming,
  autoUpgrade,
  currentUid,
  occupiedUid,
  onConfirm,
  onClose,
}: {
  run: Run;
  index: number;
  incoming: Card;
  autoUpgrade: boolean;
  currentUid: string | null;
  occupiedUid: string | null;
  onConfirm: (uid: string) => void;
  onClose: () => void;
}) {
  const [uid, setUid] = useState(currentUid ?? ''),
    [kind, setKind] = useState<CardKind | 'all'>('all');
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (uid && window.matchMedia('(max-width: 700px)').matches)
      preview.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [uid]);
  const selected = run.deck.find((card) => card.uid === uid),
    name = cardDefinition(incoming).name;
  const result = { ...incoming, upgraded: autoUpgrade };
  const visible = run.deck.filter((card) => kind === 'all' || cardDefinition(card).kind === kind);
  return (
    <JourneyPanel
      title={`槽位 ${index + 1} · 替换为${name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <p className="journey-action-note" aria-live="polite">
            {selected
              ? `${cardDefinition(selected).name}${selected.upgraded ? '＋' : ''} → ${name}${result.upgraded ? '＋' : ''} · 卡组仍为 ${run.deck.length} 张`
              : '选择要替换的旧牌，查看新旧效果'}{' '}
          </p>
          <div>
            <button className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="primary"
              disabled={!selected || uid === occupiedUid}
              onClick={() => {
                if (selected && uid !== occupiedUid) onConfirm(uid);
              }}
            >
              确认此槽位
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      }
    >
      <p className="journey-hint">
        仅修改槽位 {index + 1}。另一槽位已使用的旧牌不可重复选择；确认后仍可再次更换。
      </p>
      <div className="journey-filters" aria-label="卡牌类型筛选">
        {(['all', 'attack', 'skill', 'power', 'status'] as const).map((value) => (
          <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
            {{ all: '全部', attack: '攻击', skill: '技能', power: '强化', status: '故障' }[value]}
          </button>
        ))}
      </div>
      <div className="journey-picker evolution-picker">
        <div className="deck-grid">
          {visible.map((card) => (
            <div className="evolution-deck-copy" key={card.uid}>
              <GameCard
                run={run}
                compact
                card={card}
                disabled={card.uid === occupiedUid}
                selected={uid === card.uid}
                onClick={() => setUid(card.uid)}
              />
              <small>{`牌组第 ${run.deck.indexOf(card) + 1} 张 · ${card.uid === occupiedUid ? '另一槽位已选' : card.upgraded ? '已强化' : '未强化'}`}</small>
            </div>
          ))}
        </div>
        <aside className="journey-selection" ref={preview} aria-live="polite">
          {selected ? (
            <>
              <span className="evolution-effect-label">被替换的旧牌</span>
              <CardEffectPreview card={selected} />
              <span className="evolution-effect-label">进化后获得的新技能</span>
              <CardEffectPreview card={result} />
              <p className="journey-hint">新技能均为未强化版；旧牌的强化随替换消耗。</p>
            </>
          ) : (
            <p>点选旧牌，查看新旧完整效果。</p>
          )}
        </aside>
      </div>
      {!visible.length && <p className="journey-hint">没有符合条件的卡牌，请切换筛选。</p>}
    </JourneyPanel>
  );
}
