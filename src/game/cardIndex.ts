// 卡片图鉴检索：机制标签、关键词归一化、分类筛选、分面计数与搭配参考。
// 纯逻辑，不依赖 React；标签只由卡牌最终配置推导，不解析卡面文字，保证与结算一致。
import { CARDS, FORM_NAMES, PARTNERS, PARTNER_IDS, cardDefinition } from './data';
import { EVOLUTIONS } from './evolution';
import { skillForms } from './cardSkills';
import type { CardDef, CardKind, Meta, Partner, Special } from './types';

export type CardTag =
  | 'burnApply'
  | 'burnUse'
  | 'markApply'
  | 'markSpend'
  | 'chargeGain'
  | 'chargeUse'
  | 'devourGain'
  | 'devourSpend'
  | 'shieldGain'
  | 'shieldUse'
  | 'selfCost'
  | 'heal'
  | 'damage'
  | 'aoe'
  | 'multiHit'
  | 'draw'
  | 'energy'
  | 'weak'
  | 'vulnerable'
  | 'strength'
  | 'exhaust'
  | 'copy'
  | 'purge'
  | 'conditional';

export type TagGroup = 'burn' | 'mark' | 'charge' | 'devour' | 'shield' | 'life' | 'effect';

export const TAG_GROUPS: { id: TagGroup; name: string; tags: CardTag[] }[] = [
  { id: 'burn', name: '灼烧', tags: ['burnApply', 'burnUse'] },
  { id: 'mark', name: '符印', tags: ['markApply', 'markSpend'] },
  { id: 'charge', name: '蓄能', tags: ['chargeGain', 'chargeUse'] },
  { id: 'devour', name: '噬能', tags: ['devourGain', 'devourSpend'] },
  { id: 'shield', name: '护盾', tags: ['shieldGain', 'shieldUse'] },
  { id: 'life', name: '生命', tags: ['selfCost', 'heal'] },
  {
    id: 'effect',
    name: '效果',
    tags: [
      'damage',
      'aoe',
      'multiHit',
      'draw',
      'energy',
      'weak',
      'vulnerable',
      'strength',
      'exhaust',
      'copy',
      'purge',
      'conditional',
    ],
  },
];

export const TAG_INFO: Record<
  CardTag,
  { label: string; short: string; group: TagGroup; aliases: string[]; pair?: CardTag }
