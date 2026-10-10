import { RELICS } from './data';
import { shuffle } from './random';
import type { Run } from './types';

export const SHOP_RELIC_PRICE = 100;
export const SHOP_BLIND_BOX_PRICE = 80;
export const relicPurchaseId = (id: string) => `relic:${id}`;
export const relicIdFromPurchase = (id: string) =>
  id.startsWith('relic:') ? id.slice('relic:'.length) : null;

export function shopPrice(id: string) {
  if (relicIdFromPurchase(id) !== null) return SHOP_RELIC_PRICE;
  return id === 'relic' ? SHOP_BLIND_BOX_PRICE : id === 'potion' ? 30 : 45;
}

// 每次到访生成一次货架；购买与读档都不重新抽取。
export function shopRelicOffers(run: Run): string[] {
  return shuffle(
    run,
    Object.keys(RELICS).filter((id) => !run.relics.includes(id)),
  ).slice(0, 3);
}
