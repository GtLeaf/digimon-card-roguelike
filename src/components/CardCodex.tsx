import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PARTNER_IDS } from '../game/data';
import { cardPool } from '../game/cardSkills';
import {
  GROUP_NAMES,
  MATCH_LABELS,
  clearFilters,
  effectiveSort,
  isCardCollected,
  removeFilter,
  searchCards,
  tokenize,
} from '../game/cardIndex';
import type { CardQuery, CardSort, CardTag, MatchField, SearchContext } from '../game/cardIndex';
import type { Meta, Run } from '../game/types';
import { GameCard } from './GameCard';
import { JourneyPanel } from './JourneyPanel';
import { CardFilters } from './CardFilters';
import { CardDetailSheet } from './CardDetailSheet';
import { setCodexQuery, useCodexState } from './cardCodexStore';
import './CardCodex.css';

const SORTS: { id: CardSort; name: string }[] = [
  { id: 'relevance', name: '按相关度' },
  { id: 'cost', name: '按费用' },
  { id: 'stage', name: '按阶段' },
  { id: 'source', name: '按来源' },
  { id: 'name', name: '按名称' },
];

function matchLabel(field: MatchField, upgradedView: boolean) {
  return field === 'other' ? (upgradedView ? '强化前' : '强化后') : MATCH_LABELS[field];
}

