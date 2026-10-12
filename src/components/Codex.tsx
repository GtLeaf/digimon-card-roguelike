import { CARDS, ENEMIES, asset } from '../game/data';
import { isCardCollected } from '../game/cardIndex';
import type { Meta, Run } from '../game/types';
import { AttributeLabel } from './AttributeLabel';
import { CardCodex } from './CardCodex';
import { setCodexTab, useCodexState } from './cardCodexStore';

export function Codex({
  meta,
  run = null,
  onOpenTree,
}: {
  meta: Meta;
  run?: Run | null;
  onOpenTree?: (form: string) => void;
}) {
  const { tab } = useCodexState();
  const enemies = Object.values(ENEMIES).sort((a, b) => a.hp - b.hp);
  const seenCount = enemies.filter((e) => (meta.scans[e.id] ?? 0) > 0).length;
  // 收录口径见 isCardCollected：基础形态/通用卡常亮，进化形态卡到达过即点亮。
  const cards = Object.values(CARDS).filter((d) => d.family !== 'status');
  const litCount = cards.filter((d) => isCardCollected(meta, d)).length;
  return (
    <div className="codex">
      <div className="item-codex-filters codex-tabs" role="group" aria-label="图鉴分类">
        <button aria-pressed={tab === 'digimon'} onClick={() => setCodexTab('digimon')}>
          数码兽
          <span>
            {seenCount}/{enemies.length}
          </span>
        </button>
        <button aria-pressed={tab === 'card'} onClick={() => setCodexTab('card')}>
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
                  <h3>
                    {seen ? e.name : '???'}
                    {seen && <AttributeLabel id={e.id} />}
                  </h3>
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
        <CardCodex meta={meta} run={run} onOpenTree={onOpenTree} />
      )}
    </div>
  );
}
