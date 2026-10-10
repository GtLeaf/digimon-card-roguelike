import { CARDS } from './data';
import { ROUTE_DATA } from './evolution';
import type { Meta, Run } from './types';

interface EventEffect {
  hpCost?: number;
  goldCost?: number;
  heal?: number;
  gold?: number;
  card?: 'upgrade' | 'remove';
  autoUpgrade?: boolean;
  potion?: boolean;
  training?: Run['training'];
  routes?: string[];
  partner?: string;
}
export interface EventChoice {
  id: 'risk' | 'safe';
  title: string;
  text: string;
  effect: EventEffect;
}
export interface StoryEvent {
  id: string;
  title: string;
  story: string;
  hint: string;
  choices: EventChoice[];
}
export const EVENTS: Record<string, StoryEvent> = {
  reader: {
    id: 'reader',
    title: '损坏的读卡器',
    story: '废墟里的读卡器仍在发出信号。搭档守在身旁，等你决定是否修复它。',
    hint: '生命换资源 / 安全恢复',
    choices: [
      {
        id: 'risk',
        title: '接通不稳定电源',
        text: '失去8生命（最低保留1），获得35金币，强化第一张未强化的非防御插件牌。',
        effect: { hpCost: 8, gold: 35, autoUpgrade: true },
      },
      { id: 'safe', title: '在这里休息', text: '回复10生命。', effect: { heal: 10 } },
    ],
  },
  shelter: {
    id: 'shelter',
    title: '临时避难所',
    story: '避难所里留着一张整理卡片的工作台。远处的警报暂时无法打扰你们。',
    hint: '恢复 / 付费删牌',
    choices: [
      {
        id: 'risk',
        title: '整理冗余数据',
        text: '支付15金币，选择移除一张牌；至少保留5张。',
        effect: { goldCost: 15, card: 'remove' },
      },
      { id: 'safe', title: '让搭档睡一会儿', text: '回复18生命。', effect: { heal: 18 } },
    ],
  },
  laboratory: {
    id: 'laboratory',
    title: '废弃实验室',
    story: '实验设备还剩一点能源。你可以用它校准一张卡，也可以带走还能使用的零件。',
    hint: '指定强化 / 获得金币',
    choices: [
      {
        id: 'risk',
        title: '校准卡片',
        text: '支付25金币，选择强化一张未强化卡。',
        effect: { goldCost: 25, card: 'upgrade' },
      },
      { id: 'safe', title: '回收零件', text: '获得15金币。', effect: { gold: 15 } },
    ],
  },
  training: {
    id: 'training',
    title: '训练终端',
    story: '一段旧训练程序等待接入。搭档可以练习冲刺，也可以学习如何挡住下一次攻击。',
    hint: '训练方向 / 成熟期起生效',
    choices: [
      {
        id: 'risk',
        title: '练习主动出击',
        text: '失去5生命（最低保留1），获得10金币，训练改为进攻：成熟期起攻击每段＋1。',
        effect: { hpCost: 5, gold: 10, training: 'attack' },
      },
      {
        id: 'safe',
        title: '练习守护',
        text: '训练改为守护：成熟期起每回合开始＋3护盾。',
        effect: { training: 'defense' },
      },
    ],
  },
  research: {
    id: 'research',
    title: '失控机械档案',
    story:
      '档案中交织着机械设计与被污染的记忆。安全修复能还原资料，深入读取则可能找到混沌进化的线索。',
    hint: '永久路线资料',
    choices: [
      {
        id: 'risk',
        title: '读取混沌记忆',
        text: '失去8生命（最低保留1），永久解锁混沌资料；本局进化仍需满足行为条件。',
        effect: { hpCost: 8, routes: ['chaos'] },
      },
      {
        id: 'safe',
        title: '修复并净化档案',
        text: '永久解锁机械研究与净化资料；本局进化仍需满足行为条件。',
        effect: { routes: ['mechanical', 'purification'] },
      },
    ],
  },
  supply: {
    id: 'supply',
    title: '流浪补给商',
    story: '商人从行囊里翻出一张恢复磁盘，也愿意收走你们沿途拾到的旧零件。',
    hint: '补充消耗品 / 获得金币',
    choices: [
      {
        id: 'risk',
        title: '购买恢复磁盘',
        text: '支付20金币，获得1个恢复磁盘，最多携带2个。',
        effect: { goldCost: 20, potion: true },
      },
      { id: 'safe', title: '出售旧零件', text: '获得10金币。', effect: { gold: 10 } },
    ],
  },
  rescue: {
    id: 'rescue',
    title: '幼兽的求救',
    story:
      '废墟深处传来微弱的鸣叫：一只黑大耳兽被困在崩塌的数据碎片下。附近的旧信标还能发送救援位置。',
    hint: '获得支援伙伴 / 求援与回收',
    choices: [
      {
        id: 'risk',
        title: '伸出援手',
        text: '失去6生命（最低保留1），黑大耳兽加入支援伙伴。',
        effect: { hpCost: 6, partner: 'lopmon' },
      },
      {
        id: 'safe',
        title: '发送救援位置后离开',
        text: '向救援站发送位置，回收信标零件，获得6金币。',
        effect: { gold: 6 },
      },
    ],
  },
  spring: {
    id: 'spring',
    title: '数据之泉',
    story:
      '清澈的数据泉在废墟间流淌，泉心能洗去卡片中的冗余数据。搭档可以忍受冲击，引导一张卡片沉入泉心。',
    hint: '生命换删牌 / 安全恢复',
    choices: [
      {
        id: 'risk',
        title: '让泉心洗去冗余',
        text: '失去10生命（最低保留1），选择移除一张牌；至少保留5张。',
        effect: { hpCost: 10, card: 'remove' },
      },
      { id: 'safe', title: '饮一口泉水', text: '回复14生命。', effect: { heal: 14 } },
    ],
  },
  blackmarket: {
    id: 'blackmarket',
    title: '黑市摊位',
    story:
      '蒙面商人摆出来路不明的校准设备。改装价格低廉，但搭档需要承受不稳定电流；商人也收购旧零件。',
    hint: '低价强化与生命代价 / 出售零件',
    choices: [
      {
        id: 'risk',
        title: '接受不稳定改装',
        text: '支付15金币，失去5生命（最低保留1），选择强化一张未强化卡。',
        effect: { goldCost: 15, hpCost: 5, card: 'upgrade' },
      },
      { id: 'safe', title: '卖点旧零件', text: '获得12金币。', effect: { gold: 12 } },
    ],
  },
  echo: {
    id: 'echo',
    title: '回响信号',
    story:
      '一段陌生的信号从旧接收器传来，仿佛在邀请搭档追踪它。深入追踪耗神，拆下接收器则能回收一些零件。',
    hint: '生命换金币 / 小额回收',
    choices: [
      {
        id: 'risk',
        title: '追踪信号源头',
        text: '失去12生命（最低保留1），获得55金币。',
        effect: { hpCost: 12, gold: 55 },
      },
      { id: 'safe', title: '回收信号接收器', text: '获得8金币。', effect: { gold: 8 } },
    ],
  },
};
export const eventFor = (run: Run): StoryEvent | undefined =>
  run.currentNode?.eventId ? EVENTS[run.currentNode.eventId] : undefined;