> = {
  burnApply: {
    label: '灼烧·施加',
    short: '施加',
    group: 'burn',
    aliases: ['灼烧', '燃烧', '烧', '点燃'],
    pair: 'burnUse',
  },
  burnUse: {
    label: '灼烧·利用',
    short: '利用',
    group: 'burn',
    aliases: ['灼烧', '燃烧', '引爆'],
    pair: 'burnApply',
  },
  markApply: {
    label: '符印·施加',
    short: '施加',
    group: 'mark',
    aliases: ['符印', '印记', '符'],
    pair: 'markSpend',
  },
  markSpend: {
    label: '符印·消耗',
    short: '消耗',
    group: 'mark',
    aliases: ['符印', '印记', '解印'],
    pair: 'markApply',
  },
  chargeGain: {
    label: '蓄能·获得',
    short: '获得',
    group: 'charge',
    aliases: ['蓄能', '充能'],
    pair: 'chargeUse',
  },
  chargeUse: {
    label: '蓄能·利用',
    short: '利用',
    group: 'charge',
    aliases: ['蓄能', '充能', '炮击'],
    pair: 'chargeGain',
  },
  devourGain: {
    label: '噬能·获得',
    short: '获得',
    group: 'devour',
    aliases: ['噬能', '吞噬'],
    pair: 'devourSpend',
  },
  devourSpend: {
    label: '噬能·消耗',
    short: '消耗',
    group: 'devour',
    aliases: ['噬能', '吞噬'],
    pair: 'devourGain',
  },
  shieldGain: {
    label: '护盾·获得',
    short: '获得',
    group: 'shield',
    aliases: ['护盾', '盾', '格挡', '防御', '护甲'],
    pair: 'shieldUse',
  },
  shieldUse: {
    label: '护盾·利用',
    short: '利用',
    group: 'shield',
    aliases: ['护盾', '盾', '盾击'],
    pair: 'shieldGain',
  },
  selfCost: {
    label: '自损',
    short: '自损',
    group: 'life',
    aliases: ['扣血', '自伤', '失去生命', '献祭'],
  },
  heal: { label: '回复', short: '回复', group: 'life', aliases: ['吸血', '回血', '治疗', '恢复'] },
  damage: { label: '伤害', short: '伤害', group: 'effect', aliases: ['输出'] },
  aoe: { label: '群体', short: '群体', group: 'effect', aliases: ['群攻', '全体', '范围', 'aoe'] },
  multiHit: { label: '多段', short: '多段', group: 'effect', aliases: ['连击', '段数'] },
  draw: { label: '抽牌', short: '抽牌', group: 'effect', aliases: ['过牌', '抽卡'] },
  energy: { label: '行动力', short: '行动力', group: 'effect', aliases: ['能量', '回费'] },
  weak: { label: '虚弱', short: '虚弱', group: 'effect', aliases: ['减攻', '削弱'] },
  vulnerable: { label: '易伤', short: '易伤', group: 'effect', aliases: ['增伤'] },
  strength: { label: '力量', short: '力量', group: 'effect', aliases: ['加攻', '每段伤害'] },
  exhaust: { label: '耗竭', short: '耗竭', group: 'effect', aliases: ['一次性'] },
  copy: { label: '复制', short: '复制', group: 'effect', aliases: ['复制品'] },
  purge: { label: '清故障', short: '清故障', group: 'effect', aliases: ['故障', '净化'] },
  conditional: {
    label: '条件触发',
    short: '条件触发',
    group: 'effect',
    aliases: ['条件', '斩杀', '击杀', '连携'],
  },
};

export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

// —— 字段 → 标签映射 ——
// 不产生标签的字段：基础信息、强化辅助字段与只改变数值的修饰字段。
// 新增 CardDef 字段时必须归入下方映射或此清单，否则类型检查与 tests/cardIndex.test.ts 失败。
export const UNTAGGED_FIELDS = [
  'id',
  'name',
  'cost',
  'kind',
  'family',
  'text',
  'art',
  'upgrade',
  'unlockForm',
  'unlockForms',
  'series',
  'upgradeText',
  'upgradeDamage',
  'upgradeDrain',
  'upgradeDrainRatio',
  'upgradeDraw',
  'scatter',
  'chargeMultiplier',
  'markPower',
  'shieldDiv',
  'burnPower',
  'devourHitsCap',
  'copyChoice',
  'devourAuraGain',
  'devourVulnFallback',
] as const;
type UntaggedField = (typeof UNTAGGED_FIELDS)[number];
// hits 需要大于1才算多段；special 单独映射。
type SpecialField = 'hits' | 'special';

export const FIELD_TAGS: Record<
  Exclude<keyof CardDef, UntaggedField | SpecialField>,
  readonly CardTag[]
