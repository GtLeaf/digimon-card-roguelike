import {
  BRANCHES,
  CARDS,
  MAX_COPIES_PER_TURN,
  cardDefinition,
  copyCandidates,
} from '../../src/game/data';
import { emptySave, reduceGame, intent } from '../../src/game/engine';
import { EVOLUTIONS, evolutionStatus } from '../../src/game/evolution';
import { availableNodes } from '../../src/game/map';
import { eventFor, eventChoiceBlock } from '../../src/game/events';
import type { Action, Branch, Card, Meta, Run, Save } from '../../src/game/types';

export type Strategy = 'survival' | 'synergy';
export const ROUTES: Branch[] = [
  'duke',
  'megidra',
  'chaos',
  'sakuya',
  'kuzuha',
  'saint',
  'blacksaint',
];
const routeForms = (branch: Branch) =>
  branch === 'chaos'
    ? ['blackgrowmon', 'blackwargrowlmon', 'chaosdukemon']
    : branch === 'blacksaint'
      ? ['blackgalgomon', 'blackrapidmon', 'blacksaintgalgomon']
      : branch === 'saint'
        ? ['galgomon', 'rapidmon', 'saintgalgomon']
        : branch === 'megidra'
          ? ['growlmon', 'wargrowlmon', 'megidramon']
          : branch === 'duke'
            ? ['growlmon', 'wargrowlmon', 'dukemon']
            : ['kyubimon', 'taomon', BRANCHES[branch].art];
const definitions = (r: Run) => r.deck.map(cardDefinition);
function routeProgress(r: Run, branch: Branch, forms = routeForms(branch)) {
  const goal = forms[r.stage];
  if (!goal) return [];
  return EVOLUTIONS[goal].groups.filter(
    (group) =>
      !group.some(
        (t) =>
          (t.card ? (r.activity.cards[t.card] ?? 0) : (r.activity.counts[t.metric!] ?? 0)) >=
          t.goal,
      ),
  );
}
function incoming(r: Run) {
  return r
    .battle!.enemies.filter((e) => e.hp > 0)
    .reduce((n, e) => {
      const i = intent(r, e);
      return n + i.damage * i.hits;
    }, 0);
}

/** 规则共享、权重预先固定的启发式；不使用校准U，也不窥视抽牌顺序。 */
export function acquisitionValue(
  r: Run,
  id: string,
  strategy: Strategy,
  branch: Branch,
  forms = routeForms(branch),
) {
  const d = CARDS[id],
    deck = definitions(r);
  let value =
    (d.damage ?? 0) * (d.hits ?? 1) +
    (d.shield ?? 0) * 0.9 +
    (d.heal ?? 0) * 1.7 +
    (d.draw ?? 0) * 3 +
    (d.energy ?? 0) * 7 +
    (d.strength ?? 0) * 5 -
    d.cost * 3;
  if (d.all) value += (d.damage ?? 0) * (d.hits ?? 1) * 0.5;
  if (d.burn) value += d.burn * 2;
  if (d.mark && deck.some((c) => c.special === 'markburst')) value += d.mark * 2.5;
  if (d.special === 'markburst' && deck.some((c) => c.mark)) value += 6;
  if (d.special === 'detonate' && deck.some((c) => c.burn)) value += 6;
  if (d.charge && deck.some((c) => c.special === 'cannon')) value += d.charge * 2;
  if (d.special === 'cannon' && deck.some((c) => c.charge)) value += 5;
  if (d.special === 'copy') {
    // 对可复制来源估价；固定常数会让策略永远拒绝复制牌。
    const sources = deck.filter((c) => c.special !== 'copy' && c.kind !== 'status');
    value +=
      Math.max(
        0,
        ...sources.map(
          (c) =>
            (c.damage ?? 0) * (c.hits ?? 1) +
            (c.shield ?? 0) * 0.9 +
            (c.heal ?? 0) * 1.7 +
            (c.energy ?? 0) * 7 +
            (c.strength ?? 0) * 5 +
            (c.draw ?? 0) * 3 -
            c.cost * 3,
        ),
      ) * 0.75;
  }
  if (d.special === 'sacrifice') value -= 5;
  if (deck.filter((c) => c.id === id).length >= 2) value -= 8;
  if (strategy === 'synergy') {
    if (branch === 'megidra' && (d.burn || d.special === 'detonate')) value += 4;
    if (branch === 'chaos' && (d.special === 'sacrifice' || d.heal || d.drain)) value += 5;
    if (['sakuya', 'kuzuha'].includes(branch) && (d.mark || d.special === 'markburst' || d.draw))
      value += 3;
    if (['saint', 'blacksaint'].includes(branch) && (d.hits || d.charge || d.special === 'cannon'))
      value += 3;
  }
  // 路线要求是公开信息，缺少相关行为出口时两策略均允许适量优先。
  if (
    branch === 'chaos' &&
    d.special === 'sacrifice' &&
    !deck.some((c) => c.special === 'sacrifice')
  )
    value += 5;
  if (branch === 'chaos' && d.heal && !deck.some((c) => c.heal)) value += 5;
  // 新版暗线从成长期就需要自损：优先补齐公开条件缺少的行为出口。
  const missing = routeProgress(r, branch, forms);
  if (
    missing.some((g) => g.some((t) => t.metric === 'selfCosts')) &&
    d.special === 'sacrifice' &&
    !deck.some((c) => c.special === 'sacrifice')
  )
    value += 15;
  if (
    missing.some((g) => g.some((t) => t.metric === 'heals')) &&
    (d.heal || d.drain) &&
    !deck.some((c) => c.heal || c.drain)
  )
    value += 15;
  return value;
}

