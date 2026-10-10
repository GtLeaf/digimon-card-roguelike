import { describe, expect, it } from 'vitest';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { EVENTS } from '../src/game/events';
import { availableNodes, connectMap, explorationPaths, validateExploration } from '../src/game/map';
import { parseSave } from '../src/game/storage';
import type { MapNode } from '../src/game/types';

const isCombat = (node: MapNode) => ['battle', 'elite', 'boss'].includes(node.kind);

describe('exploration path budgets', () => {
  it.each([false, true])(
    'all paths retain combat, supply spacing and research access (tutorial=%s)',
    (tutorial) => {
      const templates = new Set<string>();
      for (let seed = 0; seed < 150; seed++) {
        const run = makeRun('guilmon', seed * 7919 + 42, tutorial);
        expect(validateExploration(run.nodes)).toEqual([]);
        for (let chapter = 0; chapter < 5; chapter++) {
          const rows = run.nodes.slice(chapter * 10, chapter * 10 + 10);
          templates.add(JSON.stringify(rows.map((row) => row.map((node) => node.kind))));
          const eventNodes = rows.flat().filter((node) => node.kind === 'event');
          expect(eventNodes.every((node) => !!node.eventId && !!EVENTS[node.eventId])).toBe(true);
          expect(new Set(eventNodes.map((node) => node.eventId)).size).toBe(eventNodes.length);
          expect(
            eventNodes.filter((node) =>
              EVENTS[node.eventId!].choices.some(
                (choice) =>
                  !!choice.effect.heal && !choice.effect.hpCost && !choice.effect.goldCost,
              ),
            ).length,
          ).toBeLessThanOrEqual(1);
          for (const path of explorationPaths(rows)) {
            expect(path).toHaveLength(10);
            const battles = path.filter(isCombat).length;
            expect(battles).toBeGreaterThanOrEqual(4);
            expect(battles).toBeLessThanOrEqual(6);
            expect(path.filter((node) => node.kind === 'shop').length).toBeLessThanOrEqual(1);
            expect(path.at(-2)?.kind).toBe('camp');
            if (chapter === 0)
              expect(path.slice(0, 4).filter(isCombat).length).toBeGreaterThanOrEqual(2);
            if (chapter === 1) expect(path.some((node) => node.eventId === 'research')).toBe(true);
            let peaceful = 0;
            for (const node of path) {
              peaceful = isCombat(node) ? 0 : peaceful + 1;
              expect(peaceful).toBeLessThanOrEqual(3);
            }
          }
        }
      }
      expect(templates.size).toBeGreaterThanOrEqual(3);
    },
  );

  it('allows a new run to change adjacent lanes after its opening fight, while later movement follows edges', () => {
    const save = emptySave();
    save.run = makeRun('guilmon', 42, false);
    const run = save.run;
    run.screen = 'map';
    run.row = 1;
    run.path = [run.nodes[0][0].id];
    expect(availableNodes(run).map((node) => node.lane)).toEqual([0, 1]);
    expect(reduceGame(save, { type: 'node', id: run.nodes[1][1].id }).run!.currentNode?.id).toBe(
      run.nodes[1][1].id,
    );
    expect(reduceGame(save, { type: 'node', id: run.nodes[1][2].id })).toBe(save);
  });

  it('old connections and an existing saved route are never expanded on reload', () => {
    const save = emptySave();
    save.run = makeRun('guilmon', 42, false);
    connectMap(save.run.nodes);
    save.run.row = 1;
    save.run.screen = 'map';
    save.run.path = [save.run.nodes[0][0].id];
    expect(save.run.nodes[0][0].next).toEqual([save.run.nodes[1][0].id]);
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.run!.nodes).toEqual(save.run.nodes);
    expect(availableNodes(loaded.run!).map((node) => node.lane)).toEqual([0]);
  });

  it('rejects a connected map that bypasses combat or permits a second shop', () => {
    const original = makeRun('guilmon', 42, false).nodes;
    const shops = structuredClone(original);
    shops[6].forEach((node) => {
      node.kind = 'shop';
    });
    expect(validateExploration(shops).some((problem) => problem.includes('商店超过1个'))).toBe(
      true,
    );
    const peaceful = structuredClone(original);
    peaceful[6].forEach((node) => {
      node.kind = 'event';
    });
    expect(
      validateExploration(peaceful).some((problem) => problem.includes('连续非战斗超过3层')),
    ).toBe(true);
    const skipped = structuredClone(original);
    skipped[1].forEach((node) => {
      node.kind = 'event';
    });
    skipped[2].forEach((node) => {
      node.kind = 'event';
    });
    expect(validateExploration(skipped).some((problem) => problem.includes('路径战斗数3'))).toBe(
      true,
    );
  });
});
