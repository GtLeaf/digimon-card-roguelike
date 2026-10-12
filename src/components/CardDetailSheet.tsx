import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import { FORM_NAMES, cardDefinition } from '../game/data';
import { skillDescription } from '../game/cardSkills';
import { GROUP_NAMES, STAGE_NAMES, TAG_INFO, buildCardIndex, synergyFor } from '../game/cardIndex';
import type { CardTag, SearchContext } from '../game/cardIndex';
import { GameCard } from './GameCard';
import { CardEffectPreview, JourneyPanel } from './JourneyPanel';

/** 卡片详情：强化对比、来源、获取方式、机制标签与搭配参考；可在当前结果中左右切换。 */
export function CardDetailSheet({
  id,
  list,
  upgradedView,
  ctx,
  hasRun,
  onNavigate,
  onClose,
  onTag,
  onOpenTree,
}: {
  id: string;
  list: string[];
  upgradedView: boolean;
  ctx: SearchContext;
  hasRun: boolean;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onTag: (tag: CardTag) => void;
  onOpenTree?: (form: string) => void;
}) {
  const entry = buildCardIndex().find((e) => e.id === id)!;
  const def = cardDefinition({ id, upgraded: false });
  const v = upgradedView ? entry.upgraded : entry.base;
  const collected = ctx.collected(def);
  const at = list.indexOf(id),
    prev = at > 0 ? list[at - 1] : null,
    next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;
  const touch = useRef<number | null>(null);
  const navRef = useRef({ prev, next, onNavigate });
  navRef.current = { prev, next, onNavigate };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const { prev: p, next: n, onNavigate: go } = navRef.current;
      if (e.key === 'ArrowLeft' && p) go(p);
      if (e.key === 'ArrowRight' && n) go(n);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  // 未收录卡只给出搭档与阶段，不揭示具体所属形态。
  const source =
    entry.group === 'common'
      ? '通用卡 · 所有形态均可使用'
      : collected
        ? `${GROUP_NAMES[entry.group]} · ${entry.forms.map((f) => FORM_NAMES[f]).join('／')} · ${STAGE_NAMES[entry.stage]}`
        : `${GROUP_NAMES[entry.group]} · ${STAGE_NAMES[entry.stage]} · 到达对应形态后收录`;
  const obtain = collected
    ? skillDescription(def)
    : '到达对应形态后进入本局奖励和商店卡池；所需形态可在进化路线中探索。';
  const own = ctx.deck?.get(id);
  const synergy = synergyFor(id, upgradedView);
  const treeForm = collected && entry.forms.length && onOpenTree ? entry.forms[0] : null;

  return (
    <JourneyPanel
      title={`${def.name}${upgradedView ? '＋' : ''}`}
      onClose={onClose}
      footer={
        <div className="codex-detail-nav">
          <button
            type="button"
            className="secondary"
            disabled={!prev}
            aria-label="上一张"
            onClick={() => prev && onNavigate(prev)}
          >
            <ChevronLeft size={18} />
          </button>
          {treeForm ? (
            <button type="button" className="primary" onClick={() => onOpenTree!(treeForm)}>
              <GitBranch size={16} />
              在进化路线中查看
            </button>
          ) : (
            <span className="codex-detail-pos">{at >= 0 ? `${at + 1} / ${list.length}` : ''}</span>
          )}
          <button
            type="button"
            className="secondary"
            disabled={!next}
            aria-label="下一张"
            onClick={() => next && onNavigate(next)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      }
    >
      <div
        className={`codex-detail ${collected ? '' : 'locked'}`}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (dx > 60 && prev) onNavigate(prev);
          if (dx < -60 && next) onNavigate(next);
        }}
      >
        <div className="codex-detail-top">
          <div className="codex-detail-card codex-card-slot">
            <GameCard card={{ uid: `codex-detail-${id}`, id, upgraded: upgradedView }} />
            {!collected && <span className="codex-slot-tag">未收录</span>}
          </div>
          <CardEffectPreview card={{ uid: `codex-effect-${id}`, id, upgraded: false }} upgrade />
        </div>
        <dl className="codex-detail-facts">
          <dt>来源</dt>
          <dd>{source}</dd>
          <dt>获取方式</dt>
          <dd>{obtain}</dd>
          {hasRun && (
            <>
              <dt>本局</dt>
              <dd>
                {own
                  ? `卡组持有 ${own.count} 张${own.upgraded ? `（强化 ${own.upgraded} 张）` : ''}`
                  : '卡组中没有'}
                {' · '}
                {ctx.pool?.has(id) ? '可在奖励与商店获得' : '本局奖励与商店暂不出现'}
              </dd>
            </>
          )}
        </dl>
        <h3 className="codex-detail-heading">机制标签</h3>
        <div className="codex-chip-row">
          {v.tags.map((t) => (
            <button
              type="button"
              key={t}
              className="codex-chip"
              aria-label={`查看全部「${TAG_INFO[t].label}」卡`}
              onClick={() => onTag(t)}
            >
              {TAG_INFO[t].label}
            </button>
          ))}
        </div>
        {synergy.length > 0 && (
          <>
            <h3 className="codex-detail-heading">搭配参考</h3>
            <div className="codex-synergy">
              {synergy.map(({ entry: s, tag }) => {
                const sd = cardDefinition({ id: s.id, upgraded: upgradedView });
                const sc = ctx.collected(s.base.def);
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={sc ? '' : 'locked'}
                    onClick={() => onNavigate(s.id)}
                  >
                    <b>{sd.name}</b>
                    <small>
                      {TAG_INFO[tag].label} · {sd.cost} 费{sc ? '' : ' · 未收录'}
                    </small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </JourneyPanel>
  );
}