export function upgradeValue(r: Run, c: Card, strategy: Strategy, branch: Branch) {
  const base = cardDefinition(c),
    up = cardDefinition({ ...c, upgraded: true });
  return (
    ((up.damage ?? 0) - (base.damage ?? 0)) * (base.hits ?? 1) +
    ((up.shield ?? 0) - (base.shield ?? 0)) * 0.9 +
    ((up.draw ?? 0) - (base.draw ?? 0)) * 3 +
    ((up.energy ?? 0) - (base.energy ?? 0)) * 7 +
    ((up.heal ?? 0) - (base.heal ?? 0)) * 2 +
    (base.cost - up.cost) * 7 +
    (up.copyChoice && !base.copyChoice ? 3 : 0) +
    acquisitionValue(r, c.id, strategy, branch) * 0.01
  );
}

export function combatCandidates(s: Save, strategy: Strategy, branch: Branch, formPath?: string[]) {
  const r = s.run!,
    b = r.battle!;
  const threats = incoming(r),
    deck = definitions(r);
  const entries: { action: Extract<Action, { type: 'play' }>; score: number; next: Save }[] = [];
  for (const c of b.hand) {
    const d = cardDefinition(c);
    if (d.cost > b.energy) continue;
    if (d.special === 'sacrifice' && r.hp <= 3) continue;
    if (d.special === 'copy' && b.copyUses >= MAX_COPIES_PER_TURN) continue;
    const sources = d.special === 'copy' ? copyCandidates(b.hand, c.uid) : [];
    if (d.special === 'copy' && !sources.length) continue;
    const sourceValue = (source: Card) => {
      const def = cardDefinition(source);
      return (
        (def.energy ?? 0) * 8 +
        (def.strength ?? 0) * 5 +
        (def.heal ?? 0) * Math.min(1, (r.maxHp - r.hp) / 8) * 2 +
        (def.draw ?? 0) * 2 +
        (def.damage ?? 0) * (def.hits ?? 1) +
        (def.shield ?? 0) * 0.7 -
        def.cost * 4
      );
    };
    const source = d.copyChoice
      ? [...sources].sort((a, b) => sourceValue(b) - sourceValue(a))[0]
      : sources[0];
    // 对攻击牌枚举当前可见目标；用正式引擎验证每个候选。
    const targets = b.enemies.filter((e) => e.hp > 0);
    for (const enemy of targets) {
      const action: Extract<Action, { type: 'play' }> = {
        type: 'play',
        uid: c.uid,
        target: enemy.uid,
        ...(d.copyChoice ? { copyUid: source.uid } : {}),
      };
      const next = reduceGame(s, action),
        after = next.run!.battle!;
      if (after.played === b.played || next.run!.hp <= 0) continue;
      const hpDamage = next.run!.damageDealt - r.damageDealt;
      const selfCost = d.special === 'sacrifice' ? 3 : 0;
      const healing = Math.max(0, next.run!.hp - r.hp + selfCost);
      const needed = Math.max(0, threats - b.block);
      const shield = Math.min(needed, Math.max(0, after.block - b.block));
      const killThreat = b.enemies
        .filter((e) => e.hp > 0 && after.enemies.find((n) => n.uid === e.uid)!.hp <= 0)
        .reduce((n, e) => {
          const i = intent(r, e);
          return n + i.damage * i.hits;
        }, 0);
      const weakProtection = Math.max(0, threats - incoming(next.run!) - killThreat);
      const newCards = Math.min(Math.max(0, 8 - (b.hand.length - 1)), d.draw ?? 0);
      let score =
        hpDamage +
        healing * 2 +
        shield * (strategy === 'survival' ? 1.8 : 1.3) +
        (killThreat + weakProtection) * 1.3 +
        newCards * 2.5 +
        (after.energy - b.energy + d.cost) * 8 -
        d.cost * 2 -
        selfCost * 2;
      if (d.strength)
        score +=
          d.strength *
          Math.min(
            6,
            deck.reduce((n, x) => n + (x.damage ? (x.hits ?? 1) : 0), 0),
          );
      if (d.burn)
        score += after.enemies.reduce(
          (n, e, i) => n + Math.min(e.hp, Math.max(0, e.burn - b.enemies[i].burn) * 1.8),
          0,
        );
      if (d.mark && deck.some((x) => x.special === 'markburst')) score += d.mark * 2;
      if (after.charge > b.charge && deck.some((x) => x.special === 'cannon'))
        score += (after.charge - b.charge) * 2;
      if (d.special === 'copy') score += sourceValue(source) * 0.65;
      if (d.special === 'purge') score += b.hand.filter((c) => c.id === 'fault').length * 2;
      if (d.kind === 'status') score += b.hand.length >= 6 ? 1 : 0;
      if (
        !hpDamage &&
        !healing &&
        !shield &&
        !newCards &&
        !d.energy &&
        !d.strength &&
        !d.burn &&
        !d.mark &&
        !d.charge &&
        d.special !== 'copy' &&
        d.special !== 'purge' &&
        d.kind !== 'status'
      )
        score -= 5;
      for (const group of routeProgress(r, branch, formPath))
        if (
          group.some((t) =>
            t.card
              ? (d.series ?? d.id) === t.card
              : t.metric === 'skills'
                ? ['skill', 'power'].includes(d.kind)
                : t.metric === 'defenses'
                  ? !!d.shield
                  : t.metric === 'attacks'
                    ? d.kind === 'attack'
                    : t.metric === 'selfCosts'
                      ? !!selfCost
                      : t.metric === 'heals'
                        ? healing > 0
                        : t.metric === 'charges'
                          ? !!d.charge
                          : t.metric === 'cannonShots'
                            ? d.special === 'cannon' && b.charge > 0
                            : t.metric === 'fire'
                              ? !!d.burn
                              : t.metric === 'detonations'
                                ? d.special === 'detonate' && enemy.burn > 0
                                : t.metric === 'markBursts'
                                  ? d.special === 'markburst' && enemy.mark > 0
                                  : t.metric === 'marks'
                                    ? !!d.mark
                                    : false,
          )
        )
          score += strategy === 'synergy' ? 4 : 2;
      if (next.run!.screen === 'reward') score += 1000;
      entries.push({ action, score, next });
      if (
        !d.damage &&
        !d.mark &&
        !d.burn &&
        !['detonate', 'markburst', 'cannon'].includes(d.special ?? '')
      )
        break;
    }
  }
  return entries.sort((a, b) => b.score - a.score);
}

