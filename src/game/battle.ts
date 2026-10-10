import { weightedOffers } from './cardSkills';
import {
  BRANCHES,
  CARDS,
  ENEMIES,
  RELICS,
  needsTarget,
  cardDefinition,
  copyCandidates,
  MAX_COPIES_PER_TURN,
} from './data';
import {
  EVOLUTIONS,
  emptyActivity,
  syncRouteData,
  activityGains,
  relevantMetrics,
  hasEvolutionOpportunity,
} from './evolution';
import { enemyPhase, expandedIntent } from './enemyRules';
import { PASSIVES, devourCap, gainDevour, type HookCtx, type PassiveHooks } from './hooks';
import { choose, makeCard, rand, shuffle } from './random';
import type {
  Battle,
  BattleNumber,
  Card,
  CardDef,
  Enemy,
  Intent,
  MapNode,
  Meta,
  Metric,
  Run,
} from './types';

// —— 被动钩子发射 ——
const passiveList = (r: Run) =>
  [...new Set([r.partner, r.form, r.branch])]
    .map((k) => PASSIVES[k!])
    .filter((h): h is PassiveHooks => !!h);
const hasHook = (r: Run, key: keyof PassiveHooks) => passiveList(r).some((h) => h[key]);
const fire = (r: Run, fn: (h: PassiveHooks, c: HookCtx) => void) => {
  const list = passiveList(r);
  if (!list.length) return;
  const b = r.battle;
  if (!b) return;
  const c = ctx(r, b);
  list.forEach((h) => fn(h, c));
};
const sum = (r: Run, fn: (h: PassiveHooks, c: HookCtx) => number | undefined) => {
  const list = passiveList(r);
  if (!list.length) return 0;
  const b = r.battle;
  if (!b) return 0;
  const c = ctx(r, b);
  return list.reduce((t, h) => t + (fn(h, c) ?? 0), 0);
};
const ctx = (r: Run, b: Battle, meta?: Meta): HookCtx => ({
  r,
  b,
  meta,
  log: (msg) => log(b, msg),
  draw: (n) => draw(r, n),
  count: (key) => count(r, key),
  hit: (e, amount, attack) => hit(r, e, amount, attack),
});

export function cardCost(c: Card): number {
  return cardDefinition(c).cost;
}
// 斗牛士兽 · 觉醒被动：每回合第二张攻击牌不消耗行动力。
export function playCost(r: Run | null | undefined, c: Card): number {
  const b = r?.battle;
  if (b && r!.form === 'matadormonAwakened' && CARDS[c.id].kind === 'attack' && b.attackPlays === 1)
    return 0;
  return cardCost(c);
}
function currentIntent(r: Run, e: Enemy): Intent {
  const b = r.battle;
  const turn = b?.turn ?? 1;
  const phase = enemyPhase(turn, e);
  const ch = Math.floor(r.row / r.chapterRows);
  const style = ENEMIES[e.id].style;
  let i: Intent = {
    name: '攻击',
    type: 'attack',
    damage: 6 + ch * 2,
    hits: 1,
    shield: 0,
    detail: '对搭档造成伤害。',
  };
  if (style === 'charge')
    i =
      phase === 1
        ? {
            name: '蓄力',
            type: 'buff',
            damage: 0,
            hits: 0,
            shield: 0,
            detail: '准备下一回合的重击。',
          }
        : {
            ...i,
            name: phase === 2 ? '重击' : '爪击',
            damage: phase === 2 ? 16 + ch * 3 : 7 + ch * 2,
          };
  if (style === 'shield')
    i =
      phase === 0
        ? {
            name: '充能护盾',
            type: 'block',
            damage: 0,
            hits: 0,
            shield: 8 + ch * 3,
            detail: '获得护盾，随后发动放电。',
          }
        : { ...i, name: '放电', damage: 8 + ch * 2 };
  if (style === 'jam' || style === 'spider')
    i =
      phase === 0
        ? {
            name: style === 'spider' ? '蛛网封锁' : '数据干扰',
            type: 'debuff',
            damage: 0,
            hits: 0,
            shield: 0,
            detail: `加入 ${style === 'spider' ? 2 : 1} 张数据故障牌到弃牌堆。`,
          }
        : { ...i, name: '侵蚀', damage: 7 + ch * 2 };
  if (style === 'buff')
    i =
      phase === 0
        ? {
            name: '鼓舞',
            type: 'buff',
            damage: 0,
            hits: 0,
            shield: 0,
            detail:
              e.id === 'replica' && e.summonedBy
                ? '所有存活敌人每段攻击伤害＋1，力量至多6；击败复制体可阻止后续鼓舞。'
                : '所有存活敌人每段攻击伤害＋2。',
            strength: e.id === 'replica' && e.summonedBy ? 1 : 2,
            ...(e.id === 'replica' && e.summonedBy ? { strengthCap: 6 } : {}),
          }
        : { ...i, name: '恶魔飞镖', damage: 5 + ch * 2 };
  if (style === 'evade')
    i = { ...i, name: '幽影攻击', damage: 7, detail: '本回合第一段受到的攻击伤害减半。' };
  if (style === 'rapid')
    i =
      phase === 2
        ? {
            name: '重新装填',
            type: 'block',
            damage: 0,
            hits: 0,
            shield: 6,
            detail: '重新装填弹药，并获得 6 护盾。',
          }
        : {
            ...i,
            name: '连续射击',
            damage: 3 + ch,
            hits: 2,
          };
  // 四拍总伤54：连射、压制射击、加农、装填；炮击回合的直接伤害可削弱加农。
  if (e.id === 'beelzebumon') {
    const cycle = enemyPhase(turn, e, 4),
      suppressed = e.stagger >= 18;
    i =
      cycle === 3
        ? {
            name: '重新装填',
            type: 'block',
            damage: 0,
            hits: 0,
            shield: 12,
            detail: '获得12护盾，本回合不攻击；装填后连射、压制射击、死亡加农依次循环。',
          }
        : (e.devour ?? 0) >= 2 || cycle === 2
          ? {
              name: '死亡加农',
              type: 'attack',
              damage: suppressed ? 14 : 21,
              hits: 1,
              shield: 0,
              detail: suppressed
                ? '炮击已受压制：基础伤害21降至14，仍会发射并清空噬能。'
                : `本回合造成18直接生命伤害（${e.stagger}/18），可将本次炮击基础伤害21降至14。攻击、引爆与支援等直接伤害计入；护盾吸收与灼烧持续伤害不计。发射后清空噬能。`,
            }
          : {
              name: cycle === 1 ? '压制射击' : '连续射击',
              type: 'attack',
              damage: cycle === 1 ? 5 : 6,
              hits: 3,
              shield: 0,
              detail:
                cycle === 1
                  ? '三连射击，并积攒1层噬能；下回合死亡加农基础伤害21，炮击当回合造成18直接生命伤害可削弱至14。'
                  : '三连射击，并积攒1层噬能；随后压制射击，再释放死亡加农。',
            };
  }
  if (style === 'chicken')
    i =
      phase === 0
        ? {
            name: '电荷储存',
            type: 'block',
            damage: 0,
            hits: 0,
            shield: 9,
            detail: '获得 9 护盾。',
          }
        : {
            ...i,
            name: phase === 1 ? '电荷反应' : '雷击',
            damage: phase === 1 ? 4 + (b?.played ?? 0) * 2 : 16,
            detail: phase === 1 ? '本回合每打出一张牌，本次攻击伤害＋2。' : '强力雷击。',
          };
  if (style === 'sword')
    i =
      phase === 1
        ? {
            name: '防御架势',
            type: 'block',
            damage: 0,
            hits: 0,
            shield: 14,
            detail: '获得 14 护盾。',
          }
        : { ...i, name: '连续斩击', damage: 6 + ch * 2, hits: 2 };
  if (style === 'core')
    i =
      phase === 0
        ? {
            name: '数据删除',
            type: 'debuff',
            damage: 0,
            hits: 0,
            shield: 0,
            detail: '加入 2 张故障牌，核心获得 8 护盾。',
          }
        : phase === 1
          ? { ...i, name: '侵蚀光束', damage: 9, hits: 2 }
          : { ...i, name: '终末脉冲', damage: 24 };
  if (e.id === 'devidramon' && phase === 2 && e.stagger >= 20)
    i = {
      name: '重击被打断',
      type: 'block',
      damage: 0,
      hits: 0,
      shield: 0,
      detail: '本回合已承受 20 点攻击伤害，重击被打断。',
    };
  i = expandedIntent(r, e) ?? i;
  // 软狂暴仅作用于首领本体。别西卜兽按整次行动预算分配，其余首领沿用逐段加伤。
  const enrage = enemyEnrage(r, e);
  if (i.type === 'attack') {
    i.damage = Math.max(
      0,
      Math.round(i.damage * (e.damageScale ?? 1)) +
        e.strength +
        (e.id === 'beelzebumon' ? enrage / i.hits : enrage) -
        e.weakened,
    );
    if (e.rogue && i.damage > 0) i.damage = Math.max(1, i.damage - 2);
  }
  return i;
}

