import { cardPool } from './cardSkills';
import { BRANCHES, CARDS, ENEMIES, RELICS, needsTarget } from './data';
import { emptyActivity, syncRouteData, activityGains } from './evolution';
import { expandedIntent } from './enemyRules';
import { DEVOUR_CAP, PASSIVES, gainDevour, type HookCtx, type PassiveHooks } from './hooks';
import { choose, makeCard, shuffle } from './random';
import type { Battle, Card, Enemy, Intent, MapNode, Meta, Metric, Run } from './types';

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
  const d = CARDS[c.id];
  return Math.max(0, d.cost - (c.upgraded && !d.damage && !d.shield ? 1 : 0));
}
export function intent(r: Run, e: Enemy): Intent {
  const b = r.battle;
  const turn = b?.turn ?? 1;
  const phase = (turn - 1) % 3;
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
            detail: '所有存活敌人攻击伤害＋2。',
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
            damage: e.id === 'beelzebumon' ? 5 : 3 + ch,
            hits: e.id === 'beelzebumon' ? 3 : 2,
          };
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
  // Boss 软狂暴：第 11 回合起攻击伤害每回合＋2（至多＋8），仅作用于 Boss 本体，召唤物不继承；数值直接体现在意图预告中。
  const enrage =
    r.currentNode?.kind === 'boss' && e.summonedTurn === undefined
      ? Math.min(8, Math.max(0, turn - 10) * 2)
      : 0;
  if (i.type === 'attack') {
    i.damage = Math.max(0, i.damage + e.strength + enrage - e.weakened);
    if (e.rogue && i.damage > 0) i.damage = Math.max(1, i.damage - 2);
  }
  return i;
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
  const scaled = (id: string) => {
    const hp = boss ? ENEMIES[id].hp : Math.ceil(ENEMIES[id].hp * (1 + 0.08 * ch));
    return { hp, maxHp: hp, block: boss ? 0 : 2 * ch, strength: Math.max(0, ch - (boss ? 3 : 2)) };
  };
  r.battle = {
    activity: emptyActivity(),
    startActivity: structuredClone(r.activity),
    selfCostThisTurn: false,
    countedKills: [],
    enemies: node.enemies.map((id, index) => {
      const s = scaled(id);
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
    cannonGuardUsed: false,
    burned: false,
    marked: false,
    defended: false,
    weakenedThisTurn: false,
    devour: 0,
    devourAura: false,
    log: ['连接建立。先观察敌人的行动意图。'],
    feedback: [],
  };
  const b = r.battle;
  fire(r, (h, c) => h.battleStart?.(c));
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
// 击败触发：亡语（自爆／激励）与召唤者死亡时召唤物撤退；撤退不再连锁触发亡语。
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
function hit(r: Run, e: Enemy, amount: number, attack = true) {
  const b = r.battle;
  if (!b || e.hp <= 0) return;
  let damage = Math.max(0, amount);
  if (attack) {
    damage += b.strength + (b.burst > 0 ? 2 : 0);
    damage += sum(r, (h, c) => h.attackHitBonus?.(c));
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
export function awardRelic(r: Run) {
  const available = Object.keys(RELICS).filter((id) => !r.relics.includes(id));
  if (!available.length) {
    r.gold += 35;
    return undefined;
  }
  const id = choose(r, available);
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
    cards: shuffle(r, cardPool(r)).slice(0, 3),
    gold,
    scans,
    relic,
    gains: activityGains(b.startActivity, r.activity),
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
    r.screen = 'evolution';
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
export function playCard(r: Run, meta: Meta, uid: string, target?: string) {
  const b = r.battle;
  if (!b) return;
  const index = b.hand.findIndex((c) => c.uid === uid);
  if (index < 0) return;
  const c = b.hand[index],
    d = CARDS[c.id];
  const cost = cardCost(c);
  if (cost > b.energy) return;
  const chosen0 =
    b.enemies.find((e) => e.uid === target && e.hp > 0) ?? b.enemies.find((e) => e.hp > 0);
  if (needsTarget(d) && !chosen0) return;
  // 护卫：存活时同伴的指定目标攻击改由护卫承受；群攻不受影响。
  const guard = chosen0
    ? b.enemies.find((e) => e.hp > 0 && e.uid !== chosen0.uid && ENEMIES[e.id].guard)
    : undefined;
  const chosen = guard ?? chosen0;
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
  const up = c.upgraded ? 3 : 0,
    damageUp = c.upgraded ? (d.upgradeDamage ?? 3) : 0;
  let tacticalBonus = d.kind === 'attack' && d.damage ? b.nextAttackBonus : 0;
  if (tacticalBonus) b.nextAttackBonus = 0;
  if (d.special === 'sacrifice') {
    const before = r.hp;
    r.hp = Math.max(0, r.hp - 3);
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
    let shield = d.shield + up;
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
    r.hp = Math.min(r.maxHp, r.hp + d.heal + (c.upgraded && d.upgradeText ? 2 : 0));
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
  if (d.energy) b.energy += d.energy + (c.upgraded && d.upgradeText && !d.upgradeDraw ? 1 : 0);
  if (d.strength) b.strength += d.strength + (c.upgraded && d.upgradeText ? 1 : 0);
  if (d.charge) {
    b.charge += d.charge;
    count(r, 'charges');
  }
  if (d.devour) gainDevour(b, d.devour);
  if (d.special === 'devouraura') {
    b.devourAura = true;
    log(b, '噬能光环 · 本场击败敌人额外＋1 噬能');
  }
  if (d.special === 'copy') {
    const original = b.hand.find(
      (x) => !x.copied && CARDS[x.id].kind !== 'status' && CARDS[x.id].special !== 'copy',
    );
    if (original && b.hand.length < 8)
      b.hand.push({ ...makeCard(r, original.id, original.upgraded, true), copied: true });
  }
  if (d.special === 'purge') {
    const faults = b.hand.filter((x) => CARDS[x.id].kind === 'status');
    b.hand = b.hand.filter((x) => CARDS[x.id].kind !== 'status');
    b.exhaust.push(...faults);
  }
  let bonus = b.charge > 0 ? (d.chargedDamage ?? 0) : 0;
  if (d.special === 'shieldhit') bonus += Math.floor(b.block / 2);
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
      spendDevour(r, d.devourAll ? DEVOUR_CAP : 3) *
      ((d.devourPower ?? 4) + sum(r, (h, cx) => h.devourPowerBonus?.(cx)));
  const targets = d.all ? b.enemies.filter((e) => e.hp > 0) : chosen ? [chosen] : [];
  const beforeDamage = r.damageDealt;
  let appliedMark = false,
    appliedWeak = false,
    detonated = false,
    consumedMark = false;
  const devourWeakSpent = d.devourWeak ? spendDevour(r, 3) : 0;
  // 噬能侵蚀：噬能满 3 层才消耗并足额施加易伤，不足则不消耗、保底施加 1 层。
  const devourVulnSpent = d.devourVuln && b.devour >= 3 ? spendDevour(r, 3) : 0;
  const vulnGain = d.devourVuln
    ? (devourVulnSpent ? d.devourVuln : 1) + (c.upgraded && d.upgradeText ? 1 : 0)
    : 0;
  const burnBonus =
    !b.burned && d.burn
      ? sum(r, (h, cx) => h.firstBurnBonus?.(cx)) + (r.inherit === 'ember' && r.stage > 0 ? 1 : 0)
      : 0;
  for (const e of targets) {
    const hpBefore = e.hp;
    let extra = bonus;
    extra += sum(r, (h, cx) => h.hitBonusVsWeakened?.(cx, e, d));
    if (d.special === 'detonate') {
      extra += e.burn * 3;
      if (e.burn > 0) detonated = true;
      e.burn = 0;
    }
    if (d.special === 'lure' && e.weakened > 0) extra += 4;
    if (d.special === 'markburst') {
      extra += e.mark * (d.markPower ?? 5);
      if (e.mark > 0) consumedMark = true;
      if (e.mark > 0 && !b.marked) {
        fire(r, (h, cx) => h.onFirstMarkBurst?.(cx));
        b.marked = true;
      }
      e.mark = 0;
    }
    if (d.damage)
      for (let h = 0; h < (d.hits ?? 1) && e.hp > 0; h++) {
        hit(r, e, d.damage + damageUp + extra + tacticalBonus);
        tacticalBonus = 0;
      }
    if (d.kind === 'attack' && e.hp < hpBefore) e.effectiveAttacks = (e.effectiveAttacks ?? 0) + 1;
    if (e.hp > 0) {
      if (d.burn) e.burn += d.burn + burnBonus;
      if (d.mark) {
        appliedMark = true;
        e.mark +=
          d.mark +
          (r.inherit === 'seal' && r.stage > 0 && b.played === 1 ? 1 : 0) +
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
  if (appliedMark) {
    count(r, 'marks');
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
  if (d.drain && r.damageDealt > beforeDamage && r.hp < r.maxHp) {
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + d.drain + sum(r, (h, cx) => h.drainBonus?.(cx)));
    b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    count(r, 'heals');
  }
  if (d.kind === 'skill' || d.kind === 'power')
    fire(r, (h, cx) => h.onSkillPlayed?.(cx, b.skillsPlayed));
  if (d.burn && !b.burned) {
    if (r.relics.includes('firewall')) b.block += 3;
    b.burned = true;
  }
  if (d.kind === 'attack') fire(r, (h, cx) => h.onAttackPlayed?.(cx, b.attackPlays));
  if (d.draw) draw(r, d.draw + (c.upgraded && d.upgradeText ? 1 : 0));
  else if (c.upgraded && d.upgradeDraw) draw(r, d.upgradeDraw);
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
  const i = intent(r, e);
  if (!(e.id === 'machinedramon' && (b.turn - 1) % 3 === 1)) e.block = 0;
  const playerHpBefore = r.hp;
  if (i.type === 'attack') {
    for (let h = 0; h < i.hits; h++) {
      const absorbed = i.pierce ? 0 : Math.min(b.block, i.damage);
      b.block -= absorbed;
      const before = r.hp;
      r.hp = Math.max(0, r.hp - i.damage + absorbed);
      b.feedback.push({ target: 'player', kind: 'damage', amount: before - r.hp });
    }
    e.weakened = 0;
    log(b, `${ENEMIES[e.id].name} · ${i.name} ${i.damage}${i.hits > 1 ? `×${i.hits}` : ''}`);
  }
  if (i.shield) e.block = i.shield;
  if (e.id === 'machinedramon' && (b.turn - 1) % 3 === 0) e.armorBroken = false;
  if (i.drain && playerHpBefore > r.hp) {
    const healed = Math.min(i.drain, playerHpBefore - r.hp, e.maxHp - e.hp);
    e.hp += healed;
    if (healed) b.feedback.push({ target: e.uid, kind: 'heal', amount: healed });
  }
  if (i.heal) {
    const patient = b.enemies
      .filter((x) => x.hp > 0)
      .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
    if (patient) {
      const healed = Math.min(i.heal, patient.maxHp - patient.hp);
      patient.hp += healed;
      if (healed) b.feedback.push({ target: patient.uid, kind: 'heal', amount: healed });
    }
    log(b, `${ENEMIES[e.id].name} · ${i.name}`);
  }
  if (i.strength) b.enemies.filter((x) => x.hp > 0).forEach((x) => (x.strength += i.strength!));
  if (i.type === 'buff' && ENEMIES[e.id].style === 'buff')
    b.enemies.filter((x) => x.hp > 0).forEach((x) => (x.strength += 2));
  if (i.type === 'debuff') {
    const n = i.jam ?? (['spider', 'core'].includes(ENEMIES[e.id].style) ? 2 : 1);
    for (let j = 0; j < n; j++) b.discard.push(makeCard(r, 'fault', false, true));
    if (e.id === 'core') e.block += 8;
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
    log(
      b,
      `${ENEMIES[e.id].name} · ${i.name}${spawned ? `：${spawned}只增援入场，下回合行动` : ''}`,
    );
  }
  if (r.hp <= 0) resolve(r, meta);
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
  if (r.currentNode?.kind === 'boss' && b.turn === 11)
    log(b, '敌方进入狂暴：攻击伤害每回合＋2（至多＋8）。');
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
  b.cannonGuardUsed = false;
  b.burned = false;
  b.marked = false;
  b.defended = false;
  b.weakenedThisTurn = false;
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
  if (!b || !r.branch) return;
  if (b.sync >= 6 && !b.burstUsed) {
    b.sync -= 6;
    b.burstUsed = true;
    b.burst = 3;
    const signature = makeCard(r, BRANCHES[r.branch].cards[0], true, true);
    if (b.hand.length < 8) b.hand.push(signature);
    else b.draw.push(signature);
    log(b, '同步爆发！本回合起三回合攻击每段＋2，获得强化必杀牌。');
  }
}
