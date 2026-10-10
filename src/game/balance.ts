import { CARDS, cardDefinition } from './data';
import { playCost, previewAction, reduceGame } from './engine';
import type { Action, BattleNumber, Card, CardDef, Save } from './types';

// 唯一评分模型。权重是筛查假设，尚未经玩家数据拟合。
export const BALANCE_VERSION = 3;
export const BALANCE_DEFAULTS = {
  prevented: 1.25,
  healing: 2,
  cards: 3,
  energy: 7,
  lifeCost: 2,
  cardSlot: 3,
  turns: 3,
  discount: 0.8,
  markChance: 0.6,
  chargeChance: 0.75,
  devourChance: 0.75,
  futureHits: 6,
};
export type BalanceOptions = Partial<typeof BALANCE_DEFAULTS>;
export type PlayAction = Extract<Action, { type: 'play' }>;

export function burnValue(stacks: number, turns: number, discount = 1, hp = Infinity): number {
  let total = 0,
    remaining = hp;
  for (let t = 0; t < turns && remaining > 0; t++) {
    const damage = Math.min(remaining, Math.max(0, stacks - t));
    total += damage * discount ** t;
    remaining -= damage;
  }
  return total;
}

function incomingOutcome(state: Save) {
  if (state.run?.screen !== 'battle')
    return { loss: 0, screen: state.run?.screen, hp: state.run?.hp };
  // 从伤害反馈取损失，不让回合末胜利回复重复获得“防伤分”。
  const feedback = previewAction(state, { type: 'endTurn' });
  const after = reduceGame(state, { type: 'endTurn' });
  return {
    loss: feedback
      .filter((n) => n.target === 'player' && n.kind === 'damage')
      .reduce((n, x) => n + x.amount, 0),
    screen: after.run?.screen,
    hp: after.run?.hp,
  };
}

const chargeOutlet = (d: CardDef) => !!(d.special === 'cannon' || d.chargeSeg || d.chargedDamage);
const devourOutlet = (d: CardDef) =>
  !!(
    d.special === 'devour' ||
    d.devourHits ||
    d.devourStrength ||
    d.devourVuln ||
    d.devourShield ||
    d.devourHeal ||
    d.devourWeak
  );
const available = (state: Save) => {
  const b = state.run!.battle!;
  return [...b.hand, ...b.draw, ...b.discard];
};

/** 只按可用牌种类估计，不读取隐藏抽牌顺序；耗竭牌不是出口。 */
export function contextualBalanceOptions(state: Save): BalanceOptions {
  const b = state.run?.battle;
  if (!b) return { markChance: 0, chargeChance: 0, devourChance: 0, futureHits: 0 };
  const remaining = available(state).map(cardDefinition);
  const chance = (filter: (d: CardDef) => boolean, fallback: number) =>
    !remaining.some(filter)
      ? 0
      : b.hand.some((c) => filter(cardDefinition(c)) && playCost(state.run, c) <= b.energy)
        ? 1
        : fallback;
  return {
    markChance: remaining.some((d) => d.special === 'markburst') ? BALANCE_DEFAULTS.markChance : 0,
    chargeChance: chance(chargeOutlet, BALANCE_DEFAULTS.chargeChance),
    devourChance: chance(devourOutlet, BALANCE_DEFAULTS.devourChance),
    futureHits: Math.min(
      BALANCE_DEFAULTS.futureHits,
      remaining.reduce(
        (n, d) =>
          n +
          (d.damage
            ? (d.hits ?? 1) * (d.all && !d.scatter ? b.enemies.filter((e) => e.hp > 0).length : 1)
            : 0),
        0,
      ),
    ),
  };
}

