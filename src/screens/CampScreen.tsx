import { useState } from 'react';
import { ArrowRight, GitBranch, Heart, Tent, Zap } from 'lucide-react';
import { stageLimit } from '../game/evolution';
import type { Action, Run } from '../game/types';
import { GameCard } from '../components/GameCard';
import { Sprite } from '../components/Sprite';

export function CampScreen({ run, send }: { run: Run; send: (action: Action) => void }) {
  const [upgradeMode, setUpgradeMode] = useState(false);
  const r = run;
  return (
    <div className="choice-screen camp-screen">
      <Tent className="large-icon" />
      <span className="eyebrow">REST / RECONNECT</span>
      <h1>在这里，喘口气。</h1>
      <p>夜色很安静，搭档正期待你的决定。</p>
      <Sprite id={r.form} size={200} />
      {upgradeMode ? (
        <>
          <h3>选择一张牌强化</h3>
          <div className="deck-grid">
            {r.deck
              .filter((c) => !c.upgraded)
              .map((c) => (
                <GameCard
                  run={r}
                  compact
                  key={c.uid}
                  card={c}
                  onClick={() => send({ type: 'camp', mode: 'upgrade', uid: c.uid })}
                />
              ))}
          </div>
          <button className="text-btn" onClick={() => setUpgradeMode(false)}>
            返回
          </button>
        </>
      ) : (
        <div className="option-list">
          <button className="option" onClick={() => send({ type: 'camp', mode: 'heal' })}>
            <Heart />
            <span>
              <strong>休息与修复</strong>
              <small>
                回复 {Math.ceil(r.maxHp * 0.3)} 生命 · 当前 {r.hp}/{r.maxHp}
              </small>
            </span>
            <ArrowRight />
          </button>
          <button
            className="option"
            disabled={r.deck.every((c) => c.upgraded)}
            onClick={() => setUpgradeMode(true)}
          >
            <Zap />
            <span>
              <strong>练习卡片抽换</strong>
              <small>永久强化本局牌组中的一张卡牌</small>
            </span>
            <ArrowRight />
          </button>
          {r.stage < stageLimit(r) && (
            <button className="option" onClick={() => send({ type: 'campEvolution' })}>
              <GitBranch />
              <span>
                <strong>补上进化</strong>
                <small>选择已满足条件的下一阶段形态，消耗本次营地行动</small>
              </span>
              <ArrowRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RestScreen({ run, send }: { run: Run; send: (action: Action) => void }) {
  const r = run;
  return (
    <div className="choice-screen camp-screen">
      <Tent className="large-icon" />
      <span className="eyebrow">A NIGHT UNDER THE LIGHT</span>
      <h1>进化之光下，休息一晚。</h1>
      <p>你们已抵达最终形态。光不再催促改变，只是安静地陪伴。</p>
      <Sprite id={r.form} size={200} />
      <div className="option-list">
        <button className="option" onClick={() => send({ type: 'rest' })}>
          <Heart />
          <span>
            <strong>休息一晚</strong>
            <small>
              回复 {Math.ceil(r.maxHp * 0.15)} 生命 · 当前 {r.hp}/{r.maxHp}
            </small>
          </span>
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
