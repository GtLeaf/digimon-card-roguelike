import { describe, expect, it } from 'vitest';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { EVENTS, eventChoiceBlock, eventChoicePreview, storyEventFor } from '../src/game/events';

function event(id?: string) {
  const save = emptySave();
  save.run = makeRun('guilmon', 42);
  const run = save.run;
  run.screen = 'event';
  run.row = 5;
  run.hp = 42;
  run.currentNode = { ...run.nodes[5][0], kind: 'event', eventId: id };
  return save;
}

describe('distinct exploration event choices', () => {
  it('safe choices reserve direct recovery for three rest events', () => {
    const healed: string[] = [];
    for (const id of Object.keys(EVENTS)) {
      const save = event(id);
      save.run!.gold = 0;
      const next = reduceGame(save, { type: 'event', choice: 'safe' });
      expect(next.run!.screen).toBe('map');
      expect(next.run!.hp).toBeGreaterThanOrEqual(save.run!.hp);
      if (next.run!.hp > save.run!.hp) healed.push(id);
    }
    expect(healed.sort()).toEqual(['reader', 'shelter', 'spring']);
  });

  it('safe training and research retain their purpose without free healing', () => {
    const training = reduceGame(event('training'), { type: 'event', choice: 'safe' });
    expect(training.run).toMatchObject({ hp: 42, training: 'defense' });
    const research = reduceGame(event('research'), { type: 'event', choice: 'safe' });
    expect(research.run!.hp).toBe(42);
    expect(research.meta.unlockedRoutes).toEqual(['mechanical', 'purification']);
    expect(research.run!.message).toContain('永久解锁');
  });

  it.each([
    ['rescue', 6],
    ['echo', 8],
  ] as const)(
    '%s has a small free economic exit without granting recovery or a partner',
    (id, gold) => {
      const save = event(id);
      const next = reduceGame(save, { type: 'event', choice: 'safe' });
      expect(next.run).toMatchObject({ hp: 42, gold: save.run!.gold + gold });
      expect(next.meta.partners).toEqual(save.meta.partners);
    },
  );

  it('the spring trades HP for the selected card removal and only settles once', () => {
    const save = event('spring');
    const run = save.run!;
    const uid = run.deck[1].uid;
    const preview = eventChoicePreview(run, EVENTS.spring.choices[0]);
    expect(preview).toContain('生命 42 → 32');
    expect(preview).toContain(`卡组 ${run.deck.length} → ${run.deck.length - 1} 张`);
    const next = reduceGame(save, { type: 'event', choice: 'risk', uid });
    expect(next.run).toMatchObject({ hp: 32, gold: run.gold, screen: 'map' });
    expect(next.run!.deck.some((card) => card.uid === uid)).toBe(false);
    expect(next.run!.deck[0]).toEqual(run.deck[0]);
    expect(next.run!.message).toContain('生命 42 → 32');
    expect(reduceGame(next, { type: 'event', choice: 'risk', uid })).toEqual(next);
  });

  it('spring removal leaves HP and cards intact for a missing target or minimum deck', () => {
    const save = event('spring');
    expect(reduceGame(save, { type: 'event', choice: 'risk' })).toEqual(save);
    expect(reduceGame(save, { type: 'event', choice: 'risk', uid: 'missing' })).toEqual(save);
    save.run!.deck = save.run!.deck.slice(0, 5);
    expect(eventChoiceBlock(save.run!, EVENTS.spring.choices[0])).toBe('至少保留5张牌');
    expect(eventChoicePreview(save.run!, EVENTS.spring.choices[0])).toEqual([]);
    expect(reduceGame(save, { type: 'event', choice: 'risk', uid: save.run!.deck[0].uid })).toEqual(
      save,
    );
  });

  it('black market discounts a chosen upgrade by charging HP and leaves disks untouched', () => {
    const save = event('blackmarket');
    const run = save.run!;
    const uid = run.deck[1].uid;
    expect(eventChoicePreview(run, EVENTS.blackmarket.choices[0])).toEqual([
      '生命 42 → 37',
      '金币 65 → 50',
      '选择一张牌强化 · 本局生效',
    ]);
    const next = reduceGame(save, { type: 'event', choice: 'risk', uid });
    expect(next.run).toMatchObject({ hp: 37, gold: 50, potions: run.potions, screen: 'map' });
    expect(next.run!.deck[1]).toMatchObject({ uid, upgraded: true });
    expect(next.run!.deck[0]).toEqual(run.deck[0]);
    expect(next.run!.message).toContain('金币 65 → 50');
    expect(reduceGame(next, { type: 'event', choice: 'risk', uid: next.run!.deck[0].uid })).toEqual(
      next,
    );
  });

  it('black market rejects insufficient gold and invalid upgrades before charging either cost', () => {
    const save = event('blackmarket');
    const uid = save.run!.deck[0].uid;
    expect(reduceGame(save, { type: 'event', choice: 'risk' })).toEqual(save);
    save.run!.gold = 14;
    expect(reduceGame(save, { type: 'event', choice: 'risk', uid })).toEqual(save);
    expect(eventChoicePreview(save.run!, EVENTS.blackmarket.choices[0])).toEqual([]);
    save.run!.gold = 65;
    save.run!.deck[0].upgraded = true;
    expect(reduceGame(save, { type: 'event', choice: 'risk', uid })).toEqual(save);
    save.run!.deck.forEach((card) => (card.upgraded = true));
    expect(eventChoiceBlock(save.run!, EVENTS.blackmarket.choices[0])).toBe('没有可选择的卡牌');
    expect(reduceGame(save, { type: 'event', choice: 'risk', uid })).toEqual(save);
  });

  it('HP costs keep the stated floor and old events without an ID retain their fallback', () => {
    const spring = event('spring');
    spring.run!.hp = 3;
    const next = reduceGame(spring, {
      type: 'event',
      choice: 'risk',
      uid: spring.run!.deck[0].uid,
    });
    expect(next.run!.hp).toBe(1);
    const legacy = event();
    legacy.run!.row = 11;
    expect(storyEventFor(legacy.run!).title).toBe('废墟里的一束光。');
    const healed = reduceGame(legacy, { type: 'event', choice: 'safe' });
    expect(healed.run!.hp).toBe(52);
    expect(healed.meta.unlockedRoutes).toEqual(['mechanical', 'purification']);
  });
});
