import { useState } from 'react';
import { ArrowRight, Box, Heart, Layers, ShoppingBag } from 'lucide-react';
import type { Action, Card, Run } from '../game/types';
import { GameCard } from '../components/GameCard';

const sample = (id: string): Card => ({ uid: id, id, upgraded: false });

export function ShopScreen({ run, send }: { run: Run; send: (action: Action) => void }) {
  const r = run;
  const [removeMode, setRemoveMode] = useState(false);
  return (
    <div className="choice-screen">
      <ShoppingBag className="large-icon" />
      <span className="eyebrow">THE WANDERING TRADER</span>
      <h1>旅途中的补给。</h1>
      <p>有时，少一张牌会比多一张更强。</p>
      {removeMode && !r.shopRemoved ? (
        <>
          <h3>选择一张牌移除</h3>
          <div className="deck-grid">
            {r.deck.map((c) => (
              <GameCard
                run={r}
                key={c.uid}
                compact
                card={c}
                onClick={() => {
                  send({ type: 'remove', uid: c.uid });
                  setRemoveMode(false);
                }}
              />
            ))}
          </div>
          <button className="text-btn" onClick={() => setRemoveMode(false)}>
            返回
          </button>
        </>
      ) : (
        <>
          <div className="reward-cards">
            {r.shopStock.map((id) => (
              <div key={id}>
                <GameCard
                  run={r}
                  card={sample(id)}
                  onClick={() => send({ type: 'buy', id })}
                  disabled={r.gold < 45 || r.shopBought.includes(id)}
                />
                <span className="price">{r.shopBought.includes(id) ? '已购入' : '45 金币'}</span>
              </div>
            ))}
          </div>
          <div className="shop-tools">
            <button
              className="option"
              disabled={r.gold < 30 || r.potions >= 2 || r.shopBought.includes('potion')}
              onClick={() => send({ type: 'buy', id: 'potion' })}
            >
              <Heart />
              <span>
                <strong>恢复磁盘</strong>
                <small>回复 18 生命 · 30 金币</small>
              </span>
            </button>
            <button
              className="option"
              disabled={r.gold < 80 || r.shopBought.includes('relic')}
              onClick={() => send({ type: 'buy', id: 'relic' })}
            >
              <Box />
              <span>
                <strong>未知装置</strong>
                <small>获得随机装置 · 80 金币</small>
              </span>
            </button>
            <button
              className="option"
              disabled={r.gold < 45 || r.shopRemoved || r.deck.length <= 5}
              onClick={() => setRemoveMode(true)}
            >
              <Layers />
              <span>
                <strong>精简牌组</strong>
                <small>移除一张卡牌 · 45 金币</small>
              </span>
            </button>
          </div>
        </>
      )}
      <button className="secondary" onClick={() => send({ type: 'continue' })}>
        离开商店
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
