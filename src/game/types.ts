export type Partner = 'guilmon' | 'renamon' | 'terriermon' | 'impmon';
export type Branch =
  | 'duke'
  | 'megidra'
  | 'sakuya'
  | 'kuzuha'
  | 'chaos'
  | 'saint'
  | 'blacksaint'
  | 'gluttony'
  | 'blast'
  | 'venom'
  | 'belial';
export type Screen =
  | 'map'
  | 'battle'
  | 'reward'
  | 'camp'
  | 'shop'
  | 'event'
  | 'treasure'
  | 'evolution'
  | 'blessing'
  | 'result'
  | 'rest';
export type NodeKind =
  'battle' | 'elite' | 'boss' | 'camp' | 'shop' | 'event' | 'treasure' | 'evolution';
export type CardKind = 'attack' | 'skill' | 'power' | 'status';
export type Special =
  | 'detonate'
  | 'shieldhit'
  | 'markburst'
  | 'copy'
  | 'cannon'
  | 'purge'
  | 'sacrifice'
  | 'devour'
  | 'devouraura'
  | 'lure'
  | 'spinstep';
export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: CardKind;
  family: Partner | Branch | 'common' | 'status';
  text: string;
  damage?: number;
  hits?: number;
  shield?: number;
  burn?: number;
  mark?: number;
  markPower?: number;
  draw?: number;
  heal?: number;
  energy?: number;
  charge?: number;
  chargeMultiplier?: number;
  chargedDamage?: number;
  upgradeDamage?: number;
  // 强化后的吸血量（不设置则强化不改变吸血）
  upgradeDrain?: number;
  upgradeText?: string;
  // 强化后额外抽牌（设置后能量强化不再享受默认 +1）
  upgradeDraw?: number;
  strength?: number;
  all?: boolean;
  exhaust?: boolean;
  special?: Special;
  art: string;
  unlockForm?: string;
  series?: string;
  weak?: number;
  drain?: number;
  // 比例吸血：每造成 N 点生命伤害回复 1 生命（与 drain 二选一）
  drainRatio?: number;
  upgradeDrainRatio?: number;
  devour?: number;
  devourPower?: number;
  devourShield?: number;
  devourWeak?: number;
  devourHeal?: number;
  // 消耗至多 3 层噬能，每层增加的攻击段数
  devourHits?: number;
  devourVuln?: number;
  // 消耗全部噬能，每 N 层获得 1 力量
  devourStrength?: number;
  devourAll?: boolean;
  convert?: number;
}
export interface Card {
  uid: string;
  id: string;
  upgraded: boolean;
  temporary?: boolean;
  copied?: boolean;
}
export interface EnemyDef {
  id: string;
  name: string;
  art: string;
  hp: number;
  style:
    | 'charge'
    | 'jam'
    | 'shield'
    | 'buff'
    | 'evade'
    | 'rapid'
    | 'spider'
    | 'chicken'
    | 'sword'
    | 'core'
    | 'expanded';
  scan: boolean;
  support?: string;
  guard?: boolean;
  onDeath?: 'explode' | 'rally';
}
export interface Enemy {
  uid: string;
  id: string;
  hp: number;
  maxHp: number;
  block: number;
  burn: number;
  mark: number;
  strength: number;
  weakened: number;
  vulnerable?: number;
  opening: boolean;
  stagger: number;
  devour?: number;
  effectiveAttacks?: number;
  armorBroken?: boolean;
  summons?: number;
  summonedTurn?: number;
  summonedBy?: string;
  rogue?: boolean;
  deathDone?: boolean;
}
export interface Intent {
  name: string;
  type: 'attack' | 'block' | 'debuff' | 'buff' | 'heal';
  damage: number;
  hits: number;
  shield: number;
  detail: string;
  heal?: number;
  drain?: number;
  jam?: number;
  strength?: number;
  summon?: string[];
  pierce?: boolean;
}
export interface BattleNumber {
  target: string | 'player';
  kind: 'damage' | 'heal';
  amount: number;
}
export type Metric =
  | 'attacks'
  | 'defenses'
  | 'skills'
  | 'fire'
  | 'marks'
  | 'detonations'
  | 'markBursts'
  | 'selfCosts'
  | 'heals'
  | 'copies'
  | 'weakens'
  | 'combos'
  | 'burnKills'
  | 'charges'
  | 'cannonShots'
  | 'kills'
  | 'devourSpent'
  | 'bigTurns';