// 力量/易伤共享同一段数预算；单体段优先分给易伤最高的目标，群攻逐目标分配。
function hitForecast(state: Save, limit: number) {
  const b = state.run!.battle!,
    hits = b.enemies.map(() => 0);
  const living = b.enemies.map((e, i) => ({ e, i })).filter(({ e }) => e.hp > 0);
  for (const c of available(state)) {
    const d = cardDefinition(c);
    if (!d.damage || !living.length) continue;
    if (d.all && !d.scatter) for (const { i } of living) hits[i] += d.hits ?? 1;
    else if (d.scatter) for (const { i } of living) hits[i] += (d.hits ?? 1) / living.length;
    else
      hits[[...living].sort((a, z) => (z.e.vulnerable ?? 0) - (a.e.vulnerable ?? 0))[0].i] +=
        d.hits ?? 1;
  }
  const scale = Math.min(1, limit / (hits.reduce((n, h) => n + h, 0) || 1));
  return hits.map((h) => h * scale);
}

type ProbeResource = 'charge' | 'devour' | 'nextAttackHits' | 'nextAttackBonus';
// 对每个出口做「有该资源 / 无该资源」的正式结算差分。
// 持久资源最多按 T 次使用同一非耗竭出口；暂态资源只看当前可支付手牌。
// 这是出口潜力估计，补能/取牌只发生在隔离副本，不是合法连招或循环证明。
function outletPotential(state: Save, resource: ProbeResource, config: typeof BALANCE_DEFAULTS) {
  const b = state.run!.battle!,
    transient = resource.startsWith('nextAttack');
  if (!b[resource]) return { damage: b.enemies.map(() => 0), healing: 0, prevented: 0 };
  const candidates = (transient ? b.hand : available(state)).filter((c) => {
    const d = cardDefinition(c);
    return resource === 'charge'
      ? chargeOutlet(d)
      : resource === 'devour'
        ? devourOutlet(d)
        : d.kind === 'attack' && !!d.damage && playCost(state.run, c) <= b.energy;
  });
  let best = { damage: b.enemies.map(() => 0), healing: 0, prevented: 0 },
    bestScore = 0;
  const unique = [
    ...new Map(
      candidates.map((c) => [`${c.id}:${c.upgraded}:${!!c.copied}:${!!c.temporary}`, c]),
    ).values(),
  ];
  for (const c of unique) {
    const simulate = (amount: number) => {
      let s = structuredClone(state);
      const start = s.run!.battle!;
      start.charge =
        start.devour =
        start.strength =
        start.nextAttackHits =
        start.nextAttackBonus =
          0;
      for (const e of start.enemies) {
        e.mark = 0;
        e.burn = 0;
        e.vulnerable = 0;
      }
      start[resource] = amount;
      // 保留其他牌供力量/易伤段数估计，但禁止试算窥视抽牌顺序。
      start.hand = [];
      start.draw = [];
      start.discard = [];
      let healed = 0;
      const uses =
        transient || cardDefinition(c).exhaust || c.copied || c.temporary
          ? 1
          : Math.max(1, Math.floor(config.turns));
      for (let i = 0; i < uses && s.run!.screen === 'battle'; i++) {
        const turn = s.run!.battle!;
        turn.hand = [structuredClone(c)];
        turn.draw = [];
        turn.discard = [];
        turn.energy = Math.max(turn.energy, playCost(s.run, c));
        const action: PlayAction = { type: 'play', uid: c.uid };
        const feedback = previewAction(s, action);
        healed += feedback
          .filter((n) => n.target === 'player' && n.kind === 'heal')
          .reduce((n, x) => n + x.amount, 0);
        s = reduceGame(s, action);
      }
      const end = s.run!.battle!,
        hits = hitForecast(state, config.futureHits);
      return {
        damage: end.enemies.map(
          (e, i) =>
            b.enemies[i].hp -
            e.hp +
            (s.run!.screen === 'battle'
              ? Math.min(e.hp, hits[i] * (end.strength + (e.vulnerable ?? 0) * config.discount))
              : 0),
        ),
        dead: s.run!.hp <= 0,
        healing: healed,
        loss: incomingOutcome(s).loss,
      };
    };
    const withResource = simulate(b[resource]),
      without = simulate(0);
    if (withResource.dead) continue;
    const result = {
      damage: withResource.damage.map((n, i) => Math.max(0, n - without.damage[i])),
      healing: Math.max(0, withResource.healing - without.healing),
      prevented: Math.max(0, without.loss - withResource.loss),
    };
    const value =
      result.damage.reduce((n, x) => n + x, 0) +
      config.healing * result.healing +
      config.prevented * result.prevented;
    if (value > bestScore) {
      bestScore = value;
      best = result;
    }
  }
  return best;
}

