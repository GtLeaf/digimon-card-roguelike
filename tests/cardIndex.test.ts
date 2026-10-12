import { describe, expect, it } from 'vitest';
import {
  ALL_TAGS,
  DEFAULT_QUERY,
  FIELD_TAGS,
  UNTAGGED_FIELDS,
  activeFilters,
  buildCardIndex,
  cardTags,
  clearFilters,
  effectiveSort,
  formOptions,
  isCardCollected,
  normalize,
  removeFilter,
  searchCards,
  synergyFor,
} from '../src/game/cardIndex';
import type { CardQuery, SearchContext } from '../src/game/cardIndex';
import { CARDS, cardDefinition } from '../src/game/data';
import type { Meta } from '../src/game/types';

const meta = (discovered: string[] = [], scans: Record<string, number> = {}): Meta => ({
  unlockedRoutes: [],
  scans,
  partners: [],
  games: 0,
  wins: 0,
  discovered,
});
// 默认全部收录，方便只检验检索规则。
const all: SearchContext = { collected: () => true };
const q = (patch: Partial<CardQuery>): CardQuery => ({ ...DEFAULT_QUERY, ...patch });
const ids = (query: Partial<CardQuery>, ctx = all) =>
  searchCards(q(query), ctx).results.map((r) => r.entry.id);
const tagsOf = (id: string, upgraded = false) => cardTags(cardDefinition({ id, upgraded }));

describe('机制标签', () => {
  it('每张非故障牌至少一个标签，故障牌不进入索引', () => {
    const index = buildCardIndex();
    expect(index.length).toBe(Object.values(CARDS).filter((d) => d.family !== 'status').length);
    expect(index.some((e) => e.id === 'fault')).toBe(false);
    for (const e of index) {
      expect(e.base.tags.length, e.id).toBeGreaterThan(0);
      expect(e.upgraded.tags.length, e.id).toBeGreaterThan(0);
    }
  });

  it('字段守卫：卡牌实际使用的字段全部已归类', () => {
    const known = new Set<string>([
      ...UNTAGGED_FIELDS,
      ...Object.keys(FIELD_TAGS),
      'hits',
      'special',
    ]);
    const used = new Set<string>();
    for (const d of Object.values(CARDS)) {
      Object.keys(d).forEach((k) => used.add(k));
      Object.keys(d.upgrade ?? {}).forEach((k) => used.add(k));
    }
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
  });

  it('抽样：圣炎之盾、死亡加农炮、余烬护甲', () => {
    expect(tagsOf('aegis')).toEqual(['burnUse', 'shieldGain', 'draw']);
    expect(tagsOf('deathCannon')).toEqual(['devourSpend', 'damage', 'exhaust']);
    expect(tagsOf('flare')).toEqual(['burnApply', 'shieldGain', 'aoe']);
  });

  it('按显示版本推导：能量装填基础版不抽牌，强化版抽牌', () => {
    expect(tagsOf('battery')).not.toContain('draw');
    expect(tagsOf('battery', true)).toContain('draw');
  });

  it('标签顺序与 ALL_TAGS 一致', () => {
    for (const e of buildCardIndex())
      expect(e.base.tags).toEqual(ALL_TAGS.filter((t) => e.base.tags.includes(t)));
  });
});

