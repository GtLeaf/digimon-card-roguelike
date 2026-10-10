import type { CardUpgrade } from './types';

// 强化使用最终数值，兼容本地校准与远端新增卡；界面和结算读取同一配置。
export const CARD_UPGRADES: Record<string, CardUpgrade> = {
  strike: {
    damage: 10,
    text: '造成 10 点伤害。',
  },
  guard: {
    shield: 10,
    text: '获得 10 护盾。',
  },
  haste: {
    cost: 0,
    draw: 2,
    text: '抽 2 张牌。耗竭。',
  },
  fortify: {
    shield: 20,
    text: '获得 20 护盾。',
  },
  mend: {
    cost: 1,
    heal: 7,
    text: '回复 7 点生命。耗竭。',
  },
  battery: {
    cost: 0,
    draw: 1,
    text: '获得 1 点行动力，抽 1 张牌。耗竭。',
  },
  study: {
    draw: 3,
    text: '抽 3 张牌。',
  },
  purge: {
    cost: 0,
    draw: 2,
    text: '清除手牌中的故障牌，抽 2 张。耗竭。',
  },
  brace: {
    shield: 8,
    text: '获得 8 护盾，抽 1 张牌。',
  },
  shieldbash: {
    damage: 7,
    text: '造成 7 ＋当前护盾一半的伤害。',
  },
  charge: {
    shield: 7,
    text: '获得 1 蓄能，获得 7 护盾。',
  },
  cannon: {
    damage: 17,
    text: '造成 17 伤害，消耗全部蓄能，每层额外 4 伤害。',
  },
  fireball: {
    damage: 9,
    text: '造成 9 伤害，施加 2 灼烧。',
  },
  rock: {
    damage: 13,
    text: '造成 13 点伤害。',
  },
  ignite: {
    damage: 6,
    text: '造成 6 伤害；消耗目标灼烧，每层额外 3 伤害。',
  },
  inferno: {
    damage: 18,
    text: '对所有敌人造成 18 伤害。耗竭。',
  },
  doublecut: {
    damage: 7,
    text: '造成 7×2 段伤害。',
  },
  roar: {
    cost: 0,
    strength: 2,
    text: '本场攻击每段伤害＋2。耗竭。',
  },
  heatwave: {
    damage: 6,
    text: '对所有敌人造成 6 伤害，施加 1 灼烧。',
  },
  sacrifice: {
    cost: 0,
    energy: 2,
    draw: 2,
    text: '失去 3 生命，获得 2 行动力，抽 2 张牌。耗竭。',
  },
  darkOverload: {
    cost: 0,
    energy: 2,
    draw: 2,
    text: '失去 3 生命，获得 2 行动力，抽 2 张牌。耗竭。',
  },
  darkDrain: {
    damage: 9,
    text: '造成 9 伤害；若造成生命伤害，回复 2 生命。',
  },
  flare: {
    shield: 11,
    text: '获得 11 护盾，对所有敌人施加 1 灼烧。',
  },
  emberCannon: {
    damage: 15,
    text: '造成 15 伤害，施加 2 灼烧；消耗全部蓄能，每层额外 4 伤害。',
  },
  leaf: {
    damage: 5,
    text: '造成 5×2 段伤害，施加 1 符印。',
  },
  illusion: {
    copyChoice: true,
    draw: 1,
    text: '选择手中一张可复制牌；复制品耗竭。抽 1 张牌。每回合最多复制 2 次。',
  },
  talisman: {
    shield: 7,
    text: '施加 3 符印，获得 7 护盾。',
  },
  seal: {
    damage: 8,
    text: '造成 8 伤害；消耗符印，每层额外 5 伤害。',
  },
  spirit: {
    damage: 10,
    text: '造成 10 伤害，施加 1 灼烧和 1 符印。',
  },
  barrier: {
    shield: 13,
    text: '获得 13 护盾。',
  },
  insight: {
    cost: 0,
    draw: 3,
    text: '抽 3 张牌。耗竭。',
  },
  cyclone: {
    damage: 14,
    text: '对所有敌人造成 14 伤害，施加 1 符印。',
  },
  ritual: {
    cost: 0,
    text: '本场攻击每段伤害＋1，抽 1 张牌。耗竭。',
  },
  royal: {
    damage: 25,
    shield: 11,
    text: '造成 25 伤害，获得 11 护盾。',
  },
  aegis: {
    shield: 13,
    text: '获得 13 护盾，抽 1 张牌。',
  },
  gramLance: {
    damage: 15,
    text: '造成 15 伤害；当前护盾每 3 点追加 1 伤害。',
  },
  megido: {
    damage: 22,
    text: '失去 3 生命；对所有敌人造成 22 伤害、施加 4 灼烧。耗竭。',
  },
  apocalypse: {
    cost: 0,
    text: '对所有敌人施加 3 灼烧。',
  },
  judgment: {
    damage: 9,
    text: '对所有敌人造成 9 伤害；每个目标的灼烧每层追加 3 伤害，灼烧不消耗。',
  },
  sacred: {
    shield: 13,
    text: '获得 13 护盾，抽 2 张牌。耗竭。',
  },
  mirrors: {
    damage: 11,
    text: '造成 11 伤害，消耗符印每层追加 5 伤害。',
  },
  kaguraBell: {
    cost: 0,
    draw: 2,
    text: '施加 2 符印，抽 2 张牌；若本回合已消耗过符印，改为施加 4 符印。',
  },
  foxguardian: {
    damage: 13,
    shield: 9,
    text: '造成 13 伤害，获得 9 护盾。',
  },
  mandala: {
    shield: 22,
    text: '获得 22 护盾，对所有敌人施加 2 符印。',
  },
  izuna: {
    cost: 0,
    text: '抽 1 张牌；若本回合式神已苏醒（第二张技能牌起），再抽 1 张。',
  },
  darkflame: {
    damage: 10,
    text: '造成 10 伤害，施加 2 灼烧。',
  },
  bloodedge: {
    damage: 19,
    text: '失去 3 生命，造成 19 伤害。',
  },
  foxcurse: {
    damage: 8,
    text: '造成 8 伤害，施加 2 符印和 1 虚弱。',
  },
  runeShard: {
    damage: 6,
    text: '造成 6 伤害；消耗符印，每层额外 4 伤害。',
  },
  shadowseal: {
    shield: 10,
    text: '获得 10 护盾，施加 2 符印。',
  },
  sealBurst: {
    damage: 9,
    text: '对所有敌人造成 9 伤害；消耗各自符印，每层额外 5 伤害。',
  },
  drain: {
    damage: 9,
    text: '造成 9 伤害；若造成生命伤害，回复 2 生命。',
  },
  chaoslance: {
    damage: 26,
    text: '失去 3 生命，造成 26 伤害；若造成生命伤害，回复 5 生命。',
  },
  chaosward: {
    shield: 21,
    text: '失去 3 生命，获得 21 护盾，抽 1 张牌。',
  },
  abyssLance: {
    damage: 20,
    text: '失去 3 生命，造成 20 伤害；若本回合已自损过，额外＋16 伤害。耗竭。',
  },
  tinyTwister: {
    damage: 8,
    text: '对所有敌人造成 8 伤害。',
  },
  blazingShot: {
    damage: 11,
    text: '造成 11 伤害；若有蓄能，额外造成 2 伤害，不消耗蓄能。',
  },
  gatling: {
    damage: 4,
    text: '造成 4×3 段伤害。',
  },
  dumUpper: {
    damage: 12,
    shield: 7,
    text: '造成 12 伤害，获得 7 护盾。',
  },
  blackGatling: {
    damage: 5,
    shield: 6,
    text: '造成 5×2 段伤害，获得 6 护盾。',
  },
  ambushUpper: {
    damage: 13,
    text: '造成 13 伤害，施加 2 虚弱。',
  },
  rapidFire: {
    damage: 4,
    text: '造成 4×3 段伤害，抽 1 张牌。',
  },
  goldTriangle: {
    damage: 16,
    text: '对所有敌人造成 16 伤害。',
  },
  blackReload: {
    shield: 11,
    text: '获得 11 护盾，获得 2 蓄能。',
  },
  blackMissile: {
    damage: 18,
    text: '造成 18 伤害，消耗全部蓄能，每层额外 4 伤害。',
  },
  giantMissile: {
    damage: 7,
    text: '造成 7×3 段伤害；消耗至多 2 层蓄能，每层使每段伤害 +1。首段锁定目标，其余段随机索敌。',
  },
  burstShot: {
    damage: 5,
    text: '对所有敌人造成 5×2 段伤害，获得 1 蓄能。',
  },
  fullSalvo: {
    damage: 9,
    text: '造成 9 伤害，消耗全部蓄能，每层额外 3 伤害。',
  },
  heavySalvo: {
    damage: 15,
    text: '造成 15 伤害，消耗全部蓄能，每层额外 6 伤害。耗竭。',
  },
  fortressLoad: {
    shield: 13,
    text: '获得 13 护盾，获得 2 蓄能。',
  },
  suppressBarrage: {
    damage: 8,
    text: '对所有敌人造成 8 伤害，施加 1 虚弱。',
  },
  gravityField: {
    shield: 10,
    text: '获得 10 护盾，对所有敌人施加 2 虚弱。',
  },
  zoneSuppress: {
    damage: 11,
    text: '对所有敌人造成 11 伤害、施加 1 虚弱，消耗全部蓄能，每层额外 3 伤害。',
  },
  fault: {
    cost: 0,
    text: '不能产生效果。支付 0 行动力清除，本场耗竭。',
  },
  nightfire: {
    damage: 8,
    text: '造成 8 点伤害；此牌每造成 5 点伤害，获得 1 噬能。',
  },
  taunt: {
    cost: 0,
    text: '施加 2 虚弱，抽 1 张牌。',
  },
  prank: {
    cost: 0,
    text: '获得 2 层噬能。耗竭。',
    devour: 2,
  },
  devourTrick: {
    damage: 9,
    text: '造成 9 伤害；消耗至多 3 层噬能，每层额外 3 伤害。',
  },
  frostSorcery: {
    damage: 10,
    text: '造成 10 伤害，施加 1 虚弱。',
  },
  magicShield: {
    shield: 9,
    text: '获得 9 护盾；消耗至多 3 层噬能，每层额外 2 护盾。',
  },
  devourAura: {
    cost: 0,
    devourAuraGain: 3,
    text: '本场战斗噬能上限＋2，获得 3 噬能。耗竭。',
  },
  soulHarvest: {
    damage: 13,
    text: '造成 13 点伤害，获得 1 噬能；随后消耗至多 3 层噬能，每层额外 3 伤害。',
  },
  lureDance: {
    damage: 10,
    text: '造成 10 伤害；若目标处于虚弱，额外造成 4 伤害。',
  },
  thousandCuts: {
    damage: 5,
    text: '造成 5×4 段伤害。',
  },
  grandFinale: {
    shield: 9,
    text: '获得 9 护盾，获得 1 噬能。',
  },
  bloodClaw: {
    damage: 10,
    drainRatio: 3,
    text: '造成 10 伤害；每造成 3 点生命伤害，回复 1 生命。',
  },
  nightmareWave: {
    cost: 0,
    draw: 1,
    text: '消耗全部噬能，每 3 层获得 1 力量，抽 1 张牌。耗竭。',
  },
  devourCorrode: {
    cost: 0,
    devourVuln: 4,
    devourVulnFallback: 2,
    text: '消耗 3 层噬能，施加 4 易伤；噬能不足 3 层时不消耗，施加 2 易伤。',
  },
  batSwarm: {
    damage: 6,
    text: '造成 6×3 段伤害；此牌每造成 5 点伤害，获得 1 噬能。',
  },
  crimsonRain: {
    damage: 9,
    text: '对所有敌人造成 9 伤害，施加 1 虚弱；消耗至多 3 层噬能，每层额外 2 伤害。',
  },
  devourFeast: {
    cost: 0,
    text: '消耗至多 3 层噬能，每层回复 3 生命。',
  },
  bloodPact: {
    cost: 0,
    draw: 2,
    text: '失去 3 生命，获得 3 噬能，抽 2 张牌。',
  },
  flamencoSlash: {
    damage: 8,
    text: '造成 8×3 段伤害；每造成 4 点生命伤害，回复 1 生命。',
  },
  curtainSpin: {
    cost: 0,
    draw: 2,
    text: '抽 2 张牌；若本回合已打出攻击牌，行动力＋1。',
  },
  fatalPierce: {
    damage: 8,
    text: '造成 8 伤害；若是本回合第二张及以后的攻击牌，伤害翻倍。',
  },
  twinClaw: {
    damage: 7,
    text: '造成 7×2 段伤害；此牌每造成 4 点伤害，获得 1 噬能。',
  },
  deathCannon: {
    damage: 15,
    text: '造成 15 伤害，消耗全部噬能（至多 6 层），每层额外 4 伤害。耗竭。',
  },
  gluttonyFeast: {
    damage: 10,
    text: '造成 10 伤害；若此牌击败敌人，获得 2 噬能并抽 1 张牌。',
  },
  gustCannon: {
    damage: 5,
    text: '对所有敌人造成 5×2 段伤害；消耗至多 3 层噬能，每层增加 1 段。',
  },
  shiningWing: {
    shield: 13,
    text: '获得 13 护盾，抽 1 张牌。',
  },
  windPressure: {
    cost: 0,
    windupHits: 2,
    text: '本回合下一张攻击牌段数＋2；若该牌至少 4 段，抽 1 张牌。',
  },
  venomFog: {
    shield: 9,
    text: '对所有敌人施加 2 虚弱，获得 9 护盾；消耗至多 3 层噬能，每层额外施加 1 虚弱。',
  },
  bloodFeast: {
    damage: 13,
    text: '造成 13 伤害；消耗至多 3 层噬能，每层额外 3 伤害；若造成生命伤害，回复 4 生命。',
  },
  venomEmbrace: {
    cost: 0,
    devourHeal: 3,
    text: '施加 2 虚弱；消耗至多 3 层噬能，每层回复 3 生命。',
  },
  despairHowl: {
    cost: 0,
    text: '对所有敌人施加 1 虚弱，获得 3 噬能。',
  },
  darkDisaster: {
    damage: 12,
    text: '失去 3 生命，造成 12×2 段伤害；若此牌击败敌人，返还失去的生命。',
  },
  despairReap: {
    damage: 6,
    text: '造成 6×2 段伤害；消耗至多 2 层噬能，每层增加 1 段；目标生命低于一半时每段额外 2 伤害。',
  },
};
