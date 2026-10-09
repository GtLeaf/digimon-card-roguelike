import { skillUnlocked, weightedOffers } from './cardSkills';
import { awardRelic, afterReward, beginBattle, finishNode } from './battle';
import { BRANCHES, CARDS, PARTNERS, RELICS, inheritanceOptions } from './data';
import { EVOLUTIONS, evolutionStatus, stageLimit } from './evolution';
import { applyEvent } from './events';
import { availableNodes } from './map';
import { makeCard } from './random';
import type { Action, Run, Save } from './types';

// 地图/收益/营地/商店/事件/祝福/进化等节点动作体。
// 返回 false 表示动作被拒绝，由 runAction 还原为原状态引用。
export function nodeAction(s: Save, action: Extract<Action, { type: 'node' }>): boolean {
  const r = s.run!;
  const n = availableNodes(r).find((x) => x.id === action.id);
  if (!n) return false;
  r.currentNode = n;
  r.message = '';
  if (['battle', 'elite', 'boss'].includes(n.kind)) beginBattle(r, n);
  else {
    r.screen = n.kind as Run['screen'];
    if (n.kind === 'evolution') {
      if (r.stage >= 3) r.screen = 'rest';
      else r.evolutionReturn = 'node';
    }
    if (n.kind === 'camp') r.supportSpent = false;
    if (n.kind === 'shop') {
      r.shopStock = weightedOffers(r, 3);
      r.shopBought = [];
      r.shopRemoved = false;
    }
    if (n.kind === 'treasure') {
      const id = awardRelic(r);
      r.message = id ? `获得 ${RELICS[id].name}` : '获得 35 金币';
    }
  }
  return true;
}
export function rewardAction(s: Save, action: Extract<Action, { type: 'reward' }>): boolean {
  const r = s.run!;
  if (
    action.card &&
    (!r.reward!.cards.includes(action.card) ||
      !CARDS[action.card] ||
      !skillUnlocked(r, CARDS[action.card]))
  )
    return false;
  if (action.card) {
    r.deck.push(makeCard(r, action.card));
    r.message = `已加入牌组：${CARDS[action.card].name} · 卡组 ${r.deck.length - 1} → ${r.deck.length} 张`;
  } else r.message = '已跳过卡牌奖励，金币与扫描资料已保留。';
  afterReward(r, s.meta);
  return true;
}
export function campAction(s: Save, action: Extract<Action, { type: 'camp' }>) {
  const r = s.run!;
  if (action.mode === 'heal') {
    if (r.hp >= r.maxHp) return;
    const before = r.hp;
    r.hp = Math.min(r.maxHp, r.hp + Math.ceil(r.maxHp * 0.3));
    r.message = `休息完成 · 生命 ${before} → ${r.hp}/${r.maxHp} · 实际回复 ${r.hp - before}`;
    finishNode(r);
  } else {
    const c = r.deck.find((x) => x.uid === action.uid && !x.upgraded);
    if (c) {
      c.upgraded = true;
      r.message = `已强化：${CARDS[c.id].name}＋ · 仅影响本局这张牌`;
      finishNode(r);
    }
  }
}
export function restAction(s: Save) {
  const r = s.run!;
  r.hp = Math.min(r.maxHp, r.hp + Math.ceil(r.maxHp * 0.15));
  finishNode(r);
}
export function buyAction(s: Save, action: Extract<Action, { type: 'buy' }>) {
  const r = s.run!;
  if (
    r.shopStock.includes(action.id) &&
    r.gold >= 45 &&
    CARDS[action.id] &&
    skillUnlocked(r, CARDS[action.id])
  ) {
    r.gold -= 45;
    r.deck.push(makeCard(r, action.id));
    r.shopBought.push(action.id);
    r.message = `已购入：${CARDS[action.id].name} · 金币 −45 · 余额 ${r.gold} · 卡组 ${r.deck.length} 张`;
  } else if (action.id === 'potion' && r.gold >= 30 && r.potions < 2) {
    r.gold -= 30;
    r.potions++;
    r.shopBought.push(action.id);
    r.message = `已获得恢复磁盘 · 磁盘 ${r.potions}/2 · 金币 −30 · 余额 ${r.gold} · 战斗中使用回血`;
  } else if (action.id === 'relic' && r.gold >= 80) {
    r.gold -= 80;
    const id = awardRelic(r);
    r.shopBought.push(action.id);
    r.message = id
      ? `已获得：${RELICS[id].name} · ${RELICS[id].text} · 金币 −80 · 余额 ${r.gold}`
      : `全部装置已拥有，转为 35 金币 · 余额 ${r.gold}`;
  }
}
export function removeAction(s: Save, action: Extract<Action, { type: 'remove' }>) {
  const r = s.run!;
  const i = r.deck.findIndex((c) => c.uid === action.uid);
  if (i >= 0) {
    const card = r.deck[i];
    r.deck.splice(i, 1);
    r.gold -= 45;
    r.shopRemoved = true;
    r.message = `已移除：${CARDS[card.id].name}${card.upgraded ? '＋' : ''} · 卡组 ${r.deck.length + 1} → ${r.deck.length} 张 · 金币 −45 · 余额 ${r.gold}`;
  }
}
export function eventAction(s: Save, action: Extract<Action, { type: 'event' }>): boolean {
  const r = s.run!;
  const meta = s.meta;
  if (!applyEvent(r, meta, action.choice, action.uid)) return false;
  finishNode(r);
  return true;
}

