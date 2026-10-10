import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/data';
import { cardPool, skillDescription, skillLabel } from '../src/game/cardSkills';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { EVOLUTIONS, evolutionCardGains, evolutionTransition } from '../src/game/evolution';
import { parseSave } from '../src/game/storage';
import { balanceScenario } from './helpers/balanceScenario';
import { simulateJourney } from './helpers/journeySimulation';
import type { Card, Save } from '../src/game/types';

const card = (id: string, uid = id, upgraded = false): Card => ({ id, uid, upgraded });
const play = (s: Save, uid: string, target?: string) =>
  reduceGame(s, { type: 'play', uid, target });
const paths = [
  ['growlmon', 'wargrowlmon', 'dukemon'],
  ['growlmon', 'wargrowlmon', 'megidramon'],
  ['blackgrowmon', 'wargrowlmon', 'dukemon'],
  ['blackgrowmon', 'wargrowlmon', 'megidramon'],
  ['blackgrowmon', 'blackwargrowlmon', 'megidramon'],
  ['blackgrowmon', 'blackwargrowlmon', 'chaosdukemon'],
];

describe('六条基尔兽进化路径的赠牌与获取衔接', () => {
  it.each(paths.map((path) => [path.join('→'), path] as const))(
    '%s 合法赠牌、强化、继承与单牌共享',
    (_name, path) => {
      let s = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 });
      s.meta.unlockedRoutes = ['chaos'];
      for (const form of path) {
        Object.assign(s.run!, { screen: 'evolution', row: 29, victories: 3, bosses: 3 });
        s.run!.activity.counts = {
          attacks: 48,
          fire: 32,
          selfCosts: 6,
          heals: 4,
          detonations: 4,
          defenses: 12,
        };
        const before = structuredClone(s.run!.deck);
        const gains = evolutionCardGains(s.run!, form);
        s = reduceGame(s, {
          type: 'evolve',
          form,
          training: 'defense',
          inherit: 'ward',
        });
        expect(s.run!.form).toBe(form);
        expect(s.run!.deck.slice(before.length).map((c) => c.id)).toEqual(gains.newIds);
        expect(s.run!.deck.slice(before.length).every((c) => !c.upgraded)).toBe(true);
        expect(s.run!.deck).toHaveLength(before.length + gains.newIds.length);
        expect(s.run!.deck.slice(0, before.length)).toEqual(
          before.map((c) => (gains.upgradeUids.includes(c.uid) ? { ...c, upgraded: true } : c)),
        );
        expect(gains.newIds.length + gains.upgradeUids.length).toBe(2);
        expect(cardPool(s.run!)).toContain('ignite');
      }
      expect(s.run!.formHistory).toEqual(['guilmon', ...path]);
      if (path[0] === 'blackgrowmon') expect(cardPool(s.run!)).not.toContain('doublecut');
      else expect(cardPool(s.run!)).not.toContain('bloodedge');
    },
  );
  it('共享引爆只开放指定单牌，标签说明真实解锁来源', () => {
    const r = makeRun('guilmon', 42);
    expect(cardPool(r)).not.toContain('ignite');
    r.form = 'blackgrowmon';
    r.stage = 1;
    r.formHistory.push('blackgrowmon');
    expect(cardPool(r)).toContain('ignite');
    expect(cardPool(r)).not.toContain('heatwave');
    expect(skillLabel(CARDS.ignite, r)).toBe('共享技能');
    expect(skillDescription(CARDS.ignite, r)).toContain('黑古拉兽');
    r.form = 'blackwargrowlmon';
    r.formHistory.push(r.form);
    expect(skillLabel(CARDS.ignite, r)).toBe('继承技能');
    expect(skillDescription(CARDS.ignite, r)).toContain('黑古拉兽');
  });
  it.each([false, true])('黑大古拉兽新专属卡强化=%s时实际自损、返能和吸血正确', (upgraded) => {
    const s = balanceScenario(
      [card('darkOverload', 'darkOverload', upgraded), card('darkDrain', 'darkDrain', upgraded)],
      'blackwargrowlmon',
    );
    expect(EVOLUTIONS.blackwargrowlmon.cards).toEqual(['darkOverload', 'darkDrain']);
    const after = play(play(s, 'darkOverload'), 'darkDrain').run!;
    expect(after.hp).toBe(59);
    expect(after.battle!.energy).toBe(upgraded ? 5 : 4);
    expect(after.battle!.enemies[0].hp).toBe(upgraded ? 91 : 94);
    expect(after.activity.counts.selfCosts).toBe(1);
    expect(after.activity.counts.heals).toBe(1);
  });
  it('合法转线均有明确的旧牌影响说明，非法跳转不产生说明', () => {
    for (const path of paths)
      for (const [i, form] of path.entries())
        expect(evolutionTransition(i ? path[i - 1] : 'guilmon', form)).toBeTruthy();
    expect(evolutionTransition('guilmon', 'chaosdukemon')).toBeNull();
    expect(evolutionTransition('blackwargrowlmon', 'chaosdukemon')).toContain('少返1行动力');
  });
});