> = {
  damage: ['damage'],
  shield: ['shieldGain'],
  burn: ['burnApply'],
  mark: ['markApply'],
  draw: ['draw'],
  heal: ['heal'],
  energy: ['energy'],
  charge: ['chargeGain'],
  chargedDamage: ['chargeUse', 'conditional'],
  chargeSeg: ['chargeUse'],
  all: ['aoe'],
  exhaust: ['exhaust'],
  strength: ['strength'],
  weak: ['weak'],
  drain: ['heal'],
  drainRequiresSelfCost: ['conditional'],
  nextAttackBonus: ['damage', 'conditional'],
  drainRatio: ['heal'],
  devour: ['devourGain'],
  devourPower: ['devourSpend'],
  devourShield: ['devourSpend'],
  devourAll: ['devourSpend'],
  devourWeak: ['devourSpend', 'weak'],
  devourHeal: ['devourSpend', 'heal'],
  devourHits: ['devourSpend', 'multiHit'],
  devourVuln: ['devourSpend', 'vulnerable'],
  devourStrength: ['devourSpend', 'strength'],
  killDevour: ['devourGain', 'conditional'],
  killDraw: ['draw', 'conditional'],
  refundSelfCostOnKill: ['heal', 'conditional'],
  windupHits: ['multiHit'],
  executeBonus: ['conditional'],
  burningBonus: ['burnUse', 'conditional'],
  burnShield: ['burnUse', 'shieldGain'],
  burnDouble: ['burnApply', 'burnUse', 'conditional'],
  shieldSpend: ['shieldUse'],
  selfCostBonus: ['conditional'],
  burstMarkBonus: ['markApply', 'conditional'],
  multiAttackDouble: ['conditional'],
  convert: ['devourGain'],
};

export const SPECIAL_TAGS: Record<Special, readonly CardTag[]> = {
  detonate: ['burnUse'],
  pyre: ['burnUse'],
  shieldhit: ['shieldUse'],
  markburst: ['markSpend'],
  copy: ['copy'],
  cannon: ['chargeUse'],
  purge: ['purge'],
  sacrifice: ['selfCost'],
  devour: ['devourSpend'],
  devouraura: ['devourGain'],
  lure: ['conditional'],
  spinstep: ['energy', 'conditional'],
  windup: ['multiHit', 'conditional'],
  izuna: ['conditional'],
};

/** 按传入版本（基础或强化后的最终配置）推导标签，顺序与 ALL_TAGS 一致。 */
export function cardTags(def: CardDef): CardTag[] {
  const found = new Set<CardTag>();
  for (const [field, tags] of Object.entries(FIELD_TAGS) as [keyof CardDef, CardTag[]][])
    if (def[field]) tags.forEach((t) => found.add(t));
  if ((def.hits ?? 1) > 1) found.add('multiHit');
  if (def.special) SPECIAL_TAGS[def.special].forEach((t) => found.add(t));
  return ALL_TAGS.filter((t) => found.has(t));
}

// —— 归一化 ——
/** 全角转半角、忽略空白与「·」、×／＊ 视为 x、英文小写。 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[×*]/g, 'x')
    .replace(/[\s·・]/g, '');
}
export function tokenize(text: string): string[] {
  return text.normalize('NFKC').split(/\s+/).map(normalize).filter(Boolean);
}
// 同义词：归一化后的词 → 标签。标签名本身（含组名）也作为别名。
const ALIASES = new Map<string, CardTag[]>();
for (const tag of ALL_TAGS) {
  const info = TAG_INFO[tag];
  for (const word of [info.label, ...info.aliases]) {
    const key = normalize(word);
    ALIASES.set(key, [...(ALIASES.get(key) ?? []), tag]);
  }
}
export const aliasTags = (token: string): CardTag[] => ALIASES.get(normalize(token)) ?? [];

// —— 索引 ——
export type Stage = -1 | 0 | 1 | 2 | 3;
export const STAGE_NAMES: Record<Stage, string> = {
  [-1]: '通用',
  0: '成长期',
  1: '成熟期',
  2: '完全体',
  3: '究极体',
};
export const KIND_NAMES: Record<Exclude<CardKind, 'status'>, string> = {
  attack: '攻击',
  skill: '技能',
  power: '强化',
};
export type CardGroup = Partner | 'common';
export const GROUP_NAMES: Record<CardGroup, string> = {
  ...(Object.fromEntries(PARTNER_IDS.map((p) => [p, PARTNERS[p].name])) as Record<Partner, string>),
  common: '通用',
};
const FORM_ORDER = Object.keys(EVOLUTIONS);

export interface CardVersion {
  def: CardDef;
  tags: CardTag[];
  name: string;
  effect: string;
}
export interface CardIndexEntry {
  id: string;
  group: CardGroup;
  /** 所属形态（专属或共享）；通用卡为空。 */
  forms: string[];
  stage: Stage;
  /** 来源排序键：搭档顺序 × 100 ＋ 进化树形态顺序。 */
  sourceOrder: number;
  base: CardVersion;
  upgraded: CardVersion;
}

