import { useEffect, useRef, useState, type PointerEvent } from 'react';
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
import { availableNodes, reachableNodeIds } from '../game/map';
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
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const per = run.chapterRows,
    start = Math.floor(run.row / per) * per,
    rows = run.nodes.slice(start, start + per),
    available = availableNodes(run).map((n) => n.id),
    reachable = reachableNodeIds(rows, available),
    currentId = run.path[run.path.length - 1],
    previewNode = rows.flat().find((n) => n.id === (hoverId ?? previewId) && reachable.has(n.id)),
    preview = reachableNodeIds(rows, previewNode ? [previewNode.id] : []);
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
    setPreviewId(null);
    setHoverId(null);
  }, [run.row, per]);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointerStart.current = null;
  }
  function beginHold(event: PointerEvent<HTMLButtonElement>, id: string) {
    cancelHold();
    suppressClick.current = false;
    if (event.pointerType === 'mouse') return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = setTimeout(() => {
      setPreviewId(id);
      suppressClick.current = true;
    }, 450);
  }
  return (
    <div className="exploration-view">
      <div className="screen-heading">
        <span className="eyebrow">FOLLOW THE SIGNAL / UPWARD</span>
        <h1>向着信号，继续向上。</h1>
        <p>沿连线向上前进。点击橙色节点出发，长按或聚焦节点查看后续路线。</p>
        <button className="map-partner" onClick={onTree}>
          <img src={asset(run.form)} alt="" />
          <span>
            {formName(run.form)}
            <small>{stageName(run.stage)} · 查看成长</small>
          </span>
          <GitBranch size={16} />
        </button>
      </div>
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
                const active = n.id === currentId && available.includes(next.id);
                const possible = reachable.has(n.id) && reachable.has(next.id);
                const highlighted =
                  (preview.has(n.id) && preview.has(next.id)) ||
                  (n.id === currentId && next.id === previewNode?.id);
                return (
                  <path
                    key={`${n.id}-${id}`}
                    d={`M ${x(n)} ${y(n)} C ${x(n)} ${y(n) - 66}, ${x(next)} ${y(next) + 66}, ${x(next)} ${y(next)}`}
                    className={`${walked ? 'walked' : ''} ${active ? 'reachable' : ''} ${!walked && !active && !possible ? 'blocked' : ''} ${highlighted ? 'preview' : ''}`}
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
                const legacyRest = n.kind === 'evolution' && run.stage >= 3,
                  label = legacyRest ? '休整营地' : n.label,
                  Icon = legacyRest ? Tent : icons[n.kind],
                  visited = run.path.includes(n.id),
                  active = available.includes(n.id),
                  possible = reachable.has(n.id),
                  current = n.id === currentId;
                const subtitle = n.enemies.length
                  ? n.enemies.map((id) => ENEMIES[id].name).join(' · ')
                  : legacyRest
                    ? '休整 / 恢复15%生命'
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
                    className={`route-node ${visited ? 'visited' : ''} ${active ? 'available' : ''} ${current ? 'current' : ''} ${preview.has(n.id) ? 'on-preview' : ''} ${n.kind === 'boss' ? 'boss' : ''} ${!visited && !possible ? 'missed' : ''}`}
                    style={{ left: `${x(n) / 4}%`, top: y(n) - 22 }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') setHoverId(n.id);
                    }}
                    onPointerLeave={() => {
                      setHoverId(null);
                      cancelHold();
                    }}
                    onFocus={() => setHoverId(n.id)}
                    onBlur={() => setHoverId(null)}
                    onPointerDown={(event) => beginHold(event, n.id)}
                    onPointerMove={(event) => {
                      const start = pointerStart.current;
                      if (
                        start &&
                        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
                      )
                        cancelHold();
                    }}
                    onPointerUp={cancelHold}
                    onPointerCancel={() => {
                      cancelHold();
                      suppressClick.current = false;
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      if (active) onEnter(n.id);
                      else setPreviewId((id) => (id === n.id ? null : n.id));
                    }}
                    disabled={visited || !possible}
                    aria-label={`${n.row - start + 1}层 ${label} ${subtitle ? `${subtitle} · ` : ''}${current ? '当前位置' : visited ? '已完成' : active ? '点击出发，长按查看后续路线' : possible ? '点击查看后续路线' : '当前路线不可到达'}`}
                  >
                    <span className="node-orb" aria-hidden="true">
                      {visited ? <Check size={22} /> : <Icon size={22} />}
                    </span>
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
        <span>橙色：下一站</span>
        <span>绿色：已走过</span>
        <span>淡色：已无法到达</span>
      </div>
    </div>
  );
}
