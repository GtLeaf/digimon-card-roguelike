import { BRANCHES, FORM_NAMES } from './data';
import type { Activity, Branch, Meta, Metric, Partner, Run } from './types';

export const emptyActivity = (): Activity => ({ counts: {}, cards: {} });
export const METRIC_NAMES: Record<Metric, string> = {
  attacks: '攻击出牌',
  defenses: '主动防御',
  skills: '技能出牌',
  fire: '火焰出牌',
  marks: '施加符印',
  detonations: '引爆灼烧',
  markBursts: '消耗符印',
  selfCosts: '主动自损',
  heals: '有效治疗',
  copies: '使用复制牌',
  weakens: '施加虚弱',
  combos: '双技能回合',
  burnKills: '击败带灼烧的敌人',
  charges: '主动蓄能',
  cannonShots: '蓄能炮击',
  kills: '击败敌人',
  devourSpent: '消耗噬能',
  bigTurns: '满编出牌回合',
};
export const ROUTE_DATA: Record<string, { name: string; source: string }> = {
  mechanical: {
    name: '机械研究',
    source: '齿轮兽或安杜路兽扫描达到 100%，或在第二章事件中完成机械研究',
  },
  chaos: { name: '混沌资料', source: '邪龙兽扫描达到 100%，或在失控机械档案中读取混沌记忆' },
  purification: { name: '净化资料', source: '狮子兽扫描达到 100%，或在第二章事件中完成安全净化' },
};
export function syncRouteData(meta: Meta): string[] {
  const gained: string[] = [];
  for (const [id, enemy] of [
    ['chaos', 'devidramon'],
    ['purification', 'leomon'],
    ['mechanical', 'hagurumon'],
    ['mechanical', 'andromon'],
  ]) {
    if ((meta.scans[enemy] ?? 0) >= 100 && !meta.unlockedRoutes.includes(id)) {
      meta.unlockedRoutes.push(id);
      gained.push(id);
    }
  }
  return gained;
}
interface Term {
  metric?: Metric;
  card?: string;
  label?: string;
  goal: number;
}
export interface EvolutionDef {
  id: string;
  partner: Partner;
  stage: number;
  parents: string[];
  tag: string;
  passive: string;
  cards: string[];
  /** 进化时自动强化原形态已有的招牌牌；同名收益不重复赠送 */
  signatureUpgrade?: boolean;
  branch?: Branch;
  /** 止步觉醒：不升阶段的终点形态（如觉醒斗牛士兽），可同步爆发 */
  endpoint?: boolean;
  /** 进化树展示列（默认按 stage）；止步觉醒挂在前置形态同列 */
  treeStage?: number;
  groups: Term[][];
  slot: number;
}
export const EVOLUTIONS: Record<string, EvolutionDef> = Object.fromEntries(
  (
    [
      {
        id: 'guilmon',
        partner: 'guilmon',
        stage: 0,
        parents: [],
        tag: '旅途起点',
        passive: '以火焰与勇气开启冒险。',
        cards: ['fireball', 'rock'],
        groups: [],
        slot: 1,
      },
      {
        id: 'growlmon',
        partner: 'guilmon',
        stage: 1,
        parents: ['guilmon'],
        tag: '烈焰追击',
        passive: '每回合首次攻击带灼烧的敌人，额外造成 2 总伤害（多段只加一次）。',
        cards: ['fireball', 'doublecut'],
        groups: [],
        slot: 0,
      },
      {
        id: 'blackgrowmon',
        partner: 'guilmon',
        stage: 1,
        parents: ['guilmon'],
        tag: '暗炎之路',
        passive: '每回合首次实际施加灼烧额外＋1。',
        cards: ['darkflame', 'bloodedge'],
        groups: [
          [{ metric: 'selfCosts', goal: 3 }],
          [
            { metric: 'attacks', goal: 8 },
            { metric: 'fire', goal: 3 },
          ],
        ],
        slot: 2,
      },
      {
        id: 'wargrowlmon',
        partner: 'guilmon',
        stage: 2,
        parents: ['growlmon', 'blackgrowmon'],
        tag: '余烬与守护',
        passive: '每场开始获得 1 蓄能；每回合首次实际施加灼烧，获得 2 护盾。',
        cards: ['flare', 'emberCannon'],
        groups: [],
        slot: 0,
      },
      {
        id: 'blackwargrowlmon',
        partner: 'guilmon',
        stage: 2,
        parents: ['blackgrowmon'],
        tag: '危险过载',
        passive: '每回合首次主动自损，获得 1 行动力。',
        cards: ['sacrifice', 'drain'],
        groups: [
          [{ metric: 'attacks', goal: 48 }],
          [
            { metric: 'selfCosts', goal: 3 },
            { metric: 'fire', goal: 16 },
          ],
        ],
        slot: 2,
      },
      {
        id: 'dukemon',
        partner: 'guilmon',
        stage: 3,
        parents: ['wargrowlmon'],
        tag: '圣盾攻防',
        passive:
          BRANCHES.duke.passive + ' 主动防御满12次，进化时额外获得圣盾继承：每回合开始＋2护盾。',
        cards: BRANCHES.duke.cards,
        branch: 'duke',
        groups: [],
        slot: 0,
      },
      {
        id: 'megidramon',
        partner: 'guilmon',
        stage: 3,
        parents: ['wargrowlmon', 'blackwargrowlmon'],
        tag: '灼烧爆发',
        passive: BRANCHES.megidra.passive,
        cards: BRANCHES.megidra.cards,
        branch: 'megidra',
        groups: [
          [
            { card: 'fireball', label: '火球系列', goal: 20 },
            { metric: 'fire', goal: 32 },
          ],
          [
            { metric: 'detonations', goal: 4 },
            { metric: 'burnKills', goal: 18 },
          ],
        ],
        slot: 1,
      },
      {
        id: 'chaosdukemon',
        partner: 'guilmon',
        stage: 3,
        parents: ['blackwargrowlmon'],
        tag: '血契循环',
        passive: BRANCHES.chaos.passive,
        cards: BRANCHES.chaos.cards,
        branch: 'chaos',
        groups: [[{ metric: 'selfCosts', goal: 6 }], [{ metric: 'heals', goal: 4 }]],
        slot: 2,
      },
      {
        id: 'renamon',
        partner: 'renamon',
        stage: 0,
        parents: [],
        tag: '旅途起点',
        passive: '以符印与术式开启冒险。',
        cards: ['leaf', 'talisman'],
        groups: [],
        slot: 1,
      },
      {
        id: 'kyubimon',
        partner: 'renamon',
        stage: 1,
        parents: ['renamon'],
        tag: '狐火之路',
        passive: '招牌牌强化；可选择进攻或守护训练。',
        cards: ['leaf', 'talisman'],
        signatureUpgrade: true,
        groups: [],
        slot: 0,
      },
      {
        id: 'youkomon',
        partner: 'renamon',
        stage: 1,
        parents: ['renamon'],
        tag: '妖术之路',
        passive: '每回合首次施加符印额外＋1。',
        cards: ['foxcurse', 'illusion'],
        groups: [[{ metric: 'skills', goal: 24 }], [{ metric: 'marks', goal: 12 }]],
        slot: 2,
      },
      {
        id: 'taomon',
        partner: 'renamon',
        stage: 2,
        parents: ['kyubimon', 'youkomon'],
        tag: '术式与守护',
        passive: '每回合第一张技能额外获得 2 护盾。',
        cards: ['leaf', 'barrier'],
        groups: [],
        slot: 0,
      },
      {
        id: 'doumon',
        partner: 'renamon',
        stage: 2,
        parents: ['youkomon'],
        tag: '咒术控制',
        passive: '每回合第二张技能，对一名敌人施加 1 符印。',
        cards: ['shadowseal', 'illusion'],
        groups: [
          [{ metric: 'marks', goal: 30 }],
          [
            { metric: 'copies', goal: 8 },
            { metric: 'weakens', goal: 5 },
          ],
        ],
        slot: 2,
      },
      {
        id: 'sakuyamon',
        partner: 'renamon',
        stage: 3,
        parents: ['taomon', 'doumon'],
        tag: '术式循环',
        passive:
          BRANCHES.sakuya.passive + ' 消耗符印满6次，进化时额外获得术式继承：首回合多抽1张。',
        cards: BRANCHES.sakuya.cards,
        branch: 'sakuya',
        groups: [],
        slot: 0,
      },
      {
        id: 'kuzuhamon',
        partner: 'renamon',
        stage: 3,
        parents: ['taomon', 'doumon'],
        tag: '结界式神',
        passive: BRANCHES.kuzuha.passive,
        cards: BRANCHES.kuzuha.cards,
        branch: 'kuzuha',
        groups: [[{ metric: 'skills', goal: 70 }], [{ metric: 'combos', goal: 22 }]],
        slot: 2,
      },
      {
        id: 'terriermon',
        partner: 'terriermon',
        stage: 0,
        parents: [],
        tag: '旅途起点',
        passive: '连射与蓄能：选择机动火力或防守炮击。',
        cards: ['tinyTwister', 'blazingShot'],
        groups: [],
        slot: 1,
      },
      {
        id: 'galgomon',
        partner: 'terriermon',
        stage: 1,
        parents: ['terriermon'],
        tag: '连射之路',
        passive: '每回合第二张攻击牌结算后，获得 1 蓄能。',
        cards: ['gatling', 'dumUpper'],
        groups: [],
        slot: 0,
      },
      {
        id: 'blackgalgomon',
        partner: 'terriermon',
        stage: 1,
        parents: ['terriermon'],
        tag: '战术之路',
        passive:
          '每回合首次防御出牌后，本回合下一张造成直接伤害的攻击牌额外造成 2 总伤害。攻击处于虚弱状态的敌人时，每段伤害＋1。',
        cards: ['blackGatling', 'ambushUpper'],
        groups: [[{ metric: 'attacks', goal: 20 }], [{ metric: 'defenses', goal: 14 }]],
        slot: 2,
      },
      {
        id: 'rapidmon',
        partner: 'terriermon',
        stage: 2,
        parents: ['galgomon', 'blackgalgomon'],
        tag: '高速机动',
        passive: '每回合第二张攻击牌结算后，抽 1 张牌。',
        cards: ['rapidFire', 'goldTriangle'],
        groups: [],
        slot: 0,
      },
      {
        id: 'blackrapidmon',
        partner: 'terriermon',
        stage: 2,
        parents: ['blackgalgomon', 'galgomon'],
        tag: '装甲蓄能',
        passive: '每回合首次防御出牌额外获得 1 蓄能；每回合首次施加虚弱时，获得 1 蓄能。',
        cards: ['blackReload', 'blackMissile'],
        groups: [[{ metric: 'charges', goal: 20 }], [{ metric: 'weakens', goal: 10 }]],
        slot: 2,
      },
      {
        id: 'saintgalgomon',
        partner: 'terriermon',
        stage: 3,
        parents: ['rapidmon', 'blackrapidmon'],
        tag: '连射压制',
        passive: BRANCHES.saint.passive,
        cards: BRANCHES.saint.cards,
        branch: 'saint',
        groups: [],
        slot: 0,
      },
      {
        id: 'blacksaintgalgomon',
        partner: 'terriermon',
        stage: 3,
        parents: ['blackrapidmon'],
        tag: '重装炮击',
        passive: BRANCHES.blacksaint.passive,
        cards: BRANCHES.blacksaint.cards,
        branch: 'blacksaint',
        groups: [[{ metric: 'defenses', goal: 58 }], [{ metric: 'cannonShots', goal: 7 }]],
        slot: 2,
      },
      {
        id: 'impmon',
        partner: 'impmon',
        stage: 0,
        parents: [],
        tag: '旅途起点',
        passive: '以恶作剧与噬能开启冒险。',
        cards: ['nightfire', 'taunt'],
        groups: [],
        slot: 1,
      },
      {
        id: 'sorcerymon',
        partner: 'impmon',
        stage: 1,
        parents: ['impmon'],
        tag: '魔人之路',
        passive: '招牌牌强化；可选择进攻或守护训练。',
        cards: ['frostSorcery', 'magicShield'],
        signatureUpgrade: true,
        groups: [],
        slot: 0,
      },
      {
        id: 'devimon',
        partner: 'impmon',
        stage: 1,
        parents: ['impmon'],
        tag: '堕天之路',
        passive: '攻击处于虚弱状态的敌人时，每段伤害＋1。',
        cards: ['bloodClaw', 'nightmareWave'],
        groups: [[{ metric: 'weakens', goal: 10 }], [{ metric: 'attacks', goal: 15 }]],
        slot: 2,
      },
      {
        id: 'matadormon',
        partner: 'impmon',
        stage: 2,
        parents: ['sorcerymon'],
        tag: '华丽剑舞',
        passive: '每场战斗开始时获得 1 噬能。',
        cards: ['soulHarvest', 'lureDance'],
        groups: [],
        slot: 0,
      },
      {
        id: 'vamdemon',
        partner: 'impmon',
        stage: 2,
        parents: ['devimon'],
        tag: '暗夜吸血',
        passive: '吸血效果额外回复 2 生命。',
        cards: ['batSwarm', 'crimsonRain'],
        groups: [[{ metric: 'weakens', goal: 20 }], [{ metric: 'heals', goal: 10 }]],
        slot: 2,
      },
      {
        id: 'beelzebumon',
        partner: 'impmon',
        stage: 3,
        parents: ['matadormon'],
        tag: '暴食吞噬',
        passive: BRANCHES.gluttony.passive,
        cards: BRANCHES.gluttony.cards,
        branch: 'gluttony',
        groups: [
          [
            { metric: 'kills', goal: 25 },
            { metric: 'devourSpent', goal: 30 },
          ],
        ],
        slot: 1,
      },
      {
        id: 'beelzebumonblaster',
        partner: 'impmon',
        stage: 3,
        parents: ['matadormon'],
        tag: '疾风连射',
        passive: BRANCHES.blast.passive,
        cards: BRANCHES.blast.cards,
        branch: 'blast',
        groups: [
          [
            { metric: 'bigTurns', goal: 3 },
            { metric: 'attacks', goal: 50 },
          ],
        ],
        slot: 0,
      },
      {
        id: 'venommyotismon',
        partner: 'impmon',
        stage: 3,
        parents: ['vamdemon'],
        tag: '剧毒吸血',
        passive: BRANCHES.venom.passive,
        cards: BRANCHES.venom.cards,
        branch: 'venom',
        groups: [[{ metric: 'weakens', goal: 25 }], [{ metric: 'heals', goal: 15 }]],
        slot: 3,
      },
      {
        id: 'belialvamdemon',
        partner: 'impmon',
        stage: 3,
        parents: ['vamdemon'],
        tag: '绝望收割',
        passive: BRANCHES.belial.passive,
        cards: BRANCHES.belial.cards,
        branch: 'belial',
        groups: [
          [{ metric: 'attacks', goal: 55 }],
          [
            { metric: 'selfCosts', goal: 4 },
            { metric: 'kills', goal: 30 },
          ],
        ],
        slot: 2,
      },
      {
        id: 'matadormonAwakened',
        partner: 'impmon',
        stage: 3,
        parents: ['matadormon'],
        tag: '止步觉醒',
        passive: '每回合打出的第二张攻击牌不消耗行动力；吸血效果额外回复 1 生命。',
        cards: ['flamencoSlash', 'curtainSpin'],
        endpoint: true,
        treeStage: 2,
        groups: [
          [{ metric: 'attacks', goal: 40 }],
          [
            { metric: 'kills', goal: 15 },
            { metric: 'bigTurns', goal: 3 },
          ],
        ],
        slot: -1,
      },
    ] satisfies EvolutionDef[]
  ).map((d) => [d.id, d]),
);
export interface Requirement {
  label: string;
  current: number;
  goal: number;
  met: boolean;
}
export interface EvolutionStatus {
  groups: Requirement[][];
  data: Requirement[];
  parent: boolean;
  stage: boolean;
  ready: boolean;
  achieved: boolean;
}
export function stageLimit(r: Run): number {
  const shortRun = r.chapterRows === 8; // 旧版两章存档
  return r.bosses >= (shortRun ? 2 : 3)
    ? 3
    : r.bosses >= (shortRun ? 1 : 2)
      ? 2
      : r.row >= 3
        ? 1
        : 0;
}
export function evolutionStatus(r: Run | null, meta: Meta, id: string): EvolutionStatus {
  const d = EVOLUTIONS[id];
  const groups = d.groups.map((group) =>
    group.map((t) => {
      const current = r
        ? t.card
          ? (r.activity.cards[t.card] ?? 0)
          : (r.activity.counts[t.metric!] ?? 0)
        : 0;
      return {
        label: t.label ?? METRIC_NAMES[t.metric!],
        current,
        goal: t.goal,
        met: current >= t.goal,
      };
    }),
  );
  const data: Requirement[] = [];
  if (id === 'blackrapidmon' && r?.form === 'galgomon')
    data.push({
      label: '机械研究（跨局）',
      current: meta.unlockedRoutes.includes('mechanical') ? 1 : 0,
      goal: 1,
      met: meta.unlockedRoutes.includes('mechanical'),
    });
  if (id === 'chaosdukemon')
    data.push({
      label: '混沌资料（跨局）',
      current: meta.unlockedRoutes.includes('chaos') ? 1 : 0,
      goal: 1,
      met: meta.unlockedRoutes.includes('chaos'),
    });
  if (id === 'sakuyamon' && r?.form === 'doumon') {
    data.push({
      label: '净化资料（跨局）',
      current: meta.unlockedRoutes.includes('purification') ? 1 : 0,
      goal: 1,
      met: meta.unlockedRoutes.includes('purification'),
    });
    groups.push(
      [
        {
          label: '主动防御',
          current: r.activity.counts.defenses ?? 0,
          goal: 12,
          met: (r.activity.counts.defenses ?? 0) >= 12,
        },
      ],
      [
        {
          label: '消耗符印',
          current: r.activity.counts.markBursts ?? 0,
          goal: 5,
          met: (r.activity.counts.markBursts ?? 0) >= 5,
        },
      ],
    );
  }
  const parent = !!r && d.partner === r.partner && d.parents.includes(r.form),
    stage =
      !!r &&
      d.stage === r.stage + 1 &&
      d.stage <= stageLimit(r) &&
      (d.stage !== 1 || r.victories >= 2);
  const achieved = !!r && r.formHistory.includes(id);
  return {
    groups,
    data,
    parent,
    stage,
    achieved,
    ready: parent && stage && data.every((x) => x.met) && groups.every((g) => g.some((x) => x.met)),
  };
}
export function nextEvolutions(r: Run): EvolutionDef[] {
  return Object.values(EVOLUTIONS).filter(
    (d) => d.partner === r.partner && d.stage === r.stage + 1 && d.parents.includes(r.form),
  );
}
// 界面预览与结算共用：新招式直接赠送，强化招式作用于已有拷贝。
export function evolutionCardGains(r: Run, form: string) {
  const d = EVOLUTIONS[form];
  const upgradeIds = d.signatureUpgrade ? (EVOLUTIONS[r.form]?.cards ?? []) : [];
  return {
    newIds: d.cards.filter((id) => !upgradeIds.includes(id)),
    upgradeIds,
  };
}
export const stageName = (stage: number) => ['成长期', '成熟期', '完全体', '究极体'][stage];
export const stageRequirement = (stage: number, chapterRows = 10) =>
  [
    '初始搭档',
    '到达第1章第4层；赢得2场战斗',
    chapterRows === 8 ? '击败第1章首领' : '击败第2章首领',
    chapterRows === 8 ? '击败第2章首领' : '击败第3章首领',
  ][stage];
