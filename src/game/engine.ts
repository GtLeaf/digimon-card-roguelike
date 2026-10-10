import {
  beginEnemyTurn,
  endTurn,
  enemyStep,
  finishEnemyTurn,
  finishNode,
  playCard,
  applyBurst,
  applyPotion,
  applySupport,
} from './battle';
import { BLESSINGS, ENEMIES } from './data';
import { EVOLUTIONS, emptyActivity, stageLimit } from './evolution';
import {
  blessAction,
  buyAction,
  campAction,
  eventAction,
  evolveAction,
  nodeAction,
  removeAction,
  restAction,
  rewardAction,
} from './runActions';
import { makeCard, rand } from './random';
import { generateWorld } from './world';
import type { Action, BattleNumber, Partner, Run, Save } from './types';

export {
  cardCost,
  playCost,
  cardTarget,
  intent,
  enemyIntents,
  enemyEnrage,
  enemyCountdown,
} from './battle';

export const emptySave = (): Save => ({
  version: 3,
  meta: { unlockedRoutes: [], scans: {}, partners: [], games: 0, wins: 0, discovered: [] },
  run: null,
  settings: { reducedMotion: false, sound: false },
});
export function makeRun(partner: Partner, seed: number, tutorial = true): Run {
  const r: Run = {
    activity: emptyActivity(),
    victories: 0,
    bosses: 0,
    formHistory: [partner],
    evolutionTarget: null,
    evolutionReturn: 'node',
    legacyEvolution: false,
    bonuses: [],
    partner,
    form: partner,
    stage: 0,
    branch: null,
    training: 'attack',
    inherit: partner === 'guilmon' ? 'ember' : partner === 'renamon' ? 'seal' : 'ward',
    hp: partner === 'guilmon' ? 90 : partner === 'renamon' ? 82 : partner === 'impmon' ? 84 : 86,
    maxHp: partner === 'guilmon' ? 90 : partner === 'renamon' ? 82 : partner === 'impmon' ? 84 : 86,
    gold: 65,
    deck: [],
    relics: [],
    blessing: '',
    support: 'default',
    potions: 1,
    rng: seed >>> 0,
    seq: 0,
    row: 0,
    chapterRows: 10,
    nodes: [],
    path: [],
    screen: 'blessing',
    currentNode: null,
    battle: null,
    reward: null,
    shopStock: [],
    shopRelicStock: [],
    shopBought: [],
    shopRemoved: false,
    spotlight: [],
    supportSpent: false,
    evolved: 0,
    won: false,
    kills: 0,
    damageDealt: 0,
    message: '选择旅途祝福',
  };
  if (partner === 'terriermon')
    r.deck = [
      'strike',
      'strike',
      'strike',
      'guard',
      'guard',
      'guard',
      'charge',
      'cannon',
      'tinyTwister',
      'blazingShot',
    ].map((id) => makeCard(r, id));
  else if (partner === 'impmon')
    r.deck = [
      'strike',
      'strike',
      'strike',
      'guard',
      'guard',
      'guard',
      'nightfire',
      'nightfire',
      'taunt',
      'devourTrick',
    ].map((id) => makeCard(r, id));
  else
    r.deck = [
      ...Array.from({ length: 4 }, () => makeCard(r, 'strike')),
      ...Array.from({ length: 4 }, () => makeCard(r, 'guard')),
      makeCard(r, partner === 'guilmon' ? 'fireball' : partner === 'renamon' ? 'seal' : 'leaf'),
      makeCard(r, partner === 'guilmon' ? 'rock' : 'talisman'),
    ];
  r.nodes = generateWorld(() => rand(r), tutorial);
  return r;
}
function runAction(state: Save, action: Action): Save {
  const s = structuredClone(state);
  const meta = s.meta;
  if (action.type === 'settings') {
    s.settings[action.key] = !s.settings[action.key];
    return s;
  }
  if (action.type === 'start') {
    if (s.run && s.run.screen !== 'result') return state;
    if (action.partner === 'impmon' && (meta.scans.beelzebumon ?? 0) < 100) return state;
    s.run = makeRun(action.partner, action.seed ?? Date.now(), (meta.scans.hagurumon ?? 0) < 100);
    meta.games++;
    return s;
  }
  if (action.type === 'convert') {
    if (
      (meta.scans[action.id] ?? 0) >= 100 &&
      ENEMIES[action.id]?.support &&
      !meta.partners.includes(action.id)
    )
      meta.partners.push(action.id);
    return s;
  }
  const r = s.run;
  if (!r) return state;
  if (
    r.battle &&
    ['play', 'enemyStep', 'finishEnemyTurn', 'potion', 'support'].includes(action.type)
  )
    r.battle.feedback = [];
  if (action.type === 'track') {
    if (action.form === null || EVOLUTIONS[action.form]?.partner === r.partner)
      r.evolutionTarget = action.form;
    return s;
  }
  if (action.type === 'campEvolution' && r.screen === 'camp' && r.stage < stageLimit(r)) {
    r.evolutionReturn = 'camp';
    r.screen = 'evolution';
    return s;
  }
  if (action.type === 'deferEvolution' && r.screen === 'evolution') {
    if (r.evolutionReturn === 'camp') r.screen = 'camp';
    else if (r.currentNode?.kind === 'boss') r.screen = 'blessing';
    else finishNode(r);
    return s;
  }
  if (action.type === 'abandon') {
    r.screen = 'result';
    r.won = false;
    return s;
  }
  if (action.type === 'equip') {
    if (r.screen !== 'battle' && (action.id === 'default' || meta.partners.includes(action.id)))
      r.support = action.id;
    return s;
  }
  if (action.type === 'node') {
    if (r.screen !== 'map') return state;
    if (!nodeAction(s, action)) return state;
    return s;
  }
  if (action.type === 'play' && r.screen === 'battle' && r.battle?.enemyTurnIndex === null)
    playCard(r, meta, action.uid, action.target, action.copyUid);
  if (action.type === 'endTurn' && r.screen === 'battle') endTurn(r, meta);
  if (action.type === 'beginEnemyTurn' && r.screen === 'battle') beginEnemyTurn(r);
  if (action.type === 'enemyStep' && r.screen === 'battle') enemyStep(r, meta);
  if (action.type === 'finishEnemyTurn' && r.screen === 'battle') finishEnemyTurn(r, meta);
  if (
    action.type === 'potion' &&
    r.screen === 'battle' &&
    r.battle?.enemyTurnIndex === null &&
    r.potions > 0 &&
    r.hp < r.maxHp
  )
    applyPotion(r);
  if (
    action.type === 'support' &&
    r.screen === 'battle' &&
    r.battle &&
    r.battle.enemyTurnIndex === null &&
    !r.battle.supportUsed
  )
    applySupport(r, meta, action.target);
  if (
    action.type === 'burst' &&
    r.screen === 'battle' &&
    r.battle &&
    r.battle.enemyTurnIndex === null &&
    (r.branch || EVOLUTIONS[r.form]?.endpoint)
  )
    applyBurst(r);
  if (action.type === 'reward' && r.screen === 'reward' && r.reward) {
    if (!rewardAction(s, action)) return state;
    return s;
  }
  if (action.type === 'continue' && ['treasure', 'shop', 'camp'].includes(r.screen)) finishNode(r);
  if (action.type === 'camp' && r.screen === 'camp') campAction(s, action);
  if (action.type === 'rest' && r.screen === 'rest') restAction(s);
  if (action.type === 'buy' && r.screen === 'shop' && !r.shopBought.includes(action.id))
    buyAction(s, action);
  if (
    action.type === 'remove' &&
    r.screen === 'shop' &&
    !r.shopRemoved &&
    r.gold >= 45 &&
    r.deck.length > 5
  )
    removeAction(s, action);
  if (action.type === 'event' && r.screen === 'event') {
    if (!eventAction(s, action)) return state;
    return s;
  }
  if (action.type === 'bless' && r.screen === 'blessing' && BLESSINGS[action.id])
    blessAction(s, action);
  if (action.type === 'evolve' && r.screen === 'evolution') {
    if (!evolveAction(s, action)) return state;
    return s;
  }
  return s;
}
export function previewAction(state: Save, action: Action): BattleNumber[] {
  const next = runAction(state, action);
  return next === state ? [] : (next.run?.battle?.feedback ?? []);
}
export function reduceGame(state: Save, action: Action): Save {
  const next = runAction(state, action);
  if (next !== state && next.run?.battle) next.run.battle.feedback = [];
  return next;
}
