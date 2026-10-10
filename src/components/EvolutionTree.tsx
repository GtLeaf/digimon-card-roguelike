import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, GitBranch, Lock, Target } from 'lucide-react';
import { asset, CARDS, PARTNERS, PARTNER_IDS, inheritanceOptions } from '../game/data';
import {
  EVOLUTIONS,
  evolutionCardGains,
  evolutionStatus,
  evolutionTransition,
  formName,
  nextEvolutions,
  ROUTE_DATA,
  stageName,
  stageRequirement,
} from '../game/evolution';
import { skillForms } from '../game/cardSkills';
import type { Action, Card, Meta, Partner, Run } from '../game/types';
import { GameCard } from './GameCard';
import { CardEffectPreview } from './JourneyPanel';
import { AttributeLabel } from './AttributeLabel';
import './EvolutionTree.css';
const x = (id: string) => (EVOLUTIONS[id].treeStage ?? EVOLUTIONS[id].stage) * 230 + 100,
  y = (id: string) =>
    EVOLUTIONS[id].slot * 155 +
    100 +
    Math.max(
      0,
      -Math.min(
        ...Object.values(EVOLUTIONS)
          .filter((node) => node.partner === EVOLUTIONS[id].partner)
          .map((node) => node.slot),
      ),
    ) *
      155;
