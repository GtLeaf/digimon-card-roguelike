import { ENEMIES } from './data';
import { ENCOUNTERS } from './encounters';
import { EVENTS } from './events';
import { connectMap, validateExploration } from './map';
import type { EnemyModifier, MapNode, NodeKind } from './types';

// 五章各10层：首章第5层进化，后续为事件；额外营地紧接精英，首领前保留营地。
// 每条路径4～6战、最多1商店，连续非战斗至多3层；模板仅旋转/镜像路线位置。
const layouts: NodeKind[][][] = [
  [
    ['battle', 'battle', 'battle'],
    ['battle', 'battle', 'event'],
    ['elite', 'battle', 'shop'],
    ['camp', 'treasure', 'battle'],
    ['evolution'],
    ['battle', 'event', 'event'],
    ['elite', 'battle', 'battle'],
    ['event'],
    ['camp'],
    ['boss'],
  ],
  [
    ['battle', 'battle', 'battle'],
    ['event', 'battle', 'battle'],
    ['shop', 'battle', 'elite'],
    ['battle', 'treasure', 'camp'],
    ['evolution'],
    ['event', 'event', 'battle'],
    ['battle', 'battle', 'elite'],
    ['event'],
    ['camp'],
    ['boss'],
  ],
  [
    ['battle', 'battle', 'battle'],
    ['battle', 'event', 'battle'],
    ['battle', 'shop', 'elite'],
    ['treasure', 'battle', 'camp'],
    ['evolution'],
    ['event', 'event', 'battle'],
    ['battle', 'battle', 'elite'],
    ['event'],
    ['camp'],
    ['boss'],
  ],
];
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
      usedEvents = new Set<string>();
    const boss = BOSSES[chapter];
    let recoveryPlaced = false;
    for (let local = 0; local < 10; local++) {
      const row = chapter * 10 + local;
      const kinds =
        local === 4
          ? ([chapter === 0 ? 'evolution' : 'event'] as NodeKind[])
          : tutorial && row < 2
            ? (['battle', 'battle', 'battle'] as NodeKind[])
            : layout[local];
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
            if (chapter === 1 && local === 4) eventId = 'research';
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
  }
  connectMap(nodes, { chapterRows: 10 });
  const problems = validateExploration(nodes);
  if (problems.length) throw new Error(`地图生成未通过校验：${problems.join('；')}`);
  return nodes;
}
