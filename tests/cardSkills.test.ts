import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/data';
import {
  cardPool,
  skillLabel,
  skillDescription,
  skillUnlocked,
  weightedOffers,
} from '../src/game/cardSkills';
import { EVOLUTIONS } from '../src/game/evolution';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import type { Partner } from '../src/game/types';
function start(partner: Partner = 'renamon') {
  return reduceGame(reduceGame(emptySave(), { type: 'start', partner, seed: 42 }), {
    type: 'bless',
    id: 'guard',
  });
}

describe('form skill unlocks', () => {
  it('Renamon cannot acquire Taomon skills from either rewards or shops', () => {
    for (const seed of [1, 42, 99]) {
      let s = reduceGame(reduceGame(emptySave(), { type: 'start', partner: 'renamon', seed }), {
        type: 'bless',
        id: 'guard',
      });
      expect(cardPool(s.run!)).not.toContain('ritual');
      expect(cardPool(s.run!)).not.toContain('barrier');
      s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
      s.run!.battle!.enemies[0].hp = 1;
      s.run!.battle!.hand = [{ id: 'strike', uid: 'finish', upgraded: false }];
      s = reduceGame(s, { type: 'play', uid: 'finish' });
      expect(s.run!.reward!.cards.every((id) => skillUnlocked(s.run!, CARDS[id]))).toBe(true);
      s = reduceGame(s, { type: 'reward' });
      s.run!.row = 2;
      s.run!.path = [s.run!.nodes[1][0].id];
      s = reduceGame(s, { type: 'node', id: s.run!.nodes[2][1].id });
      expect(s.run!.shopStock.every((id) => skillUnlocked(s.run!, CARDS[id]))).toBe(true);
    }
  });
  it('unlocks only visited forms and retains skills through later evolution', () => {
    const r = makeRun('renamon', 42);
    r.form = 'taomon';
    r.stage = 2;
    r.formHistory = ['renamon', 'kyubimon', 'taomon'];
    expect(cardPool(r)).toContain('ritual');
    expect(cardPool(r)).not.toContain('shadowseal');
    r.form = 'sakuyamon';
    r.stage = 3;
    r.formHistory.push('sakuyamon');
    expect(cardPool(r)).toContain('ritual');
    expect(skillLabel(CARDS.ritual, r)).toBe('继承技能');
    expect(skillDescription(CARDS.ritual, r)).toContain('祭师兽');
    expect(cardPool(r)).not.toContain('mandala');
    r.form = 'doumon';
    r.stage = 2;
    r.formHistory = ['renamon', 'youkomon', 'doumon'];
    expect(cardPool(r)).toContain('shadowseal');
    expect(cardPool(r)).not.toContain('ritual');
  });
  it('all starting cards are legal and every exclusive image matches its owner', () => {
    for (const partner of ['guilmon', 'renamon', 'terriermon'] as const) {
      const r = makeRun(partner, 42);
      for (const c of r.deck) expect(skillUnlocked(r, CARDS[c.id]), c.id).toBe(true);
    }
    for (const c of Object.values(CARDS))
      if (c.family !== 'common' && c.family !== 'status') {
        expect(c.unlockForm, c.id).toBe(c.art);
        expect(EVOLUTIONS[c.unlockForm!], c.id).toBeDefined();
      }
  });
  it('evolution gifts never require a future or unvisited side-branch form', () => {
    function paths(id: string): string[][] {
      const d = EVOLUTIONS[id];
      return d.parents.length
        ? d.parents.flatMap((parent) => paths(parent).map((path) => [...path, id]))
        : [[id]];
    }
    for (const d of Object.values(EVOLUTIONS))
      for (const history of paths(d.id)) {
        const r = makeRun(d.partner, 42);
        r.form = d.id;
        r.stage = d.stage;
        r.formHistory = history;
        for (const id of d.cards)
          expect(skillUnlocked(r, CARDS[id]), `${history.join(' → ')} / ${id}`).toBe(true);
      }
  });
  it('rejects locked offers even when a stale screen contains them', () => {
    let s = start();
    s.run!.screen = 'shop';
    s.run!.shopStock = ['ritual'];
    s.run!.gold = 100;
    expect(reduceGame(s, { type: 'buy', id: 'ritual' })).toEqual(s);
    s = {
      ...s,
      run: { ...s.run!, screen: 'reward', reward: { cards: ['ritual'], gold: 0, scans: [] } },
    };
    expect(reduceGame(s, { type: 'reward', card: 'ritual' })).toEqual(s);
  });
  it('legacy owned skills remain playable without unlocking new copies or losing upgrades', () => {
    let s = start();
    s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
    const card = { id: 'ritual', uid: 'old-skill', upgraded: true };
    s.run!.deck.push(card);
    s.run!.battle!.hand = [card];
    const before = s.run!.rng;
    s = parseSave(JSON.stringify(s));
    expect(s.run!.rng).toBe(before);
    expect(s.run!.battle!.hand).toEqual([card]);
    expect(skillLabel(CARDS.ritual, s.run!)).toBe('旧版保留');
    expect(cardPool(s.run!)).not.toContain('ritual');
    s = reduceGame(s, { type: 'play', uid: 'old-skill' });
    expect(s.run!.battle!.strength).toBe(1);
    expect(s.run!.battle!.exhaust.some((c) => c.uid === 'old-skill' && c.upgraded)).toBe(true);
  });
  it('refreshes only unclaimed locked offers on load and preserves RNG, gold and purchased cards', () => {
    const s = start(),
      r = s.run!;
    r.screen = 'shop';
    r.shopStock = ['ritual', 'barrier', 'guard'];
    r.shopBought = ['ritual'];
    r.reward = { cards: ['ritual', 'barrier', 'guard'], gold: 24, scans: [] };
    const loaded = parseSave(JSON.stringify(s)).run!;
    expect(loaded.shopStock).toHaveLength(3);
    expect(loaded.shopStock).toContain('ritual');
    expect(loaded.shopStock).not.toContain('barrier');
    expect(loaded.reward!.cards.every((id) => skillUnlocked(loaded, CARDS[id]))).toBe(true);
    expect(loaded.reward!.cards).toHaveLength(3);
    expect(new Set(loaded.reward!.cards).size).toBe(3);
    expect(loaded.rng).toBe(r.rng);
    expect(loaded.gold).toBe(r.gold);
    expect(loaded.deck).toEqual(r.deck);
    expect(parseSave(JSON.stringify({ ...s, run: loaded })).run).toEqual(loaded);
  });
  it('new journeys reset unlocks while keeping common cards available', () => {
    let s = start();
    s.run!.formHistory.push('taomon');
    s = reduceGame(s, { type: 'abandon' });
    s = reduceGame(s, { type: 'start', partner: 'renamon' });
    expect(cardPool(s.run!)).not.toContain('ritual');
    expect(cardPool(s.run!)).toContain('guard');
    expect(cardPool(s.run!)).toContain('cannon');
    expect(cardPool(s.run!)).not.toContain('fault');
  });
});

describe('weighted offer sampling', () => {
  it('current-form exclusive cards appear far more often than uniform sampling', () => {
    let hit = 0,
      total = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const run = makeRun('impmon', seed);
      const offers = weightedOffers(run, 3);
      expect(new Set(offers).size).toBe(offers.length); // 无放回
      for (const id of offers) {
        expect(skillUnlocked(run, CARDS[id])).toBe(true);
        if (CARDS[id].unlockForm === run.form) hit++;
        total++;
      }
    }
    // 小妖兽开局卡池 17 张、专属 4 张：均匀抽样专属占比约 24%，加权后实测约 55%。
    expect(hit / total).toBeGreaterThan(0.45);
  });
});
