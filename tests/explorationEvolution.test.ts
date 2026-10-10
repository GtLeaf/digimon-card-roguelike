import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { evolutionStatus, hasEvolutionOpportunity, nextEvolutions } from '../src/game/evolution';
import { parseSave } from '../src/game/storage';
import type { Run } from '../src/game/types';

function start() {
  return reduceGame(reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 }), {
    type: 'bless',
    id: 'guard',
  });
}
function bossReward(row: number, state: Partial<Run>) {
  const save = start();
  Object.assign(save.run!, state, {
    row,
    currentNode: save.run!.nodes[row][0],
    screen: 'reward',
    reward: { cards: [], gold: 65, scans: [], gains: [], unlocks: [] },
  });
  return save;
}
function camp(state: Partial<Run>) {
  const save = start();
  Object.assign(save.run!, state, {
    row: 8,
    currentNode: save.run!.nodes[8][0],
    screen: 'camp',
  });
  return save;
}

// 首领奖励、成长界面和祝福共用同一个当前节点，不能提前走层或重复奖励。
describe('探索成长节点衔接', () => {
  it.each([
    { row: 9, stage: 1, form: 'growlmon', bosses: 1 },
    { row: 39, stage: 3, form: 'dukemon', bosses: 4 },
  ])('首领奖励后没有开放的下一阶段直接进入祝福：第$row 层', (state) => {
    const save = bossReward(state.row, { ...state, victories: 8 });
    const original = structuredClone(save);
    const next = reduceGame(save, { type: 'reward' });
    expect(save).toEqual(original);
    expect(next.run!.screen).toBe('blessing');
    expect(next.run!.row).toBe(state.row);
    expect(next.run!.currentNode!.id).toBe(save.run!.currentNode!.id);
    expect(next.run!.path).not.toContain(save.run!.currentNode!.id);
    const continued = reduceGame(next, { type: 'bless', id: 'bond' });
    expect(continued.run!.row).toBe(state.row + 1);
    expect(continued.run!.screen).toBe('map');
    expect(continued.run!.path.filter((id) => id === save.run!.currentNode!.id)).toHaveLength(1);
    expect(reduceGame(continued, { type: 'bless', id: 'bond' })).toEqual(continued);
  });

  it('未达到行为或跨局资料条件的合法进化仍显示进度，并可暂缓进入祝福', () => {
    const save = bossReward(29, {
      stage: 2,
      form: 'blackwargrowlmon',
      bosses: 3,
      victories: 16,
      formHistory: ['guilmon', 'blackgrowmon', 'blackwargrowlmon'],
    });
    expect(
      nextEvolutions(save.run!).every((d) => !evolutionStatus(save.run, save.meta, d.id).ready),
    ).toBe(true);
    let next = reduceGame(save, { type: 'reward' });
    expect(next.run!.screen).toBe('evolution');
    expect(next.run!.evolutionReturn).toBe('node');
    expect(reduceGame(next, { type: 'evolve', form: 'chaosdukemon' })).toEqual(next);
    next = reduceGame(next, { type: 'deferEvolution' });
    expect(next.run!.screen).toBe('blessing');
    expect(next.run!.row).toBe(29);
    next = reduceGame(next, { type: 'bless', id: 'bond' });
    expect(next.run!.row).toBe(30);
    expect(next.run!.path).toContain('n29-0');
  });

  it('开放的首领进化完成后接祝福，不再进入空的成长页面', () => {
    let save = bossReward(19, { stage: 1, form: 'growlmon', bosses: 2, victories: 12 });
    save = reduceGame(save, { type: 'reward' });
    expect(save.run!.screen).toBe('evolution');
    save = reduceGame(save, { type: 'evolve', form: 'wargrowlmon' });
    expect(save.run!.form).toBe('wargrowlmon');
    expect(save.run!.screen).toBe('blessing');
    expect(save.run!.row).toBe(19);
    save = reduceGame(save, { type: 'bless', id: 'bond' });
    expect(save.run!.row).toBe(20);
  });

  it('落后阶段仍可在同一首领节点连续补进化，最终只完成一次节点', () => {
    let save = bossReward(29, { stage: 0, form: 'guilmon', bosses: 3, victories: 16 });
    save = reduceGame(save, { type: 'reward' });
    for (const form of ['growlmon', 'wargrowlmon', 'dukemon']) {
      expect(save.run!.screen).toBe('evolution');
      save = reduceGame(save, { type: 'evolve', form });
      expect(save.run!.form).toBe(form);
      expect(save.run!.row).toBe(29);
    }
    expect(save.run!.screen).toBe('blessing');
    save = reduceGame(save, { type: 'bless', id: 'bond' });
    expect(save.run!.row).toBe(30);
    expect(save.run!.path.filter((id) => id === 'n29-0')).toHaveLength(1);
  });

  it('最终首领直接结算胜利，即使还有未完成的成长阶段', () => {
    const save = bossReward(49, { stage: 1, form: 'growlmon', bosses: 5, victories: 20 });
    expect(hasEvolutionOpportunity(save.run!)).toBe(true);
    const next = reduceGame(save, { type: 'reward' });
    expect(next.run!.screen).toBe('result');
    expect(next.run!.won).toBe(true);
    expect(next.meta.wins).toBe(1);
    expect(next.run!.path).toContain('n49-0');
    expect(reduceGame(next, { type: 'reward' })).toEqual(next);
  });

  it('营地未满足进化条件仍可查看，取消后还能休息且不会提前耗用营地', () => {
    const save = camp({
      stage: 2,
      form: 'blackwargrowlmon',
      bosses: 3,
      victories: 16,
      hp: 30,
      formHistory: ['guilmon', 'blackgrowmon', 'blackwargrowlmon'],
    });
    let next = reduceGame(save, { type: 'campEvolution' });
    expect(next.run!.screen).toBe('evolution');
    expect(next.run!.evolutionReturn).toBe('camp');
    expect(reduceGame(next, { type: 'evolve', form: 'megidramon' })).toEqual(next);
    next = reduceGame(next, { type: 'deferEvolution' });
    expect(next.run!.screen).toBe('camp');
    expect(next.run!.row).toBe(8);
    expect(next.run!.hp).toBe(30);
    expect(next.run!.evolutionReturn).toBe('node');
    next = reduceGame(next, { type: 'camp', mode: 'heal' });
    expect(next.run!.hp).toBe(57);
    expect(next.run!.row).toBe(9);
    expect(next.run!.screen).toBe('map');
  });

  it('营地完成补进化只消费一次营地，其他开放阶段留给后续节点', () => {
    const save = camp({ stage: 0, form: 'guilmon', bosses: 3, victories: 12 });
    let next = reduceGame(save, { type: 'campEvolution' });
    next = reduceGame(next, { type: 'evolve', form: 'growlmon' });
    expect(next.run!.screen).toBe('map');
    expect(next.run!.row).toBe(9);
    expect(next.run!.form).toBe('growlmon');
    expect(next.run!.evolutionReturn).toBe('node');
    expect(reduceGame(next, { type: 'evolve', form: 'wargrowlmon' })).toEqual(next);
  });

  it('尚未开放或已完成的后继不会让营地进入成长页面', () => {
    const unopened = camp({ stage: 1, form: 'growlmon', bosses: 1, victories: 8 });
    expect(hasEvolutionOpportunity(unopened.run!)).toBe(false);
    expect(reduceGame(unopened, { type: 'campEvolution' })).toEqual(unopened);
    const completed = camp({
      stage: 1,
      form: 'growlmon',
      bosses: 2,
      victories: 12,
      formHistory: ['guilmon', 'growlmon', 'wargrowlmon'],
    });
    expect(hasEvolutionOpportunity(completed.run!)).toBe(false);
    expect(reduceGame(completed, { type: 'campEvolution' })).toEqual(completed);
  });

  it('旧地图未开放阶段的固定进化点直接通过，不回血并保留原地图', () => {
    const save = start();
    const r = save.run!;
    Object.assign(r, { row: 14, stage: 1, form: 'growlmon', bosses: 1, victories: 8, hp: 30 });
    const node = r.nodes[14][0];
    node.kind = 'evolution';
    node.label = '进化之光';
    node.enemies = [];
    const restored = parseSave(JSON.stringify(save));
    expect(restored.run!.nodes).toEqual(r.nodes);
    const next = reduceGame(restored, { type: 'node', id: node.id });
    expect(next.run!.nodes).toEqual(r.nodes);
    expect(next.run!.screen).toBe('map');
    expect(next.run!.row).toBe(15);
    expect(next.run!.hp).toBe(30);
    expect(next.run!.path).toContain(node.id);
    expect(next.run!.message).toContain('没有已开放');
  });

  it('第一章固定成长点尚未达两胜仍显示条件，不赠送免费治疗', () => {
    const save = start();
    Object.assign(save.run!, { row: 4, victories: 1, hp: 30 });
    expect(evolutionStatus(save.run, save.meta, 'growlmon').ready).toBe(false);
    let next = reduceGame(save, { type: 'node', id: save.run!.nodes[4][0].id });
    expect(next.run!.screen).toBe('evolution');
    expect(next.run!.hp).toBe(30);
    expect(reduceGame(next, { type: 'evolve', form: 'growlmon' })).toEqual(next);
    next = reduceGame(next, { type: 'deferEvolution' });
    expect(next.run!.row).toBe(5);
    expect(next.run!.hp).toBe(30);
  });
});
