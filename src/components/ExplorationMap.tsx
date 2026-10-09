import { useEffect, useRef } from 'react';
import {
  ArrowUp,
  Check,
  Crosshair,
  Flag,
  GitBranch,
  Radio,
  ShoppingBag,
  Skull,
  Swords,
  Tent,
  Box,
} from 'lucide-react';
import { formName, stageName } from '../game/evolution';
import { EVENTS } from '../game/events';
import { ENEMIES, asset } from '../game/data';
import { availableNodes } from '../game/map';
import type { MapNode, Run } from '../game/types';
const icons = {
  battle: Swords,
  elite: Skull,
  boss: Flag,
  camp: Tent,
  shop: ShoppingBag,
  event: Radio,
  treasure: Box,
  evolution: GitBranch,
};
export function ExplorationMap({
  run,
  onEnter,
  onTree,
}: {
  run: Run;
  onEnter: (id: string) => void;
  onTree: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const per = run.chapterRows,
    start = Math.floor(run.row / per) * per,
    rows = run.nodes.slice(start, start + per),
    available = availableNodes(run).map((n) => n.id);
  const span = (per - 1) * 132 + 190;
  const y = (n: MapNode) => (per - 1 - (n.row - start)) * 132 + 45;
  const x = (n: MapNode) => {
    const width = rows[n.row - start].length;
    return width === 1
      ? 200
      : width === 2
        ? n.lane === 0
          ? 100
          : 300
        : ([70, 200, 330][n.lane] ?? 200);
  };
  function locate() {
    const v = viewport.current;
    if (v)
      v.scrollTo({
        top: Math.max(0, (per - 1 - (run.row % per)) * 132 + 45 - v.clientHeight + 155),
        behavior: 'auto',
      });
  }
  useEffect(() => {
    const v = viewport.current;
    if (v) v.scrollTop = Math.max(0, (per - 1 - (run.row % per)) * 132 + 45 - v.clientHeight + 155);
  }, [run.row, per]);
  return (
    <div className="exploration-view">
      <div className="screen-heading">
        <span className="eyebrow">FOLLOW THE SIGNAL / UPWARD</span>
        <h1>向着信号，继续向上。</h1>
        <p>沿连线选择下一站，点击亮起的节点直接出发。</p>
        <button className="map-partner" onClick={onTree}>
          <img src={asset(run.form)} alt="" />
          <span>
            {formName(run.form)}
            <small>{stageName(run.stage)} · 查看成长</small>
          </span>
          <GitBranch size={16} />
        </button>
      </div>
      <div className="chapter-boss-preview">
        <Flag size={16} />
        <span>
          本章首领：<strong>{ENEMIES[rows[per - 1][0].enemies[0]].name}</strong>
        </span>
        <small>已侦测 · 可提前准备卡组</small>
      </div>
      {run.message && (
        <p className="map-message" role="status">
          {run.message}
        </p>
      )}
      <div className="map-toolbar">
        <span>
          <ArrowUp size={15} />第 {(run.row % per) + 1} / {per} 层
        </span>
        <button onClick={locate}>
          <Crosshair size={15} />
          当前位置
        </button>
        <button onClick={onTree}>
          <GitBranch size={15} />
          进化树
        </button>
      </div>
      <div className="route-viewport" ref={viewport} aria-label="向上探索地图">
        <div className="route-canvas" style={{ height: span }}>
          <svg
            className="route-connectors"
            viewBox={`0 0 400 ${span}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {rows.flat().flatMap((n) =>
              n.next.map((id) => {
                const next = rows.flat().find((x) => x.id === id);
                if (!next) return null;
                const walked = run.path.includes(n.id) && run.path.includes(next.id);
                const reachable = run.path.includes(n.id) && available.includes(next.id);
                return (
                  <path
                    key={`${n.id}-${id}`}
                    d={`M ${x(n)} ${y(n)} C ${x(n)} ${y(n) - 66}, ${x(next)} ${y(next) + 66}, ${x(next)} ${y(next)}`}
                    className={walked ? 'walked' : reachable ? 'reachable' : ''}
                  />
                );
              }),
            )}
          </svg>
          {[...rows].reverse().map((row) => (
            <div key={row[0].row}>
              <span className="route-floor" style={{ top: y(row[0]) - 8 }}>
                {String(row[0].row - start + 1).padStart(2, '0')}
              </span>
              {row.map((n) => {
                const Icon = icons[n.kind],
                  visited = run.path.includes(n.id),
                  active = available.includes(n.id);
                const subtitle = n.enemies.length
                  ? n.enemies.map((id) => ENEMIES[id].name).join(' · ')
                  : n.kind === 'evolution'
                    ? '成长的分岔'
                    : n.kind === 'camp'
                      ? '恢复 / 强化 / 进化'
                      : n.eventId
                        ? EVENTS[n.eventId].hint
                        : n.kind === 'event' && start === per
                          ? '可获得净化资料'
                          : '';
                return (
                  <button
                    key={n.id}
                    className={`route-node ${visited ? 'visited' : ''} ${active ? 'available' : ''} ${n.kind === 'boss' ? 'boss' : ''} ${n.row < run.row && !visited ? 'missed' : ''}`}
                    style={{ left: `${x(n) / 4}%`, top: y(n) - 20 }}
                    onClick={() => onEnter(n.id)}
                    disabled={!active}
                    aria-label={`${n.row - start + 1}层 ${n.label} ${visited ? '已完成' : active ? '点击出发' : '当前路线不可进入'}`}
                  >
                    <span className="node-orb">
                      {visited ? <Check size={22} /> : <Icon size={22} />}
                    </span>
                    <strong>{n.label}</strong>
                    {subtitle && <small>{subtitle}</small>}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="route-start">
            <span className="signal-dot" />
            本章起点 · 向上探索
          </div>
        </div>
      </div>
      <div className="map-legend">
        <span>亮起：可前往</span>
        <span>绿色：已走过</span>
        <span>灰色：未经过</span>
      </div>
    </div>
  );
}
