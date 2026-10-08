import { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  BRANCHES,
  CARDS,
  ENEMIES,
  PARTNERS,
  PARTNER_IDS,
  asset,
} from '../game/data';
import type { Branch, CardDef, Meta, Partner } from '../game/types';

type Tab = 'digimon' | 'card';
const kindLabel: Record<CardDef['kind'], string> = {
  attack: '攻击',
  skill: '技能',
  power: '强化',
  status: '故障',
};

// 卡片所属的基础搭档分组：family 是分支时回溯到搭档，通用卡归通用组。
function groupOf(d: CardDef): Partner | 'common' {
  if (d.family === 'common' || d.family === 'status') return 'common';
  return (BRANCHES[d.family as Branch]?.partner ?? d.family) as Partner;
}

export function Codex({ meta }: { meta: Meta }) {
  const [tab, setTab] = useState<Tab>('digimon');
  const [group, setGroup] = useState<Partner | 'common' | 'all'>('all');

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
  const cards = Object.values(CARDS)
    .filter((d) => d.family !== 'status')
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh'));
  const litCount = cards.filter(lit).length;
  const visible = cards.filter((d) => group === 'all' || groupOf(d) === group);
  const groups: { id: Partner | 'common' | 'all'; name: string }[] = [
    { id: 'all', name: '全部' },
    ...PARTNER_IDS.map((id) => ({ id: id as Partner | 'common' | 'all', name: PARTNERS[id].name })),
    { id: 'common', name: '通用卡' },
  ];
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
          <div className="item-codex-filters" role="group" aria-label="按搭档筛选">
            {groups.map((g) => (
              <button
                key={g.id}
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.name}
                <span>
                  {g.id === 'all'
                    ? cards.length
                    : cards.filter((d) => groupOf(d) === g.id).length}
                </span>
              </button>
            ))}
          </div>
          <p className="item-codex-count" aria-live="polite">
            共 {visible.length} 张 · 置灰的卡尚未在进化旅途中获得
          </p>
          <div className="codex-card-grid">
            {visible.map((d) => {
              const on = lit(d);
              const isGeneric = !d.unlockForm;
              const artwork = isGeneric
                ? `${import.meta.env.BASE_URL}card-art/${d.id}.jpg`
                : asset(d.art);
              return (
                <article
                  className={`codex-card kind-${d.kind} ${on ? '' : 'locked'}`}
                  key={d.id}
                >
                  <div className="codex-card-head">
                    <span className="codex-cost">{d.cost}</span>
                    <strong>{d.name}</strong>
                    {!on && (
                      <span className="codex-lock">
                        <Lock size={12} />
                        未收录
                      </span>
                    )}
                  </div>
                  <span className="codex-card-art">
                    <img src={artwork} alt="" loading="lazy" decoding="async" />
                  </span>
                  <p>{d.text}</p>
                  <small>
                    {kindLabel[d.kind]}
                    {d.exhaust ? ' · 耗竭' : ''}
                  </small>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