export interface Activity {
  counts: Partial<Record<Metric, number>>;
  cards: Record<string, number>;
}
export interface Battle {
  activity: Activity;
  startActivity: Activity;
  selfCostThisTurn: boolean;
  countedKills: string[];
  enemies: Enemy[];
  hand: Card[];
  draw: Card[];
  discard: Card[];
  exhaust: Card[];
  turn: number;
  enemyTurnIndex: number | null;
  energy: number;
  block: number;
  sync: number;
  syncThisTurn: number;
  burst: number;
  burstUsed: boolean;
  supportUsed: boolean;
  strength: number;
  charge: number;
  played: number;
  skillsPlayed: number;
  attacks: number;
  attackPlays: number;
  nextAttackBonus: number;
  cannonGuardUsed: boolean;
  burned: boolean;
  marked: boolean;
  defended: boolean;
  weakenedThisTurn: boolean;
  markedThisTurn: boolean;
  devour: number;
  // 噬能光环提供的上限加成（基础上限 6）
  devourCapBonus: number;
  log: string[];
  feedback: BattleNumber[];
}
export interface MapNode {
  id: string;
  row: number;
  lane: number;
  kind: NodeKind;
  label: string;
  enemies: string[];
  next: string[];
  encounterId?: string;
  eventId?: string;
}
export interface Reward {
  cards: string[];
  gold: number;
  scans: { id: string; before: number; after: number }[];
  relic?: string;
  gains?: string[];
  unlocks?: string[];
}
export interface Run {
  activity: Activity;
  victories: number;
  bosses: number;
  formHistory: string[];
  evolutionTarget: string | null;
  evolutionReturn: 'node' | 'camp';
  legacyEvolution: boolean;
  bonuses: string[];
  partner: Partner;
  form: string;
  stage: number;
  branch: Branch | null;
  training: 'attack' | 'defense';
  inherit: 'ember' | 'ward' | 'seal' | 'flow';
  hp: number;
  maxHp: number;
  gold: number;
  deck: Card[];
  relics: string[];
  blessing: string;
  support: string;
  potions: number;
  rng: number;
  seq: number;
  row: number;
  chapterRows: number;
  nodes: MapNode[][];
  path: string[];
  screen: Screen;
  currentNode: MapNode | null;
  battle: Battle | null;
  reward: Reward | null;
  shopStock: string[];
  shopBought: string[];
  shopRemoved: boolean;
  /** 进化后获得的新卡 uid，下一场战斗洗入抽牌堆前半段后清空 */
  spotlight?: string[];
  supportSpent: boolean;
  evolved: number;
  won: boolean;
  kills: number;
  damageDealt: number;
  message: string;
}
export interface Meta {
  unlockedRoutes: string[];
  scans: Record<string, number>;
  partners: string[];
  games: number;
  wins: number;
  discovered: string[];
}
export interface Save {
  version: 3;
  meta: Meta;
  run: Run | null;
  settings: { reducedMotion: boolean; sound: boolean };
}
export type Action =
  | { type: 'start'; partner: Partner; seed?: number }
  | { type: 'node'; id: string }
  | { type: 'play'; uid: string; target?: string }
  | { type: 'endTurn' }
  | { type: 'beginEnemyTurn' }
  | { type: 'enemyStep' }
  | { type: 'finishEnemyTurn' }
  | { type: 'support'; target?: string }
  | { type: 'burst' }
  | { type: 'potion' }
  | { type: 'reward'; card?: string }
  | { type: 'continue' }
  | { type: 'camp'; mode: 'heal' | 'upgrade'; uid?: string }
  | { type: 'buy'; id: string }
  | { type: 'remove'; uid: string }
  | { type: 'event'; choice: 'risk' | 'safe'; uid?: string }
  | { type: 'bless'; id: string }
  | { type: 'track'; form: string | null }
  | { type: 'campEvolution' }
  | { type: 'deferEvolution' }
  | { type: 'rest' }
  | {
      type: 'evolve';
      form?: string;
      branch?: Branch;
      training?: 'attack' | 'defense';
      replace?: string[];
      inherit?: Run['inherit'];
    }
  | { type: 'convert'; id: string }
  | { type: 'equip'; id: string }
  | { type: 'settings'; key: 'sound' | 'reducedMotion' }
  | { type: 'abandon' };