describe('关键词', () => {
  it('归一化：空白、全角数字、乘号', () => {
    expect(normalize('施加 ３ 灼烧')).toBe('施加3灼烧');
    expect(normalize('4×2 段')).toBe('4x2段');
    expect(ids({ text: '3灼烧' })).toEqual(ids({ text: '３灼烧' }));
    expect(ids({ text: '3灼烧' })).toContain('apocalypse');
    // 空格分词：「3 灼烧」是两个词，同时命中即可，范围更宽。
    expect(ids({ text: '3 灼烧' }).length).toBeGreaterThan(ids({ text: '3灼烧' }).length);
    expect(ids({ text: '4x2' })).toEqual(ids({ text: '4×2' }));
    expect(ids({ text: '4x2' })).toContain('doublecut');
  });

  it('同义词：群攻与「群体」标签结果一致', () => {
    expect(ids({ text: '群攻' }).sort()).toEqual(ids({ tags: ['aoe'] }).sort());
    expect(ids({ text: 'AOE' }).sort()).toEqual(ids({ tags: ['aoe'] }).sort());
  });

  it('多词 AND：灼烧 护盾', () => {
    const found = ids({ text: '灼烧 护盾' });
    expect(found).toEqual(expect.arrayContaining(['flare', 'aegis']));
    for (const id of found) {
      const tags = tagsOf(id),
        text =
          cardDefinition({ id, upgraded: false }).text +
          cardDefinition({ id, upgraded: true }).text;
      expect(tags.some((t) => t.startsWith('burn')) || text.includes('灼烧'), id).toBe(true);
      expect(tags.some((t) => t.startsWith('shield')) || text.includes('护盾'), id).toBe(true);
    }
  });

  it('命中位置：强化后文本单独标注', () => {
    const r = searchCards(q({ text: '抽1张' }), all).results.find((x) => x.entry.id === 'battery');
    expect(r?.matchedIn).toContain('other');
    expect(r?.matchedIn).not.toContain('effect');
  });

  it('形态名可检索；未收录卡不按形态名命中', () => {
    expect(ids({ text: '红莲骑士兽' })).toEqual(expect.arrayContaining(['aegis', 'royal']));
    const locked = { collected: (d: { unlockForm?: string }) => d.unlockForm !== 'dukemon' };
    expect(ids({ text: '红莲骑士兽' }, locked)).not.toContain('aegis');
    // 卡名与效果仍然可以搜到未收录卡。
    expect(ids({ text: '圣炎之盾' }, locked)).toEqual(['aegis']);
  });

  it('有关键词时默认按相关度，名称命中优先', () => {
    expect(effectiveSort(q({ text: '火球' }))).toBe('relevance');
    expect(effectiveSort(q({ text: '火球', relevance: false, sort: 'name' }))).toBe('name');
    expect(effectiveSort(q({ text: '' }))).toBe('cost');
    expect(ids({ text: '火球' })[0]).toBe('fireball');
    const shield = searchCards(q({ text: '盾' }), all).results;
    const named = shield.filter((r) => r.matchedIn.includes('name')).length;
    expect(named).toBeGreaterThan(0);
    shield.slice(0, named).forEach((r) => expect(r.entry.base.def.name).toContain('盾'));
  });
});

describe('分类筛选', () => {
  it('同维度为或、跨维度为且', () => {
    const r = searchCards(q({ costs: [0, 2], kinds: ['skill'] }), all).results;
    expect(r.length).toBeGreaterThan(0);
    for (const { entry } of r) {
      expect([0, 2]).toContain(entry.base.def.cost);
      expect(entry.base.def.kind).toBe('skill');
    }
  });

  it('多个机制标签为且', () => {
    expect(ids({ tags: ['burnApply', 'shieldGain'] })).toEqual(['flare']);
    expect(ids({ tags: ['markSpend', 'aoe'] })).toEqual(['sealBurst']);
  });

  it('强化版视图按强化后费用筛选', () => {
    expect(ids({ costs: [0], upgradedView: true })).toEqual(
      expect.arrayContaining(['ritual', 'apocalypse']),
    );
    expect(ids({ costs: [0] })).not.toContain('ritual');
  });

  it('形态归属：斗牛士兽不含觉醒形态；黑古拉兽含共享的烈焰引爆', () => {
    const matador = ids({ group: 'impmon', forms: ['matadormon'] });
    expect(matador).toEqual(
      expect.arrayContaining(['soulHarvest', 'lureDance', 'thousandCuts', 'grandFinale']),
    );
    expect(matador).not.toContain('flamencoSlash');
    expect(ids({ group: 'guilmon', forms: ['blackgrowmon'] })).toContain('ignite');
    expect(formOptions('guilmon')[0]).toBe('guilmon');
    expect(formOptions('all')).toEqual([]);
  });

  it('小妖兽分支牌按形态归入小妖兽', () => {
    const impmon = ids({ group: 'impmon' });
    expect(impmon).toContain('deathCannon');
    expect(impmon.length).toBe(33);
    expect(ids({ group: 'common' }).length).toBe(13);
  });

  it('阶段：通用、成长期到究极体', () => {
    expect(ids({ stages: [-1] }).length).toBe(13);
    expect(ids({ stages: [3] })).toContain('flamencoSlash');
  });

  it('本局：卡组中与本局可获取', () => {
    const ctx: SearchContext = {
      ...all,
      deck: new Map([['fireball', { count: 2, upgraded: 1 }]]),
      pool: new Set(['rock', 'guard']),
    };
    expect(ids({ run: ['deck'] }, ctx)).toEqual(['fireball']);
    expect(ids({ run: ['deck', 'pool'] }, ctx).sort()).toEqual(['fireball', 'guard', 'rock']);
  });
});