function reachableResearch(r: Run, nodeId: string): boolean {
  const nodes = r.nodes.flat(),
    seen = new Set<string>(),
    queue = [nodeId];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.find((n) => n.id === id);
    if (!n) continue;
    if (n.eventId === 'research') return true;
    queue.push(...n.next);
  }
  return false;
}
export function simulateJourney(
  branch: Branch,
  seed: number,
  strategy: Strategy,
  profile?: Meta,
  formPath?: string[],
) {
  const forms = formPath ?? routeForms(branch);
  if (
    forms.length !== 3 ||
    forms[2] !== BRANCHES[branch].art ||
    forms.some(
      (form, i) =>
        !EVOLUTIONS[form] ||
        EVOLUTIONS[form].partner !== BRANCHES[branch].partner ||
        !EVOLUTIONS[form].parents.includes(i ? forms[i - 1] : BRANCHES[branch].partner),
    )
  )
    throw Error('模拟进化路径不合法');
  const initial = emptySave();
  if (profile) initial.meta = structuredClone(profile);
  let s = reduceGame(initial, { type: 'start', partner: BRANCHES[branch].partner, seed });
  let steps = 0,
    purchases = 0,
    removals = 0,
    spent = 0,
    skipped = 0;
  const diagnostics: string[] = [];
  const picked: Record<string, number> = {},
    upgraded: Record<string, number> = {},
    used: Record<string, number> = {},
    firstPicked: Record<string, number> = {};
  const battles: {
    row: number;
    enemies: string[];
    hpStart: number;
    hpEnd: number;
    turns: number;
    plays: number[];
    copies: number;
    marks: number;
    charge: number;
  }[] = [];
  let current: (typeof battles)[number] | null = null;
  const apply = (action: Action, cached?: Save) => {
    const r = s.run!,
      before = r.battle,
      old = s,
      next = cached ?? reduceGame(s, action);
    if (JSON.stringify(next) === JSON.stringify(old)) {
      diagnostics.push(`stalled:${r.row}:${r.screen}:${JSON.stringify(action)}`);
      return false;
    }
    if (action.type === 'play' && before) {
      const c = before.hand.find((c) => c.uid === action.uid)!;
      used[c.id] = (used[c.id] ?? 0) + 1;
    }
    if (action.type === 'reward') {
      if (action.card) {
        picked[action.card] = (picked[action.card] ?? 0) + 1;
        firstPicked[action.card] ??= r.row;
      } else skipped++;
    }
    if (action.type === 'buy' && CARDS[action.id]) {
      purchases++;
      picked[action.id] = (picked[action.id] ?? 0) + 1;
      firstPicked[action.id] ??= r.row;
    }
    if (action.type === 'remove') removals++;
    if (action.type === 'camp' && action.mode === 'upgrade') {
      const c = r.deck.find((c) => c.uid === action.uid)!;
      upgraded[c.id] = (upgraded[c.id] ?? 0) + 1;
    }
    if (action.type === 'event' && action.uid) {
      const c = r.deck.find((c) => c.uid === action.uid)!;
      if (eventFor(r)?.choices.find((c) => c.id === action.choice)?.effect.card === 'upgrade')
        upgraded[c.id] = (upgraded[c.id] ?? 0) + 1;
    }
    spent += Math.max(0, r.gold - next.run!.gold);
    if (before && current) {
      if (action.type === 'endTurn') current.plays.push(before.played);
      if (action.type === 'play') current.copies += next.run!.battle!.copyUses - before.copyUses;
    }
    s = next;
    const a = s.run!;
    if (a.screen === 'battle' && !current)
      current = {
        row: a.row,
        enemies: a.battle!.enemies.map((e) => e.id),
        hpStart: a.hp,
        hpEnd: a.hp,
        turns: 0,
        plays: [],
        copies: 0,
        marks: 0,
        charge: 0,
      };
    if (current && a.screen !== 'battle') {
      current.hpEnd = a.hp;
      current.turns = a.battle!.turn;
      if (action.type !== 'endTurn') current.plays.push(a.battle!.played);
      current.marks = a.battle!.enemies.reduce((n, e) => n + e.mark, 0);
      current.charge = a.battle!.charge;
      battles.push(current);
      current = null;
    }
    return true;
  };
  while (s.run!.screen !== 'result' && steps++ < 2500) {
    const r = s.run!,
      goal = forms[r.stage];
    let action: Action, cached: Save | undefined;
    switch (r.screen) {
      case 'blessing':
        action = { type: 'bless', id: 'guard' };
        break;
      case 'map': {
        const nodes = availableNodes(r);
        if (!nodes.length) {
          diagnostics.push('no-map-exit');
          break;
        }
        const needsResearch = branch === 'chaos' && !s.meta.unlockedRoutes.includes('chaos');
        const needProgress = routeProgress(r, branch, forms).length > 0;
        const node =
          (needsResearch ? nodes.find((n) => reachableResearch(r, n.id)) : undefined) ??
          nodes.find(
            (n) =>
              n.kind === 'camp' &&
              (r.hp < r.maxHp * 0.8 || (goal && evolutionStatus(r, s.meta, goal).ready)),
          ) ??
          (needProgress ? nodes.find((n) => n.kind === 'battle') : undefined) ??
          nodes.find((n) => n.kind === 'treasure') ??
          nodes.find((n) => n.kind === 'event') ??
          nodes.find((n) => n.kind === 'camp') ??
          nodes.find((n) => n.kind === 'battle') ??
          nodes[0];
        action = { type: 'node', id: node.id };
        break;
      }
      case 'battle': {
        const b = r.battle!;
        if (r.potions && r.hp <= r.maxHp - 18) {
          action = { type: 'potion' };
          break;
        }
        if (!b.supportUsed && (r.support || !r.supportSpent)) {
          action = { type: 'support', target: b.enemies.find((e) => e.hp > 0)?.uid };
          break;
        }
        if (r.branch && b.sync >= 6 && !b.burstUsed) {
          action = { type: 'burst' };
          break;
        }
        const c = combatCandidates(s, strategy, branch, forms)[0];
        action = c && c.score > 0 ? c.action : { type: 'endTurn' };
        cached = c && c.score > 0 ? c.next : undefined;
        break;
      }
      case 'reward': {
        const id = [...r.reward!.cards].sort(
          (a, b) =>
            acquisitionValue(r, b, strategy, branch, forms) -
            acquisitionValue(r, a, strategy, branch, forms),
        )[0];
        action = {
          type: 'reward',
          card:
            r.deck.length < 16 && acquisitionValue(r, id, strategy, branch, forms) > 5
              ? id
              : undefined,
        };
        break;
      }
      case 'camp': {
        if (goal && evolutionStatus(r, s.meta, goal).ready) {
          action = { type: 'campEvolution' };
          break;
        }
        const c = r.deck
          .filter((c) => !c.upgraded)
          .sort(
            (a, b) => upgradeValue(r, b, strategy, branch) - upgradeValue(r, a, strategy, branch),
          )[0];
        action =
          r.hp < r.maxHp * (strategy === 'survival' ? 0.8 : 0.72)
            ? { type: 'camp', mode: 'heal' }
            : !c
              ? { type: 'continue' }
              : { type: 'camp', mode: 'upgrade', uid: c.uid };
        break;
      }
      case 'evolution': {
        const replace = [...r.deck]
          .sort(
            (a, b) =>
              acquisitionValue(r, a.id, strategy, branch) -
              acquisitionValue(r, b.id, strategy, branch),
          )
          .slice(0, 2)
          .map((c) => c.uid);
        action =
          goal && evolutionStatus(r, s.meta, goal).ready
            ? {
                type: 'evolve',
                form: goal,
                replace,
                training: 'defense',
                inherit: r.partner === 'renamon' ? 'seal' : 'ward',
              }
            : { type: 'deferEvolution' };
        break;
      }
      case 'event': {
        const e = eventFor(r),
          risk = e?.choices.find((c) => c.id === 'risk');
        if (e?.id === 'research') {
          action = { type: 'event', choice: branch === 'chaos' ? 'risk' : 'safe' };
          break;
        }
        if (e?.id === 'laboratory' && risk && !eventChoiceBlock(r, risk)) {
          const c = r.deck
            .filter((c) => !c.upgraded)
            .sort(
              (a, b) => upgradeValue(r, b, strategy, branch) - upgradeValue(r, a, strategy, branch),
            )[0];
          if (c && acquisitionValue(r, c.id, strategy, branch) > 8) {
            action = { type: 'event', choice: 'risk', uid: c.uid };
            break;
          }
        }
        if (e?.id === 'shelter' && r.hp > r.maxHp * 0.85 && risk && !eventChoiceBlock(r, risk)) {
          const c = r.deck.find((c) => c.id === 'strike');
          if (c) {
            action = { type: 'event', choice: 'risk', uid: c.uid };
            break;
          }
        }
        action = { type: 'event', choice: 'safe' };
        break;
      }
      case 'shop': {
        const id = r.shopStock
          .filter((id) => !r.shopBought.includes(id))
          .sort(
            (a, b) =>
              acquisitionValue(r, b, strategy, branch, forms) -
              acquisitionValue(r, a, strategy, branch, forms),
          )[0];
        if (r.potions < 2 && r.gold >= 30 && !r.shopBought.includes('potion')) {
          action = { type: 'buy', id: 'potion' };
          break;
        }
        if (
          purchases < 2 &&
          r.deck.length < 16 &&
          r.gold >= 45 &&
          id &&
          acquisitionValue(r, id, strategy, branch, forms) > 10
        ) {
          action = { type: 'buy', id };
          break;
        }
        const c = r.deck.find((c) => c.id === 'strike' && !c.upgraded);
        if (removals < 2 && !r.shopRemoved && r.gold >= 45 && r.deck.length > 8 && c) {
          action = { type: 'remove', uid: c.uid };
          break;
        }
        action = { type: 'continue' };
        break;
      }
      case 'rest':
        action = { type: 'rest' };
        break;
      case 'treasure':
        action = { type: 'continue' };
        break;
      default:
        throw Error(`Unexpected screen: ${r.screen}`);
    }
    if (diagnostics.length || !apply(action!, cached)) break;
    if (
      s.run!.screen !== 'battle' &&
      s.meta.partners.includes('hagurumon') &&
      s.run!.support !== 'hagurumon'
    )
      apply({ type: 'equip', id: 'hagurumon' });
    else if (
      s.run!.screen !== 'battle' &&
      (s.meta.scans.hagurumon ?? 0) >= 100 &&
      !s.meta.partners.includes('hagurumon')
    ) {
      apply({ type: 'convert', id: 'hagurumon' });
      apply({ type: 'equip', id: 'hagurumon' });
    }
  }
  if (steps >= 2500) diagnostics.push('step-limit');
  const r = s.run!;
  const requirements = evolutionStatus(r, s.meta, BRANCHES[branch].art);
  const targetMissing = requirements.achieved
    ? []
    : [
        ...requirements.groups
          .filter((g) => !g.some((x) => x.met))
          .map((g) => g.map((x) => ({ label: x.label, current: x.current, goal: x.goal }))),
        ...requirements.data.filter((x) => !x.met),
      ];
  if (!requirements.achieved && !targetMissing.length)
    targetMissing.push([
      {
        label:
          requirements.parent && requirements.stage
            ? '最终满足条件，但未在剩余进化机会中进化'
            : '前置形态或阶段未满足',
        current: 0,
        goal: 1,
      },
    ]);
  return {
    seed,
    strategy,
    branch,
    profile: profile ? 'veteran' : 'new',
    won: r.won,
    reached: r.formHistory.includes(BRANCHES[branch].art),
    targetWon: r.won && r.branch === branch,
    form: r.form,
    row: r.row,
    hp: r.hp,
    steps,
    diagnostics,
    targetMissing,
    death:
      r.hp <= 0
        ? {
            chapter: Math.floor(r.row / r.chapterRows) + 1,
            enemies: r.battle?.enemies.map((e) => e.id),
          }
        : null,
    deck: r.deck.map((c) => ({ id: c.id, upgraded: c.upgraded })),
    relics: r.relics,
    counts: r.activity.counts,
    unlocked: s.meta.unlockedRoutes,
    spent,
    purchases,
    removals,
    skipped,
    picked,
    upgraded,
    used,
    firstPicked,
    battles,
    meta: s.meta,
  };
}