function version(def: CardDef): CardVersion {
  return { def, tags: cardTags(def), name: normalize(def.name), effect: normalize(def.text) };
}

let cache: CardIndexEntry[] | null = null;
/** 107 张非故障牌的检索索引，模块级缓存。 */
export function buildCardIndex(): CardIndexEntry[] {
  if (cache) return cache;
  cache = Object.values(CARDS)
    .filter((d) => d.family !== 'status')
    .map((d) => {
      const forms = skillForms(d);
      const group: CardGroup = forms.length ? EVOLUTIONS[forms[0]].partner : 'common';
      const stage = (
        forms.length ? Math.min(...forms.map((f) => EVOLUTIONS[f].stage)) : -1
      ) as Stage;
      const formOrder = forms.length ? Math.min(...forms.map((f) => FORM_ORDER.indexOf(f))) : 0;
      return {
        id: d.id,
        group,
        forms,
        stage,
        sourceOrder: (group === 'common' ? 0 : PARTNER_IDS.indexOf(group) + 1) * 100 + formOrder,
        base: version(cardDefinition({ id: d.id, upgraded: false })),
        upgraded: version(cardDefinition({ id: d.id, upgraded: true })),
      };
    });
  return cache;
}

/** 图鉴收录口径：基础形态／通用卡常亮；进化形态卡到达过即点亮；小妖兽未解锁时其基础卡置灰。 */
export function isCardCollected(meta: Meta, def: CardDef): boolean {
  if (!def.unlockForm) return true;
  if ((PARTNER_IDS as string[]).includes(def.unlockForm))
    return def.unlockForm !== 'impmon' || (meta.scans.beelzebumon ?? 0) >= 100;
  return skillForms(def).some((form) => meta.discovered.includes(form));
}

// —— 查询 ——
export type CardSort = 'cost' | 'stage' | 'source' | 'name' | 'relevance';
export type Collection = 'all' | 'lit' | 'locked';
export type RunFilter = 'deck' | 'pool';
export interface CardQuery {
  text: string;
  group: CardGroup | 'all';
  forms: string[];
  stages: Stage[];
  kinds: Exclude<CardKind, 'status'>[];
  costs: number[];
  tags: CardTag[];
  collection: Collection;
  run: RunFilter[];
  upgradedView: boolean;
  sort: Exclude<CardSort, 'relevance'>;
  /** 有关键词时是否按相关度排序；输入新关键词时自动恢复为 true。 */
  relevance: boolean;
}
export const DEFAULT_QUERY: CardQuery = {
  text: '',
  group: 'all',
  forms: [],
  stages: [],
  kinds: [],
  costs: [],
  tags: [],
  collection: 'all',
  run: [],
  upgradedView: false,
  sort: 'cost',
  relevance: true,
};
export const effectiveSort = (q: CardQuery): CardSort =>
  q.relevance && tokenize(q.text).length ? 'relevance' : q.sort;

export interface SearchContext {
  collected: (def: CardDef) => boolean;
  /** 本局永久卡组：卡牌ID → 持有数与强化数。 */
  deck?: Map<string, { count: number; upgraded: number }>;
  /** 本局奖励／商店卡池。 */
  pool?: Set<string>;
}

export type MatchField = 'name' | 'form' | 'tag' | 'effect' | 'other' | 'meta';
const FIELD_WEIGHT: Record<MatchField, number> = {
  name: 5,
  form: 4,
  tag: 3,
  effect: 2,
  other: 1,
  meta: 1,
};
export const MATCH_LABELS: Record<MatchField, string> = {
  name: '名称',
  form: '形态',
  tag: '机制',
  effect: '效果',
  other: '强化后',
  meta: '类型／费用',
};

