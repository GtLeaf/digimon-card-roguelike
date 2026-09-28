import { CARDS, FORM_NAMES } from './data';
import type { CardDef, Run } from './types';

// 解锁只看本局实际经历的形态，持有旧版卡牌不会解锁整条路线。
export function skillUnlocked(run: Run, card: CardDef): boolean {
  if (!card.unlockForm) return card.family === 'common';
  return [run.partner, run.form, ...run.formHistory].includes(card.unlockForm);
}
export function cardPool(run: Run): string[] {
  return Object.values(CARDS)
    .filter((card) => skillUnlocked(run, card))
    .map((card) => card.id);
}
export function skillLabel(card: CardDef, run?: Run | null): string {
  if (!card.unlockForm) return card.family === 'common' ? '通用卡' : '故障卡';
  if (!run) return `${FORM_NAMES[card.unlockForm]}专属`;
  if (card.unlockForm === run.form) return '形态专属';
  if (skillUnlocked(run, card)) return '继承技能';
  if (run.deck.some((c) => c.id === card.id)) return '旧版保留';
  return '未解锁';
}
export function skillDescription(card: CardDef, run?: Run | null): string {
  if (!card.unlockForm)
    return card.family === 'common' ? '所有形态均可使用。' : '故障状态牌，不进入普通奖励与商店。';
  const owner = FORM_NAMES[card.unlockForm];
  if (run && skillLabel(card, run) === '旧版保留')
    return `${owner}专属技能 · 旧版已获得，继续可用；到达对应形态前不会再次出现在奖励或商店。`;
  if (run && skillLabel(card, run) === '继承技能')
    return `继承自${owner} · 本局已解锁，继续进化后仍可使用和获取。`;
  return `${owner}专属技能 · 到达该形态后进入本局奖励和商店卡池。`;
}
// 旧存档中尚未领取／购买的提前技能换为合法候选，保持随机状态不变。
export function refreshLockedOffers(run: Run): void {
  const pool = cardPool(run);
  function refresh(offers: string[], bought: string[] = []): string[] {
    const kept = new Set(offers.filter((id) => pool.includes(id) || bought.includes(id)));
    const available = pool.filter((id) => !kept.has(id) && !bought.includes(id));
    return offers.flatMap((id) =>
      kept.has(id) ? [id] : available.length ? [available.shift()!] : [],
    );
  }
  if (run.reward) run.reward.cards = refresh(run.reward.cards);
  run.shopStock = refresh(run.shopStock, run.shopBought);
}
