import type { Battle, CardDef, Enemy, Meta, Metric, Run } from './types';

// 形态/搭档/分支的被动钩子上下文：由 battle.ts 注入战斗原语，钩子表本身不依赖 battle 模块。
export interface HookCtx {
  r: Run;
  b: Battle;
  meta?: Meta;
  log(msg: string): void;
  draw(n: number): void;
  count(key: Metric): void;
  hit(e: Enemy, amount: number, attack?: boolean): void;
}

export interface PassiveHooks {
  battleStart?(c: HookCtx): void;
  onTurnStart?(c: HookCtx): void;
  attackHitBonus?(c: HookCtx): number;
  onDamageDealt?(c: HookCtx, actual: number): void;
  onKill?(c: HookCtx, e: Enemy): void;
  onFirstSelfCost?(c: HookCtx): void;
  firstDefenseShield?(c: HookCtx): number;
  onFirstDefense?(c: HookCtx): void;
  onCannonCharge?(c: HookCtx): void;
  devourPowerBonus?(c: HookCtx): number;
  hitBonusVsWeakened?(c: HookCtx, e: Enemy, d: CardDef): number;
  firstBurnBonus?(c: HookCtx): number;
  onFirstMarkBurst?(c: HookCtx): void;
  markBonus?(c: HookCtx): number;
  onMarkApplied?(c: HookCtx): void;
  weakBonus?(c: HookCtx): number;
  onFirstWeak?(c: HookCtx): void;
  drainBonus?(c: HookCtx): number;
  onSkillPlayed?(c: HookCtx, skillsPlayed: number): void;
  onAttackPlayed?(c: HookCtx, attackPlays: number): void;
}

// 键为搭档/形态/分支 id；一场战斗中按 [partner, form, branch] 顺序触发。
export const PASSIVES: Record<string, PassiveHooks> = {
  impmon: {
    onTurnStart({ b, log }) {
      b.devour++;
      log(`噬能 ＋1（回合 · 当前 ${b.devour}）`);
    },
    onDamageDealt({ b }, actual) {
      if (actual <= 0) return;
      b.devourPool += actual;
      while (b.devourPool >= 5 && b.devourFromDamage < 2) {
        b.devourPool -= 5;
        b.devour++;
        b.devourFromDamage++;
      }
    },
    onKill({ b, log }) {
      const gain = 1 + (b.devourAura ? 1 : 0);
      b.devour += gain;
      log(`噬能 ＋${gain}（击败 · 当前 ${b.devour}）`);
    },
  },
  wargrowlmon: {
    battleStart({ b }) {
      b.charge++;
    },
  },
  matadormon: {
    battleStart({ b }) {
      b.devour++;
    },
  },
  blackwargrowlmon: {
    onFirstSelfCost({ b }) {
      b.energy++;
    },
  },
  blackgrowmon: {
    firstBurnBonus: () => 1,
  },
  blackgalgomon: {
    onFirstDefense({ b }) {
      b.nextAttackBonus = 2;
    },
    hitBonusVsWeakened: (_c, e, d) => (e.weakened > 0 && d.damage ? (d.hits ?? 1) : 0),
  },
  blackrapidmon: {
    onFirstDefense({ b }) {
      b.charge++;
    },
    onFirstWeak({ b }) {
      b.charge++;
    },
  },
  blacksaintgalgomon: {
    onFirstDefense({ b }) {
      b.charge++;
    },
    onCannonCharge({ b }) {
      b.block += 6;
    },
  },
  galgomon: {
    onAttackPlayed({ b }, n) {
      if (n === 2) b.charge++;
    },
  },
  rapidmon: {
    onAttackPlayed(_c, n) {
      if (n === 2) _c.draw(1);
    },
  },
  saintgalgomon: {
    onAttackPlayed({ b, draw }, n) {
      if (n === 2) {
        b.charge++;
        draw(1);
      }
    },
  },
  youkomon: {
    markBonus: ({ b }) => (b.marked ? 0 : 1),
    onMarkApplied({ b }) {
      b.marked = true;
    },
  },
  taomon: {
    onSkillPlayed({ b }, n) {
      if (n === 1) b.block += 2;
    },
  },
  doumon: {
    onSkillPlayed({ b }, n) {
      if (n === 2) {
        const e = b.enemies.find((x) => x.hp > 0);
        if (e) e.mark++;
      }
    },
  },
  vamdemon: {
    drainBonus: () => 2,
  },
  blast: {
    attackHitBonus: ({ b }) => (b.attackPlays >= 3 ? 2 : 0),
  },
  gluttony: {
    onKill({ r, b, log }) {
      b.strength++;
      const before = r.hp;
      r.hp = Math.min(r.maxHp, r.hp + 4);
      if (r.hp > before) b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
      log('暴食 · 攻击每段＋1，回复 4 生命');
    },
  },
  belial: {
    onKill({ draw, log }) {
      draw(1);
      log('绝望收割 · 抽 1 张牌');
    },
    devourPowerBonus: () => 2,
  },
  venom: {
    weakBonus: () => 1,
    onFirstWeak({ r, b }) {
      const before = r.hp;
      r.hp = Math.min(r.maxHp, r.hp + 3);
      if (r.hp > before) b.feedback.push({ target: 'player', kind: 'heal', amount: r.hp - before });
    },
  },
  chaos: {
    onFirstSelfCost({ b }) {
      b.block += 6;
    },
  },
  duke: {
    firstDefenseShield: () => 3,
  },
  megidra: {
    firstBurnBonus: () => 2,
  },
  sakuya: {
    onFirstMarkBurst({ draw }) {
      draw(1);
    },
  },
  kuzuha: {
    onSkillPlayed({ b, hit, log }, n) {
      if (n === 2) {
        const e = b.enemies.find((x) => x.hp > 0);
        if (e) hit(e, 4, false);
        log('管狐追击 · 4 伤害');
      }
    },
  },
};