export const shown = (e: CardIndexEntry, q: Pick<CardQuery, 'upgradedView'>) =>
  q.upgradedView ? e.upgraded : e.base;

/** 关键词命中位置；未命中任一词返回 null。未收录卡不按形态名匹配，避免剧透所属形态。 */
export function matchText(
  e: CardIndexEntry,
  tokens: string[],
  upgradedView: boolean,
  collected: boolean,
): { fields: MatchField[]; score: number } | null {
  if (!tokens.length) return { fields: [], score: 0 };
  const v = upgradedView ? e.upgraded : e.base,
    other = upgradedView ? e.base : e.upgraded;
  const forms = normalize(
    [GROUP_NAMES[e.group], ...(collected ? e.forms.map((f) => FORM_NAMES[f] ?? f) : [])].join(' '),
  );
  const tagText = normalize(
    v.tags
      .map(
        (t) => `${TAG_INFO[t].label} ${TAG_GROUPS.find((g) => g.id === TAG_INFO[t].group)!.name}`,
      )
      .join(' '),
  );
  const meta = normalize(
    `${KIND_NAMES[v.def.kind as keyof typeof KIND_NAMES] ?? ''} ${v.def.cost}费`,
  );
  const fields = new Set<MatchField>();
  let score = 0;
  for (const token of tokens) {
    const hits: MatchField[] = [];
    if (v.name.includes(token)) hits.push('name');
    if (forms.includes(token)) hits.push('form');
    if (tagText.includes(token) || aliasTags(token).some((t) => v.tags.includes(t)))
      hits.push('tag');
    if (v.effect.includes(token)) hits.push('effect');
    if (other.effect !== v.effect && other.effect.includes(token)) hits.push('other');
    if (meta.includes(token)) hits.push('meta');
    if (!hits.length) return null;
    hits.forEach((h) => fields.add(h));
    score += Math.max(...hits.map((h) => FIELD_WEIGHT[h]));
  }
  // 按权重从高到低，界面只展示最主要的命中位置。
  return { fields: [...fields].sort((a, b) => FIELD_WEIGHT[b] - FIELD_WEIGHT[a]), score };
}

type Dimension =
  'text' | 'group' | 'forms' | 'stages' | 'kinds' | 'costs' | 'tags' | 'collection' | 'run';

function passes(
  e: CardIndexEntry,
  q: CardQuery,
  ctx: SearchContext,
  collected: boolean,
  skip?: Dimension,
): boolean {
  const v = shown(e, q);
  if (skip !== 'group' && q.group !== 'all' && e.group !== q.group) return false;
  // 未收录卡不暴露所属形态，因此不参与形态筛选。
  if (
    skip !== 'forms' &&
    q.forms.length &&
    !(collected && e.forms.some((f) => q.forms.includes(f)))
  )
    return false;
  if (skip !== 'stages' && q.stages.length && !q.stages.includes(e.stage)) return false;
  if (skip !== 'kinds' && q.kinds.length && !q.kinds.includes(v.def.kind as never)) return false;
  if (skip !== 'costs' && q.costs.length && !q.costs.includes(v.def.cost)) return false;
  if (skip !== 'tags' && q.tags.some((t) => !v.tags.includes(t))) return false;
  if (skip !== 'collection' && q.collection !== 'all' && collected !== (q.collection === 'lit'))
    return false;
  if (skip !== 'run' && q.run.length) {
    const inDeck = !!ctx.deck?.has(e.id),
      inPool = !!ctx.pool?.has(e.id);
    if (!q.run.some((r) => (r === 'deck' ? inDeck : inPool))) return false;
  }
  if (skip !== 'text' && !matchText(e, tokenize(q.text), q.upgradedView, collected)) return false;
  return true;
}

