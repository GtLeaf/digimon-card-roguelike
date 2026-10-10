import { useState } from 'react';
import {
  ArrowRight,
  CircleHelp,
  Crosshair,
  Flame,
  Heart,
  ScanLine,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import {
  CARDS,
  ENEMIES,
  FORM_NAMES,
  BRANCHES,
  cardDefinition,
  copyCandidates,
  MAX_COPIES_PER_TURN,
} from '../game/data';
import { cardTarget, playCost, enemyIntents, enemyEnrage, enemyCountdown } from '../game/engine';
import { EVOLUTIONS } from '../game/evolution';
import type { Action, Battle, Run } from '../game/types';
import type { Pile } from '../components/DeckViewer';
import { GameCard } from '../components/GameCard';
import { Modal } from '../components/Modal';
import { Health } from '../components/Health';
import { SceneDecor } from '../components/SceneDecor';
import { Sprite } from '../components/Sprite';
import { AttributeLabel } from '../components/AttributeLabel';
import { attributeText } from '../game/attributes';
import type { BattleMotion, QueueAction } from '../hooks/useBattleQueue';

const SUPPORT_HINTS: Record<string, string> = {
  mushmon: '虚弱目标',
  picodevimon: '8 点伤害',
  hagurumon: '+10 护盾',
  impmon: '斩杀 8/14',
  leomon: '群体虚弱',
  andromon: '+12 护盾',
  gotsumon: '+2 蓄能',
  betamon: '抽 2 张牌',
  lopmon: '清故障/回 6 血',
};

export function BattleScreen({
  run,
  battle,
  theme,
  motion,
  battleBusy,
  queueAction,
  send,
  openDeck,
  onHelp,
}: {
  run: Run;
  battle: Battle;
  theme: string;
  motion: BattleMotion | null;
  battleBusy: boolean;
  queueAction: QueueAction;
  send: (action: Action) => void;
  openDeck: (pile: Pile) => void;
  onHelp: () => void;
}) {
  const r = run,
    b = battle;
  const plans = enemyIntents(r);
  const incoming = b.enemies
    .filter((e) => e.hp > 0)
    .reduce((n, e) => {
      const plan = plans.get(e.uid)!;
      return n + plan.damage * plan.hits;
    }, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const dispatchAction = (action: Action) => {
    setSelected(null);
    send(action);
  };
  const queue = (
    action: Action,
    actor: Parameters<QueueAction>[1],
    enemyIds: string[] = [],
    playerHit = false,
  ) => {
    setSelected(null);
    queueAction(action, actor, enemyIds, playerHit);
  };
  const activeCard = b.hand.find((c) => c.uid === selected);
  const activeEnemy =
    b.enemies.find((e) => e.uid === target && e.hp > 0) ?? b.enemies.find((e) => e.hp > 0);
  const battleLocked = battleBusy || b.enemyTurnIndex !== null;
  const copyBlocked =
    !!activeCard &&
    CARDS[activeCard.id].special === 'copy' &&
    (b.copyUses >= MAX_COPIES_PER_TURN ||
      (cardDefinition(activeCard).copyChoice && !copyCandidates(b.hand, activeCard.uid).length));
  function playSelectedCard() {
    if (!activeCard || battleLocked || copyBlocked || playCost(r, activeCard) > b.energy) return;
    const definition = cardDefinition(activeCard);
    if (definition.special === 'copy' && definition.copyChoice) {
      setCopyOpen(true);
      return;
    }
    const canHit =
      !!definition.damage ||
      ['detonate', 'markburst', 'shieldhit', 'cannon'].includes(definition.special ?? '');
    const enemyIds = canHit
      ? definition.all
        ? b.enemies.filter((e) => e.hp > 0).map((e) => e.uid)
        : activeEnemy
          ? [cardTarget(r, definition, activeEnemy.uid)!.uid]
          : []
      : [];
    queue({ type: 'play', uid: activeCard.uid, target: activeEnemy?.uid }, 'player', enemyIds);
  }
  return (
    <div className="battle-view">
      <div className={`battle-stage ${theme}`}>
        <SceneDecor theme={theme} />
        <div className="battle-topline">
          <span>
            <Crosshair size={13} />
            {r.currentNode?.kind === 'boss'
              ? '首领战'
              : r.currentNode?.kind === 'elite'
                ? '精英遭遇'
                : '数码遭遇'}
          </span>
          <span>
            {b.enemyTurnIndex !== null ? '敌方行动中' : `攻击合计 ${incoming} · 点击敌人选目标`}
          </span>
        </div>
        <div className="enemies">
          {b.enemies.map((e) => {
            const plan = plans.get(e.uid)!;
            const countdown = enemyCountdown(r, e);
            return (
              <button
                key={e.uid}
                className={`enemy ${e.hp <= 0 ? 'defeated' : ''} ${activeEnemy?.uid === e.uid ? 'targeted' : ''} ${motion?.actor === 'enemy' && motion.enemyIds.includes(e.uid) && motion.phase === 'windup' ? 'acting' : ''} ${motion?.actor === 'player' && motion.enemyIds.includes(e.uid) && motion.phase === 'impact' ? 'taking-hit' : ''}`}
                onClick={() => setTarget(e.uid)}
                disabled={e.hp <= 0 || battleLocked}
                aria-label={`选择目标 ${ENEMIES[e.id].name} · ${attributeText(e.id)} · ${plan.name} ${plan.damage * plan.hits}伤害 · ${plan.detail}`}
              >
                <span className={`enemy-intent ${plan.type}`} title={plan.detail}>
                  {plan.type === 'attack' ? (
                    <Swords size={14} />
                  ) : plan.type === 'block' ? (
                    <Shield size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}{' '}
                  {plan.name}
                  {plan.type === 'attack' && (
                    <b>
                      {plan.damage}
                      {plan.hits > 1 ? `×${plan.hits}` : ''}
                    </b>
                  )}
                  {plan.pierce && <b>穿透</b>}
                  {plan.shield > 0 && <b>{plan.shield}</b>}
                  {plan.heal && <b>＋{plan.heal}</b>}
                </span>
                <Sprite
                  id={e.id}
                  size={b.enemies.length > 2 ? 120 : b.enemies.length > 1 ? 175 : 200}
                />
                <span className="enemy-name">{ENEMIES[e.id].name}</span>
                <Health hp={e.hp} max={e.maxHp} block={e.block} />
                <span className="status-tags">
                  <AttributeLabel id={e.id} compact />
                  {e.hp > 0 && e.strength > 0 && <span>力量 {e.strength}</span>}
                  {e.hp > 0 && ENEMIES[e.id].guard && <span>护卫</span>}
                  {e.hp > 0 && e.id === 'beelzebumon' && <span>噬能 {e.devour ?? 0}/2</span>}
                  {e.hp > 0 && enemyEnrage(r, e) > 0 && (
                    <span>
                      狂暴 ＋{enemyEnrage(r, e)}/{e.id === 'beelzebumon' ? '次行动' : '段'}
                    </span>
                  )}
                  {e.hp > 0 && countdown && <span>{countdown}</span>}
                  {e.burn > 0 && (
                    <span>
                      <Flame size={12} />
                      {e.burn}
                    </span>
                  )}
                  {e.mark > 0 && (
                    <span>
                      <Sparkles size={12} />
                      {e.mark}
                    </span>
                  )}
                  {e.weakened > 0 && <span>虚弱 {e.weakened}</span>}
                  {(e.vulnerable ?? 0) > 0 && <span>易伤 {e.vulnerable}</span>}
                  {e.rogue && <span>失控</span>}
                  {e.hp <= 0 && <span>已击败</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="player-field">
          <div
            className={`player-unit ${motion?.actor === 'player' && motion.phase === 'windup' ? 'acting' : ''} ${motion?.actor === 'enemy' && motion.phase === 'impact' && motion.playerHit ? 'taking-hit' : ''}`}
          >
            <Sprite id={r.form} size={210} />
            <div className="player-caption">
              <strong>{FORM_NAMES[r.form]}</strong>
              <span>
                <AttributeLabel id={r.form} compact /> ·{' '}
                {r.branch
                  ? BRANCHES[r.branch].tag
                  : r.training === 'defense' && r.stage > 0
                    ? '守护训练'
                    : '与你并肩'}
              </span>
              <Health hp={r.hp} max={r.maxHp} block={b.block} />
            </div>
          </div>
          <div className="sync-device">
            <div className="sync-dial">
              <ScanLine size={23} />
              <b>
                {b.sync}
                <small>/6</small>
              </b>
            </div>
            <span>同步率</span>
            <button
              disabled={
                battleLocked ||
                !(r.branch || EVOLUTIONS[r.form]?.endpoint) ||
                b.sync < 6 ||
                b.burstUsed
              }
              onClick={() => dispatchAction({ type: 'burst' })}
            >
              {b.burst > 0
                ? `爆发 · ${b.burst} 回合`
                : b.burstUsed
                  ? '本场已爆发'
                  : r.branch || EVOLUTIONS[r.form]?.endpoint
                    ? '同步爆发'
                    : '究极体解锁'}
            </button>
          </div>
        </div>
        {b.burst > 0 && <div className="burst-banner">同步爆发 · 攻击每段＋2</div>}
        <div className="battle-log" key={`${b.turn}-${b.played}-${b.log[0]}`} aria-live="polite">
          {b.log[0]}
        </div>
      </div>
      {activeEnemy && (
        <p className="enemy-mechanic">
          <strong>
            {ENEMIES[activeEnemy.id].name} · <AttributeLabel id={activeEnemy.id} compact /> ·{' '}
            {plans.get(activeEnemy.uid)!.name}
          </strong>
          <span>{plans.get(activeEnemy.uid)!.detail}</span>
        </p>
      )}
      <div className="combat-info">
        <span>
          <Shield size={14} />
          护盾 {b.block}
        </span>
        {b.strength > 0 && (
          <span>
            <Swords size={14} />
            力量 {b.strength}
          </span>
        )}
        {b.charge > 0 && (
          <span>
            <Zap size={14} />
            蓄能 {b.charge}
          </span>
        )}
        {b.devour > 0 && (
          <span>
            <Flame size={14} />
            噬能 {b.devour}/6
          </span>
        )}
        <button className="text-btn" onClick={onHelp}>
          状态说明
          <CircleHelp size={13} />
        </button>
      </div>
      <div className="hand-heading">
        <span>
          <span className="energy-gem">{b.energy}</span>行动力
          <small>每回合恢复 3 点</small>
        </span>
        <span className="pile-info">
          <button onClick={() => openDeck('draw')}>抽牌 {b.draw.length}</button>
          <button onClick={() => openDeck('discard')}>弃牌 {b.discard.length}</button>
          <button onClick={() => openDeck('exhaust')}>耗竭 {b.exhaust.length}</button>
        </span>
      </div>
      <div className="hand">
        {b.hand.map((c) => (
          <GameCard
            run={r}
            key={c.uid}
            card={c}
            selected={selected === c.uid}
            disabled={battleLocked}
            onClick={() => (selected === c.uid ? playSelectedCard() : setSelected(c.uid))}
          />
        ))}
        {!b.hand.length && <p className="empty-hand">手牌已用尽，结束回合抽取新牌。</p>}
      </div>
      {copyBlocked && (
        <p className="enemy-mechanic" role="status">
          {b.copyUses >= MAX_COPIES_PER_TURN
            ? '本回合复制次数已用完，下一回合恢复。'
            : '手中暂无可复制目标，请先抽牌或选择其他牌。'}
        </p>
      )}
      <div className="battle-actions">
        <button
          className="support-btn"
          disabled={battleLocked || b.supportUsed}
          onClick={() => queue({ type: 'support', target: activeEnemy?.uid }, 'effect')}
        >
          <ScanLine size={17} />
          <span>
            {ENEMIES[r.support]?.name ?? '应急防御'}
            <small>
              {b.supportUsed
                ? r.support === 'default'
                  ? '已耗尽 · 营地恢复'
                  : '本场已使用'
                : (SUPPORT_HINTS[r.support] ?? '+8 护盾')}
            </small>
          </span>
        </button>
        <button
          className="potion-btn"
          disabled={battleLocked || !r.potions || r.hp >= r.maxHp}
          onClick={() => queue({ type: 'potion' }, 'effect')}
          aria-label={`使用恢复磁盘，剩余${r.potions}个`}
        >
          <Heart size={18} />
          <b>{r.potions}</b>
        </button>
        <div className="turn-buttons">
          <button
            className="secondary use-card"
            disabled={
              !activeCard || battleLocked || copyBlocked || playCost(r, activeCard) > b.energy
            }
            onClick={playSelectedCard}
            aria-label={activeCard ? `使用 ${CARDS[activeCard.id].name}` : '选择卡片后使用'}
          >
            <Zap size={16} />
            使用
          </button>
          <button
            className="primary end-turn"
            disabled={battleLocked}
            onClick={() => dispatchAction({ type: 'beginEnemyTurn' })}
          >
            结束回合
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      {copyOpen && activeCard && (
        <Modal title="选择复制目标" onClose={() => setCopyOpen(false)} wide>
          <p className="modal-note">
            选择手中一张可复制牌。复制品继承强化并耗竭，取消不消耗费用；每回合合计最多2次。
          </p>
          <div className="deck-grid">
            {copyCandidates(b.hand, activeCard.uid).map((c) => (
              <GameCard
                key={c.uid}
                card={c}
                run={r}
                compact
                onClick={() => {
                  if (!battleLocked && !copyBlocked) {
                    setCopyOpen(false);
                    queue(
                      {
                        type: 'play',
                        uid: activeCard.uid,
                        target: activeEnemy?.uid,
                        copyUid: c.uid,
                      },
                      'effect',
                    );
                  }
                }}
              />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
