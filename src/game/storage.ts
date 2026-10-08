import { EVENTS } from './events';
import { ENCOUNTERS } from './encounters';
import { refreshLockedOffers } from './cardSkills';
import { z } from 'zod';
import { emptySave } from './engine';
import { emptyActivity, EVOLUTIONS, syncRouteData } from './evolution';
import { connectMap } from './map';
import { CARDS, ENEMIES, PARTNERS } from './data';
import type { Save } from './types';
export const SAVE_KEY = 'digimon-journey-v1';
const activity = z.object({
  counts: z.record(
    z.enum([
      'attacks',
      'defenses',
      'skills',
      'fire',
      'marks',
      'detonations',
      'markBursts',
      'selfCosts',
      'heals',
      'copies',
      'weakens',
      'combos',
      'burnKills',
      'charges',
      'cannonShots',
      'kills',
      'devourSpent',
      'bigTurns',
    ]),
    z.number().int().nonnegative(),
  ),
  cards: z.record(z.string(), z.number().int().nonnegative()),
});
const card = z.object({
  uid: z.string(),
  id: z.string().refine((id) => id in CARDS),
  upgraded: z.boolean(),
  temporary: z.boolean().optional(),
  copied: z.boolean().optional(),
});
const enemy = z.object({
  uid: z.string(),
  id: z.string().refine((id) => id in ENEMIES),
  hp: z.number(),
  maxHp: z.number().positive(),
  block: z.number(),
  burn: z.number(),
  mark: z.number(),
  strength: z.number(),
  weakened: z.number(),
  vulnerable: z.number().int().nonnegative().optional(),
  opening: z.boolean(),
  stagger: z.number(),
  devour: z.number().int().nonnegative().optional(),
  effectiveAttacks: z.number().int().nonnegative().optional(),
  armorBroken: z.boolean().optional(),
  summons: z.number().int().nonnegative().optional(),
  summonedTurn: z.number().int().nonnegative().optional(),
  summonedBy: z.string().optional(),
  rogue: z.boolean().optional(),
  deathDone: z.boolean().optional(),
});
const node = z.object({
  eventId: z
    .string()
    .refine((id) => id in EVENTS)
    .optional(),
  encounterId: z
    .string()
    .refine((id) => id.startsWith('tutorial-') || ENCOUNTERS.some((e) => e.id === id))
    .optional(),
  next: z.array(z.string()).default([]),
  id: z.string(),
  row: z.number().int(),
  lane: z.number().int(),
  kind: z.enum(['battle', 'elite', 'boss', 'camp', 'shop', 'event', 'treasure', 'evolution']),
  label: z.string(),
  enemies: z.array(z.string().refine((id) => id in ENEMIES)),
});
const reward = z.object({
  gains: z.array(z.string()).optional(),
  unlocks: z.array(z.string()).optional(),
  cards: z.array(z.string().refine((id) => id in CARDS)),
  gold: z.number(),
  scans: z.array(z.object({ id: z.string(), before: z.number(), after: z.number() })),
  relic: z.string().optional(),
});
const battle = z.object({
  activity: activity.default(emptyActivity),
  startActivity: activity.default(emptyActivity),
  selfCostThisTurn: z.boolean().default(false),
  countedKills: z.array(z.string()).default([]),
  enemies: z.array(enemy),
  hand: z.array(card),
  draw: z.array(card),
  discard: z.array(card),
  exhaust: z.array(card),
  turn: z.number().int().positive(),
  enemyTurnIndex: z.number().int().nonnegative().nullable().default(null),
  energy: z.number(),
  block: z.number(),
  sync: z.number(),
  syncThisTurn: z.number(),
  burst: z.number(),
  burstUsed: z.boolean(),
  supportUsed: z.boolean(),
  strength: z.number(),
  charge: z.number(),
  played: z.number(),
  skillsPlayed: z.number().default(0),
  attacks: z.number(),
  attackPlays: z.number().int().nonnegative().default(0),
  nextAttackBonus: z.number().nonnegative().default(0),
  nextAttackHits: z.number().int().nonnegative().default(0),
  cannonGuardUsed: z.boolean().default(false),
  burned: z.boolean(),
  marked: z.boolean(),
  defended: z.boolean(),
  weakenedThisTurn: z.boolean().default(false),
  markedThisTurn: z.boolean().default(false),
  markBurstThisTurn: z.boolean().default(false),
  devour: z.number().int().nonnegative().default(0),
  devourCapBonus: z.number().int().nonnegative().default(0),
  log: z.array(z.string()),
  feedback: z
    .array(
      z.object({
        target: z.string(),
        kind: z.enum(['damage', 'heal']),
        amount: z.number().nonnegative(),
      }),
    )
    .default([]),
});
const run = z
  .object({
    activity: activity.default(emptyActivity),
    victories: z.number().int().nonnegative().default(0),
    bosses: z.number().int().min(0).max(5).default(0),
    formHistory: z.array(z.string().refine((id) => id in EVOLUTIONS)).default([]),
    evolutionTarget: z
      .string()
      .refine((id) => id in EVOLUTIONS)
      .nullable()
      .default(null),
    evolutionReturn: z.enum(['node', 'camp']).default('node'),
    legacyEvolution: z.boolean().default(false),
    bonuses: z.array(z.enum(['holyward', 'ritual'])).default([]),
    partner: z.enum(['guilmon', 'renamon', 'terriermon', 'impmon']),
    form: z.string().refine((id) => id in EVOLUTIONS),
    stage: z.number().int().min(0).max(3),
    branch: z
      .enum([
        'duke',
        'megidra',
        'sakuya',
        'kuzuha',
        'chaos',
        'saint',
        'blacksaint',
        'gluttony',
        'blast',
        'venom',
        'belial',
      ])
      .nullable(),
    training: z.enum(['attack', 'defense']),
    inherit: z.enum(['ember', 'ward', 'seal', 'flow']),
    hp: z.number().min(0),
    maxHp: z.number().positive(),
    gold: z.number().min(0),
    deck: z.array(card),
    relics: z.array(z.string()),
    blessing: z.string(),
    support: z.string(),
    potions: z.number(),
    rng: z.number(),
    seq: z.number(),
    row: z.number().int().min(0).max(59),
    chapterRows: z.number().int().min(6).max(12).default(10),
    nodes: z.array(z.array(node)).min(6).max(60),
    path: z.array(z.string()),
    screen: z.enum([
      'map',
      'battle',
      'reward',
      'camp',
      'shop',
      'event',
      'treasure',
      'evolution',
      'blessing',
      'result',
      'rest',
    ]),
    currentNode: node.nullable(),
    battle: battle.nullable(),
    reward: reward.nullable(),
    shopStock: z.array(z.string()),
    shopBought: z.array(z.string()),
    shopRemoved: z.boolean(),
    spotlight: z.array(z.string()).optional(),
    supportSpent: z.boolean().default(false),
    evolved: z.number(),
    won: z.boolean(),
    kills: z.number(),
    damageDealt: z.number(),
    message: z.string(),
  })
  .refine((r) => r.screen !== 'battle' || r.battle !== null)
  .refine((r) => r.screen !== 'reward' || r.reward !== null);