function locateNode(el: HTMLDivElement | null, id: string) {
  if (el)
    el.scrollTo({
      left: Math.max(0, x(id) - el.clientWidth / 2),
      top: Math.max(0, y(id) - el.clientHeight / 2),
      behavior: 'auto',
    });
}
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
  initialPartner = 'guilmon',
}: {
  run: Run | null;
  initialPartner?: Partner;
  meta: Meta;
  onAction: (a: Action) => void;
  choose?: boolean;
  onDeck?: () => void;
}) {
  const [partner, setPartner] = useState<Partner>(run?.partner ?? initialPartner);
  const [selected, setSelected] = useState(() =>
    choose && run
      ? (nextEvolutions(run).find((d) => evolutionStatus(run, meta, d.id).ready)?.id ??
        nextEvolutions(run)[0]?.id ??
        run.form)
      : (run?.form ?? initialPartner),
  );
  const [expanded, setExpanded] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [inherit, setInherit] = useState<Run['inherit']>(run?.inherit ?? 'ward');
  const [training, setTraining] = useState<Run['training']>(run?.training ?? 'attack');
  const scroll = useRef<HTMLDivElement>(null);
  const cardPreview = useRef<HTMLDivElement>(null);
  const nodes = Object.values(EVOLUTIONS).filter((d) => d.partner === partner),
    activeRun = run?.partner === partner ? run : null;
  const candidates = run
    ? nodes.filter(
        (node) =>
          nextEvolutions(run).some((next) => next.id === node.id) ||
          (run.legacyEvolution &&
            run.stage === 2 &&
            node.stage === 3 &&
            ['dukemon', 'megidramon', 'sakuyamon', 'kuzuhamon'].includes(node.id)),
      )
    : [];
  const yOff = Math.max(0, -Math.min(...nodes.map((node) => node.slot))) * 155;
  const d = EVOLUTIONS[selected],
    status = evolutionStatus(activeRun, meta, selected);
  const legacy =
    !!activeRun?.legacyEvolution &&
    activeRun.stage === 2 &&
    d.stage === 3 &&
    ['dukemon', 'megidramon', 'sakuyamon', 'kuzuhamon'].includes(d.id);
  const ready = status.ready || legacy;
  const gains = choose && activeRun ? evolutionCardGains(activeRun, d.id) : null;
  const rewardCards: Card[] = gains
    ? [
        ...gains.newIds.map((id) => ({ uid: `evolution-new-${id}`, id, upgraded: false })),
        ...gains.upgradeIds
          .filter((id) => activeRun?.deck.some((card) => card.id === id))
          .map((id) => ({ uid: `evolution-upgrade-${id}`, id, upgraded: true })),
      ]
    : d.cards.map((id) => ({ uid: `evolution-${id}`, id, upgraded: false }));
  const previewCard = rewardCards.find((card) => card.uid === previewId);
  const blocker = !ready ? '当前形态条件未达成' : '条件已达成，可直接进化';
  function locate() {
    locateNode(scroll.current, activeRun?.form ?? partner);
  }
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() => locateNode(el, selected));
    observer.observe(el);
    locateNode(el, selected);
    return () => observer.disconnect();
  }, [selected, partner, treeOpen]);
  useEffect(() => {
    if (previewId) cardPreview.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [previewId]);
  function select(id: string) {
    setSelected(id);
    setExpanded(true);
    setPreviewId(null);
  }
  function confirm() {
    if (ready) onAction({ type: 'evolve', form: d.id, training, inherit });
  }
  function requirements(missingOnly = false) {
    return (
      <div className="requirement-list">
        {(!missingOnly || (!status.stage && !status.achieved)) && (
          <div className={status.stage || status.achieved ? 'met' : ''}>
            <Check size={15} />
            <span>{stageRequirement(d.stage, activeRun?.chapterRows)}</span>
          </div>
        )}
        {d.stage > 0 && (!missingOnly || (!status.parent && !status.achieved)) && (
          <div className={status.parent || status.achieved ? 'met' : ''}>
            <GitBranch size={15} />
            <span>前置形态：{d.parents.map(formName).join(' / ')}</span>
          </div>
        )}
        {status.data
          .filter((t) => !missingOnly || !t.met)
          .map((t) => (
            <div key={t.label} className={t.met ? 'met' : ''}>
              {t.met ? <Check size={15} /> : <Lock size={15} />}
              <span>
                {t.label} · {t.met ? '已解锁' : '未解锁'}
                {missingOnly &&
                  !t.met &&
                  Object.values(ROUTE_DATA)
                    .filter((info) => t.label.startsWith(info.name))
                    .map((info) => (
                      <details className="evolution-requirement-source" key={info.name}>
                        <summary>获取方式</summary>
                        <p>{info.source}</p>
                      </details>
                    ))}
              </span>
            </div>
          ))}
        {status.groups
          .filter((group) => !missingOnly || !group.some((t) => t.met))
          .map((group, i) => (
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
    );
  }
  const growthContent = (
    <>
      {choose && requirements()}
      {activeRun && evolutionTransition(activeRun.form, d.id) && (
        <p className="condition-hint">
          <strong>特性转变：</strong>
          {evolutionTransition(activeRun.form, d.id)} 形态特性替换，训练与所选继承能力保留。
        </p>
      )}
      {d.id === 'blackrapidmon' && (
        <p className="condition-hint">
          从加鲁哥兽转入另需机械研究；黑加鲁哥兽主路线无需跨局资料。{ROUTE_DATA.mechanical.source}。
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
      <h4>到达此形态后解锁的技能卡池</h4>
      <p className="condition-hint">
        {Object.values(CARDS)
          .filter((c) => skillForms(c).includes(d.id))
          .map((c) => `${c.name}${skillForms(c).length > 1 ? '（共享技能）' : ''}`)
          .join('、') || '沿用已学技能与通用卡。'}
        。后续进化保留解锁资格。
      </p>
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
    </>
  );
  const treeContent = (
    <>
      <div className="tree-toolbar">
        {!choose && (
          <div className="partner-tabs">
            {PARTNER_IDS.map((id) => (
              <button
                key={id}
                disabled={choose && id !== run?.partner}
                aria-pressed={partner === id}
                onClick={() => {
                  setPartner(id);
                  setSelected(id);
                  setExpanded(false);
                  setPreviewId(null);
                }}
              >
                {PARTNERS[id].name}
              </button>
            ))}
          </div>
        )}
        <button className="text-btn" onClick={locate}>
          <Crosshair size={16} />
          定位当前
        </button>
      </div>
      <p className="modal-note">
        左右滑动看阶段，上下滑动看分支。点击形态查看条件；实线为成长路线，虚线为调和／特殊路线。
      </p>
      <div
        className="tree-scroll"
        ref={scroll}
        role="region"
        tabIndex={0}
        aria-label="进化树，可上下左右滑动"
      >
        <div className="tree-canvas" style={{ height: 700 + yOff }}>
          <svg
            className="tree-edges"
            viewBox={`0 0 920 ${700 + yOff}`}
            style={{ height: 700 + yOff }}
            aria-hidden="true"
          >
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
    </>
  );
  return (
    <div className={`evolution-tree ${choose ? 'evolution-choosing' : ''}`}>
      {choose && run && (
        <>
          <p className="evolution-current">
            {formName(run.form)} · {stageName(run.stage)} · <AttributeLabel id={run.form} compact />
          </p>
          <div className="evolution-candidates" aria-label="下一阶段形态">
            {candidates.map((node) => {
              const candidateReady =
                evolutionStatus(run, meta, node.id).ready ||
                (run.legacyEvolution && node.stage === 3);
              return (
                <button
                  key={node.id}
                  className="evolution-candidate"
                  aria-pressed={selected === node.id}
                  onClick={() => select(node.id)}
                >
                  <img src={asset(node.id)} alt="" />
                  <strong>{formName(node.id)}</strong>
                  <small>
                    <AttributeLabel id={node.id} compact /> ·{' '}
                    {candidateReady ? '可进化' : '条件未达成'}
                  </small>
                </button>
              );
            })}
          </div>
          {!candidates.length && (
            <p className="condition-hint">当前没有下一阶段形态，可暂缓进化。</p>
          )}
          <details
            className="evolution-disclosure"
            onToggle={(event) => setTreeOpen(event.currentTarget.open)}
          >
            <summary>查看进化树</summary>
            {treeContent}
          </details>
        </>
      )}
      {!choose && treeContent}
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
            <AttributeLabel id={d.id} />
          </div>
          {!choose && activeRun && d.stage > activeRun.stage && (
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
        {choose && ready ? (
          <p className="evolution-ready">
            <Check size={15} />
            条件已达成
          </p>
        ) : (
          requirements(choose)
        )}
        <section className="evolution-rewards" aria-label="进化招式">
          <h4>{choose ? '进化招式' : '招牌卡片'}</h4>
          <div className="evolution-new-cards">
            {rewardCards.map((card) => (
              <div className="evolution-reward-card" key={card.uid}>
                {choose && (
                  <span className="evolution-reward-label">
                    {card.upgraded ? '自动强化' : '获得新卡'}
                  </span>
                )}
                <GameCard
                  run={!choose || card.upgraded ? activeRun : null}
                  compact
                  card={card}
                  selected={previewId === card.uid}
                  onClick={() => setPreviewId(previewId === card.uid ? null : card.uid)}
                />
              </div>
            ))}
          </div>
          {!rewardCards.length && <p className="condition-hint">当前牌组没有可强化的招牌牌。</p>}
          {previewCard && (
            <div className="evolution-card-preview" ref={cardPreview} aria-live="polite">
              <CardEffectPreview card={previewCard} />
              <button className="text-btn" onClick={() => setPreviewId(null)}>
                收起卡牌效果
              </button>
            </div>
          )}
        </section>
        {choose && run && (
          <div className="evolution-confirm">
            {ready ? (
              <details className="evolution-config">
                <summary>
                  <span>
                    {training === 'attack' ? '进攻' : '守护'} ·{' '}
                    {inheritance[inherit].split('：')[0]}
                  </span>
                  <span>调整</span>
                </summary>
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
              </details>
            ) : null}
            <button className="text-btn" onClick={onDeck}>
              查看当前卡组
            </button>
          </div>
        )}
        {choose ? (
          <details className="evolution-disclosure" key={d.id}>
            <summary>成长详情</summary>
            {growthContent}
          </details>
        ) : (
          growthContent
        )}
      </section>
      {choose && run && (
        <footer className="evolution-action-bar">
          <p role="status">
            <strong>{formName(d.id)}</strong>
            <span>{blocker}</span>
          </p>
          <div>
            <button className="secondary" onClick={() => onAction({ type: 'deferEvolution' })}>
              {run.evolutionReturn === 'camp' ? '返回营地' : '暂缓进化'}
            </button>
            <button className="primary" disabled={!ready} onClick={confirm}>
              确认进化
              <GitBranch size={17} />
            </button>
          </div>
        </footer>
      )}
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
