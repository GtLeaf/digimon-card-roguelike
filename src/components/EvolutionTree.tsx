import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, GitBranch, Lock, Target } from 'lucide-react';
import { asset, CARDS, PARTNERS, PARTNER_IDS, inheritanceOptions } from '../game/data';
import {
  EVOLUTIONS,
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
import { EvolutionReplacementPanel } from './EvolutionReplacementPanel';
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
  const [replacements, setReplacements] = useState<[string | null, string | null]>([null, null]);
  const [editingSlot, setEditingSlot] = useState<0 | 1 | null>(null),
    [previewId, setPreviewId] = useState<string | null>(null);
  const [inherit, setInherit] = useState<Run['inherit']>(run?.inherit ?? 'ward');
  const [training, setTraining] = useState<Run['training']>(run?.training ?? 'attack');
  const scroll = useRef<HTMLDivElement>(null);
  const cardPreview = useRef<HTMLDivElement>(null);
  const nodes = Object.values(EVOLUTIONS).filter((d) => d.partner === partner),
    activeRun = run?.partner === partner ? run : null;
  const yOff = Math.max(0, -Math.min(...nodes.map((node) => node.slot))) * 155;
  const d = EVOLUTIONS[selected],
    status = evolutionStatus(activeRun, meta, selected);
  const legacy =
    !!activeRun?.legacyEvolution &&
    activeRun.stage === 2 &&
    d.stage === 3 &&
    ['dukemon', 'megidramon', 'sakuyamon', 'kuzuhamon'].includes(d.id);
  const ready = status.ready || legacy;
  const replacementCards = replacements.map((uid) => run?.deck.find((card) => card.uid === uid));
  const replacementCount = replacementCards.filter(Boolean).length;
  const incoming = (i: number): Card => ({
    uid: `evolution-${i}`,
    id: d.cards[i],
    upgraded: false,
  });
  const previewCard =
    previewId && d.cards.includes(previewId) ? incoming(d.cards.indexOf(previewId)) : null;
  const blocker = !ready
    ? '当前形态条件未达成'
    : replacementCount < 2
      ? `还需选择 ${2 - replacementCount} 张旧牌`
      : `替换已选 2/2 · 卡组仍为 ${run?.deck.length} 张`;
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
  }, [selected, partner]);
  useEffect(() => {
    if (previewId) cardPreview.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [previewId]);
  function select(id: string) {
    setSelected(id);
    setExpanded(true);
    setPreviewId(null);
  }
  function recommend() {
    if (!run) return;
    const oldIds = EVOLUTIONS[run.form]?.cards ?? [];
    const preferred = run.deck.filter((card) => oldIds.includes(card.id));
    const candidates = [...preferred, ...run.deck.filter((card) => !oldIds.includes(card.id))];
    setReplacements([candidates[0]?.uid ?? null, candidates[1]?.uid ?? null]);
  }
  function confirm() {
    if (
      ready &&
      replacements[0] &&
      replacements[1] &&
      replacements[0] !== replacements[1] &&
      replacementCount === 2
    )
      onAction({
        type: 'evolve',
        form: d.id,
        replace: [replacements[0], replacements[1]],
        training,
        inherit,
      });
  }
  return (
    <div className={`evolution-tree ${choose ? 'evolution-choosing' : ''}`}>
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
                setExpanded(false);
                setPreviewId(null);
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
        {activeRun && evolutionTransition(activeRun.form, d.id) && (
          <p className="condition-hint">
            <strong>特性转变：</strong>
            {evolutionTransition(activeRun.form, d.id)} 形态特性替换，训练与所选继承能力保留。
          </p>
        )}
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
        {choose && d.signatureUpgrade && (
          <p className="condition-hint">
            招牌牌强化：卡组中已有的
            {(EVOLUTIONS[activeRun?.form ?? d.parents[0]]?.cards ?? [])
              .map((id) => CARDS[id].name)
              .join('、')}
            将被强化。
          </p>
        )}
        {choose && run && ready ? (
          <section className="evolution-replacements" aria-label="固定技能替换槽位">
            <div className="evolution-replacement-heading">
              <h4>选择两张旧牌进行替换 · {replacementCount}/2</h4>
              <button className="secondary" onClick={recommend}>
                使用推荐替换
              </button>
            </div>
            <p className="condition-hint">
              推荐优先替换当前形态招牌牌。每个槽位独立配对，牌组张数不变。
              新技能均为未强化版；被替换的强化牌会消耗。
            </p>
            <div className="evolution-slots">
              {d.cards.slice(0, 2).map((id, i) => {
                const old = replacementCards[i],
                  card = incoming(i);
                return (
                  <article
                    className={`evolution-slot ${old ? 'complete' : ''}`}
                    key={i}
                    aria-label={`替换槽位 ${i + 1}`}
                  >
                    <header>
                      <strong>槽位 {i + 1}</strong>
                      <span>{old ? '已选择' : '待选择旧牌'}</span>
                    </header>
                    <p className="evolution-slot-pair">
                      <strong>
                        {CARDS[id].name}
                        {card.upgraded ? '＋' : ''}
                      </strong>
                      <span>
                        ← {old ? `${CARDS[old.id].name}${old.upgraded ? '＋' : ''}` : '待选择旧牌'}
                      </span>
                    </p>
                    <span className="evolution-effect-label">
                      新技能 · {card.upgraded ? '进化后已强化' : '进化后未强化'}
                    </span>
                    <CardEffectPreview card={card} />
                    <div className="evolution-slot-old">
                      <span className="evolution-effect-label">替换掉的旧牌</span>
                      {old ? (
                        <>
                          <CardEffectPreview card={old} />
                          <small>牌组第 {run.deck.indexOf(old) + 1} 张</small>
                        </>
                      ) : (
                        <p>选择一张旧牌，替换为{CARDS[id].name}</p>
                      )}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => setEditingSlot(i as 0 | 1)}
                      aria-label={`槽位 ${i + 1}，${old ? '更换' : '选择'}旧牌`}
                    >
                      {old ? '更换旧牌' : '选择旧牌'}
                      <GitBranch size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <h4>招牌卡片</h4>
            <p className="condition-hint">点卡牌查看完整效果。</p>
            <div className="evolution-new-cards">
              {d.cards.map((id, i) => (
                <GameCard
                  run={activeRun}
                  key={id}
                  compact
                  card={incoming(i)}
                  selected={previewId === id}
                  onClick={() => setPreviewId(previewId === id ? null : id)}
                />
              ))}
            </div>
            {previewCard && (
              <div className="evolution-card-preview" ref={cardPreview} aria-live="polite">
                <CardEffectPreview card={previewCard} />
                <button className="text-btn" onClick={() => setPreviewId(null)}>
                  收起卡牌效果
                </button>
              </div>
            )}
          </>
        )}
        <h4>到达此形态后解锁的技能卡池</h4>
        <p className="condition-hint">
          {Object.values(CARDS)
            .filter((c) => skillForms(c).includes(d.id))
            .map((c) => `${c.name}${skillForms(c).length > 1 ? '（共享技能）' : ''}`)
            .join('、') || '沿用已学技能与通用卡。'}
          。后续进化保留解锁资格。
        </p>
        {choose && run && (
          <div className="evolution-confirm">
            {ready ? (
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
            ) : (
              <p className="condition-hint">
                当前无法进化为此形态。请选择亮起的下一阶段节点，或暂缓成长。
              </p>
            )}
            <button className="text-btn" onClick={onDeck}>
              查看当前卡组
            </button>
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
            <button
              className="primary"
              disabled={!ready || replacementCount !== 2}
              onClick={confirm}
            >
              确认进化
              <GitBranch size={17} />
            </button>
          </div>
        </footer>
      )}
      {choose && run && editingSlot !== null && (
        <EvolutionReplacementPanel
          key={`${d.id}-${editingSlot}`}
          run={run}
          index={editingSlot}
          incoming={incoming(editingSlot)}
          autoUpgrade={false}
          currentUid={replacements[editingSlot]}
          occupiedUid={replacements[editingSlot === 0 ? 1 : 0]}
          onClose={() => setEditingSlot(null)}
          onConfirm={(uid) => {
            setReplacements((old) => (editingSlot === 0 ? [uid, old[1]] : [old[0], uid]));
            setEditingSlot(null);
          }}
        />
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