function resourcePool(state: Save, options: BalanceOptions) {
  const pool = {
    burn: 0,
    marks: 0,
    charge: 0,
    devour: 0,
    vulnerable: 0,
    nextAttack: 0,
    strength: 0,
  };
  const b = state.run?.battle;
  if (!b || state.run?.screen !== 'battle') return pool;
  const config = { ...BALANCE_DEFAULTS, ...contextualBalanceOptions(state), ...options };
  const budget = b.enemies.map((e) => Math.max(0, e.hp));
  const claim = (i: number, value: number) => {
    const used = Math.min(budget[i], Math.max(0, value));
    budget[i] -= used;
    return used;
  };
  const outlets = available(state)
    .map(cardDefinition)
    .filter((d) => d.special === 'markburst');
  for (const [i, e] of b.enemies.entries()) {
    pool.burn += claim(i, burnValue(e.burn, config.turns, config.discount, budget[i]));
    // 符印留在各目标身上，按真实出口倍率计价，不再固定为5。
    const power = Math.max(0, ...outlets.map((d) => d.markPower ?? 5));
    pool.marks += claim(i, e.mark * power * config.markChance);
  }
  let healingBudget = state.run.maxHp - state.run.hp,
    protectionBudget = incomingOutcome(state).loss;
  for (const resource of ['charge', 'devour', 'nextAttackHits', 'nextAttackBonus'] as const) {
    const chance =
      resource === 'charge' ? config.chargeChance : resource === 'devour' ? config.devourChance : 1;
    if (!chance) continue;
    const potential = outletPotential(state, resource, config);
    const healing = Math.min(healingBudget, potential.healing * chance),
      prevented = Math.min(protectionBudget, potential.prevented * chance);
    healingBudget -= healing;
    protectionBudget -= prevented;
    const value =
      potential.damage.reduce((n, x, i) => n + claim(i, x * chance), 0) +
      config.healing * healing +
      config.prevented * prevented;
    if (resource.startsWith('nextAttack')) pool.nextAttack += value;
    else pool[resource as 'charge' | 'devour'] += value;
  }
  const hits = hitForecast(state, config.futureHits);
  for (const [i, e] of b.enemies.entries()) {
    pool.vulnerable += claim(i, (e.vulnerable ?? 0) * hits[i] * config.discount);
    pool.strength += claim(i, b.strength * hits[i]);
  }
  return pool;
}

/** 不压成虚假精确分值的条件收益，必须和U一起展示。 */
function unpricedEffects(state: Save, next: Save, cards: Card[]) {
  const flags = new Set<string>();
  for (const c of cards) {
    const d = cardDefinition(c);
    if (d.exhaust || c.copied || c.temporary) flags.add('exhaust-deck-thinning');
    if (d.special === 'purge') flags.add('fault-removal');
    if (d.special === 'copy') flags.add('copy-selection');
    if (d.special === 'devouraura') flags.add('devour-capacity');
    if (d.weak || d.devourWeak) flags.add('weakness-after-current-turn');
  }
  const old = state.run!.battle!,
    b = next.run!.battle!;
  if (b.enemies.some((e, i) => e.block < old.enemies[i].block && e.hp > 0))
    flags.add('shield-breaking');
  if (b.burst !== old.burst || b.sync !== old.sync) flags.add('sync-burst');
  return [...flags];
}