export function blessAction(s: Save, action: Extract<Action, { type: 'bless' }>) {
  const r = s.run!;
  r.message = '';
  if (action.id === 'growth') {
    r.maxHp += 10;
    r.hp = Math.min(r.maxHp, r.hp + 10);
  }
  r.blessing = action.id;
  if (r.currentNode) finishNode(r);
  else r.screen = 'map';
}
export function evolveAction(s: Save, action: Extract<Action, { type: 'evolve' }>): boolean {
  const r = s.run!;
  const meta = s.meta;
  const form =
    action.form ??
    (action.branch ? BRANCHES[action.branch].art : PARTNERS[r.partner].forms[r.stage + 1]);
  const d = EVOLUTIONS[form];
  if (!d) return false;
  const legacy =
    r.legacyEvolution &&
    r.stage === 2 &&
    d.partner === r.partner &&
    d.stage === 3 &&
    ['dukemon', 'megidramon', 'sakuyamon', 'kuzuhamon'].includes(form);
  if (!evolutionStatus(r, meta, form).ready && !legacy) return false;
  const ids = [...new Set(action.replace ?? [])];
  if (ids.length !== 2 || ids.some((uid) => !r.deck.some((c) => c.uid === uid))) return false;
  const previousForm = r.form;
  if (d.signatureUpgrade) {
    const signatureIds = EVOLUTIONS[previousForm]?.cards ?? [];
    r.deck.forEach((c) => {
      if (signatureIds.includes(c.id)) c.upgraded = true;
    });
  }
  ids.forEach((uid, i) => {
    const c = r.deck.find((x) => x.uid === uid);
    if (c) {
      c.id = d.cards[i];
      c.upgraded = false; // 新卡一律未强化，被替换的强化牌视为消耗
    }
  });
  r.spotlight = [...ids]; // 进化获得的新卡：下一场战斗洗入抽牌堆前半段
  r.form = form;
  r.stage = d.stage;
  r.evolved = d.stage;
  r.branch = d.branch ?? null;
  r.training = action.training ?? r.training;
  if (action.inherit && inheritanceOptions(r.partner).includes(action.inherit))
    r.inherit = action.inherit;
  if (
    form === 'dukemon' &&
    (r.activity.counts.defenses ?? 0) >= 12 &&
    !r.bonuses.includes('holyward')
  )
    r.bonuses.push('holyward');
  if (
    form === 'sakuyamon' &&
    (r.activity.counts.markBursts ?? 0) >= 6 &&
    !r.bonuses.includes('ritual')
  )
    r.bonuses.push('ritual');
  r.formHistory.push(form);
  if (!meta.discovered.includes(form)) meta.discovered.push(form);
  if (r.evolutionTarget && (EVOLUTIONS[r.evolutionTarget]?.stage ?? 0) <= r.stage)
    r.evolutionTarget = null;
  r.legacyEvolution = false;
  if (r.evolutionReturn === 'camp') {
    finishNode(r);
    r.evolutionReturn = 'node';
  } else if (r.stage < stageLimit(r)) {
    r.screen = 'evolution';
  } else if (r.currentNode?.kind === 'boss') r.screen = 'blessing';
  else finishNode(r);
  return true;
}