export function CardCodex({
  meta,
  run,
  onOpenTree,
}: {
  meta: Meta;
  run: Run | null;
  onOpenTree?: (form: string) => void;
}) {
  const { query } = useCodexState();
  const text = useDeferredValue(query.text);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<{ id: string; list: string[] } | null>(null);
  // 搜索默认收起为图标；保留了关键词时直接展开，便于看到当前搜索。
  const [searchOpen, setSearchOpen] = useState(() => !!query.text);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // 吸顶：检索栏紧贴弹窗标题下沿，宽屏侧栏再紧贴检索栏；按实际高度计算，适配各断点与字体。
  useLayoutEffect(() => {
    const el = root.current,
      heading = el?.closest('.modal')?.querySelector<HTMLElement>('.modal-heading');
    if (!el || !bar.current) return;
    const measure = () => {
      const offset = heading ? parseFloat(getComputedStyle(heading).top) || 0 : 0;
      const top = heading ? Math.max(0, offset + heading.offsetHeight) : 0;
      el.style.setProperty('--codex-bar-top', `${top}px`);
      el.style.setProperty('--codex-side-top', `${top + (bar.current?.offsetHeight ?? 0) + 4}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar.current);
    if (heading) observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  const ctx = useMemo<SearchContext>(() => {
    const deck = new Map<string, { count: number; upgraded: number }>();
    for (const c of run?.deck ?? []) {
      const d = deck.get(c.id) ?? { count: 0, upgraded: 0 };
      deck.set(c.id, { count: d.count + 1, upgraded: d.upgraded + (c.upgraded ? 1 : 0) });
    }
    return {
      collected: (def) => isCardCollected(meta, def),
      deck: run ? deck : undefined,
      pool: run ? new Set(cardPool(run)) : undefined,
    };
  }, [meta, run]);
  // 没有进行中的冒险时，忽略保留下来的本局条件。
  const effective = useMemo<CardQuery>(
    () => ({ ...query, text, run: run ? query.run : [] }),
    [query, text, run],
  );
  const { results, facets, filters, relaxHints } = useMemo(
    () => searchCards(effective, ctx),
    [effective, ctx],
  );
  const lockedCount = results.filter((r) => !r.collected).length;
  const sort = effectiveSort(query);
  const hasText = tokenize(query.text).length > 0;
  const sheetFilterCount = filters.filter((f) => f.dim !== 'text' && f.dim !== 'group').length;

  function openSearch() {
    // 同步展开后再聚焦，手机端可直接弹出键盘。
    flushSync(() => setSearchOpen(true));
    input.current?.focus();
  }
  function closeSearch() {
    setCodexQuery((q) => ({ ...q, text: '' }));
    setSearchOpen(false);
  }

  // 宽屏键盘：按「/」展开并聚焦搜索框。
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key !== '/' || sheetOpen || detail) return;
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return;
      e.preventDefault();
      openSearch();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [sheetOpen, detail]);

  function showTag(tag: CardTag) {
    setCodexQuery((q) => ({ ...clearFilters(q), tags: [tag] }));
    setDetail(null);
  }

  return (
    <div className="card-codex" ref={root}>
      <div className="card-codex-bar" ref={bar}>
        {searchOpen && (
          <div className="codex-search-row">
            <label className="codex-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={input}
                id="codex-search-input"
                type="search"
                role="searchbox"
                aria-label="搜索卡片"
                placeholder="搜索卡名、效果、形态、机制…"
                value={query.text}
                enterKeyHint="search"
                onChange={(e) => setCodexQuery((q) => ({ ...q, text: e.target.value }))}
                onKeyDown={(e) => {
                  // Escape：有内容先清空，已为空再收起；都不关闭图鉴。
                  if (e.key !== 'Escape') return;
                  e.preventDefault();
                  if (query.text) setCodexQuery((q) => ({ ...q, text: '' }));
                  else setSearchOpen(false);
                }}
              />
              {query.text && (
                <button
                  type="button"
                  className="codex-search-clear"
                  aria-label="清空搜索"
                  onClick={() => {
                    setCodexQuery((q) => ({ ...q, text: '' }));
                    input.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <button type="button" className="codex-search-close" onClick={closeSearch}>
              收起
            </button>
          </div>
        )}
        <div className="codex-group-bar" role="group" aria-label="按搭档筛选">
          {(['all', ...PARTNER_IDS, 'common'] as const).map((g) => (
            <button
              type="button"
              key={g}
              aria-pressed={query.group === g}
              onClick={() => setCodexQuery((q) => ({ ...q, group: g, forms: [] }))}
            >
              {g === 'all' ? '全部' : GROUP_NAMES[g]}
              <span>{facets.group[g]}</span>
            </button>
          ))}
        </div>
        <div className="codex-tools">
          {!searchOpen && (
            <button
              type="button"
              className="codex-search-open"
              aria-label="搜索卡片"
              aria-expanded={false}
              aria-controls="codex-search-input"
              onClick={openSearch}
            >
              <Search size={18} />
            </button>
          )}
          <button
            type="button"
            className="codex-filter-open"
            onClick={() => setSheetOpen(true)}
            aria-label={`筛选${sheetFilterCount ? `，已选 ${sheetFilterCount} 项` : ''}`}
          >
            <SlidersHorizontal size={16} />
            筛选{sheetFilterCount ? ` · ${sheetFilterCount}` : ''}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={query.upgradedView}
            className="codex-switch"
            onClick={() => setCodexQuery((q) => ({ ...q, upgradedView: !q.upgradedView }))}
          >
            <i aria-hidden="true" />
            强化版
          </button>
          <label className="codex-sort">
            <span>排序</span>
            <select
              value={sort}
              onChange={(e) => {
                const v = e.target.value as CardSort;
                setCodexQuery((q) =>
                  v === 'relevance'
                    ? { ...q, relevance: true }
                    : { ...q, sort: v, relevance: false },
                );
              }}
            >
              {SORTS.filter((s) => s.id !== 'relevance' || hasText).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card-codex-body">
        <aside className="card-codex-side" aria-label="卡片筛选">
          <CardFilters
            query={effective}
            facets={facets}
            hasRun={!!run}
            onChange={(q) => setCodexQuery({ ...q, text: query.text })}
          />
        </aside>
        <section className="card-codex-results" aria-label="卡片结果">
          {filters.length > 0 && (
            <div className="codex-active" aria-label="已选条件">
              {filters.map((f) => (
                <button
                  type="button"
                  key={`${f.dim}-${f.value}`}
                  aria-label={`移除条件：${f.label}`}
                  onClick={() => setCodexQuery((q) => removeFilter(q, f))}
                >
                  {f.label}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="codex-clear-all"
                onClick={() => setCodexQuery(clearFilters)}
              >
                清除全部
              </button>
            </div>
          )}
          <p className="item-codex-count" aria-live="polite">
            共 {results.length} 张{lockedCount ? ` · 其中 ${lockedCount} 张未收录` : ''}
            {query.upgradedView ? ' · 显示强化版' : ''}
          </p>
          {results.length ? (
            <div className="codex-cards deck-viewer">
              <div className="deck-grid">
                {results.map(({ entry, collected, matchedIn }) => {
                  const own = ctx.deck?.get(entry.id);
                  return (
                    <div
                      className={`deck-entry codex-card-slot ${collected ? '' : 'locked'}`}
                      key={entry.id}
                    >
                      <GameCard
                        card={{
                          uid: `codex-${entry.id}`,
                          id: entry.id,
                          upgraded: query.upgradedView,
                        }}
                        compact
                        onClick={() =>
                          setDetail({ id: entry.id, list: results.map((r) => r.entry.id) })
                        }
                      />
                      {!collected && <span className="codex-slot-tag">未收录</span>}
                      {(own || matchedIn.length > 0) && (
                        <span className="codex-card-note">
                          {own && <b>卡组 ×{own.count}</b>}
                          {matchedIn.length > 0 && (
                            <span>匹配：{matchLabel(matchedIn[0], query.upgradedView)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="codex-empty">
              <p>没有符合条件的卡。</p>
              {relaxHints.map((h) => (
                <button
                  type="button"
                  key={`${h.filter.dim}-${h.filter.value}`}
                  onClick={() => setCodexQuery((q) => removeFilter(q, h.filter))}
                >
                  去掉「{h.filter.label}」可看到 {h.count} 张
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {sheetOpen && (
        <JourneyPanel
          title="筛选卡片"
          onClose={() => setSheetOpen(false)}
          footer={
            <div>
              <button
                type="button"
                className="secondary"
                onClick={() => setCodexQuery((q) => ({ ...clearFilters(q), text: q.text }))}
              >
                重置
              </button>
              <button type="button" className="primary" onClick={() => setSheetOpen(false)}>
                查看 {results.length} 张结果
              </button>
            </div>
          }
        >
          <CardFilters
            query={effective}
            facets={facets}
            hasRun={!!run}
            showGroup
            onChange={(q) => setCodexQuery({ ...q, text: query.text })}
          />
        </JourneyPanel>
      )}
      {detail && (
        <CardDetailSheet
          id={detail.id}
          list={detail.list}
          upgradedView={query.upgradedView}
          ctx={ctx}
          hasRun={!!run}
          onNavigate={(id) => setDetail((d) => (d ? { ...d, id } : d))}
          onClose={() => setDetail(null)}
          onTag={showTag}
          onOpenTree={onOpenTree}
        />
      )}
    </div>
  );
}