export function storyEventFor(run: Run): StoryEvent {
  return (
    eventFor(run) ?? {
      ...EVENTS.reader,
      title: '废墟里的一束光。',
      choices: EVENTS.reader.choices.map((choice) =>
        choice.id === 'safe' && Math.floor(run.row / run.chapterRows) === 1
          ? {
              ...choice,
              effect: { ...choice.effect, routes: ['mechanical', 'purification'] },
              text: '回复10生命，永久解锁机械研究与净化资料。',
            }
          : choice,
      ),
    }
  );
}
export function eligibleEventCards(run: Run, choice: EventChoice) {
  return run.deck.filter((c) => (choice.effect.card === 'upgrade' ? !c.upgraded : true));
}
export function eventChoiceBlock(run: Run, choice: EventChoice): string {
  const e = choice.effect;
  if (run.gold < (e.goldCost ?? 0)) return `还差 ${(e.goldCost ?? 0) - run.gold} 金币`;
  if (e.potion && run.potions >= 2) return '恢复磁盘已满 2/2';
  if (e.card === 'remove' && run.deck.length <= 5) return '至少保留5张牌';
  if (e.card && !eligibleEventCards(run, choice).length) return '没有可选择的卡牌';
  return '';
}
export function eventChoicePreview(run: Run, choice: EventChoice): string[] {
  if (eventChoiceBlock(run, choice)) return [];
  const e = choice.effect,
    lines: string[] = [];
  if (e.hpCost || e.heal) {
    const hp = Math.min(run.maxHp, Math.max(1, run.hp - (e.hpCost ?? 0)) + (e.heal ?? 0));
    lines.push(`生命 ${run.hp} → ${hp}${hp === run.hp ? ' · 无变化' : ''}`);
  }
  if (e.goldCost || e.gold)
    lines.push(`金币 ${run.gold} → ${run.gold - (e.goldCost ?? 0) + (e.gold ?? 0)}`);
  if (e.potion) lines.push(`磁盘 ${run.potions} → ${run.potions + 1}/2`);
  if (e.card === 'remove') lines.push(`卡组 ${run.deck.length} → ${run.deck.length - 1} 张`);
  if (e.card === 'upgrade') lines.push('选择一张牌强化 · 本局生效');
  if (e.autoUpgrade)
    lines.push(
      run.deck.some((card) => !card.upgraded && card.id !== 'guard')
        ? '自动强化一张牌 · 本局生效'
        : '无可强化卡牌',
    );
  if (e.training) lines.push(`训练：${e.training === 'attack' ? '进攻' : '守护'} · 本局生效`);
  return lines;
}
// 仅验证通过后提交效果；选择卡片前不扣金币，重复点击由事件页面状态拦截。
export function applyEvent(run: Run, meta: Meta, choiceId: 'risk' | 'safe', uid?: string): boolean {
  const event = storyEventFor(run),
    choice = event.choices.find((c) => c.id === choiceId);
  if (!choice || eventChoiceBlock(run, choice)) return false;
  const e = choice.effect,
    card = e.card ? eligibleEventCards(run, choice).find((c) => c.uid === uid) : undefined;
  if (e.card && !card) return false;
  const changes = eventChoicePreview(run, choice).filter(
    (text) => !text.startsWith('自动强化') && !text.startsWith('选择一张牌'),
  );
  const newRoutes = e.routes?.filter((route) => !meta.unlockedRoutes.includes(route)) ?? [];
  run.gold = run.gold - (e.goldCost ?? 0) + (e.gold ?? 0);
  run.hp = Math.min(run.maxHp, Math.max(1, run.hp - (e.hpCost ?? 0)) + (e.heal ?? 0));
  if (e.card === 'upgrade' && card) card.upgraded = true;
  if (e.card === 'remove' && card) run.deck = run.deck.filter((c) => c.uid !== card.uid);
  if (e.autoUpgrade) {
    const c = run.deck.find((c) => !c.upgraded && c.id !== 'guard');
    if (c) {
      c.upgraded = true;
      changes.push(`已强化：${CARDS[c.id].name}`);
    }
  }
  if (e.potion) run.potions++;
  if (e.training) run.training = e.training;
  if (e.partner && !meta.partners.includes(e.partner)) meta.partners.push(e.partner);
  for (const route of e.routes ?? [])
    if (!meta.unlockedRoutes.includes(route)) meta.unlockedRoutes.push(route);
  if (card) changes.push(`已${e.card === 'remove' ? '移除' : '强化'}：${CARDS[card.id].name}`);
  if (newRoutes.length)
    changes.push(`永久解锁：${newRoutes.map((route) => ROUTE_DATA[route].name).join('、')}`);
  run.message = `${event.title} · ${choice.title}：${changes.join('；')}`;
  return true;
}