describe('火焰追击与首次实际灼烧边界', () => {
  it('古拉兽追击多段只加2总伤害，非灼烧目标不消耗机会', () => {
    let s = balanceScenario(
      [card('rock'), card('doublecut', 'first'), card('doublecut', 'second')],
      'growlmon',
      ['core', 'core'],
    );
    const [plain, burning] = s.run!.battle!.enemies;
    burning.burn = 3;
    s = play(s, 'rock', plain.uid);
    expect(s.run!.battle!.burnFollowupUsed).toBe(false);
    s = play(s, 'first', burning.uid);
    expect(s.run!.battle!.enemies[1].hp).toBe(88);
    s = play(s, 'second', burning.uid);
    expect(s.run!.battle!.enemies[1].hp).toBe(78);
  });
  it('追击检查先于引爆消费，力量仍逐段结算', () => {
    let s = balanceScenario([card('ignite')], 'growlmon');
    s.run!.battle!.enemies[0].burn = 3;
    s = play(s, 'ignite');
    expect(s.run!.battle!.enemies[0].hp).toBe(86);
    expect(s.run!.battle!.enemies[0].burn).toBe(0);
    s = balanceScenario([card('doublecut')], 'growlmon');
    s.run!.battle!.enemies[0].burn = 3;
    s.run!.battle!.strength = 2;
    expect(play(s, 'doublecut').run!.battle!.enemies[0].hp).toBe(84);
  });
  it('群攻追击最多奖励一个目标，不按敌人数放大', () => {
    const s = balanceScenario([card('heatwave')], 'growlmon', ['core', 'core']);
    s.run!.battle!.enemies.forEach((e) => (e.burn = 3));
    expect(play(s, 'heatwave').run!.battle!.enemies.map((e) => e.hp)).toEqual([95, 97]);
  });
  it.each([
    ['blackgrowmon', 4],
    ['megidramon', 5],
  ] as const)('%s 直接击杀不消耗首次灼烧，余烬与防火仍留给有效目标', (form, expectedBurn) => {
    let s = balanceScenario([card('fireball', 'a'), card('fireball', 'b')], form, ['core', 'core']);
    s.run!.inherit = 'ember';
    s.run!.relics = ['firewall'];
    s.run!.battle!.enemies[0].hp = 5;
    const [a, b] = s.run!.battle!.enemies;
    s = play(s, 'a', a.uid);
    expect(s.run!.battle!.burned).toBe(false);
    expect(s.run!.battle!.block).toBe(0);
    s = play(s, 'b', b.uid);
    expect(s.run!.battle!.enemies[1].burn).toBe(expectedBurn);
    expect(s.run!.battle!.block).toBe(3);
  });
  it('大古拉兽实际叠火每回合只获2盾，群攻与防火不刷主动防御', () => {
    let s = balanceScenario([card('heatwave', 'a'), card('fireball', 'b')], 'wargrowlmon', [
      'core',
      'core',
    ]);
    s.run!.relics = ['firewall'];
    s.run!.battle!.enemies[0].hp = 2;
    s = play(s, 'a');
    expect(s.run!.battle!.enemies[0].burn).toBe(0);
    expect(s.run!.battle!.enemies[1].burn).toBe(1);
    expect(s.run!.battle!.block).toBe(5);
    expect(s.run!.activity.counts.defenses ?? 0).toBe(0);
    s = play(s, 'b');
    expect(s.run!.battle!.block).toBe(5);
  });
  it('大古拉兽余烬护甲仍算一次防御，终点替换掉旧被动', () => {
    for (const [form, expected] of [
      ['wargrowlmon', 10],
      ['dukemon', 11],
      ['megidramon', 8],
    ] as const) {
      const scenario = balanceScenario([card('flare')], form);
      scenario.run!.inherit = 'ember';
      const after = play(scenario, 'flare').run!;
      expect(after.battle!.block).toBe(expected);
      expect(after.activity.counts.defenses).toBe(1);
    }
  });
  it('回合开始重置追击，保存恢复保留已使用标记且旧档有默认值', () => {
    let s = balanceScenario([card('rock')], 'growlmon');
    s.run!.battle!.enemies[0].burn = 4;
    s = play(s, 'rock');
    expect(parseSave(JSON.stringify(s)).run!.battle!.burnFollowupUsed).toBe(true);
    const old = JSON.parse(JSON.stringify(s));
    delete old.run.battle.burnFollowupUsed;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.run!.battle!.burnFollowupUsed).toBe(false);
    expect(loaded.run!.deck).toEqual(s.run!.deck);
    expect(loaded.run!.rng).toBe(s.run!.rng);
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!.burnFollowupUsed).toBe(false);
    expect(s.run!.battle!.burned).toBe(false);
  });
  it('混沌保留返能转护盾的代价，不叠加旧被动', () => {
    const scenario = balanceScenario([card('sacrifice')], 'chaosdukemon');
    scenario.run!.inherit = 'ember';
    const after = play(scenario, 'sacrifice').run!;
    expect(after.battle!.energy).toBe(4);
    expect(after.battle!.block).toBe(6);
    expect(after.hp).toBe(57);
  });
});

