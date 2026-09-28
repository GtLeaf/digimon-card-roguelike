import { ArrowRight, Box, Check, Coins } from 'lucide-react';
import { ENEMIES, RELICS, asset } from '../game/data';
import { ROUTE_DATA } from '../game/evolution';
import type { Action, Card, Run } from '../game/types';
import { GameCard } from '../components/GameCard';

const sample = (id: string): Card => ({ uid: id, id, upgraded: false });

export function RewardScreen({
  run,
  partners,
  send,
}: {
  run: Run;
  partners: string[];
  send: (action: Action) => void;
}) {
  const r = run,
    reward = run.reward!;
  return (
    <div className="choice-screen reward-screen">
      <div className="result-symbol">
        <Check size={28} />
      </div>
      <span className="eyebrow">CONNECTION RESTORED</span>
      <h1>漂亮的配合。</h1>
      <p>选择一张卡牌，继续构筑你的可能。</p>
      <div className="reward-badges">
        <span>
          <Coins size={16} />＋{reward.gold}
        </span>
        {reward.relic && (
          <span>
            <Box size={16} />
            {RELICS[reward.relic].name}
          </span>
        )}
      </div>
      <div className="activity-reward">
        {reward.gains?.map((g) => (
          <span key={g}>{g}</span>
        ))}
        {reward.unlocks?.map((id) => (
          <strong key={id}>永久解锁：{ROUTE_DATA[id].name}</strong>
        ))}
      </div>
      <div className="reward-cards">
        {reward.cards.map((id) => (
          <div key={id}>
            <GameCard
              run={r}
              card={sample(id)}
              onClick={() => send({ type: 'reward', card: id })}
            />
            <button className="text-btn" onClick={() => send({ type: 'reward', card: id })}>
              加入牌组
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
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
            {ENEMIES[scan.id].support && scan.after === 100 && !partners.includes(scan.id) ? (
              <button className="secondary" onClick={() => send({ type: 'convert', id: scan.id })}>
                转化伙伴
              </button>
            ) : (
              <span className="scan-note">
                {partners.includes(scan.id)
                  ? '已转化'
                  : scan.after === 100
                    ? '资料完整'
                    : '数据已保存'}
              </span>
            )}
          </div>
        ))}
      </div>
      <button className="secondary" onClick={() => send({ type: 'reward' })}>
        跳过卡牌，继续
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