export const saveSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  meta: z.object({
    unlockedRoutes: z.array(z.enum(['chaos', 'purification', 'mechanical'])).default([]),
    scans: z.record(z.string(), z.number()),
    partners: z.array(z.string()),
    games: z.number(),
    wins: z.number(),
    discovered: z.array(z.string()),
  }),
  run: run.nullable(),
  settings: z.object({ reducedMotion: z.boolean(), sound: z.boolean() }),
});
export function parseSave(raw: string): Save {
  const parsed = saveSchema.parse(JSON.parse(raw));
  const legacy = parsed.version === 1;
  const save: Save = { ...parsed, version: 3 };
  // v2及更早的进行中对局保留8层旧章结构，按旧门槛跑完本局。
  if (parsed.version < 3 && save.run) save.run.chapterRows = 8;
  if (legacy && save.run) {
    const r = save.run;
    connectMap(r.nodes);
    const completed = r.nodes.flat().filter((n) => r.path.includes(n.id));
    const pending =
      r.currentNode &&
      ['reward', 'evolution', 'blessing'].includes(r.screen) &&
      ['battle', 'elite', 'boss'].includes(r.currentNode.kind) &&
      !r.path.includes(r.currentNode.id)
        ? [r.currentNode]
        : [];
    r.victories = [...completed, ...pending].filter((n) =>
      ['battle', 'elite', 'boss'].includes(n.kind),
    ).length;
    r.bosses = [...completed, ...pending].filter((n) => n.kind === 'boss').length;
    r.formHistory = [
      ...PARTNERS[r.partner].forms.slice(0, Math.min(3, r.stage + 1)),
      ...(r.stage === 3 ? [r.form] : []),
    ];
    r.legacyEvolution = r.screen === 'evolution' && r.stage === 2;
  }
  if (save.run) refreshLockedOffers(save.run);
  syncRouteData(save.meta);
  return save;
}
export function loadSave(): { save: Save; error: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { save: emptySave(), error: '' };
    const save = parseSave(raw);
    const version = z.object({ version: z.number() }).parse(JSON.parse(raw)).version;
    if (version === 1 && !localStorage.getItem(`${SAVE_KEY}-before-v2`))
      localStorage.setItem(`${SAVE_KEY}-before-v2`, raw);
    if (version < 3 && !localStorage.getItem(`${SAVE_KEY}-before-v3`))
      localStorage.setItem(`${SAVE_KEY}-before-v3`, raw);
    return { save, error: '' };
  } catch (error) {
    return {
      save: emptySave(),
      error: `无法读取上次存档，已保留原记录。${error instanceof Error ? error.message.slice(0, 80) : '请检查浏览器存储。'}`,
    };
  }
}
export function writeSave(save: Save): string {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return '';
  } catch {
    return '浏览器未能保存进度，请勿关闭此页；可以在设置中下载存档备份。';
  }
}