export interface SearchResult {
  entry: CardIndexEntry;
  collected: boolean;
  matchedIn: MatchField[];
}
export type FacetKey = Exclude<Dimension, 'text'>;
export type Facets = { [K in FacetKey]: Record<string, number> };

export interface ActiveFilter {
  dim: Dimension;
  value: string;
  label: string;
}

const collator = new Intl.Collator('zh');
function compare(a: SearchResult, b: SearchResult, q: CardQuery, scores: Map<string, number>) {
  const va = shown(a.entry, q).def,
    vb = shown(b.entry, q).def;
  const byName = collator.compare(va.name, vb.name);
  const byCost = va.cost - vb.cost;
  switch (effectiveSort(q)) {
    case 'name':
      return byName;
    case 'stage':
      return a.entry.stage - b.entry.stage || byCost || byName;
    case 'source':
      return a.entry.sourceOrder - b.entry.sourceOrder || byCost || byName;
    case 'relevance':
      // 同分时已收录的卡排在前面。
      return (
        (scores.get(b.entry.id) ?? 0) - (scores.get(a.entry.id) ?? 0) ||
        Number(b.collected) - Number(a.collected) ||
        byCost ||
        byName
      );
    default:
      return byCost || byName;
  }
}

/** 当前搭档下列出拥有专属牌的形态，按进化树顺序。 */
export function formOptions(group: CardQuery['group']): string[] {
  if (group === 'all' || group === 'common') return [];
  const forms = new Set(buildCardIndex().flatMap((e) => (e.group === group ? e.forms : [])));
  return FORM_ORDER.filter((f) => forms.has(f));
}

export function activeFilters(q: CardQuery): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const text = q.text.trim();
  if (text) out.push({ dim: 'text', value: text, label: `“${text}”` });
  if (q.group !== 'all') out.push({ dim: 'group', value: q.group, label: GROUP_NAMES[q.group] });
  q.forms.forEach((f) => out.push({ dim: 'forms', value: f, label: FORM_NAMES[f] ?? f }));
  q.stages.forEach((s) => out.push({ dim: 'stages', value: String(s), label: STAGE_NAMES[s] }));
  q.kinds.forEach((k) => out.push({ dim: 'kinds', value: k, label: KIND_NAMES[k] }));
  q.costs.forEach((c) => out.push({ dim: 'costs', value: String(c), label: `${c} 费` }));
  q.tags.forEach((t) => out.push({ dim: 'tags', value: t, label: TAG_INFO[t].label }));
  if (q.collection !== 'all')
    out.push({
      dim: 'collection',
      value: q.collection,
      label: q.collection === 'lit' ? '已收录' : '未收录',
    });
  q.run.forEach((r) =>
    out.push({ dim: 'run', value: r, label: r === 'deck' ? '卡组中' : '本局可获取' }),
  );
  return out;
}

export function removeFilter(q: CardQuery, f: ActiveFilter): CardQuery {
  switch (f.dim) {
    case 'text':
      return { ...q, text: '' };
    case 'group':
      return { ...q, group: 'all', forms: [] };
    case 'collection':
      return { ...q, collection: 'all' };
    case 'stages':
      return { ...q, stages: q.stages.filter((s) => String(s) !== f.value) };
    case 'costs':
      return { ...q, costs: q.costs.filter((c) => String(c) !== f.value) };
    default:
      return { ...q, [f.dim]: (q[f.dim] as string[]).filter((v) => v !== f.value) };
  }
}
/** 清除全部筛选；保留强化版视图与排序偏好。 */
export const clearFilters = (q: CardQuery): CardQuery => ({
  ...DEFAULT_QUERY,
  upgradedView: q.upgradedView,
  sort: q.sort,
});