// 当前形态仍可企及的进化形态所需的行为指标：沿进化图向后遍历，只收集目标形态
// 条件中出现的指标，战后结算只展示这些，避免无关计数刷屏。咲耶兽/公爵兽的
// 额外继承条件不在 groups 里，单独补上。
export function relevantMetrics(r: Run): Set<Metric> {
  const reachable = new Set<string>();
  const queue = [r.form];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const d of Object.values(EVOLUTIONS))
      if (d.partner === r.partner && d.parents.includes(cur) && !reachable.has(d.id)) {
        reachable.add(d.id);
        queue.push(d.id);
      }
  }
  const metrics = new Set<Metric>();
  for (const id of reachable)
    for (const group of EVOLUTIONS[id].groups)
      for (const t of group) if (t.metric) metrics.add(t.metric);
  if (reachable.has('sakuyamon')) metrics.add('defenses').add('markBursts');
  if (reachable.has('dukemon')) metrics.add('defenses');
  return metrics;
}
export function activityGains(before: Activity, after: Activity, relevant?: Set<Metric>): string[] {
  return (Object.keys(METRIC_NAMES) as Metric[])
    .filter(
      (k) => (after.counts[k] ?? 0) > (before.counts[k] ?? 0) && (!relevant || relevant.has(k)),
    )
    .map((k) => `${METRIC_NAMES[k]} +${(after.counts[k] ?? 0) - (before.counts[k] ?? 0)}`);
}
export const formName = (id: string) => FORM_NAMES[id] ?? id;

