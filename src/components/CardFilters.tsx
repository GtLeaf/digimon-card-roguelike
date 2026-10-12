import type { ReactNode } from 'react';
import { FORM_NAMES, PARTNER_IDS } from '../game/data';
import {
  GROUP_NAMES,
  KIND_NAMES,
  STAGE_NAMES,
  TAG_GROUPS,
  TAG_INFO,
  formOptions,
} from '../game/cardIndex';
import type { CardQuery, Facets, RunFilter, Stage } from '../game/cardIndex';

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function FilterChip({
  label,
  count,
  pressed,
  onClick,
  ariaLabel,
}: {
  label: ReactNode;
  count?: number;
  pressed: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className={`codex-chip ${!pressed && count === 0 ? 'zero' : ''}`}
      aria-pressed={pressed}
      aria-label={count === undefined ? ariaLabel : `${ariaLabel}，${count} 张`}
      onClick={onClick}
    >
      {label}
      {count !== undefined && <span aria-hidden="true">{count}</span>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="codex-filter-section">
      <legend>{title}</legend>
      <div className="codex-chip-row">{children}</div>
    </fieldset>
  );
}

/** 筛选条件：手机版放在底部面板，宽屏常驻在结果左侧。 */
export function CardFilters({
  query,
  facets,
  onChange,
  hasRun,
  showGroup = false,
}: {
  query: CardQuery;
  facets: Facets;
  onChange: (q: CardQuery) => void;
  hasRun: boolean;
  showGroup?: boolean;
}) {
  const set = (patch: Partial<CardQuery>) => onChange({ ...query, ...patch });
  const forms = formOptions(query.group);
  return (
    <div className="codex-filters">
      {hasRun && (
        <Section title="本局">
          {(['deck', 'pool'] as RunFilter[]).map((r) => {
            const label = r === 'deck' ? '卡组中' : '本局可获取';
            return (
              <FilterChip
                key={r}
                label={label}
                ariaLabel={label}
                count={facets.run[r]}
                pressed={query.run.includes(r)}
                onClick={() => set({ run: toggle(query.run, r) })}
              />
            );
          })}
        </Section>
      )}
      {showGroup && (
        <Section title="搭档">
          {(['all', ...PARTNER_IDS, 'common'] as const).map((g) => {
            const label = g === 'all' ? '全部' : GROUP_NAMES[g];
            return (
              <FilterChip
                key={g}
                label={label}
                ariaLabel={label}
                count={facets.group[g]}
                pressed={query.group === g}
                onClick={() => set({ group: g, forms: [] })}
              />
            );
          })}
        </Section>
      )}
      <Section title="来源形态">
        {forms.length ? (
          forms.map((f) => (
            <FilterChip
              key={f}
              label={FORM_NAMES[f]}
              ariaLabel={FORM_NAMES[f]}
              count={facets.forms[f]}
              pressed={query.forms.includes(f)}
              onClick={() => set({ forms: toggle(query.forms, f) })}
            />
          ))
        ) : (
          <p className="codex-filter-hint">
            {query.group === 'common' ? '通用卡不区分形态。' : '先选择搭档，可按形态细分。'}
          </p>
        )}
      </Section>
      <Section title="成长阶段">
        {([-1, 0, 1, 2, 3] as Stage[]).map((s) => (
          <FilterChip
            key={s}
            label={STAGE_NAMES[s]}
            ariaLabel={STAGE_NAMES[s]}
            count={facets.stages[s]}
            pressed={query.stages.includes(s)}
            onClick={() => set({ stages: toggle(query.stages, s) })}
          />
        ))}
      </Section>
      <Section title="类型">
        {(Object.keys(KIND_NAMES) as (keyof typeof KIND_NAMES)[]).map((k) => (
          <FilterChip
            key={k}
            label={KIND_NAMES[k]}
            ariaLabel={KIND_NAMES[k]}
            count={facets.kinds[k]}
            pressed={query.kinds.includes(k)}
            onClick={() => set({ kinds: toggle(query.kinds, k) })}
          />
        ))}
      </Section>
      <Section title={query.upgradedView ? '费用（强化后）' : '费用'}>
        {[0, 1, 2].map((c) => (
          <FilterChip
            key={c}
            label={`${c} 费`}
            ariaLabel={`${c} 费`}
            count={facets.costs[c]}
            pressed={query.costs.includes(c)}
            onClick={() => set({ costs: toggle(query.costs, c) })}
          />
        ))}
      </Section>
      <fieldset className="codex-filter-section">
        <legend>资源机制</legend>
        <div className="codex-tag-grid">
          {TAG_GROUPS.filter((g) => g.id !== 'effect').map((g) => (
            <div className="codex-tag-pair" key={g.id}>
              <b>{g.name}</b>
              {g.tags.map((t) => (
                <FilterChip
                  key={t}
                  label={TAG_INFO[t].short}
                  ariaLabel={TAG_INFO[t].label}
                  count={facets.tags[t]}
                  pressed={query.tags.includes(t)}
                  onClick={() => set({ tags: toggle(query.tags, t) })}
                />
              ))}
            </div>
          ))}
        </div>
      </fieldset>
      <Section title="效果">
        {TAG_GROUPS.find((g) => g.id === 'effect')!.tags.map((t) => (
          <FilterChip
            key={t}
            label={TAG_INFO[t].label}
            ariaLabel={TAG_INFO[t].label}
            count={facets.tags[t]}
            pressed={query.tags.includes(t)}
            onClick={() => set({ tags: toggle(query.tags, t) })}
          />
        ))}
      </Section>
      <Section title="收录">
        {(['all', 'lit', 'locked'] as const).map((c) => {
          const label = { all: '全部', lit: '已收录', locked: '未收录' }[c];
          return (
            <FilterChip
              key={c}
              label={label}
              ariaLabel={label}
              count={facets.collection[c]}
              pressed={query.collection === c}
              onClick={() => set({ collection: c })}
            />
          );
        })}
      </Section>
    </div>
  );
}
