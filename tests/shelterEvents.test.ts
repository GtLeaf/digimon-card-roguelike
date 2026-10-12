import { describe, expect, it } from 'vitest';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { EVENTS, eventChoicePreview } from '../src/game/events';
import { parseSave } from '../src/game/storage';

function shelter(rng: number) {
  const save = emptySave();
  save.run = makeRun('guilmon', 42);
  const run = save.run;
  run.screen = 'event';
  run.row = 5;
  run.hp = 42;
  run.potions = 1;
  run.rng = rng;
  run.currentNode = { ...run.nodes[5][0], kind: 'event', eventId: 'shelter' };
  return save;
}

describe('temporary shelter rest', () => {
  it.each([
    [0, 60, 1, '平安休息'],
    [1500, 52, 1, '受伤，失去 8 生命'],
    [1800, 60, 0, '丢失1枚恢复磁盘'],
  ] as const)(
    'seed %s settles the rest outcome once and preserves it after reload',
    (rng, hp, potions, message) => {
      const save = shelter(rng);
      const node = save.run!.currentNode!;
      const before = structuredClone(save);
      const preview = eventChoicePreview(save.run!, EVENTS.shelter.choices[0]);
      expect(preview).toContain('最多回复 18 生命');
      expect(preview).toContain('可能受伤或丢失恢复磁盘');
      eventChoicePreview(save.run!, EVENTS.shelter.choices[0]);
      expect(save).toEqual(before);
      const rested = reduceGame(save, { type: 'event', choice: 'risk' });
      expect(rested.run).toMatchObject({
        screen: 'event',
        row: 5,
        eventResolved: true,
        hp,
        potions,
      });
      expect(rested.run!.rng).not.toBe(rng);
      expect(rested.run!.message).toContain('实际回复 18 生命');
      expect(rested.run!.message).toContain(message);
      expect(rested.run!.message).toContain(`生命 42 → ${hp}`);
      expect(rested.run!.path).not.toContain(node.id);
      expect(reduceGame(before, { type: 'event', choice: 'risk' })).toEqual(rested);
      const restored = parseSave(JSON.stringify(rested));
      expect(restored.run!.eventResolved).toBe(true);
      expect(restored.run!.rng).toBe(rested.run!.rng);
      expect(restored.run!.message).toBe(rested.run!.message);
      for (const choice of ['risk', 'safe'] as const)
        expect(reduceGame(restored, { type: 'event', choice })).toEqual(restored);
      const left = reduceGame(restored, { type: 'continue' });
      expect(left.run).toMatchObject({ screen: 'map', row: 6, currentNode: null, hp, potions });
      expect(left.run!.eventResolved).toBeUndefined();
      expect(left.run!.rng).toBe(rested.run!.rng);
      expect(left.run!.path.filter((id) => id === node.id)).toHaveLength(1);
      expect(reduceGame(left, { type: 'continue' })).toEqual(left);
    },
  );

  it('caps rest healing before any injury and reports both actual effects', () => {
    const save = shelter(0);
    save.run!.hp = save.run!.maxHp - 2;
    expect(eventChoicePreview(save.run!, EVENTS.shelter.choices[0])).toContain('最多回复 2 生命');
    const peaceful = reduceGame(save, { type: 'event', choice: 'risk' });
    expect(peaceful.run!.hp).toBe(save.run!.maxHp);
    expect(peaceful.run!.message).toContain('实际回复 2 生命');
    save.run!.rng = 1500;
    const injured = reduceGame(save, { type: 'event', choice: 'risk' });
    expect(injured.run!.hp).toBe(save.run!.maxHp - 8);
    expect(injured.run!.message).toContain('实际回复 2 生命');
    expect(injured.run!.message).toContain('失去 8 生命');
  });

  it('permits rest at full health, protects the HP floor and never loses absent disks', () => {
    const full = shelter(0);
    full.run!.hp = full.run!.maxHp;
    const rested = reduceGame(full, { type: 'event', choice: 'risk' });
    expect(rested.run!.hp).toBe(full.run!.maxHp);
    expect(rested.run!.message).toContain('实际回复 0 生命');
    const fragile = shelter(1500);
    fragile.run!.maxHp = 6;
    fragile.run!.hp = 1;
    const injured = reduceGame(fragile, { type: 'event', choice: 'risk' });
    expect(injured.run!.hp).toBe(1);
    expect(injured.run!.message).toContain('失去 5 生命');
    const empty = shelter(1800);
    empty.run!.potions = 0;
    const stolen = reduceGame(empty, { type: 'event', choice: 'risk' });
    expect(stolen.run).toMatchObject({ hp: 60, potions: 0 });
    expect(stolen.run!.message).toContain('没有恢复磁盘可丢失');
  });

  it('offers only rest or leave and leaving consumes no resources or random draw', () => {
    expect(EVENTS.shelter.choices.map((choice) => choice.title)).toEqual(['休息', '离开']);
    const save = shelter(1800);
    save.run!.gold = 0;
    expect(eventChoicePreview(save.run!, EVENTS.shelter.choices[1])).toEqual([]);
    expect(reduceGame(save, { type: 'continue' })).toEqual(save);
    const left = reduceGame(save, { type: 'event', choice: 'safe' });
    expect(left.run).toMatchObject({
      screen: 'map',
      row: 6,
      hp: 42,
      potions: 1,
      gold: 0,
      rng: 1800,
    });
    expect(left.run!.eventResolved).toBeUndefined();
    expect(left.run!.message).toContain('离开');
    expect(reduceGame(left, { type: 'event', choice: 'risk' })).toEqual(left);
  });
});
