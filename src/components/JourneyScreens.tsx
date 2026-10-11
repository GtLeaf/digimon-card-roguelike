import { useState } from 'react';
import {
  ArrowRight,
  Box,
  Check,
  Coins,
  GitBranch,
  Heart,
  Layers,
  Package,
  ShoppingBag,
  Tent,
  Zap,
} from 'lucide-react';
import { ENEMIES, RELICS, asset } from '../game/data';
import { hasEvolutionOpportunity } from '../game/evolution';
import type { Action, Card, Meta, Run } from '../game/types';
import { GameCard } from './GameCard';
import { Sprite } from './Sprite';
import { CardChoicePanel, JourneyHeader, JourneyPanel, JourneyResources } from './JourneyPanel';
import { ROUTE_DATA } from '../game/evolution';
import { relicIdFromPurchase, relicPurchaseId, shopPrice } from '../game/shop';
import { relicIcons } from './relicIcons';

type NodeProps = { run: Run; onAction: (action: Action) => void };
const sample = (id: string): Card => ({ uid: id, id, upgraded: false });

export function ShopView({ run, onAction }: NodeProps) {
  const [removing, setRemoving] = useState(false);
  function block(id: string) {
    if (run.shopBought.includes(id)) return '已售出';
    const relicId = relicIdFromPurchase(id);
    if (relicId && run.relics.includes(relicId)) return '本局已拥有';
    if (id === 'remove' && run.shopRemoved) return '本次已精简';
    if (id === 'remove' && run.deck.length <= 5) return '至少保留 5 张牌';
    if (id === 'potion' && run.potions >= 2) return '磁盘已满 2/2';
    if (id === 'relic' && Object.keys(RELICS).every((key) => run.relics.includes(key)))
      return '已拥有全部装置';
    const cost = shopPrice(id);
    return run.gold < cost ? `还差 ${cost - run.gold} 金币` : '';
  }
  function purchase(id: string) {
    if (block(id)) return;
    onAction({ type: 'buy', id });
  }
  const devices = [
    ...run.shopRelicStock
      .filter((id) => RELICS[id])
      .map((id) => ({
        id: relicPurchaseId(id),
        name: RELICS[id].name,
        Icon: relicIcons[id] ?? Box,
        random: false,
        owned: run.relics.includes(id),
      })),
    { id: 'relic', name: '装置盲盒', Icon: Package, random: true, owned: false },
  ];
  return (
    <div className="journey-screen shop-screen">
      <JourneyHeader icon={<ShoppingBag />} title="旅途中的补给。" eyebrow="THE WANDERING TRADER">
        点击商品直接购买，准备好后离开。
      </JourneyHeader>
      <JourneyResources run={run} />
      {run.message && (
        <p className="journey-receipt" role="status">
          <Check size={17} />
          {run.message}
        </p>
      )}
      <section className="journey-device-stock" aria-label="装置货架">
        <div className="journey-section-title">
          <h2>装置货架</h2>
          <span>点击直接购买</span>
        </div>
        <div className="journey-device-grid">
          {devices.map(({ id, name, Icon, random, owned }) => {
            const sold = run.shopBought.includes(id),
              status = sold
                ? '已售出'
                : owned
                  ? '本局已拥有'
                  : random && block(id) === '已拥有全部装置'
                    ? '已拥有全部装置'
                    : '';
            return (
              <button
                key={id}
                className={`journey-device-product ${sold || owned ? 'journey-device-owned' : ''}`}
                disabled={!!block(id)}
                onClick={() => purchase(id)}
              >
                <Icon size={34} aria-hidden="true" />
                <strong>{name}</strong>
                {random && <span className="journey-device-random">随机装置</span>}
                <span className="journey-device-price">{shopPrice(id)} 金币</span>
                {status && <small className="journey-device-status">{status}</small>}
              </button>
            );
          })}
        </div>
      </section>
      <section className="journey-stock">
        <div className="journey-section-title">
          <h2>卡牌补给</h2>
          <span>每张 45 金币</span>
        </div>
        <div className="journey-stock-cards">
          {run.shopStock.map((id) => (
            <div key={id} className={run.shopBought.includes(id) ? 'journey-purchased' : ''}>
              <GameCard
                run={run}
                card={sample(id)}
                disabled={!!block(id)}
                onClick={() => purchase(id)}
              />
              <span className="journey-price">{block(id) || '45 金币 · 点击购买'}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="journey-services">
        <h2>旅途服务</h2>
        <div className="shop-tools">
          <button
            className="option"
            disabled={!!block('potion')}
            onClick={() => purchase('potion')}
          >
            <Heart />
            <span>
              <strong>
                恢复磁盘 <b>30 金币</b>
              </strong>
              <small>获得 1 个 · 战斗中使用回复 18 生命</small>
              {block('potion') && <small className="journey-blocked">{block('potion')}</small>}
            </span>
            <ArrowRight />
          </button>
          <button className="option" disabled={!!block('remove')} onClick={() => setRemoving(true)}>
            <Layers />
            <span>
              <strong>
                精简牌组 <b>45 金币</b>
              </strong>
              <small>选择移除一张牌 · 每次到访限一次</small>
              {block('remove') && <small className="journey-blocked">{block('remove')}</small>}
            </span>
            <ArrowRight />
          </button>
        </div>
      </section>
      <footer className="journey-bottom-bar">
        <span>
          金币 {run.gold} · 磁盘 {run.potions}/2
        </span>
        <button className="secondary" onClick={() => onAction({ type: 'continue' })}>
          离开商店
          <ArrowRight size={16} />
        </button>
      </footer>
      {removing && (
        <CardChoicePanel
          run={run}
          cards={run.deck}
          mode="remove"
          title="精简牌组"
          cost={45}
          blocked={block('remove')}
          onClose={() => setRemoving(false)}
          onConfirm={(uid) => {
            onAction({ type: 'remove', uid });
            setRemoving(false);
          }}
        />
      )}
    </div>
  );
}

export function CampView({ run, onAction }: NodeProps) {
  const [mode, setMode] = useState<'upgrade' | 'heal' | null>(null),
    heal = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * 0.3));
  const cards = run.deck.filter((card) => !card.upgraded);
  return (
    <div className="journey-screen camp-screen">
      <JourneyHeader icon={<Tent />} title="在这里，喘口气。" eyebrow="REST / RECONNECT">
        选择一项行动，完成后继续旅程。
      </JourneyHeader>
      <JourneyResources run={run} />
      <div className="journey-camp-partner">
        <Sprite id={run.form} size={116} />
        <p>
          搭档正期待你的决定。<small>预览或取消不会消耗营地行动。</small>
        </p>
      </div>
      <div className="option-list">
        <button className="option" disabled={!heal} onClick={() => setMode('heal')}>
          <Heart />
          <span>
            <strong>休息与修复</strong>
            <small>
              {heal
                ? `实际回复 ${heal} 生命 · ${run.hp} → ${run.hp + heal}/${run.maxHp}`
                : '生命已满，无需恢复'}
            </small>
          </span>
          <ArrowRight />
        </button>
        <button className="option" disabled={!cards.length} onClick={() => setMode('upgrade')}>
          <Zap />
          <span>
            <strong>练习卡片抽换</strong>
            <small>
              {cards.length ? `强化本局的一张卡牌 · ${cards.length} 张可选` : '全部卡牌已强化'}
            </small>
          </span>
          <ArrowRight />
        </button>
        {hasEvolutionOpportunity(run) && (
          <button className="option" onClick={() => onAction({ type: 'campEvolution' })}>
            <GitBranch />
            <span>
              <strong>补上进化</strong>
              <small>查看满足条件的下一阶段形态 · 确认进化消耗行动</small>
            </span>
            <ArrowRight />
          </button>
        )}
      </div>
      <footer className="journey-bottom-bar">
        <span>本次可完成一项行动</span>
        <button className="secondary" onClick={() => onAction({ type: 'continue' })}>
          离开营地
          <ArrowRight size={16} />
        </button>
      </footer>
      {mode === 'upgrade' && (
        <CardChoicePanel
          run={run}
          cards={cards}
          mode="upgrade"
          title="选择一张牌强化"
          onClose={() => setMode(null)}
          onConfirm={(uid) => onAction({ type: 'camp', mode: 'upgrade', uid })}
        />
      )}
      {mode === 'heal' && (
        <JourneyPanel
          title="休息与修复"
          onClose={() => setMode(null)}
          footer={
            <>
              <p className="journey-action-note">完成后消耗本次营地行动并继续旅程</p>
              <div>
                <button className="secondary" onClick={() => setMode(null)}>
                  取消
                </button>
                <button
                  className="primary"
                  onClick={() => onAction({ type: 'camp', mode: 'heal' })}
                >
                  休息 · 回复 {heal} 生命
                </button>
              </div>
            </>
          }
        >
          <div className="journey-item-detail">
            <Heart size={34} />
            <h3>
              生命 {run.hp} → {run.hp + heal}/{run.maxHp}
            </h3>
            <p>实际回复 {heal} 生命。</p>
          </div>
        </JourneyPanel>
      )}
    </div>
  );
}

export function RewardView({ run, meta, onAction }: NodeProps & { meta: Meta }) {
  const reward = run.reward;
  if (!reward) return null;
  return (
    <div className="journey-screen reward-screen">
      <JourneyHeader icon={<Check />} title="漂亮的配合。" eyebrow="CONNECTION RESTORED">
        点选一张卡牌直接加入牌组，也可以跳过。
      </JourneyHeader>
      <div className="reward-badges">
        <span>
          <Coins size={16} />＋{reward.gold} 金币
        </span>
        {reward.relic && (
          <span>
            <Box size={16} />
            {RELICS[reward.relic].name}
          </span>
        )}
      </div>
      {reward.relic && <p className="journey-hint">{RELICS[reward.relic].text}</p>}
      <div className="activity-reward">
        {reward.gains?.map((gain) => (
          <span key={gain}>{gain}</span>
        ))}
        {reward.unlocks?.map((id) => (
          <strong key={id}>永久解锁：{ROUTE_DATA[id].name}</strong>
        ))}
      </div>
      <div className="reward-card-row" aria-label="战斗奖励卡牌">
        {reward.cards.map((id) => (
          <div key={id}>
            <GameCard
              run={run}
              card={sample(id)}
              onClick={() => onAction({ type: 'reward', card: id })}
            />
          </div>
        ))}
      </div>
      {reward.scans.length > 0 && (
        <details className="journey-scan-details">
          <summary>
            扫描与伙伴 · {reward.scans.length} 份资料已保存
            {reward.scans.some(
              (scan) =>
                ENEMIES[scan.id].support && scan.after === 100 && !meta.partners.includes(scan.id),
            )
              ? ' · 有伙伴可转化'
              : ''}
          </summary>
          <div className="scan-results">
            {reward.scans.map((scan) => (
              <div key={scan.id}>
                <img src={asset(scan.id)} alt="" />
                <div>
                  <b>{ENEMIES[scan.id].name}</b>
                  <span>
                    扫描 {scan.before}% → {scan.after}%
                  </span>
                  <progress max={100} value={scan.after} />
                </div>
                {ENEMIES[scan.id].support &&
                scan.after === 100 &&
                !meta.partners.includes(scan.id) ? (
                  <button
                    className="secondary"
                    onClick={() => onAction({ type: 'convert', id: scan.id })}
                  >
                    转化伙伴
                  </button>
                ) : (
                  <span className="scan-note">
                    {meta.partners.includes(scan.id)
                      ? '已转化'
                      : scan.after === 100
                        ? '资料完整'
                        : '数据已保存'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
      <footer className="journey-bottom-bar">
        <span>卡组 {run.deck.length} 张 · 点牌领取</span>
        <button className="secondary" onClick={() => onAction({ type: 'reward' })}>
          跳过卡牌，继续
          <ArrowRight size={15} />
        </button>
      </footer>
    </div>
  );
}
