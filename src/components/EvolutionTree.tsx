import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, GitBranch, Lock, Target } from 'lucide-react';
import { asset, CARDS, PARTNERS, PARTNER_IDS, inheritanceOptions } from '../game/data';
import {
  EVOLUTIONS,
  evolutionStatus,
  formName,
  nextEvolutions,
  ROUTE_DATA,
  stageName,
  stageRequirement,
} from '../game/evolution';
import type { Action, Meta, Partner, Run } from '../game/types';
import { GameCard } from './GameCard';
const inheritance = {
  ember: '余烬：首次灼烧＋1',
  ward: '坚守：首次防御＋2护盾',
  seal: '符心：首张牌施加符印额外＋1',
  flow: '灵巧：首张牌为技能时＋2护盾',
};
export function EvolutionTree({
  run,
  meta,
  onAction,
  choose = false,
  onDeck,
}: {
  run: Run | null;
  meta: Meta;
  onAction: (a: Action) => void;
  choose?: boolean;
  onDeck?: () => void;
}) {
  const [partner, setPartner] = useState<Partner>(run?.partner ?? 'guilmon');
  const [selected, setSelected] = useState(() =>
    choose && run
      ? (nextEvolutions(run).find((d) => evolutionStatus(run, meta, d.id).ready)?.id ??
        nextEvolutions(run)[0]?.id ??
        run.form)
      : (run?.form ?? 'guilmon'),
  );
  const [expanded, setExpanded] = useState(false);
  const [replacements, setReplacements] = useState<string[]>(
    () => run?.deck.slice(0, 2).map((c) => c.uid) ?? [],
  );
  const [inherit, setInherit] = useState<Run['inherit']>(run?.inherit ?? 'ward');
  const [training, setTraining] = useState<Run['training']>(run?.training ?? 'attack');
  const scroll = useRef<HTMLDivElement>(null);
  const nodes = Object.values(EVOLUTIONS).filter((d) => d.partner === partner),
    activeRun = run?.partner === partner ? run : null;
  const d = EVOLUTIONS[selected],
    status = evolutionStatus(activeRun, meta, selected);
  const legacy =
    !!activeRun?.legacyEvolution &&
    activeRun.stage === 2 &&
    d.stage === 3 &&
    ['dukemon', 'megidramon', 'sakuyamon', 'kuzuhamon'].includes(d.id);
  const ready = status.ready || legacy;
  function locate() {
    const el = scroll.current;
    if (el)
      el.scrollTo({ left: Math.max(0, (activeRun?.stage ?? 0) * 230 - 40), behavior: 'auto' });
  }
  useEffect(() => {
    const el = scroll.current;
    if (el) el.scrollLeft = Math.max(0, (activeRun?.stage ?? 0) * 230 - 40);
  }, [activeRun?.stage, partner]);
  const x = (id: string) => (EVOLUTIONS[id].treeStage ?? EVOLUTIONS[id].stage) * 230 + 100,
    y = (id: string) => EVOLUTIONS[id].slot * 155 + 100;
  function select(id: string) {
    setSelected(id);
    setExpanded(true);
    if (run) {
      const oldIds = EVOLUTIONS[run.form]?.cards ?? [];
      const preferred = run.deck.filter((c) => oldIds.includes(c.id));
      setReplacements((preferred.length >= 2 ? preferred : run.deck).slice(0, 2).map((c) => c.uid));
    }
  }
  return (
    <div className="evolution-tree">
      <div className="tree-toolbar">
        <div className="partner-tabs">
          {PARTNER_IDS.map((id) => (
            <button
              key={id}
              disabled={choose && id !== run?.partner}
              aria-pressed={partner === id}
              onClick={() => {
                setPartner(id);
                setSelected(id);
              }}
            >
              {PARTNERS[id].name}
            </button>
          ))}
        </div>
        <button className="text-btn" onClick={locate}>
          <Crosshair size={16} />
          定位当前
        </button>
      </div>
      <p className="modal-note">
        左右滑动查看进化阶段。点击形态查看条件；实线为成长路线，虚线为调和／特殊路线。
      </p>
      <div className="tree-scroll" ref={scroll} aria-label="横向进化树">
        <div className="tree-canvas">
          <svg className="tree-edges" viewBox="0 0 920 700" aria-hidden="true">
            {nodes.flatMap((node) =>
              node.parents.map((parent) => {
                const special =
                  (parent === 'blackgrowmon' && node.id === 'wargrowlmon') ||
                  (parent === 'youkomon' && node.id === 'taomon') ||
                  (parent === 'doumon' && node.id === 'sakuyamon') ||
                  (parent === 'blackgalgomon' && node.id === 'rapidmon') ||
                  (parent === 'galgomon' && node.id === 'blackrapidmon') ||
                  (parent === 'blackrapidmon' && node.id === 'saintgalgomon');
                const visited =
                  !!activeRun &&
                  activeRun.formHistory.includes(parent) &&
                  activeRun.formHistory.includes(node.id);
                return (
                  <path
                    key={`${parent}-${node.id}`}
                    d={`M ${x(parent) + 76} ${y(parent)} C ${x(parent) + 126} ${y(parent)}, ${x(node.id) - 126} ${y(node.id)}, ${x(node.id) - 76} ${y(node.id)}`}
                    className={`${special ? 'special' : ''} ${visited ? 'walked' : ''}`}
                  />
                );
              }),
            )}
          </svg>
          {[0, 1, 2, 3].map((stage) => (
            <span className="tree-stage-label" key={stage} style={{ left: stage * 230 + 20 }}>
              {String(stage + 1).padStart(2, '0')} / {stageName(stage)}
            </span>
          ))}
          {nodes.map((node) => {
            const s = evolutionStatus(activeRun, meta, node.id);
            return (
              <button
                key={node.id}
                className={`evo-node ${selected === node.id ? 'selected' : ''} ${activeRun?.form === node.id ? 'current' : ''} ${s.ready ? 'ready' : ''} ${s.achieved ? 'achieved' : ''}`}
                style={{ left: x(node.id) - 77, top: y(node.id) - 64 }}
                onClick={() => select(node.id)}
                aria-label={`${formName(node.id)} ${activeRun?.form === node.id ? '当前形态' : s.ready ? '可进化' : '查看条件'}`}
              >
                <img src={asset(node.id)} alt="" />
                <strong>{formName(node.id)}</strong>
                <small>
                  {activeRun?.form === node.id
                    ? '当前形态'
                    : s.achieved
                      ? '本局已进化'
                      : s.ready
                        ? '条件达成 · 可进化'
                        : node.stage === 0
                          ? '初始搭档'
                          : node.tag}
                </small>
                {node.groups.length > 0 && (
                  <em>
                    {s.groups
                      .slice(0, 2)
                      .map((g) =>
                        g
                          .map((t) => `${t.label} ${Math.min(t.current, t.goal)}/${t.goal}`)
                          .join(' 或 '),
                      )
                      .join(' · ')}
                  </em>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <section
        className={`evo-details ${expanded && !choose ? 'detail-open' : ''}`}
        aria-label="进化条件详情"
      >
        {expanded && !choose && (
          <button className="text-btn collapse-evo-detail" onClick={() => setExpanded(false)}>
            收起详情，返回进化树
          </button>
        )}
        <div className="evo-detail-title">
          <div>
            <span className="eyebrow">
              {stageName(d.stage)} / {d.tag}
            </span>
            <h3>{formName(d.id)}</h3>
          </div>
          {activeRun && d.stage > activeRun.stage && (
            <button
              className="secondary"
              onClick={() =>
                onAction({ type: 'track', form: activeRun.evolutionTarget === d.id ? null : d.id })
              }
            >
              <Target size={16} />
              {activeRun.evolutionTarget === d.id ? '取消追踪' : '设为目标'}
            </button>
          )}
        </div>
        <p className="evo-passive">{d.passive}</p>
        <div className="requirement-list">
          <div className={status.stage || status.achieved ? 'met' : ''}>
            <Check size={15} />
            <span>{stageRequirement(d.stage, activeRun?.chapterRows)}</span>
          </div>
          {d.stage > 0 && (
            <div className={status.parent || status.achieved ? 'met' : ''}>
              <GitBranch size={15} />
              <span>前置形态：{d.parents.map(formName).join(' / ')}</span>
            </div>
          )}
          {status.data.map((t) => (
            <div key={t.label} className={t.met ? 'met' : ''}>
              {t.met ? <Check size={15} /> : <Lock size={15} />}
              <span>
                {t.label} · {t.met ? '已解锁' : '未解锁'}
              </span>
            </div>
          ))}
          {status.groups.map((group, i) => (
            <div className={`requirement-group ${group.some((t) => t.met) ? 'met' : ''}`} key={i}>
              <Check size={15} />
              <span>
                {group
                  .map((t) => `${t.label} ${Math.min(t.current, t.goal)}/${t.goal}`)
                  .join(' 或 ')}
              </span>
            </div>
          ))}
        </div>
        {d.id === 'blackrapidmon' && (
          <p className="condition-hint">
            从加鲁哥兽转入另需机械研究；黑加鲁哥兽主路线无需跨局资料。{ROUTE_DATA.mechanical.source}
            。
          </p>
        )}
        {d.id === 'chaosdukemon' && (
          <p className="condition-hint">混沌资料：{ROUTE_DATA.chaos.source}。</p>
        )}
        {d.id === 'sakuyamon' && (
          <p className="condition-hint">
            道士兽转入此路线另需：净化资料、主动防御12次、消耗符印5次。净化资料：
            {ROUTE_DATA.purification.source}。
          </p>
        )}
        {legacy && <p className="condition-hint">旧版待进化存档：保留原有四条终点的选择资格。</p>}
        {!status.groups.length && d.stage > 0 && (
          <p className="condition-hint">主线成长：满足阶段与前置形态即可进化。</p>
        )}
        <h4>{choose ? '将获得的两张招牌牌' : '招牌卡片'}</h4>
        {choose && d.signatureUpgrade && (
          <p className="condition-hint">
            招牌牌强化：卡组中已有的{' '}
            {(EVOLUTIONS[d.parents[0]]?.cards ?? []).map((id) => CARDS[id].name).join('、')}{' '}
            将被强化。
          </p>
        )}
        <div className="evolution-new-cards">
          {d.cards.map((id) => (
            <GameCard run={activeRun} key={id} compact card={{ uid: id, id, upgraded: false }} />
          ))}
        </div>
        <h4>到达此形态后解锁的专属卡池</h4>
        <p className="condition-hint">
          {Object.values(CARDS)
            .filter((c) => c.unlockForm === d.id)
            .map((c) => c.name)
            .join('、') || '沿用已学技能与通用卡。'}
          。后续进化保留解锁资格。
        </p>
        {choose && run && (
          <div className="evolution-confirm">
            {ready ? (
              <>
                <h4>替换两张牌，牌组张数不变 · {replacements.length}/2</h4>
                <p>成熟期／完全体招牌牌自动强化；究极体保留对应被替换牌的强化。</p>
                <div className="replace-list">
                  {run.deck.map((c) => (
                    <button
                      key={c.uid}
                      aria-pressed={replacements.includes(c.uid)}
                      className={replacements.includes(c.uid) ? 'active' : ''}
                      onClick={() =>
                        setReplacements((old) =>
                          old.includes(c.uid)
                            ? old.filter((uid) => uid !== c.uid)
                            : old.length < 2
                              ? [...old, c.uid]
                              : [old[1], c.uid],
                        )
                      }
                    >
                      {replacements.includes(c.uid) && <Check size={13} />} {CARDS[c.id].name}
                      {c.upgraded ? '＋' : ''}
                      {replacements.includes(c.uid)
                        ? ` → ${CARDS[d.cards[replacements.indexOf(c.uid)]].name}`
                        : ''}
                    </button>
                  ))}
                </div>
                <div className="evo-selects">
                  <label>
                    训练方向
                    <select
                      aria-label="训练方向"
                      value={training}
                      onChange={(e) => setTraining(e.target.value as Run['training'])}
                    >
                      <option value="attack">进攻 · 攻击每段＋1</option>
                      <option value="defense">守护 · 每回合＋3护盾</option>
                    </select>
                  </label>
                  <label>
                    继承能力
                    <select
                      aria-label="继承能力"
                      value={inherit}
                      onChange={(e) => setInherit(e.target.value as Run['inherit'])}
                    >
                      {Object.entries(inheritance)
                        .filter(([key]) => inheritanceOptions(run.partner).includes(key))
                        .map(([key, text]) => (
                          <option value={key} key={key}>
                            {text}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <button
                  className="primary"
                  disabled={replacements.length !== 2}
                  onClick={() =>
                    onAction({
                      type: 'evolve',
                      form: d.id,
                      replace: replacements,
                      training,
                      inherit,
                    })
                  }
                >
                  确认进化为{formName(d.id)}
                  <GitBranch size={17} />
                </button>
              </>
            ) : (
              <p className="condition-hint">
                当前无法进化为此形态。请选择亮起的下一阶段节点，或暂缓成长。
              </p>
            )}
            <div className="evo-bottom-actions">
              <button className="text-btn" onClick={onDeck}>
                查看当前卡组
              </button>
              <button className="secondary" onClick={() => onAction({ type: 'deferEvolution' })}>
                {run.evolutionReturn === 'camp' ? '返回营地' : '暂缓进化，继续旅途'}
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="route-data">
        <h4>永久路线资料</h4>
        {Object.entries(ROUTE_DATA).map(([id, info]) => (
          <p key={id}>
            <span>
              {meta.unlockedRoutes.includes(id) ? <Check size={15} /> : <Lock size={15} />}{' '}
              {info.name} · {meta.unlockedRoutes.includes(id) ? '已解锁' : '未解锁'}
            </span>
            <small>{info.source}</small>
          </p>
        ))}
      </div>
    </div>
  );
}
export function EvolutionTracker({
  run,
  meta,
  onOpen,
}: {
  run: Run;
  meta: Meta;
  onOpen: () => void;
}) {
  const id = run.evolutionTarget;
  if (!id) return null;
  const s = evolutionStatus(run, meta, id);
  return (
    <button className="evolution-tracker" onClick={onOpen}>
      <Target size={15} />
      <span>
        <strong>目标：{formName(id)}</strong>
        <small>
          {s.ready
            ? '新进化路线已开放'
            : s.groups.length
              ? s.groups
                  .slice(0, 2)
                  .map((g) =>
                    g
                      .map((t) => `${t.label} ${Math.min(t.current, t.goal)}/${t.goal}`)
                      .join(' 或 '),
                  )
                  .join(' · ')
              : stageRequirement(EVOLUTIONS[id].stage, run.chapterRows)}
          {s.data.some((t) => !t.met) ? ' · 缺少永久资料' : ''}
        </small>
      </span>
      <GitBranch size={15} />
    </button>
  );
}
