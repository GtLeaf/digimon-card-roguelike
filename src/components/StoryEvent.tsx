import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Radio } from 'lucide-react';
import { CARDS } from '../game/data';
import { ROUTE_DATA } from '../game/evolution';
import { eligibleEventCards, eventChoiceBlock, eventFor } from '../game/events';
import type { Action, Meta, Run } from '../game/types';

export function StoryEventView({
  run,
  meta,
  onAction,
}: {
  run: Run;
  meta: Meta;
  onAction: (action: Action) => void;
}) {
  const [pending, setPending] = useState<'risk' | 'safe' | null>(null),
    [uid, setUid] = useState('');
  const event = eventFor(run)!;
  const choice = event.choices.find((c) => c.id === pending),
    cards = choice ? eligibleEventCards(run, choice) : [];
  return (
    <div className="choice-screen event-screen">
      <Radio className="large-icon" />
      <span className="eyebrow">AN UNEXPECTED SIGNAL</span>
      <h1>{event.title}</h1>
      <p className="story-text">{event.story}</p>
      <p className="event-context">
        生命 {run.hp}/{run.maxHp} · 金币 {run.gold} · 卡组 {run.deck.length} 张
      </p>
      {choice ? (
        <div className="event-card-choice">
          <h3>{choice.title}</h3>
          <p>{choice.text}</p>
          <label>
            选择{choice.effect.card === 'remove' ? '移除' : '强化'}的卡片
            <select aria-label="事件目标卡片" value={uid} onChange={(e) => setUid(e.target.value)}>
              <option value="">请选择一张牌</option>
              {cards.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {CARDS[c.id].name}
                  {c.upgraded ? '＋' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!cards.some((c) => c.uid === uid) || !!eventChoiceBlock(run, choice)}
            onClick={() => onAction({ type: 'event', choice: choice.id, uid })}
          >
            确认{choice.effect.card === 'remove' ? '移除' : '强化'}
            <ArrowRight size={16} />
          </button>
          <button
            className="text-btn"
            onClick={() => {
              setPending(null);
              setUid('');
            }}
          >
            <ArrowLeft size={14} />
            返回选择 · 尚未扣费
          </button>
        </div>
      ) : (
        <div className="option-list">
          {event.choices.map((option) => {
            const blocked = eventChoiceBlock(run, option);
            return (
              <button
                className="option"
                key={option.id}
                disabled={!!blocked}
                onClick={() =>
                  option.effect.card
                    ? setPending(option.id)
                    : onAction({ type: 'event', choice: option.id })
                }
              >
                <Radio size={20} />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.text}</small>
                  {blocked && <small>{blocked}</small>}
                  {option.effect.routes?.map((id) => (
                    <small key={id}>
                      {meta.unlockedRoutes.includes(id) ? <Check size={12} /> : null}
                      {ROUTE_DATA[id].name} ·{' '}
                      {meta.unlockedRoutes.includes(id) ? '已永久解锁' : '本次可永久解锁'}
                    </small>
                  ))}
                </span>
                <ArrowRight size={18} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
