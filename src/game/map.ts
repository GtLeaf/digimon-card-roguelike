import type { MapNode, Run } from './types';
// 双线／三线延续各自通路，单节点承担分叉与汇合；不存在没有出口的节点。
export function connectMap(rows: MapNode[][]): void {
  for (let i = 0; i < rows.length; i++)
    for (const n of rows[i]) {
      const next = rows[i + 1] ?? [];
      n.next = (
        rows[i].length === 1 || next.length === 1 ? next : next.filter((x) => x.lane === n.lane)
      ).map((x) => x.id);
    }
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