// 别西卜兽返回每次行动的额外总伤（13～14回合＋3，15回合起＋6）；其余返回每段增伤。
export const enemyEnrage = (r: Run, e: Enemy) => {
  if (r.currentNode?.kind !== 'boss' || e.summonedTurn !== undefined) return 0;
  const elapsed = Math.max(0, (r.battle?.turn ?? 1) - 12);
  return e.id === 'beelzebumon'
    ? Math.min(6, Math.ceil(elapsed / 2) * 3)
    : Math.min(6, elapsed * 2);
};

// 预告在副本上按实际行动顺序推演；不改变随机状态、牌堆或日志。
// 已行动敌人的增益已包含在当前状态中，不能再次应用。
export function enemyIntents(r: Run): Map<string, Intent> {
  const b = r.battle;
  if (!b) return new Map();
  const simulated: Run = { ...r, battle: { ...b, enemies: b.enemies.map((e) => ({ ...e })) } };
  const next = simulated.battle!;
  const plans = new Map(b.enemies.map((e) => [e.uid, currentIntent(r, e)]));
  for (let index = b.enemyTurnIndex ?? 0; index < next.enemies.length; index++) {
    const e = next.enemies[index];
    if (e.hp <= 0) continue;
    if (e.summonedTurn === b.turn) {
      plans.set(e.uid, {
        name: '增援待机',
        type: 'block',
        damage: 0,
        hits: 0,
        shield: 0,
        detail: '入场当回合不行动，下回合开始行动。',
      });
      continue;
    }
    const plan = currentIntent(simulated, e);
    plans.set(e.uid, plan);
    const before = simulated.hp;
    if (plan.type === 'attack') applyEnemyAttack(simulated, e, plan);
    applyEnemyEffects(next, e, plan, before - simulated.hp);
  }
  return plans;
}

export function intent(r: Run, e: Enemy): Intent {
  return enemyIntents(r).get(e.uid) ?? currentIntent(r, e);
}

export function enemyCountdown(r: Run, e: Enemy): string | undefined {
  const turn = r.battle?.turn ?? 1;
  if (e.id === 'beelzebumon') {
    const phase = enemyPhase(turn, e, 4);
    if (phase === 3) return '装填窗口';
    return phase === 2 || (e.devour ?? 0) >= 2
      ? e.stagger >= 18
        ? '加农已压制'
        : `炮击压制 ${e.stagger}/18`
      : `加农还有${2 - phase}回合`;
  }
  if (e.id === 'belphemon') {
    const phase = enemyPhase(turn, e);
    return phase === 2 ? '本回合觉醒' : `觉醒还有${2 - phase}回合`;
  }
  if (e.id === 'core') {
    const phase = enemyPhase(turn, e, 4);
    return phase === 3 ? '脉冲就绪' : `脉冲还有${3 - phase}回合`;
  }
}

