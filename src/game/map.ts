import type { MapNode, Run } from './types';
// 双线延续各自通路，单节点承担分叉与汇合；不存在没有出口的节点。
export function connectMap(rows:MapNode[][]):void {
 for(let i=0;i<rows.length;i++)for(const n of rows[i]){
  const next=rows[i+1]??[];
  n.next=(rows[i].length===1||next.length===1?next:next.filter(x=>x.lane===n.lane)).map(x=>x.id);
 }
}
export function availableNodes(r:Run):MapNode[]{
 const rows=r.nodes[r.row]??[];
 if(r.row===0||!r.path.length)return rows;
 const previous=r.nodes.flat().find(n=>n.id===r.path[r.path.length-1]);
 return previous?rows.filter(n=>previous.next.includes(n.id)):rows;
}