describe('六路径实际行动回归', () => {
  it.each(paths.map((path) => [path.join('→'), path] as const))(
    '%s 固定策略旅途无异常，目标不足单列诊断',
    (_name, path) => {
      const branch =
        path[2] === 'dukemon' ? 'duke' : path[2] === 'megidramon' ? 'megidra' : 'chaos';
      const result = simulateJourney(branch, 42, 'synergy', undefined, path);
      expect(result.diagnostics).toEqual([]);
      // 地图节奏与补给调整后，固定策略可能合法战败；检查真实终局而不是强制种子必胜。
      expect(Number.isInteger(result.row)).toBe(true);
      expect(result.row).toBeGreaterThanOrEqual(0);
      expect(result.row).toBeLessThanOrEqual(49);
      expect(result.steps).toBeLessThan(2500);
      if (result.won) {
        expect(result.row).toBe(49);
        expect(result.hp).toBeGreaterThan(0);
        expect(result.death).toBeNull();
      } else {
        expect(result.hp).toBe(0);
        expect(result.death?.chapter).toBe(Math.floor(result.row / 10) + 1);
        expect(result.death?.enemies?.length ?? 0).toBeGreaterThan(0);
        expect(result.battles.at(-1)).toMatchObject({ row: result.row, hpEnd: 0 });
      }
      // 已达到目标形态但后来战败，不属于进化条件不足。
      if (!result.reached) expect(result.targetMissing.length).toBeGreaterThan(0);
      else expect(result.targetMissing).toEqual([]);
    },
  );
});