export function cardTarget(r: Run, d: CardDef, target?: string): Enemy | undefined {
  const enemies = r.battle?.enemies ?? [];
  const chosen = enemies.find((e) => e.uid === target && e.hp > 0) ?? enemies.find((e) => e.hp > 0);
  if (!chosen || d.kind !== 'attack' || d.all || ENEMIES[chosen.id].guard) return chosen;
  return enemies.find((e) => e.hp > 0 && e.uid !== chosen.uid && ENEMIES[e.id].guard) ?? chosen;
}
export const log = (b: Battle, s: string) => {
  b.log = [s, ...b.log].slice(0, 12);
};
function draw(r: Run, n: number) {
  const b = r.battle;
  if (!b) return;
  for (let i = 0; i < n; i++) {
    if (!b.draw.length) {
      b.draw = shuffle(r, b.discard);
      b.discard = [];
    }
    const c = b.draw.pop();
    if (!c) break;
    if (b.hand.length < 8) b.hand.push(c);
    else b.discard.push(c);
  }
}
export function beginBattle(r: Run, node: MapNode) {
  const ch = Math.floor(r.row / r.chapterRows);
  const boss = node.kind === 'boss';
  const scaled = (id: string, index: number) => {
    const hp = Math.ceil(
      ENEMIES[id].hp * (node.enemyModifiers?.[index]?.hpScale ?? 1) * (boss ? 1 : 1 + 0.08 * ch),
    );
    return { hp, maxHp: hp, block: boss ? 0 : 2 * ch, strength: Math.max(0, ch - (boss ? 3 : 2)) };
  };
  r.battle = {
    activity: emptyActivity(),
    startActivity: structuredClone(r.activity),
    selfCostThisTurn: false,
    countedKills: [],
    enemies: node.enemies.map((id, index) => {
      const s = scaled(id, index);
      return {
        uid: `${node.id}-e${index}`,
        id,
        hp: s.hp,
        maxHp: s.maxHp,
        block: s.block,
        burn: 0,
        mark: 0,
        strength: s.strength,
        weakened: 0,
        opening: true,
        stagger: 0,
        devour: 0,
        ...(node.enemyModifiers?.[index]?.phaseOffset !== undefined
          ? { phaseOffset: node.enemyModifiers[index].phaseOffset }
          : {}),
        ...(node.enemyModifiers?.[index]?.damageScale !== undefined
          ? { damageScale: node.enemyModifiers[index].damageScale }
          : {}),
      };
    }),
    hand: [],
    draw: shuffle(r, r.deck),
    discard: [],
    exhaust: [],
    turn: 1,
    enemyTurnIndex: null,
    energy: 3 + (r.relics.includes('battery') ? 1 : 0),
    block: r.relics.includes('armor') ? 3 : 0,
    sync: r.blessing === 'bond' ? 2 : 0,
    syncThisTurn: 0,
    burst: 0,
    burstUsed: false,
    supportUsed: r.support === 'default' && r.supportSpent,
    strength: 0,
    charge: 0,
    played: 0,
    skillsPlayed: 0,
    attacks: 0,
    attackPlays: 0,
    nextAttackBonus: 0,
    nextAttackHits: 0,
    cannonGuardUsed: false,
    copyUses: 0,
    burnFollowupUsed: false,
    burned: false,
    marked: false,
    defended: false,
    weakenedThisTurn: false,
    markedThisTurn: false,
    markBurstThisTurn: false,
    devour: 0,
    devourCapBonus: 0,
    log: ['连接建立。先观察敌人的行动意图。'],
    feedback: [],
  };
  // 进化获得的新卡洗入抽牌堆前半段（抽牌从堆尾 pop，牌堆顶在数组末端），确保进化后尽快上手
  if (r.spotlight?.length) {
    const drawPile = r.battle.draw;
    for (const uid of r.spotlight) {
      const idx = drawPile.findIndex((c) => c.uid === uid);
      if (idx < 0) continue;
      const [c] = drawPile.splice(idx, 1);
      const front = Math.ceil((drawPile.length + 1) / 2);
      const p = Math.floor(rand(r) * front); // 抽牌顺序中的位置：0 = 牌堆顶
      drawPile.splice(drawPile.length - p, 0, c);
    }
    r.spotlight = [];
  }
  const b = r.battle;
  fire(r, (h, c) => h.battleStart?.(c));
  if (r.relics.includes('capacitor')) {
    gainDevour(b, 1);
    log(b, `噬能电容器 · 噬能 ＋1（当前 ${b.devour}）`);
  }
  if (r.relics.includes('magazine')) {
    b.charge++;
    log(b, '过载弹匣 · 蓄能 ＋1');
  }
  if (r.training === 'defense' && r.stage > 0) b.block += 3;
  if (r.bonuses.includes('holyward')) b.block += 2;
  draw(r, 5 + (r.relics.includes('reader') ? 1 : 0) + (r.bonuses.includes('ritual') ? 1 : 0));
  r.screen = 'battle';
}
function count(r: Run, key: Metric) {
  const b = r.battle;
  if (!b) return;
  const used = b.activity.counts[key] ?? 0;
  if (used >= 10) return;
  b.activity.counts[key] = used + 1;
  r.activity.counts[key] = (r.activity.counts[key] ?? 0) + 1;
}
function burnKill(r: Run, e: Enemy) {
  const b = r.battle;
  if (b && e.hp <= 0 && e.burn > 0 && !b.countedKills.includes(e.uid)) {
    b.countedKills.push(e.uid);
    count(r, 'burnKills');
  }
}
// 击败触发：亡语（自爆／激励）；召唤者死亡后增援失控，每段伤害降低2但继续战斗。
function deathTrigger(r: Run, e: Enemy) {
  const b = r.battle;
  if (!b || e.deathDone) return;
  e.deathDone = true;
  const def = ENEMIES[e.id];
  if (def.onDeath === 'explode') {
    const absorbed = Math.min(b.block, 8);
    b.block -= absorbed;
    const before = r.hp;
    r.hp = Math.max(0, r.hp - (8 - absorbed));
    b.feedback.push({ target: 'player', kind: 'damage', amount: before - r.hp });
    log(b, `${def.name} · 自爆 ${before - r.hp}`);
  }
  if (def.onDeath === 'rally') {
    b.enemies.filter((x) => x.hp > 0).forEach((x) => (x.strength += 2));
    log(b, `${def.name} · 激励同伴`);
  }
  for (const m of b.enemies)
    if (m.summonedBy === e.uid && m.hp > 0 && !m.rogue) {
      m.rogue = true;
      log(b, `${ENEMIES[m.id].name} 失去指挥，失控继续战斗（攻击伤害 -2）。`);
    }
  count(r, 'kills');
  fire(r, (h, c) => h.onKill?.(c, e));
}
function hit(r: Run, e: Enemy, amount: number, attack = true, hitIndex?: number) {
  const b = r.battle;
  if (!b || e.hp <= 0) return;
  let damage = Math.max(0, amount);
  if (attack) {
    damage += b.strength + (b.burst > 0 ? 2 : 0);
    damage += sum(r, (h, c) => h.attackHitBonus?.(c, hitIndex));
    if (e.vulnerable) damage += e.vulnerable;
    if (r.training === 'attack' && r.stage > 0) damage += 1;
    if (r.relics.includes('cooler') && b.attacks < 3) damage++;
    b.attacks++;
    if (ENEMIES[e.id].style === 'evade' && e.opening) {
      damage = Math.floor(damage / 2);
      e.opening = false;
    }
  }
  const beforeBlock = e.block;
  const blocked = Math.min(e.block, damage);
  e.block -= blocked;
  if (e.id === 'machinedramon' && beforeBlock > 0 && e.block === 0) e.armorBroken = true;
  const actual = Math.min(e.hp, damage - blocked);
  e.hp -= actual;
  r.damageDealt += actual;
  e.stagger += actual;
  burnKill(r, e);
  b.feedback.push({ target: e.uid, kind: 'damage', amount: actual });
  if (e.hp <= 0) deathTrigger(r, e);
}
// 资源系装置只在本局用得上时才进入发放池，避免抽到对牌组零价值的死物。
const RELIC_RELEVANCE: Record<string, (r: Run, deck: CardDef[]) => boolean> = {
  capacitor: (r, deck) =>
    r.partner === 'impmon' || deck.some((d) => d.devour || d.convert || d.special === 'devour'),
  magazine: (r, deck) =>
    r.partner === 'terriermon' || deck.some((d) => d.charge || d.special === 'cannon'),
  firebrand: (r, deck) => deck.some((d) => d.burn) || r.branch === 'megidra',
  compass: (r, deck) => deck.some((d) => d.mark) || r.branch === 'sakuya' || r.branch === 'kuzuha',
  fang: (_r, deck) => deck.some((d) => d.drain || d.drainRatio),
};
export function awardRelic(r: Run) {
  const available = Object.keys(RELICS).filter((id) => !r.relics.includes(id));
  if (!available.length) {
    r.gold += 35;
    return undefined;
  }
  const deck = r.deck.map((c) => CARDS[c.id]);
  const relevant = available.filter((id) => RELIC_RELEVANCE[id]?.(r, deck) ?? true);
  const id = choose(r, relevant.length ? relevant : available);
  r.relics.push(id);
  return id;
}
function resolve(r: Run, meta: Meta) {
  if (r.hp <= 0) {
    r.hp = 0;
    r.screen = 'result';
    r.won = false;
    return;
  }
  const b = r.battle;
  if (!b || b.enemies.some((e) => e.hp > 0)) return;
  const node = r.currentNode;
  if (!node) return;
  const scans: { id: string; before: number; after: number }[] = [];
  for (const id of new Set(b.enemies.map((e) => e.id))) {
    if (!ENEMIES[id].scan) continue;
    const before = meta.scans[id] ?? 0;
    const after = Math.min(100, before + (node.kind === 'boss' ? 100 : 50));
    meta.scans[id] = after;
    scans.push({ id, before, after });
  }
  r.victories++;
  if (node.kind === 'boss') r.bosses++;
  const unlocks = syncRouteData(meta);
  r.kills += b.enemies.length;
  const gold = node.kind === 'boss' ? 65 : node.kind === 'elite' ? 45 : 24;
  r.gold += gold;
  if (r.relics.includes('memory')) {
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + 3);
    if (r.hp > before) b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
  }
  const relic = node.kind === 'elite' || node.kind === 'boss' ? awardRelic(r) : undefined;
  r.reward = {
    cards: weightedOffers(r, 3),
    gold,
    scans,
    relic,
    gains: activityGains(b.startActivity, r.activity, relevantMetrics(r)),
    unlocks,
  };
  r.screen = 'reward';
}
export function finishNode(r: Run) {
  if (r.currentNode && !r.path.includes(r.currentNode.id)) r.path.push(r.currentNode.id);
  r.row++;
  r.screen = 'map';
  r.battle = null;
  r.reward = null;
  r.currentNode = null;
}
export function afterReward(r: Run, meta: Meta) {
  if (r.currentNode?.kind === 'boss') {
    if (r.row === r.nodes.length - 1) {
      r.won = true;
      r.screen = 'result';
      meta.wins++;
      if (!r.path.includes(r.currentNode.id)) r.path.push(r.currentNode.id);
      return;
    }
    r.screen = hasEvolutionOpportunity(r) ? 'evolution' : 'blessing';
    r.evolutionReturn = 'node';
    return;
  }
  finishNode(r);
}
function spendDevour(r: Run, cap: number) {
  const b = r.battle;
  if (!b) return 0;
  const spent = Math.min(b.devour, cap);
  for (let i = 0; i < spent; i++) count(r, 'devourSpent');
  b.devour -= spent;
  return spent;
}
export function playCard(r: Run, meta: Meta, uid: string, target?: string, copyUid?: string) {
  const b = r.battle;
  if (!b) return;
  const index = b.hand.findIndex((c) => c.uid === uid);
  if (index < 0) return;
  const c = b.hand[index],
    d = cardDefinition(c);
  const cost = playCost(r, c);
  if (cost > b.energy) return;
  const copies = d.special === 'copy' ? copyCandidates(b.hand, uid) : [];
  const original = d.copyChoice ? copies.find((card) => card.uid === copyUid) : copies[0];
  if (d.special === 'copy' && b.copyUses >= MAX_COPIES_PER_TURN) return;
  if (d.copyChoice && !original) return;
  const chosen = cardTarget(r, d, target);
  if (needsTarget(d) && !chosen) return;
  b.energy -= cost;
  b.hand.splice(index, 1);
  if (d.kind === 'attack') {
    count(r, 'attacks');
    b.attackPlays++;
  }
  if (d.kind === 'skill' || d.kind === 'power') count(r, 'skills');
  if (d.burn || d.special === 'detonate') count(r, 'fire');
  if (c.copied) count(r, 'copies');
  if (!c.copied) {
    const series = d.series ?? d.id;
    const used = b.activity.cards[series] ?? 0;
    if (used < 3) {
      b.activity.cards[series] = used + 1;
      r.activity.cards[series] = (r.activity.cards[series] ?? 0) + 1;
    }
  }
  b.played++;
  if (d.kind === 'skill' || d.kind === 'power') b.skillsPlayed++;
  if ((d.kind === 'skill' || d.kind === 'power') && b.skillsPlayed === 2) count(r, 'combos');
  if (b.syncThisTurn < 3) {
    b.sync = Math.min(6, b.sync + 1);
    b.syncThisTurn++;
  }
  log(b, `${d.name}${c.upgraded ? '＋' : ''}`);

  let tacticalBonus = d.kind === 'attack' && d.damage ? b.nextAttackBonus : 0;
  if (tacticalBonus) b.nextAttackBonus = 0;
  // 风压推进：本回合下一张攻击牌增加段数，使用后消耗。
  const windupSpent = d.kind === 'attack' && d.damage ? b.nextAttackHits : 0;
  if (windupSpent) b.nextAttackHits = 0;
  // 深渊龙枪：本回合此前已自损过则追加伤害（先于本牌的自损结算判定）。
  const priorSelfCost = b.selfCostThisTurn;
  // 自损返还：记录出牌前已阵亡敌人数与实际自损量，结算后若新增击杀则返还。
  const deadBefore = d.refundSelfCostOnKill ? b.enemies.filter((e) => e.hp <= 0).length : 0;
  let selfCostRefund = 0;
  if (d.special === 'sacrifice') {
    const before = r.hp;
    r.hp = Math.max(0, r.hp - 3);
    if (d.refundSelfCostOnKill) selfCostRefund = before - r.hp;
    b.feedback.push({ target: 'player', kind: 'damage', amount: before - r.hp });
    count(r, 'selfCosts');
    if (!b.selfCostThisTurn) {
      fire(r, (h, cx) => h.onFirstSelfCost?.(cx));
      b.selfCostThisTurn = true;
    }
    if (!r.hp) {
      b.exhaust.push(c);
      resolve(r, meta);
      return;
    }
  }
  if (d.shield) {
    count(r, 'defenses');
    let shield = d.shield;
    if (!b.defended) {
      if (r.blessing === 'guard') shield += 3;
      shield += sum(r, (h, cx) => h.firstDefenseShield?.(cx));
      if (r.inherit === 'ward' && r.stage > 0) shield += 2;
      fire(r, (h, cx) => h.onFirstDefense?.(cx));
      b.defended = true;
    }
    if (d.devourShield) shield += spendDevour(r, 3) * d.devourShield;
    b.block += shield;
  }
  if (d.heal && r.hp < r.maxHp) {
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + d.heal);
    b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    count(r, 'heals');
  }
  if (d.devourHeal && r.hp < r.maxHp) {
    const spent = spendDevour(r, 3);
    if (spent) {
      const before = r.hp;
      r.hp = Math.min(r.maxHp, r.hp + spent * d.devourHeal);
      b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    }
  }
  if (d.energy) b.energy += d.energy;
  if (d.strength) b.strength += d.strength;
  if (d.charge) {
    b.charge += d.charge;
    count(r, 'charges');
  }
  if (d.devour) gainDevour(b, d.devour);
  if (d.special === 'devouraura') {
    b.devourCapBonus += 2;
    const gain = d.devourAuraGain ?? 2;
    gainDevour(b, gain);
    log(b, `噬能光环 · 噬能上限＋2，噬能 ＋${gain}（当前 ${b.devour}）`);
  }
  if (d.special === 'copy' && original && b.hand.length < 8) {
    b.copyUses++;
    b.hand.push({ ...makeCard(r, original.id, original.upgraded, true), copied: true });
  }
  if (d.special === 'purge') {
    const faults = b.hand.filter((x) => CARDS[x.id].kind === 'status');
    b.hand = b.hand.filter((x) => CARDS[x.id].kind !== 'status');
    b.exhaust.push(...faults);
  }
  // 谢幕回旋：本回合已打出攻击牌则返还 1 行动力。
  if (d.special === 'spinstep' && b.attackPlays > 0) {
    b.energy++;
    log(b, '谢幕回旋 · 行动力＋1');
  }
  // 风压推进：本回合下一张攻击牌段数增加。
  if (d.windupHits) {
    const n = d.windupHits;
    b.nextAttackHits += n;
    log(b, `${d.name} · 本回合下一张攻击牌段数＋${n}`);
  }
  // 式神·饭纲：本回合式神已苏醒（第二张技能牌起）则再抽 1 张。
  if (d.special === 'izuna' && b.skillsPlayed >= 2) {
    draw(r, 1);
    log(b, '式神·饭纲 · 式神呼应，再抽 1 张牌');
  }
  let bonus = b.charge > 0 ? (d.chargedDamage ?? 0) : 0;
  if (d.special === 'shieldhit') bonus += Math.floor(b.block / (d.shieldDiv ?? 2));
  // 深渊龙枪：本回合此前已自损过则追加伤害。
  if (d.selfCostBonus && priorSelfCost) bonus += d.selfCostBonus;
  // 致命穿刺：本回合第二张及以后的攻击牌伤害翻倍。
  if (d.multiAttackDouble && d.kind === 'attack' && b.attackPlays >= 2) bonus += d.damage ?? 0;
  if (d.special === 'cannon') {
    if (b.charge > 0) {
      count(r, 'cannonShots');
      if (!b.cannonGuardUsed && hasHook(r, 'onCannonCharge')) {
        fire(r, (h, cx) => h.onCannonCharge?.(cx));
        b.cannonGuardUsed = true;
      }
    }
    bonus += b.charge * (d.chargeMultiplier ?? 4);
    b.charge = 0;
  }
  if (d.special === 'devour')
    bonus +=
      spendDevour(r, d.devourAll ? devourCap(b) : 3) *
      ((d.devourPower ?? 4) + sum(r, (h, cx) => h.devourPowerBonus?.(cx)));
  // 恶梦冲击波：消耗全部噬能，每 N 层换 1 力量。
  if (d.devourStrength) {
    const spent = spendDevour(r, devourCap(b));
    const gain = Math.floor(spent / d.devourStrength);
    b.strength += gain;
    log(b, `${d.name} · 消耗 ${spent} 噬能，力量 ＋${gain}`);
  }
  // 巨型导弹：消耗至多 N 层蓄能，每层使每段伤害 +1（只取所需层数，不清空蓄能）。
  let chargeSegSpent = 0;
  if (d.chargeSeg && b.charge > 0) {
    chargeSegSpent = Math.min(b.charge, d.chargeSeg);
    b.charge -= chargeSegSpent;
  }
  const targets = d.all ? b.enemies.filter((e) => e.hp > 0) : chosen ? [chosen] : [];
  const beforeDamage = r.damageDealt;
  let appliedBurn = false,
    appliedMark = false,
    appliedWeak = false,
    detonated = false,
    consumedMark = false;
  const devourWeakSpent = d.devourWeak ? spendDevour(r, 3) : 0;
  // 疾风加农：消耗噬能换额外攻击段数（一次性消耗，对全目标生效）。
  const devourHitsLayers = d.devourHits ? spendDevour(r, d.devourHitsCap ?? 3) : 0;
  const devourHitsSpent = devourHitsLayers * (d.devourHits ?? 0);
  // 贝利亚吸血魔兽被动「消耗噬能每层＋2 伤害」同样覆盖噬能换段：
  // 换段的层数不直接加伤，折算为首段额外伤害（devourPowerBonus 通用钩子，其他路线为 0）。
  if (devourHitsLayers)
    tacticalBonus += devourHitsLayers * sum(r, (h, cx) => h.devourPowerBonus?.(cx));
  // 噬能侵蚀：噬能满 3 层才消耗并足额施加易伤，不足则不消耗、保底施加 1 层。
  const devourVulnSpent = d.devourVuln && b.devour >= 3 ? spendDevour(r, 3) : 0;
  const vulnGain = d.devourVuln
    ? devourVulnSpent
      ? d.devourVuln
      : (d.devourVulnFallback ?? 1)
    : 0;
  const burnBonus =
    !b.burned && d.burn
      ? sum(r, (h, cx) => h.firstBurnBonus?.(cx)) +
        (r.inherit === 'ember' && r.stage > 0 ? 1 : 0) +
        (r.relics.includes('firebrand') ? 1 : 0)
      : 0;
  const followup = (e: Enemy) => {
    if (
      r.form !== 'growlmon' ||
      d.kind !== 'attack' ||
      !d.damage ||
      e.burn <= 0 ||
      b.burnFollowupUsed
    )
      return 0;
    b.burnFollowupUsed = true;
    return 2;
  };
  if (d.scatter) {
    const struck = new Set<Enemy>();
    // 散射攻击：第 1 段锁定所选目标，其余段从存活敌人中随机索敌。
    // 逐段独立调用 hit()，每段产生独立伤害反馈，前端按段播放攻击动画。
    const totalSegs = (d.hits ?? 1) + devourHitsSpent + windupSpent;
    const segBase = (d.damage ?? 0) + chargeSegSpent + bonus;
    for (let h = 0; h < totalSegs; h++) {
      const alive = b.enemies.filter((e) => e.hp > 0);
      if (!alive.length) break;
      const t =
        h === 0 && chosen && chosen.hp > 0 ? chosen : alive[Math.floor(rand(r) * alive.length)];
      const hpBefore = t.hp;
      hit(
        r,
        t,
        segBase +
          followup(t) +
          (h === 0 ? tacticalBonus : 0) +
          sum(r, (hx, cx) => hx.hitBonusVsWeakened?.(cx, t, d)) +
          (d.executeBonus && t.hp * 2 < t.maxHp ? d.executeBonus : 0),
        true,
        h,
      );
      if (t.hp < hpBefore) struck.add(t);
    }
    if (d.kind === 'attack')
      for (const e of struck) e.effectiveAttacks = (e.effectiveAttacks ?? 0) + 1;
    tacticalBonus = 0;
  }
  for (const e of d.scatter ? [] : targets) {
    const hpBefore = e.hp;
    let pursuit = followup(e);
    let extra = bonus;
    extra += sum(r, (h, cx) => h.hitBonusVsWeakened?.(cx, e, d));
    if (d.special === 'detonate') {
      extra += e.burn * 3;
      if (e.burn > 0) detonated = true;
      e.burn = 0;
    }
    // 末日审判：灼烧追加伤害但不消耗灼烧层数。
    if (d.special === 'pyre') extra += e.burn * (d.burnPower ?? 3);
    if (d.special === 'lure' && e.weakened > 0) extra += 4;
    if (d.special === 'markburst') {
      extra += e.mark * (d.markPower ?? 5);
      if (e.mark > 0) consumedMark = true;
      if (e.mark > 0) b.markBurstThisTurn = true;
      if (e.mark > 0 && !b.marked) {
        fire(r, (h, cx) => h.onFirstMarkBurst?.(cx));
        b.marked = true;
      }
      e.mark = 0;
    }
    if (d.damage)
      for (let h = 0; h < (d.hits ?? 1) + devourHitsSpent + windupSpent && e.hp > 0; h++) {
        hit(
          r,
          e,
          d.damage +
            chargeSegSpent +
            extra +
            tacticalBonus +
            pursuit +
            (d.executeBonus && e.hp * 2 < e.maxHp ? d.executeBonus : 0),
          true,
          h,
        );
        tacticalBonus = 0;
        pursuit = 0;
      }
    if (d.kind === 'attack' && e.hp < hpBefore) e.effectiveAttacks = (e.effectiveAttacks ?? 0) + 1;
    if (e.hp > 0) {
      if (d.burn) {
        e.burn += d.burn + burnBonus;
        appliedBurn = true;
      }
      if (d.mark) {
        appliedMark = true;
        e.mark +=
          d.mark +
          // 神乐铃：本回合已消耗过符印则加量施加。
          (d.burstMarkBonus && b.markBurstThisTurn ? d.burstMarkBonus : 0) +
          (r.inherit === 'seal' && r.stage > 0 && b.played === 1 ? 1 : 0) +
          (!b.markedThisTurn && r.relics.includes('compass') ? 1 : 0) +
          sum(r, (h, cx) => h.markBonus?.(cx));
      }
      if (d.weak || devourWeakSpent) {
        e.weakened +=
          (d.weak ?? 0) + devourWeakSpent + (d.weak ? sum(r, (h, cx) => h.weakBonus?.(cx)) : 0);
        appliedWeak = true;
      }
      if (vulnGain) e.vulnerable = (e.vulnerable ?? 0) + vulnGain;
    }
  }
  // 风压推进：加成后的攻击牌达到至少 4 段则抽 1 张。
  const totalHits = (d.hits ?? 1) + devourHitsSpent + windupSpent;
  if (windupSpent && totalHits >= 4) draw(r, 1);
  // 暴食掠宴：此牌击败敌人获得噬能并抽牌。
  if ((d.killDevour || d.killDraw) && targets.some((e) => e.hp <= 0)) {
    if (d.killDevour) {
      gainDevour(b, d.killDevour);
      log(b, `${d.name} · 击败敌人，噬能 ＋${d.killDevour}`);
    }
    if (d.killDraw) draw(r, d.killDraw);
  }
  // 自损返还：本牌新增击杀则返还本牌的自损生命。
  if (selfCostRefund && b.enemies.filter((e) => e.hp <= 0).length > deadBefore) {
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + selfCostRefund);
    if (r.hp > before) b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    log(b, `${d.name} · 击败敌人，返还自损生命`);
  }
  if (appliedMark) {
    count(r, 'marks');
    b.markedThisTurn = true;
    fire(r, (h, cx) => h.onMarkApplied?.(cx));
  }
  if (appliedWeak) {
    count(r, 'weakens');
    if (!b.weakenedThisTurn) {
      fire(r, (h, cx) => h.onFirstWeak?.(cx));
      b.weakenedThisTurn = true;
    }
  }
  if (detonated) count(r, 'detonations');
  if (consumedMark) count(r, 'markBursts');
  // 内建转化：按本牌实际造成的生命伤害折算噬能，单次出牌至多 2 层。
  if (d.convert) {
    const gain = Math.min(2, Math.floor((r.damageDealt - beforeDamage) / d.convert));
    if (gain > 0) {
      gainDevour(b, gain);
      log(b, `噬能 ＋${gain}（转化 · 当前 ${b.devour}）`);
    }
  }
  if ((d.drain || d.drainRatio) && r.damageDealt > beforeDamage && r.hp < r.maxHp) {
    const before = r.hp;
    // 比例吸血：按本牌实际生命伤害折算；固定吸血维持原值。
    const drainAmount = d.drainRatio
      ? Math.floor((r.damageDealt - beforeDamage) / d.drainRatio)
      : d.drain!;
    r.hp = Math.min(
      r.maxHp,
      r.hp +
        drainAmount +
        sum(r, (h, cx) => h.drainBonus?.(cx)) +
        (r.relics.includes('fang') ? 1 : 0),
    );
    b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    count(r, 'heals');
  }
  if (d.kind === 'skill' || d.kind === 'power')
    fire(r, (h, cx) => h.onSkillPlayed?.(cx, b.skillsPlayed));
  if (appliedBurn && !b.burned) {
    fire(r, (h, cx) => h.onFirstBurn?.(cx));
    if (r.relics.includes('firewall')) b.block += 3;
    b.burned = true;
  }
  if (d.kind === 'attack') fire(r, (h, cx) => h.onAttackPlayed?.(cx, b.attackPlays));
  if (d.draw) draw(r, d.draw);
  if (r.inherit === 'flow' && r.stage > 0 && b.played === 1 && d.kind === 'skill') b.block += 2;
  if (d.exhaust || c.copied || c.temporary) b.exhaust.push(c);
  else b.discard.push(c);
  resolve(r, meta);
}
export function beginEnemyTurn(r: Run) {
  const b = r.battle;
  if (!b || b.enemyTurnIndex !== null) return;
  if (b.played >= 5) count(r, 'bigTurns');
  b.discard.push(...b.hand.filter((c) => !c.temporary));
  b.exhaust.push(...b.hand.filter((c) => c.temporary));
  b.hand = [];
  b.enemyTurnIndex = 0;
}
export function enemyStep(r: Run, meta: Meta) {
  const b = r.battle;
  if (!b || b.enemyTurnIndex === null || b.enemyTurnIndex >= b.enemies.length) return;
  const e = b.enemies[b.enemyTurnIndex++];
  if (e.hp <= 0 || e.summonedTurn === b.turn) return;
  const i = currentIntent(r, e);
  const playerHpBefore = r.hp;
  if (i.type === 'attack') {
    b.feedback.push(...applyEnemyAttack(r, e, i));
    log(b, `${ENEMIES[e.id].name} · ${i.name} ${i.damage}${i.hits > 1 ? `×${i.hits}` : ''}`);
  }
  const effects = applyEnemyEffects(b, e, i, playerHpBefore - r.hp);
  b.feedback.push(...effects.feedback);
  for (const message of effects.messages) log(b, message);
  if (i.type === 'debuff') {
    const n = i.jam ?? (['spider', 'core'].includes(ENEMIES[e.id].style) ? 2 : 1);
    for (let j = 0; j < n; j++) b.discard.push(makeCard(r, 'fault', false, true));
  }
  if (r.hp <= 0) resolve(r, meta);
}

