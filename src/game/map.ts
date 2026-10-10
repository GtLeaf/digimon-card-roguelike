import type { MapNode, Run } from './types';
// 未传选路参数时保留旧版连接，供旧存档迁移使用。新图仅在预算允许的位置增加变线。
export function connectMap(rows: MapNode[][], options: { chapterRows?: number } = {}): void {
  for (let i = 0; i < rows.length; i++)
    for (const n of rows[i]) {
      const next = rows[i + 1] ?? [];
      const local = options.chapterRows ? n.row % options.chapterRows : -1;
      n.next = next
        .filter(
          (x) =>
            rows[i].length === 1 ||
            next.length === 1 ||
            x.lane === n.lane ||
            (Math.abs(x.lane - n.lane) === 1 &&
              (local === 0 ||
                (local === 2 && n.kind === 'elite' && x.kind === 'treasure') ||
                (local === 5 && n.kind === 'battle' && x.kind === 'battle'))),
        )
        .map((x) => x.id);
    }
}

// 仅枚举传入的一章，不把跨章分支相乘；供生成校验与审核工具共用。
export function explorationPaths(rows: MapNode[][]): MapNode[][] {
  const paths: MapNode[][] = [];
  const walk = (path: MapNode[]) => {
    if (path.length === rows.length) {
      paths.push(path);
      return;
    }
    for (const next of rows[path.length] ?? [])
      if (path[path.length - 1].next.includes(next.id)) walk([...path, next]);
  };
  for (const start of rows[0] ?? []) walk([start]);
  return paths;
}

export function validateExploration(rows: MapNode[][], chapterRows = 10): string[] {
  const problems = validateMap(rows);
  const isCombat = (n: MapNode) => ['battle', 'elite', 'boss'].includes(n.kind);
  for (let start = 0; start < rows.length; start += chapterRows) {
    const chapter = rows.slice(start, start + chapterRows),
      prefix = `第${start / chapterRows + 1}章`,
      paths = explorationPaths(chapter);
    if (chapter.length !== chapterRows) problems.push(`${prefix}层数不完整`);
    if (chapter[chapterRows - 1]?.[0]?.kind !== 'boss') problems.push(`${prefix}缺少首领`);
    if (chapter[chapterRows - 2]?.[0]?.kind !== 'camp') problems.push(`${prefix}缺少首领前营地`);
    if (!chapter.flat().some((n) => n.kind === 'shop')) problems.push(`${prefix}缺少商店机会`);
    for (const n of chapter.flat()) {
      if (n.kind !== 'camp' || n.row - start === chapterRows - 2) continue;
      const incoming = chapter[n.row - start - 1]?.filter((p) => p.next.includes(n.id)) ?? [];
      if (!incoming.length || incoming.some((p) => p.kind !== 'elite'))
        problems.push(`${prefix}额外营地未紧接精英`);
    }
    for (const path of paths) {
      const combats = path.filter(isCombat).length,
        shops = path.filter((n) => n.kind === 'shop').length,
        camps = path.filter((n) => n.kind === 'camp').length;
      if (combats < 4 || combats > 6) problems.push(`${prefix}路径战斗数${combats}超出4～6`);
      if (shops > 1) problems.push(`${prefix}路径商店超过1个`);
      if (camps < 1 || camps > 2) problems.push(`${prefix}路径营地数超出1～2`);
      let peaceful = 0;
      for (let i = 0; i < path.length; i++) {
        peaceful = isCombat(path[i]) ? 0 : peaceful + 1;
        if (peaceful > 3) problems.push(`${prefix}路径连续非战斗超过3层`);
        if (i && path[i].kind === 'elite' && path[i - 1].kind === 'elite')
          problems.push(`${prefix}路径精英连续`);
      }
    }
    const reachable = new Set(paths.flat().map((n) => n.id));
    if (chapter.flat().some((n) => !reachable.has(n.id))) problems.push(`${prefix}存在孤立节点`);
  }
  return [...new Set(problems)];
}
export function availableNodes(r: Run): MapNode[] {
  const rows = r.nodes[r.row] ?? [];
  if (r.row === 0 || !r.path.length) return rows;
  const previous = r.nodes.flat().find((n) => n.id === r.path[r.path.length - 1]);
  return previous ? rows.filter((n) => previous.next.includes(n.id)) : rows;
}
// 生成后强制校验：全图连通、首领可达、营地／商店互不相邻（含同行并列）。
export function validateMap(rows: MapNode[][]): string[] {
  const problems: string[] = [];
  const last = rows.length - 1;
  rows.flat().forEach((n) => {
    if (n.row < last && n.next.length === 0) problems.push(`${n.id} 没有出口`);
    for (const target of n.next) {
      if (!rows[n.row + 1]?.some((x) => x.id === target))
        problems.push(`${n.id} 指向不存在的 ${target}`);
    }
    if (['camp', 'shop'].includes(n.kind)) {
      if (
        n.next.some((id) => {
          const t = rows.flat().find((x) => x.id === id);
          return t && ['camp', 'shop'].includes(t.kind);
        })
      )
        problems.push(`${n.id} 营地／商店相邻`);
      if (rows[n.row].some((x) => x.id !== n.id && ['camp', 'shop'].includes(x.kind)))
        problems.push(`${n.id} 营地／商店同层并列`);
    }
  });
  let frontier = rows[0]?.map((n) => n.id) ?? [];
  for (let row = 0; row < last; row++) {
    const next = new Set<string>();
    for (const id of frontier) {
      const n = rows[row].find((x) => x.id === id);
      if (!n) {
        problems.push(`前沿在 ${row} 层断裂`);
        continue;
      }
      for (const t of n.next) next.add(t);
    }
    frontier = [...next];
  }
  if (!frontier.includes(rows[last]?.[0]?.id)) problems.push('首领不可达');
  return problems;
}
