import { describe, expect, it } from 'vitest';
import { RELICS } from '../src/game/data';
import { emptySave, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import { relicPurchaseId } from '../src/game/shop';

function enterShop(relics: string[] = []) {
  const save = reduceGame(
    reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 }),
    { type: 'bless', id: 'guard' },
  );
  save.run!.gold = 400;
  save.run!.relics = relics;
  save.run!.nodes[0][0].kind = 'shop';
  return reduceGame(save, { type: 'node', id: save.run!.nodes[0][0].id });
}

describe('shop device shelf and blind box', () => {
  it('creates reproducible, distinct unowned stock and preserves it on reload', () => {
    const save = enterShop(['armor']);
    const stock = save.run!.shopRelicStock;
    expect(stock).toHaveLength(3);
    expect(new Set(stock).size).toBe(3);
    expect(stock).not.toContain('armor');
    expect(stock.every((id) => RELICS[id])).toBe(true);
    expect(enterShop(['armor'])).toEqual(save);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it('buys the selected device without rolling RNG or replenishing the shelf', () => {
    const save = enterShop();
    const id = save.run!.shopRelicStock[1];
    const bought = reduceGame(save, { type: 'buy', id: relicPurchaseId(id) });
    expect(bought.run!.relics).toEqual([id]);
    expect(bought.run!.gold).toBe(300);
    expect(bought.run!.rng).toBe(save.run!.rng);
    expect(bought.run!.shopRelicStock).toEqual(save.run!.shopRelicStock);
    expect(bought.run!.message).toContain(RELICS[id].text);
    expect(reduceGame(bought, { type: 'buy', id: relicPurchaseId(id) })).toEqual(bought);
    expect(parseSave(JSON.stringify(bought))).toEqual(bought);
  });

  it('rejects devices outside stock, invalid IDs and unaffordable purchases', () => {
    const save = enterShop();
    const outside = Object.keys(RELICS).find((id) => !save.run!.shopRelicStock.includes(id))!;
    for (const id of [relicPurchaseId(outside), 'relic:fake', 'relic:'])
      expect(reduceGame(save, { type: 'buy', id })).toEqual(save);
    save.run!.gold = 99;
    expect(
      reduceGame(save, { type: 'buy', id: relicPurchaseId(save.run!.shopRelicStock[0]) }),
    ).toEqual(save);
    save.run!.gold = 79;
    expect(reduceGame(save, { type: 'buy', id: 'relic' })).toEqual(save);
  });

  it('keeps the blind box separate and prevents buying its reward again from the shelf', () => {
    const save = enterShop(Object.keys(RELICS).filter((id) => id !== 'armor'));
    expect(save.run!.shopRelicStock).toEqual(['armor']);
    const bought = reduceGame(save, { type: 'buy', id: 'relic' });
    expect(bought.run!.gold).toBe(320);
    expect(bought.run!.relics).toContain('armor');
    expect(bought.run!.message).toContain('盲盒已开启');
    expect(bought.run!.shopRelicStock).toEqual(['armor']);
    expect(reduceGame(bought, { type: 'buy', id: relicPurchaseId('armor') })).toEqual(bought);
    expect(reduceGame(bought, { type: 'buy', id: 'relic' })).toEqual(bought);
  });

  it('allows several selected purchases followed by one blind box', () => {
    let save = enterShop();
    for (const id of save.run!.shopRelicStock)
      save = reduceGame(save, { type: 'buy', id: relicPurchaseId(id) });
    const bought = reduceGame(save, { type: 'buy', id: 'relic' });
    expect(bought.run!.gold).toBe(20);
    expect(bought.run!.relics).toHaveLength(4);
    expect(new Set(bought.run!.relics).size).toBe(4);
  });

  it('does not charge for an empty blind box when every device is owned', () => {
    const save = enterShop(Object.keys(RELICS));
    expect(save.run!.shopRelicStock).toEqual([]);
    expect(reduceGame(save, { type: 'buy', id: 'relic' })).toEqual(save);
  });

  it('adds a stable shelf to old shop saves without changing their RNG or purchase history', () => {
    const save = enterShop(['armor']);
    save.run!.shopBought = ['relic'];
    const legacy = structuredClone(save);
    delete (legacy.run! as { shopRelicStock?: string[] }).shopRelicStock;
    const loaded = parseSave(JSON.stringify(legacy));
    expect(loaded.run!.shopRelicStock).toHaveLength(3);
    expect(loaded.run!.shopRelicStock).not.toContain('armor');
    expect(loaded.run!.rng).toBe(save.run!.rng);
    expect(loaded.run!.shopBought).toEqual(['relic']);
    expect(parseSave(JSON.stringify(legacy))).toEqual(loaded);
    expect(parseSave(JSON.stringify(loaded))).toEqual(loaded);
  });

  it('leaves explicitly saved empty shelves unchanged', () => {
    const save = enterShop();
    save.run!.shopRelicStock = [];
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });
});