describe('收录与防剧透', () => {
  it('收录口径与原图鉴一致', () => {
    const m = meta(['growlmon']);
    const c = (id: string) => isCardCollected(m, CARDS[id]);
    expect(c('strike')).toBe(true);
    expect(c('fireball')).toBe(true);
    expect(c('doublecut')).toBe(true);
    expect(c('aegis')).toBe(false);
    expect(c('nightfire')).toBe(false);
    expect(isCardCollected(meta([], { beelzebumon: 100 }), CARDS.nightfire)).toBe(true);
    // 共享技能：到达任一所属形态即收录。
    expect(isCardCollected(meta(['blackgrowmon']), CARDS.ignite)).toBe(true);
  });

  it('未收录卡留在结果中并标记；收录筛选一致', () => {
    const m = meta();
    const ctx: SearchContext = { collected: (d) => isCardCollected(m, d) };
    const r = searchCards(q({ text: '圣炎之盾' }), ctx).results;
    expect(r).toHaveLength(1);
    expect(r[0].collected).toBe(false);
    const lit = ids({ collection: 'lit' }, ctx),
      locked = ids({ collection: 'locked' }, ctx);
    expect(lit.length + locked.length).toBe(buildCardIndex().length);
    for (const id of lit) expect(isCardCollected(m, CARDS[id])).toBe(true);
  });

  it('未收录卡不参与形态筛选', () => {
    const m = meta();
    const ctx: SearchContext = { collected: (d) => isCardCollected(m, d) };
    expect(ids({ group: 'guilmon', forms: ['dukemon'] }, ctx)).toEqual([]);
    expect(searchCards(q({ group: 'guilmon' }), ctx).facets.forms.dukemon).toBe(0);
  });
});

describe('分面、条件与建议', () => {
  it('分面计数等于实际选中后的结果数', () => {
    const base = q({ group: 'guilmon', kinds: ['attack'] });
    const { facets } = searchCards(base, all);
    expect(facets.costs['2']).toBe(searchCards({ ...base, costs: [2] }, all).results.length);
    expect(facets.tags.burnApply).toBe(
      searchCards({ ...base, tags: ['burnApply'] }, all).results.length,
    );
    expect(facets.kinds.skill).toBe(searchCards({ ...base, kinds: ['skill'] }, all).results.length);
    expect(facets.group.renamon).toBe(
      searchCards({ ...base, group: 'renamon' }, all).results.length,
    );
  });

  it('已选条件可逐个移除；清除全部保留强化版与排序', () => {
    const query = q({
      text: '灼烧',
      group: 'guilmon',
      forms: ['growlmon'],
      costs: [1],
      upgradedView: true,
      sort: 'name',
    });
    const filters = activeFilters(query);
    expect(filters.map((f) => f.label)).toEqual(['“灼烧”', '基尔兽', '古拉兽', '1 费']);
    expect(removeFilter(query, filters[1])).toMatchObject({ group: 'all', forms: [] });
    expect(removeFilter(query, filters[3]).costs).toEqual([]);
    expect(clearFilters(query)).toEqual({ ...DEFAULT_QUERY, upgradedView: true, sort: 'name' });
  });

  it('空结果给出按结果数降序的放宽建议', () => {
    const query = q({ group: 'renamon', tags: ['chargeGain'], costs: [2] });
    const { results, relaxHints } = searchCards(query, all);
    expect(results).toEqual([]);
    expect(relaxHints.length).toBeGreaterThan(0);
    expect(relaxHints[0].count).toBeGreaterThanOrEqual(relaxHints.at(-1)!.count);
    // 去掉「蓄能·获得」后妖狐兽2费牌最多。
    expect(relaxHints[0].filter.dim).toBe('tags');
  });
});

describe('搭配参考', () => {
  it('热浪 → 同搭档的灼烧利用牌', () => {
    expect(synergyFor('heatwave').map((s) => s.entry.id)).toEqual([
      'ignite',
      'doublecut',
      'burnAmplify',
      'aegis',
      'judgment',
    ]);
  });

  it('包含通用牌：蓄能指令 ↔ 脉冲炮', () => {
    expect(synergyFor('charge').map((s) => s.entry.id)).toContain('cannon');
    expect(synergyFor('cannon').map((s) => s.entry.id)).toContain('charge');
  });

  it('最多6张且不含自身', () => {
    for (const e of buildCardIndex()) {
      const s = synergyFor(e.id);
      expect(s.length).toBeLessThanOrEqual(6);
      expect(s.some((x) => x.entry.id === e.id)).toBe(false);
    }
  });
});
