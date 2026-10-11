import { describe, expect, it } from 'vitest';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { EVENTS } from '../src/game/events';
import {
  availableNodes,
  connectMap,
  explorationPaths,
  reachableNodeIds,
  validateExploration,
  validateRouteTopology,
} from '../src/game/map';
import { parseSave } from '../src/game/storage';
import type { MapNode } from '../src/game/types';

const isCombat = (node: MapNode) => ['battle', 'elite', 'boss'].includes(node.kind);

describe('exploration path budgets', () => {
  it.each([false, true])(
    'all paths retain combat, supply spacing and research access (tutorial=%s)',
    (tutorial) => {
      const templates = new Set<string>();
      for (let seed = 0; seed < 500; seed++) {
        const run = makeRun('guilmon', seed * 7919 + 42, tutorial);
        expect(validateExploration(run.nodes)).toEqual([]);
        for (let chapter = 0; chapter < 5; chapter++) {
          const rows = run.nodes.slice(chapter * 10, chapter * 10 + 10);
          templates.add(JSON.stringify(rows.map((row) => row.map((node) => node.kind))));
          const eventNodes = rows.flat().filter((node) => node.kind === 'event');
          expect(eventNodes.every((node) => !!node.eventId && !!EVENTS[node.eventId])).toBe(true);
          // 等价入口可以共享同层事件，实际路径不会重复经历事件。
          for (const id of new Set(eventNodes.map((node) => node.eventId)))
            expect(
              new Set(eventNodes.filter((node) => node.eventId === id).map((node) => node.row))
                .size,
            ).toBe(1);
          const distinctEvents = [
            ...new Map(eventNodes.map((node) => [node.eventId, node])).values(),
          ];
          expect(
            distinctEvents.filter((node) =>
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
            const events = path.filter((node) => node.kind === 'event').map((node) => node.eventId);
            expect(new Set(events).size).toBe(events.length);
            expect(
              path.slice(0, -1).filter((node) => node.next.length > 1).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
              path.slice(0, -1).filter((node) => node.next.length > 1).length,
            ).toBeLessThanOrEqual(3);
            if (chapter === 0) {
              expect(path.slice(0, 4).filter(isCombat).length).toBeGreaterThanOrEqual(2);
              expect(path[4].kind).toBe('evolution');
            }
            if (chapter === 1)
              expect(path.filter((node) => node.eventId === 'research')).toHaveLength(1);
            let peaceful = 0;
            for (const node of path) {
              peaceful = isCombat(node) ? 0 : peaceful + 1;
              expect(peaceful).toBeLessThanOrEqual(3);
            }
          }
        }
      }
      expect(templates.size).toBeGreaterThanOrEqual(4);
    },
  );

  it('keeps the opening route and rejects adjacent, same-layer and skipped nodes without edges', () => {
    const save = emptySave();
    save.run = makeRun('guilmon', 42, false);
    const run = save.run;
    run.screen = 'map';
    run.row = 1;
    run.path = [run.nodes[0][0].id];
    expect(availableNodes(run).map((node) => node.lane)).toEqual([0]);
    expect(reduceGame(save, { type: 'node', id: run.nodes[1][0].id }).run!.currentNode?.id).toBe(
      run.nodes[1][0].id,
    );
    expect(reduceGame(save, { type: 'node', id: run.nodes[1][1].id })).toBe(save);
    expect(reduceGame(save, { type: 'node', id: run.nodes[1][2].id })).toBe(save);
    expect(reduceGame(save, { type: 'node', id: run.nodes[0][1].id })).toBe(save);
    expect(reduceGame(save, { type: 'node', id: run.nodes[2][0].id })).toBe(save);
  });

  it('offers exactly the explicit exits at a fork and preserves the choice on reload', () => {
    const save = emptySave();
    save.run = makeRun('guilmon', 42, false);
    const run = save.run;
    const fork = run.nodes
      .slice(0, 8)
      .flat()
      .find((node) => node.next.length === 2)!;
    run.screen = 'map';
    run.row = fork.row + 1;
    run.path = [fork.id];
    expect(availableNodes(run).map((node) => node.id)).toEqual(fork.next);
    for (const id of fork.next)
      expect(reduceGame(save, { type: 'node', id }).run!.currentNode?.id).toBe(id);
    const other = run.nodes[run.row].find((node) => !fork.next.includes(node.id))!;
    expect(reduceGame(save, { type: 'node', id: other.id })).toBe(save);
    expect(availableNodes(parseSave(JSON.stringify(save)).run!).map((node) => node.id)).toEqual(
      fork.next,
    );
  });

  it('future reachability respects route commitment, rejoins at the camp and stops at the chapter boundary', () => {
    const run = makeRun('guilmon', 42, false);
    const rows = run.nodes.slice(0, 10);
    run.row = 1;
    run.path = [rows[0][0].id];
    const reachable = reachableNodeIds(
      rows,
      availableNodes(run).map((node) => node.id),
    );
    expect(reachable.has(rows[1][0].id)).toBe(true);
    expect(reachable.has(rows[1][1].id)).toBe(false);
    expect(reachable.has(rows[0][0].id)).toBe(false);
    expect(reachable.has(rows[8][0].id)).toBe(true);
    expect(reachable.has(rows[9][0].id)).toBe(true);
    expect(reachable.has(run.nodes[10][0].id)).toBe(false);
    const node = rows[4][0];
    run.row = 5;
    run.path = [node.id];
    expect(availableNodes(run).map((next) => next.lane)).toEqual([0]);
    const later = reachableNodeIds(
      rows,
      availableNodes(run).map((next) => next.id),
    );
    expect(later.has(rows[5][1].id)).toBe(false);
    expect(later.has(rows[8][0].id)).toBe(true);
  });

  it('does not unlock all routes when the saved previous node cannot be found', () => {
    const save = emptySave();
    save.run = makeRun('guilmon', 42, false);
    save.run.row = 1;
    save.run.screen = 'map';
    save.run.path = ['missing-node'];
    expect(availableNodes(save.run)).toEqual([]);
    expect(reduceGame(save, { type: 'node', id: save.run.nodes[1][0].id })).toBe(save);
  });

  it('rejects crossing edges, excessive exits and premature global merges', () => {
    const rows = makeRun('guilmon', 42, false).nodes.slice(0, 10);
    const crossing = structuredClone(rows);
    crossing[0][0].next = [crossing[1][1].id];
    crossing[0][1].next = [crossing[1][0].id];
    expect(validateRouteTopology(crossing)).toContain('第1章存在交叉连线');
    const crowded = structuredClone(rows);
    crowded[0][0].next = crowded[1].map((node) => node.id);
    expect(validateRouteTopology(crowded)).toContain('第1章普通节点出口超过2个');
    const merged = structuredClone(rows);
    merged[4] = [merged[4][0]];
    expect(validateRouteTopology(merged)).toContain('第1章首领前营地之前存在全路线汇合');
    const threeIntoOne = structuredClone(rows);
    threeIntoOne[0].forEach((node) => {
      node.next = [threeIntoOne[1][1].id];
    });
    expect(validateRouteTopology(threeIntoOne)).toContain('第1章局部汇合超过两条支线');
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