// 说明合法转线对旧牌的影响；形态被动替换，训练与单独选择的继承仍保留。
export function evolutionTransition(from: string, to: string): string | null {
  const hints: Record<string, string> = {
    'guilmon/growlmon':
      '火球先叠灼烧，再用双刃斩或烈焰引爆追击；每回合首次攻击带灼烧目标额外＋2总伤害。',
    'guilmon/blackgrowmon': '火焰转为暗炎，自损换取更高伤害；解锁共享的烈焰引爆，可主动消费灼烧。',
    'growlmon/wargrowlmon':
      '烈焰追击的＋2总伤害改为首次实际灼烧获得2护盾；余烬护甲兼顾叠火与守护，炎核重炮消耗初始蓄能并施加灼烧。',
    'blackgrowmon/wargrowlmon':
      '暗炎额外＋1改为首次实际灼烧获得2护盾；保留已学暗炎与引爆，获得余烬护甲与炎核重炮，转向灼烧守护和炮击。',
    'blackgrowmon/blackwargrowlmon':
      '暗炎额外＋1改为首次自损返1行动力；保留暗炎与引爆，获得危险过载和生命汲取，开始自损后恢复。',
    'wargrowlmon/dukemon':
      '首次灼烧护盾与初始蓄能改为首次提供护盾的牌额外＋3护盾；余烬护甲仍能触发，皇家枪击将攻防合为一张牌。',
    'wargrowlmon/megidramon':
      '首次灼烧护盾与初始蓄能改为首次实际灼烧额外＋2；旧火焰和引爆转为群体爆发的准备。',
    'blackwargrowlmon/megidramon':
      '首次自损返能改为首次实际灼烧额外＋2；危险过载仍返能抽牌，但少了形态额外返能，生命汲取可补偿灭世烈焰的自损。',
    'blackwargrowlmon/chaosdukemon':
      '首次自损返1行动力改为获得6护盾；血色利刃不再由被动抵消费用，危险过载少返1行动力，生命汲取与混沌枪击帮助恢复。',
  };
  return EVOLUTIONS[to]?.parents.includes(from) ? (hints[`${from}/${to}`] ?? null) : null;
}