function applyEnemyAttack(r: Run, e: Enemy, i: Intent): BattleNumber[] {
  const b = r.battle!;
  const feedback: BattleNumber[] = [];
  for (let h = 0; h < i.hits; h++) {
    const absorbed = i.pierce ? 0 : Math.min(b.block, i.damage);
    b.block -= absorbed;
    const before = r.hp;
    r.hp = Math.max(0, r.hp - i.damage + absorbed);
    feedback.push({ target: 'player', kind: 'damage', amount: before - r.hp });
  }
  e.weakened = 0;
  return feedback;
}

// 实际结算与意图推演共用非攻击效果，避免增益、治疗、召唤各维护一套规则。
function applyEnemyEffects(b: Battle, e: Enemy, i: Intent, lifeDamage: number) {
  const feedback: BattleNumber[] = [],
    messages: string[] = [];
  if (i.type !== 'attack' && !i.heal && !i.summon)
    messages.push(`${ENEMIES[e.id].name} · ${i.name}`);
  if (!(e.id === 'machinedramon' && enemyPhase(b.turn, e) === 1)) e.block = 0;
  if (i.shield) e.block = i.shield;
  if (e.id === 'machinedramon' && enemyPhase(b.turn, e) === 0) e.armorBroken = false;
  if (e.id === 'beelzebumon') {
    const fired = i.name === '死亡加农';
    e.devour = fired || i.type === 'block' ? 0 : Math.min(2, (e.devour ?? 0) + 1);
    if (fired) messages.push('别西卜兽的噬能已倾泻一空。');
  }
  if (i.drain && lifeDamage > 0) {
    const healed = Math.min(i.drain, lifeDamage, e.maxHp - e.hp);
    e.hp += healed;
    if (healed) feedback.push({ target: e.uid, kind: 'heal', amount: healed });
  }
  if (i.heal) {
    const patient = b.enemies
      .filter((x) => x.hp > 0)
      .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
    if (patient) {
      const healed = Math.min(i.heal, patient.maxHp - patient.hp);
      patient.hp += healed;
      if (healed) feedback.push({ target: patient.uid, kind: 'heal', amount: healed });
    }
    messages.push(`${ENEMIES[e.id].name} · ${i.name}`);
  }
  if (i.strength) {
    const recipients = i.strengthTarget === 'self' ? [e] : b.enemies.filter((x) => x.hp > 0);
    for (const x of recipients)
      x.strength = Math.max(
        x.strength,
        Math.min(i.strengthCap ?? Infinity, x.strength + i.strength),
      );
  }
  if (i.summon) {
    let spawned = 0;
    for (const id of i.summon) {
      if (b.enemies.filter((x) => x.hp > 0).length >= 3) break;
      b.enemies.push({
        uid: `${e.uid}-m${b.turn}-${b.enemies.length}`,
        id,
        hp: ENEMIES[id].hp,
        maxHp: ENEMIES[id].hp,
        block: 0,
        burn: 0,
        mark: 0,
        strength: 0,
        weakened: 0,
        opening: true,
        stagger: 0,
        summonedTurn: b.turn,
        summonedBy: e.uid,
      });
      spawned++;
    }
    e.summons = (e.summons ?? 0) + 1;
    messages.push(
      `${ENEMIES[e.id].name} · ${i.name}${spawned ? `：${spawned}只增援入场，下回合行动` : ''}`,
    );
  }
  return { feedback, messages };
}
export function finishEnemyTurn(r: Run, meta: Meta) {
  const b = r.battle;
  if (!b || b.enemyTurnIndex === null || b.enemyTurnIndex < b.enemies.length) return;
  b.enemyTurnIndex = null;
  for (const e of b.enemies) {
    if (e.hp <= 0) continue;
    if (e.vulnerable) e.vulnerable = Math.max(0, e.vulnerable - 1);
    if (!e.burn) continue;
    const damage = Math.min(e.hp, e.burn);
    e.hp -= damage;
    r.damageDealt += damage;
    b.feedback.push({ target: e.uid, kind: 'damage', amount: damage });
    burnKill(r, e);
    if (e.hp <= 0) deathTrigger(r, e);
    e.burn = Math.max(0, e.burn - 1);
  }
  resolve(r, meta);
  if (r.screen !== 'battle') return;
  b.turn++;
  if (r.currentNode?.kind === 'boss' && b.turn === 13)
    log(
      b,
      r.currentNode.enemies.includes('beelzebumon')
        ? '别西卜兽进入狂暴：每次攻击行动总伤害＋3，第15回合起＋6；连射平均分配。'
        : '敌方进入狂暴：每段攻击伤害每回合＋2（至多＋6）。',
    );
  b.energy = 3;
  b.block =
    (r.relics.includes('armor') ? 3 : 0) +
    (r.training === 'defense' && r.stage > 0 ? 3 : 0) +
    (r.bonuses.includes('holyward') ? 2 : 0);
  b.selfCostThisTurn = false;
  b.syncThisTurn = 0;
  b.played = 0;
  b.skillsPlayed = 0;
  b.attacks = 0;
  b.attackPlays = 0;
  b.nextAttackBonus = 0;
  b.nextAttackHits = 0;
  b.cannonGuardUsed = false;
  b.copyUses = 0;
  b.burnFollowupUsed = false;
  b.burned = false;
  b.marked = false;
  b.defended = false;
  b.weakenedThisTurn = false;
  b.markedThisTurn = false;
  b.markBurstThisTurn = false;
  fire(r, (h, c) => h.onTurnStart?.(c));
  b.burst = Math.max(0, b.burst - 1);
  for (const e of b.enemies) {
    e.opening = true;
    e.stagger = 0;
    e.effectiveAttacks = 0;
  }
  draw(r, 5);
  log(b, `第 ${b.turn} 回合 · 行动力已恢复`);
}
export function endTurn(r: Run, meta: Meta) {
  const b = r.battle;
  if (!b || b.enemyTurnIndex !== null) return;
  beginEnemyTurn(r);
  while (r.screen === 'battle' && b.enemyTurnIndex !== null && b.enemyTurnIndex < b.enemies.length)
    enemyStep(r, meta);
  if (r.screen === 'battle') finishEnemyTurn(r, meta);
}
export function applyPotion(r: Run) {
  r.potions--;
  const before = r.hp;
  r.hp = Math.min(r.maxHp, r.hp + 18);
  count(r, 'heals');
  if (r.battle) {
    r.battle.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    log(r.battle, `恢复磁盘 · 回复 ${r.hp - before} 生命`);
  }
}
export function applySupport(r: Run, meta: Meta, targetUid?: string) {
  const b = r.battle;
  if (!b) return;
  const target =
    b.enemies.find((e) => e.uid === targetUid && e.hp > 0) ?? b.enemies.find((e) => e.hp > 0);
  b.supportUsed = true;
  const sup = r.support;
  if (sup === 'default') r.supportSpent = true;
  if (sup === 'mushmon' && target) {
    target.weakened += 2;
    count(r, 'weakens');
  } else if (sup === 'picodevimon' && target) hit(r, target, 8, false);
  else if (sup === 'hagurumon') b.block += 10;
  else if (sup === 'impmon' && target)
    hit(r, target, target.hp * 2 <= target.maxHp ? 14 : 8, false);
  else if (sup === 'leomon') {
    for (const e of b.enemies) if (e.hp > 0) e.weakened += 2;
    count(r, 'weakens');
  } else if (sup === 'andromon') b.block += 12;
  else if (sup === 'gotsumon') {
    b.charge += 2;
    count(r, 'charges');
  } else if (sup === 'betamon') draw(r, 2);
  else if (sup === 'lopmon') {
    const f = b.hand.find((c) => CARDS[c.id].kind === 'status');
    if (f) {
      b.hand.splice(b.hand.indexOf(f), 1);
      b.exhaust.push(f);
    } else {
      const before = r.hp;
      r.hp = Math.min(r.maxHp, r.hp + 6);
      if (r.hp > before) count(r, 'heals');
    }
  } else b.block += 8;
  log(b, `${ENEMIES[sup]?.name ?? '应急防御程序'} · 支援已抵达`);
  resolve(r, meta);
}
export function applyBurst(r: Run) {
  const b = r.battle;
  if (!b) return;
  // 分支形态用分支必杀牌；止步觉醒（如觉醒斗牛士兽）用自己的招牌牌。
  const signatureId = r.branch
    ? BRANCHES[r.branch].cards[0]
    : EVOLUTIONS[r.form]?.endpoint
      ? EVOLUTIONS[r.form].cards[0]
      : undefined;
  if (!signatureId) return;
  if (b.sync >= 6 && !b.burstUsed) {
    b.sync -= 6;
    b.burstUsed = true;
    b.burst = 3;
    const signature = makeCard(r, signatureId, true, true);
    if (b.hand.length < 8) b.hand.push(signature);
    else b.draw.push(signature);
    log(b, '同步爆发！本回合起三回合攻击每段＋2，获得强化必杀牌。');
  }
}
