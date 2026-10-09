export type Partner = 'guilmon' | 'renamon' | 'terriermon';
export type Branch = 'duke' | 'megidra' | 'sakuya' | 'kuzuha' | 'chaos' | 'saint' | 'blacksaint';
export type Screen = 'map' | 'battle' | 'reward' | 'camp' | 'shop' | 'event' | 'treasure' | 'evolution' | 'blessing' | 'result';
export type NodeKind = 'battle' | 'elite' | 'boss' | 'camp' | 'shop' | 'event' | 'treasure' | 'evolution';
export type CardKind = 'attack' | 'skill' | 'power' | 'status';
export type Special = 'detonate' | 'shieldhit' | 'markburst' | 'copy' | 'cannon' | 'purge' | 'sacrifice';
export interface CardDef { id: string; name: string; cost: number; kind: CardKind; family: Partner | Branch | 'common' | 'status'; text: string; damage?: number; hits?: number; shield?: number; burn?: number; mark?: number; draw?: number; heal?: number; energy?: number; charge?: number; chargeMultiplier?: number; chargedDamage?: number; strength?: number; all?: boolean; exhaust?: boolean; special?: Special; art: string; unlockForm?: string; unlockForms?: string[]; series?: string; weak?: number; drain?: number; copyChoice?: boolean; upgrade: CardUpgrade; }
// 强化存放最终数值，不再通过卡牌类型推断减费或逐段增伤。
export type CardUpgrade = Partial<Pick<CardDef, 'cost'|'damage'|'hits'|'shield'|'burn'|'mark'|'draw'|'heal'|'energy'|'charge'|'chargeMultiplier'|'chargedDamage'|'strength'|'exhaust'|'weak'|'drain'|'copyChoice'>> & {text: string};
export interface Card { uid: string; id: string; upgraded: boolean; temporary?: boolean; copied?: boolean }
export interface EnemyDef { id: string; name: string; art: string; hp: number; style: 'charge'|'jam'|'shield'|'buff'|'evade'|'rapid'|'spider'|'chicken'|'sword'|'core'|'expanded'; scan: boolean; support?: string; }
export interface Enemy { uid: string; id: string; hp: number; maxHp: number; block: number; burn: number; mark: number; strength: number; weakened: number; opening: boolean; stagger: number; effectiveAttacks?:number; armorBroken?:boolean }
export interface Intent { name: string; type: 'attack'|'block'|'debuff'|'buff'|'heal'; damage: number; hits: number; shield: number; detail: string; heal?:number; drain?:number; jam?:number; strength?:number; }
export interface BattleNumber { target: string | 'player'; kind: 'damage' | 'heal'; amount: number; }
export type Metric = 'attacks'|'defenses'|'skills'|'fire'|'marks'|'detonations'|'markBursts'|'selfCosts'|'heals'|'copies'|'weakens'|'combos'|'burnKills'|'charges'|'cannonShots';
export interface Activity { counts: Partial<Record<Metric, number>>; cards: Record<string, number>; }
export interface Battle { activity: Activity; startActivity: Activity; selfCostThisTurn: boolean; countedKills: string[]; enemies: Enemy[]; hand: Card[]; draw: Card[]; discard: Card[]; exhaust: Card[]; turn: number; enemyTurnIndex: number|null; energy: number; block: number; sync: number; syncThisTurn: number; burst: number; burstUsed: boolean; supportUsed: boolean; strength: number; charge: number; played: number; skillsPlayed: number; attacks: number; attackPlays: number; nextAttackBonus: number; cannonGuardUsed: boolean; copyUses: number; burnFollowupUsed: boolean; burned: boolean; marked: boolean; defended: boolean; log: string[]; feedback: BattleNumber[]; }
export interface MapNode { id: string; row: number; lane: number; kind: NodeKind; label: string; enemies: string[]; next: string[]; encounterId?:string; eventId?:string; }
export interface Reward { cards: string[]; gold: number; scans: {id:string; before:number; after:number}[]; relic?: string; gains?: string[]; unlocks?: string[]; }
export interface Run { activity: Activity; victories: number; bosses: number; formHistory: string[]; evolutionTarget: string|null; evolutionReturn: 'node'|'camp'; legacyEvolution: boolean; bonuses: string[]; partner: Partner; form: string; stage: number; branch: Branch|null; training: 'attack'|'defense'; inherit: 'ember'|'ward'|'seal'|'flow'; hp: number; maxHp: number; gold: number; deck: Card[]; relics: string[]; blessing: string; support: string; potions: number; rng: number; seq: number; row: number; nodes: MapNode[][]; path: string[]; screen: Screen; currentNode: MapNode|null; battle: Battle|null; reward: Reward|null; shopStock: string[]; shopBought: string[]; shopRemoved: boolean; evolved: number; won: boolean; kills: number; damageDealt: number; message: string; }
export interface Meta { unlockedRoutes: string[]; scans: Record<string,number>; partners: string[]; games: number; wins: number; discovered: string[]; }
export interface Save { version: 2; meta: Meta; run: Run|null; settings: { reducedMotion: boolean; sound: boolean }; }
export type Action =
 | {type:'start';partner:Partner;seed?:number}
 | {type:'node';id:string}
 | {type:'play';uid:string;target?:string;copyUid?:string}
 | {type:'endTurn'} | {type:'beginEnemyTurn'} | {type:'enemyStep'} | {type:'finishEnemyTurn'} | {type:'support';target?:string} | {type:'burst'} | {type:'potion'}
 | {type:'reward';card?:string} | {type:'continue'}
 | {type:'camp';mode:'heal'|'upgrade';uid?:string}
 | {type:'buy';id:string} | {type:'remove';uid:string}
 | {type:'event';choice:'risk'|'safe';uid?:string} | {type:'bless';id:string}
 | {type:'track';form:string|null} | {type:'campEvolution'} | {type:'deferEvolution'}
 | {type:'evolve';form?:string;branch?:Branch;training?:'attack'|'defense';replace?:string[];inherit?:Run['inherit']}
 | {type:'convert';id:string} | {type:'equip';id:string}
 | {type:'settings';key:'sound'|'reducedMotion'} | {type:'abandon'};
