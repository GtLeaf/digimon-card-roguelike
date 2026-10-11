import { ENEMIES } from './data';
import { ENCOUNTERS } from './encounters';
import { EVENTS } from './events';
import { connectChapter, validateExploration } from './map';
import type { EnemyModifier, MapNode, NodeKind } from './types';

// 先选稀疏拓扑，再填充遭遇：前三条路线保持方向，仅在显式分叉处变线。
// 每章10层，第5层成长／研究采用等价入口，第8层继续分路，第9层营地统一汇合。
type ChapterLayout = { kinds: NodeKind[][]; exits: number[][][] };
const leftChallenge: ChapterLayout = {
  kinds: [
    ['battle', 'battle', 'battle'],
    ['battle', 'battle', 'event'],
    ['elite', 'battle', 'shop'],
    ['camp', 'treasure', 'battle'],
    ['evolution', 'evolution', 'evolution'],
    ['battle', 'event', 'event'],
    ['elite', 'battle', 'battle'],
    ['event', 'event', 'event'],
    ['camp'],
    ['boss'],
  ],
  exits: [
    [[0], [1], [2]],
    [[0, 1], [1, 2], [2]],
    [[0], [1], [2]],
    [[0], [1], [1, 2]],
    [[0], [1], [2]],
    [[0, 1], [1], [2]],
    [[0], [1], [2]],
    [[0], [0], [0]],
    [[0]],
  ],
};
const middleShop: ChapterLayout = {
  kinds: [
    ['battle', 'battle', 'battle'],
    ['battle', 'event', 'battle'],
    ['battle', 'shop', 'elite'],
    ['treasure', 'battle', 'camp'],
    ['evolution', 'evolution', 'evolution'],
    ['event', 'event', 'battle'],
    ['battle', 'battle', 'elite'],
    ['event', 'event', 'event'],
    ['camp'],
    ['boss'],
  ],
  exits: [
    [[0], [1], [2]],
    [[0], [1], [1, 2]],
    [[0], [1], [2]],
    [[0, 1], [1, 2], [2]],
    [[0], [1], [2]],
    [[0], [1], [1, 2]],
    [[0], [1], [2]],
    [[0], [0], [0]],
    [[0]],
  ],
};
function mirrorLayout(layout: ChapterLayout): ChapterLayout {
  return {
    kinds: layout.kinds.map((row) => [...row].reverse()),
    exits: layout.exits.map((row, local) =>
      [...row]
        .reverse()
        .map((targets) =>
          targets
            .map((target) => layout.kinds[local + 1].length - 1 - target)
            .sort((a, b) => a - b),
        ),
    ),
  };
}
const layouts = [leftChallenge, mirrorLayout(leftChallenge), middleShop, mirrorLayout(middleShop)];
const BOSSES = ['sinduramon', 'beelzebumon', 'machinedramon', 'diaboromon', 'core'];
const ELITES = [
  [['devidramon'], ['dokugumon'], ['devimon']],
  [['icedevimon'], ['vajramon'], ['skullgreymon']],
  [
    ['rookchessmon', 'pawnchessmonwhite'],
    ['bishopchessmon', 'knightchessmonwhite'],
    ['vajramon'],
    ['skullgreymon'],
  ],
  [['devimon'], ['icedevimon'], ['infermon'], ['lilithmon'], ['leviamon'], ['grandracmon']],
  [['sentinel'], ['devourer'], ['armageddemon'], ['daemon'], ['belphemon'], ['barbamon']],
];
export function generateWorld(random: () => number, tutorial: boolean): MapNode[][] {
  const lastEventChapter = new Map<string, number>(),
    nodes: MapNode[][] = [];
  const pick = <T>(items: T[]): T => {
    if (!items.length) throw new Error('地图生成候选池为空');
    return items[Math.floor(random() * items.length)];
  };
  const freeRecovery = (id: string) =>
    EVENTS[id].choices.some((choice) =>
      Boolean(choice.effect.heal && !choice.effect.goldCost && !choice.effect.hpCost),
    );
  for (let chapter = 0; chapter < 5; chapter++) {
    const layout = pick(layouts),
      usedEncounters = new Set<string>(),
      usedEvents = new Set<string>(),
      sharedEvents = new Map<number, string>();
    const boss = BOSSES[chapter];
    let recoveryPlaced = false;
    for (let local = 0; local < 10; local++) {
      const row = chapter * 10 + local;
      const kinds =
        local === 4
          ? layout.kinds[local].map((): NodeKind => (chapter === 0 ? 'evolution' : 'event'))
          : tutorial && row < 2
            ? (['battle', 'battle', 'battle'] as NodeKind[])
            : layout.kinds[local];
      nodes.push(
        kinds.map((kind, lane) => {
          let enemies: string[] = [],
            enemyModifiers: EnemyModifier[] | undefined,
            encounterId: string | undefined,
            eventId: string | undefined;
          if (kind === 'battle') {
            if (tutorial && row < 2) {
              enemies = ['hagurumon'];
              encounterId = `tutorial-${row}`;
            } else {
              const pool = ENCOUNTERS.filter(
                (e) =>
                  e.chapter === chapter &&
                  !usedEncounters.has(e.id) &&
                  (!(local < 2) || e.opening) &&
                  !(chapter === 0 && tutorial && e.id === 'city-gears'),
              );
              const encounter = pick(pool);
              usedEncounters.add(encounter.id);
              enemies = encounter.enemies;
              encounterId = encounter.id;
              enemyModifiers = encounter.enemyModifiers;
            }
          }
          if (kind === 'elite') {
            enemies = pick(ELITES[chapter]);
            // 按整队预算缩放，护卫／治疗拥有作用对象而非直接叠加一只满强度小怪。
            if (enemies[0] === 'rookchessmon')
              enemyModifiers = [
                { hpScale: 0.62, damageScale: 0.8 },
                { hpScale: 0.7, damageScale: 0.6, phaseOffset: 1 },
              ];
            if (enemies[0] === 'bishopchessmon')
              enemyModifiers = [
                { hpScale: 0.72, damageScale: 0.85 },
                { hpScale: 0.6, damageScale: 0.7, phaseOffset: 1 },
              ];
          }
          if (kind === 'boss') enemies = [boss];
          if (kind === 'event') {
            // 原第5／8层的单事件使用等价入口，既不合并路线，也不额外消耗事件池。
            const shared = sharedEvents.get(local);
            if (shared) eventId = shared;
            else if (chapter === 1 && local === 4) eventId = 'research';
            else {
              const pool = Object.keys(EVENTS).filter(
                (id) =>
                  id !== 'research' &&
                  !usedEvents.has(id) &&
                  (!recoveryPlaced || !freeRecovery(id)),
              );
              // 优先从未出现或最久未出现的事件；只在章内去重，不再耗尽整局事件池。
              const earliest = Math.min(...pool.map((id) => lastEventChapter.get(id) ?? -1));
              eventId = pick(pool.filter((id) => (lastEventChapter.get(id) ?? -1) === earliest));
            }
            usedEvents.add(eventId);
            lastEventChapter.set(eventId, chapter);
            recoveryPlaced ||= freeRecovery(eventId);
            if (local === 4 || local === 7) sharedEvents.set(local, eventId);
          }
          const labels: Record<NodeKind, string> = {
            battle: '数码遭遇',
            elite: '危险信号',
            boss: ENEMIES[boss].name,
            camp: '休息营地',
            shop: '流浪商人',
            event: eventId ? EVENTS[eventId].title : '未知信号',
            treasure: '数据宝箱',
            evolution: '进化之光',
          };
          return {
            id: `n${row}-${lane}`,
            row,
            lane,
            kind,
            label: labels[kind],
            enemies: [...enemies],
            next: [],
            ...(encounterId ? { encounterId } : {}),
            ...(enemyModifiers ? { enemyModifiers: enemyModifiers.map((m) => ({ ...m })) } : {}),
            ...(eventId ? { eventId } : {}),
          };
        }),
      );
    }
    connectChapter(nodes.slice(chapter * 10, chapter * 10 + 10), layout.exits);
  }
  // 击败首领后可重新选择下一章起点；章内没有自动跨线连接。
  for (let chapter = 0; chapter < 4; chapter++)
    nodes[chapter * 10 + 9][0].next = nodes[chapter * 10 + 10].map((node) => node.id);
  const problems = validateExploration(nodes);
  if (problems.length) throw new Error(`地图生成未通过校验：${problems.join('；')}`);
  return nodes;
}