/** 序列严格依次验证，任意非法步骤返回诊断；不提交部分状态。 */
export function calibrateSequence(
  state: Save,
  actions: PlayAction[],
  options: BalanceOptions = {},
) {
  if (!state.run?.battle || state.run.screen !== 'battle') throw Error('校准需要战斗状态。');
  if (!actions.length) return { legal: false as const, score: 0, reason: 'empty-sequence' };
  const config = { ...BALANCE_DEFAULTS, ...options },
    before = state.run.battle;
  let next = state,
    drawn = 0,
    paid = 0;
  const feedback: BattleNumber[] = [];
  const playedCards: Card[] = [];
  for (const [index, action] of actions.entries()) {
    const b = next.run?.battle,
      c = b?.hand.find((c) => c.uid === action.uid);
    if (next.run?.screen !== 'battle' || !b || !c)
      return { legal: false as const, score: 0, reason: 'unavailable-card', index };
    const after = reduceGame(next, action);
    if (after.run!.battle!.played === b.played)
      return { legal: false as const, score: 0, reason: 'rejected-action', index };
    paid += playCost(next.run, c);
    playedCards.push(c);
    feedback.push(...previewAction(next, action));
    const previous = new Set(b.hand.map((c) => c.uid));
    drawn += after.run!.battle!.hand.filter(
      (c) => !previous.has(c.uid) && CARDS[c.id].kind !== 'status',
    ).length;
    next = after;
  }
  const after = next.run!.battle!,
    terminal = next.run!.screen !== 'battle',
    dead = next.run!.hp <= 0;
  const damage = feedback
    .filter((n) => n.target !== 'player' && n.kind === 'damage')
    .reduce((sum, n) => sum + n.amount, 0);
  const healing = feedback
    .filter((n) => n.target === 'player' && n.kind === 'heal')
    .reduce((sum, n) => sum + n.amount, 0);
  const lifeCost = feedback
    .filter((n) => n.target === 'player' && n.kind === 'damage')
    .reduce((sum, n) => sum + n.amount, 0);
  const baseline = incomingOutcome(state),
    incoming = incomingOutcome(next);
  const prevented = dead ? 0 : baseline.loss - incoming.loss;
  // 胜利/死亡后新牌和返能不再具有本场利用价值，支付成本仍保留。
  const cards = terminal ? 0 : drawn,
    energy = terminal ? 0 - paid : after.energy - before.energy;
  const oldPool = resourcePool(state, options),
    pool = resourcePool(next, options);
  const burn = pool.burn - oldPool.burn,
    marks = pool.marks - oldPool.marks,
    charge = pool.charge - oldPool.charge,
    strength = pool.strength - oldPool.strength;
  const devour = pool.devour - oldPool.devour,
    vulnerable = pool.vulnerable - oldPool.vulnerable,
    nextAttack = pool.nextAttack - oldPool.nextAttack;
  const future = burn + marks + charge + strength + devour + vulnerable + nextAttack;
  const score =
    damage +
    config.prevented * prevented +
    config.healing * healing +
    config.cards * cards +
    config.energy * energy +
    future -
    config.lifeCost * lifeCost -
    config.cardSlot * actions.length;
  return {
    legal: true as const,
    score,
    damage,
    prevented,
    healing,
    cards,
    drawn,
    energy,
    paid,
    lifeCost,
    future,
    burn,
    marks,
    charge,
    strength,
    devour,
    vulnerable,
    nextAttack,
    resourceBefore: oldPool,
    resourceAfter: pool,
    unpricedEffects: unpricedEffects(state, next, playedCards),
    modelVersion: BALANCE_VERSION,
    plays: actions.length,
    netLife: next.run!.hp - state.run.hp,
    terminal,
    dead,
    screen: next.run!.screen,
    endTurnScreen: incoming.screen,
    endTurnHp: incoming.hp,
    baselineEndTurnHp: baseline.hp,
    state: next,
  };
}

export function calibrateAction(state: Save, action: PlayAction, options: BalanceOptions = {}) {
  const metric = calibrateSequence(state, [action], options);
  if (!metric.legal) return { legal: false as const, score: 0 };
  const { state: result, ...report } = metric;
  void result;
  return report;
}
