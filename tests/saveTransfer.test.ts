import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { SAVE_KEY, parseSave } from '../src/game/storage';
import {
  IMPORT_BACKUP_KEY,
  MAX_IMPORT_BYTES,
  commitImport,
  prepareImport,
} from '../src/game/saveTransfer';

function storage(initial: string | null, failKey?: string) {
  const values = new Map(initial === null ? [] : [[SAVE_KEY, initial]]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failKey) throw new Error('quota');
      values.set(key, value);
    },
  };
}
function battle() {
  let save = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 });
  save = reduceGame(save, { type: 'bless', id: 'guard' });
  return reduceGame(save, { type: 'node', id: save.run!.nodes[0][0].id });
}

describe('save import and recovery', () => {
  it('previews and imports a battle without changing random state or next actions', () => {
    const save = battle();
    const raw = JSON.stringify(save);
    const previous = JSON.stringify(emptySave());
    const target = storage(previous);
    expect(prepareImport(raw)).toEqual(save);
    expect(target.getItem(SAVE_KEY)).toBe(previous);
    const loaded = commitImport(raw, previous, target);
    expect(target.getItem(IMPORT_BACKUP_KEY)).toBe(previous);
    expect(parseSave(target.getItem(SAVE_KEY)!)).toEqual(save);
    expect(reduceGame(loaded, { type: 'endTurn' })).toEqual(reduceGame(save, { type: 'endTurn' }));
  });
  it('backs up unreadable previous records exactly and supports an empty destination', () => {
    const raw = JSON.stringify(emptySave());
    const target = storage('broken old json');
    commitImport(raw, 'broken old json', target);
    expect(target.getItem(IMPORT_BACKUP_KEY)).toBe('broken old json');
    const fresh = storage(null);
    commitImport(raw, null, fresh);
    expect(fresh.getItem(IMPORT_BACKUP_KEY)).toBeNull();
    expect(parseSave(fresh.getItem(SAVE_KEY)!)).toEqual(emptySave());
  });
  it('migrates legacy saves using the existing migration rules', () => {
    const save = battle();
    const legacy = { ...save, version: 2 };
    expect(prepareImport(JSON.stringify(legacy)).run!.chapterRows).toBe(8);
    expect(prepareImport(JSON.stringify(legacy)).version).toBe(3);
  });
  it('rejects invalid, future, oversized and unknown-content files without touching storage', () => {
    const previous = JSON.stringify(emptySave());
    const target = storage(previous);
    for (const raw of [
      'not json',
      '{}',
      JSON.stringify({ ...emptySave(), version: 99 }),
      ' '.repeat(MAX_IMPORT_BYTES + 1),
    ]) {
      expect(() => commitImport(raw, previous, target)).toThrow();
      expect(target.getItem(SAVE_KEY)).toBe(previous);
      expect(target.getItem(IMPORT_BACKUP_KEY)).toBeNull();
    }
    const save = battle();
    save.run!.relics = ['unknown'];
    expect(() => prepareImport(JSON.stringify(save))).toThrow('无法识别');
    save.run!.relics = [];
    save.run!.deck[0].id = '__proto__';
    expect(() => prepareImport(JSON.stringify(save))).toThrow('无法识别');
  });
  it('does not overwrite progress changed in another window since the preview', () => {
    const target = storage('newer progress');
    expect(() => commitImport(JSON.stringify(emptySave()), 'old preview', target)).toThrow(
      '已发生变化',
    );
    expect(target.getItem(SAVE_KEY)).toBe('newer progress');
    expect(target.getItem(IMPORT_BACKUP_KEY)).toBeNull();
  });
  it('leaves the current record intact if backup or replacement fails', () => {
    const previous = JSON.stringify(battle());
    for (const key of [IMPORT_BACKUP_KEY, SAVE_KEY]) {
      const target = storage(previous, key);
      expect(() => commitImport(JSON.stringify(emptySave()), previous, target)).toThrow('仍保留');
      expect(target.getItem(SAVE_KEY)).toBe(previous);
    }
  });
});