export function searchCards(q: CardQuery, ctx: SearchContext) {
  const index = buildCardIndex();
  const collected = new Map(index.map((e) => [e.id, ctx.collected(e.base.def)]));
  const tokens = tokenize(q.text);
  const scores = new Map<string, number>();
  const results: SearchResult[] = [];
  for (const entry of index) {
    const c = collected.get(entry.id)!;
    if (!passes(entry, q, ctx, c)) continue;
    const m = matchText(entry, tokens, q.upgradedView, c)!;
    scores.set(entry.id, m.score);
    results.push({ entry, collected: c, matchedIn: m.fields });
  }
  results.sort((a, b) => compare(a, b, q, scores));

  // 分面计数：其他条件不变、再选这一项后的结果数。
  const count = (dim: Dimension, extra: (e: CardIndexEntry, c: boolean) => boolean) =>
    index.filter((e) => {
      const c = collected.get(e.id)!;
      return passes(e, q, ctx, c, dim) && extra(e, c);
    }).length;
  const facets: Facets = {
    group: Object.fromEntries(
      (['all', ...PARTNER_IDS, 'common'] as const).map((g) => [
        g,
        count('group', (e) => g === 'all' || e.group === g),
      ]),
    ),
    forms: Object.fromEntries(
      formOptions(q.group).map((f) => [f, count('forms', (e, c) => c && e.forms.includes(f))]),
    ),
    stages: Object.fromEntries(
      ([-1, 0, 1, 2, 3] as Stage[]).map((s) => [s, count('stages', (e) => e.stage === s)]),
    ),
    kinds: Object.fromEntries(
      (Object.keys(KIND_NAMES) as (keyof typeof KIND_NAMES)[]).map((k) => [
        k,
        count('kinds', (e) => shown(e, q).def.kind === k),
      ]),
    ),
    costs: Object.fromEntries(
      [0, 1, 2].map((c) => [c, count('costs', (e) => shown(e, q).def.cost === c)]),
    ),
    tags: Object.fromEntries(
      ALL_TAGS.map((t) => [
        t,
        count('tags', (e) => q.tags.concat(t).every((x) => shown(e, q).tags.includes(x))),
      ]),
    ),
    collection: Object.fromEntries(
      (['all', 'lit', 'locked'] as const).map((s) => [
        s,
        count('collection', (_, c) => s === 'all' || c === (s === 'lit')),
      ]),
    ),
    run: {
      deck: count('run', (e) => !!ctx.deck?.has(e.id)),
      pool: count('run', (e) => !!ctx.pool?.has(e.id)),
    },
  };

  // 空结果：逐个去掉已选条件试算，给出最多2条放宽建议。
  const filters = activeFilters(q);
  const relaxHints = results.length
    ? []
    : filters
        .map((f) => ({ filter: f, count: searchCount(removeFilter(q, f), ctx) }))
        .filter((h) => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);
  return { results, facets, filters, relaxHints };
}

function searchCount(q: CardQuery, ctx: SearchContext): number {
  return buildCardIndex().filter((e) => passes(e, q, ctx, ctx.collected(e.base.def))).length;
}

/** 搭配参考：按「产生↔利用」配对，先列同搭档，再列通用卡，最多 6 张。 */
export function synergyFor(id: string, upgradedView = false, limit = 6) {
  const index = buildCardIndex();
  const self = index.find((e) => e.id === id);
  if (!self) return [];
  const v = upgradedView ? self.upgraded : self.base;
  const wanted = v.tags.flatMap((t) =>
    TAG_INFO[t].pair ? [{ from: t, to: TAG_INFO[t].pair! }] : [],
  );
  const out: { entry: CardIndexEntry; tag: CardTag }[] = [];
  for (const sameGroup of [true, false])
    for (const e of index) {
      if (e.id === id || out.some((o) => o.entry.id === e.id)) continue;
      const isSame = self.group !== 'common' && e.group === self.group;
      const allowed = sameGroup
        ? isSame
        : e.group === 'common' || (self.group === 'common' && !isSame);
      if (!allowed) continue;
      const ev = upgradedView ? e.upgraded : e.base;
      const hit = wanted.find((w) => ev.tags.includes(w.to));
      if (hit) out.push({ entry: e, tag: hit.to });
    }
  return out.slice(0, limit);
}
