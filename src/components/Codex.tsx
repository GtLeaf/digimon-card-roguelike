import { useState } from 'react';
import { BRANCHES, CARDS, ENEMIES, PARTNERS, PARTNER_IDS, asset } from '../game/data';
import { EVOLUTIONS } from '../game/evolution';
import type { Branch, CardDef, CardKind, Meta, Partner } from '../game/types';
import { GameCard } from './GameCard';
import { AttributeLabel } from './AttributeLabel';

type Tab = 'digimon' | 'card';
type GroupFilter = Partner | 'common' | 'all';
type KindFilter = CardKind | 'all';
type CostFilter = 'all' | '0' | '1' | '2';
type LitFilter = 'all' | 'lit' | 'locked';
type CardSort = 'cost' | 'stage' | 'name';

// 卡片所属的基础搭档分组：family 是分支时回溯到搭档，通用卡归通用组。
function groupOf(d: CardDef): Partner | 'common' {
  if (d.family === 'common' || d.family === 'status') return 'common';
  return (BRANCHES[d.family as Branch]?.partner ?? d.family) as Partner;
}

export function Codex({ meta }: { meta: Meta }) {
  const [tab, setTab] = useState<Tab>('digimon');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [cost, setCost] = useState<CostFilter>('all');
  const [collection, setCollection] = useState<LitFilter>('all');
  const [sort, setSort] = useState<CardSort>('cost');

  const enemies = Object.values(ENEMIES).sort((a, b) => a.hp - b.hp);
  const seenCount = enemies.filter((e) => (meta.scans[e.id] ?? 0) > 0).length;

  // 图鉴收录口径：基础形态/通用卡常亮；进化形态卡到达过（discovered）即点亮；
  // 小妖兽未解锁时其基础卡也置灰。不展示卡片属于哪条具体路线。
  const impmonLocked = (meta.scans.beelzebumon ?? 0) < 100;
  const lit = (d: CardDef) => {
    if (!d.unlockForm) return true;
    if ((PARTNER_IDS as string[]).includes(d.unlockForm))
      return d.unlockForm !== 'impmon' || !impmonLocked;
    return meta.discovered.includes(d.unlockForm);
  };
  const cards = Object.values(CARDS).filter((d) => d.family !== 'status');
  const litCount = cards.filter(lit).length;
  // 成长阶段：通用卡 -1 在最前，专属卡按解锁形态的进化阶段（成长期→究极体）。
  const stageOf = (d: CardDef) => (d.unlockForm ? (EVOLUTIONS[d.unlockForm]?.stage ?? 0) : -1);
  const sorted = [...cards].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
    if (sort === 'stage')
      return stageOf(a) - stageOf(b) || a.cost - b.cost || a.name.localeCompare(b.name, 'zh');
    return a.cost - b.cost || a.name.localeCompare(b.name, 'zh');
  });
  const visible = sorted.filter(
    (d) =>
      (group === 'all' || groupOf(d) === group) &&
      (kind === 'all' || d.kind === kind) &&
      (cost === 'all' || d.cost === Number(cost)) &&
      (collection === 'all' || (collection === 'lit' ? lit(d) : !lit(d))),
  );
  return (
    <div className="codex">
      <div className="item-codex-filters codex-tabs" role="group" aria-label="图鉴分类">
        <button aria-pressed={tab === 'digimon'} onClick={() => setTab('digimon')}>
          数码兽
          <span>
            {seenCount}/{enemies.length}
          </span>
        </button>
        <button aria-pressed={tab === 'card'} onClick={() => setTab('card')}>
          卡片
          <span>
            {litCount}/{cards.length}
          </span>
        </button>
      </div>
      {tab === 'digimon' ? (
        <>
          <p className="item-codex-count" aria-live="polite">
            战胜过的数码兽会留下资料；未遇见的只剩剪影。
          </p>
          <div className="codex-mon-grid">
            {enemies.map((e) => {
              const seen = (meta.scans[e.id] ?? 0) > 0;
              const progress = meta.scans[e.id] ?? 0;
              return (
                <article className={`codex-mon ${seen ? '' : 'undiscovered'}`} key={e.id}>
                  <img src={asset(e.art)} alt={seen ? e.name : '未知数码兽'} loading="lazy" />
                  <h3>{seen ? e.name : '???'}</h3>
                  {seen ? (
                    <>
                      <AttributeLabel id={e.id} />
                      <span>
                        生命 {e.hp}
                        {e.scan ? (
                          <small>
                            扫描 <b>{progress}%</b>
                          </small>
                        ) : (
                          <small>资料已收录</small>
                        )}
                      </span>
                      <p>{e.support ?? '收集战斗资料，记录你们的相遇。'}</p>
                    </>
                  ) : (
                    <p>尚未在旅途中遇见。</p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="codex-selects">
            <label>
              搭档
              <select value={group} onChange={(e) => setGroup(e.target.value as GroupFilter)}>
                <option value="all">全部</option>
                {PARTNER_IDS.map((id) => (
                  <option value={id} key={id}>
                    {PARTNERS[id].name}
                  </option>
                ))}
                <option value="common">通用卡</option>
              </select>
            </label>
            <label>
              类型
              <select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
                <option value="all">全部</option>
                <option value="attack">攻击</option>
                <option value="skill">技能</option>
                <option value="power">强化</option>
              </select>
            </label>
            <label>
              费用
              <select value={cost} onChange={(e) => setCost(e.target.value as CostFilter)}>
                <option value="all">全部</option>
                <option value="0">0 费</option>
                <option value="1">1 费</option>
                <option value="2">2 费</option>
              </select>
            </label>
            <label>
              收录
              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value as LitFilter)}
              >
                <option value="all">全部</option>
                <option value="lit">已收录</option>
                <option value="locked">未收录</option>
              </select>
            </label>
            <label>
              排序
              <select value={sort} onChange={(e) => setSort(e.target.value as CardSort)}>
                <option value="cost">费用从低到高</option>
                <option value="stage">成长阶段</option>
                <option value="name">名称排序</option>
              </select>
            </label>
          </div>
          <p className="item-codex-count" aria-live="polite">
            共 {visible.length} 张 · 置灰的卡尚未在进化旅途中获得
          </p>
          <div className="codex-cards deck-viewer">
            <div className="deck-grid">
              {visible.map((d) => {
                const on = lit(d);
                return (
                  <div className={`deck-entry codex-card-slot ${on ? '' : 'locked'}`} key={d.id}>
                    <GameCard card={{ uid: `codex-${d.id}`, id: d.id, upgraded: false }} compact />
                    {!on && <span className="codex-slot-tag">未收录</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
