import { describe, expect, it } from 'vitest';
import { emptySave, makeRun, reduceGame } from '../src/game/engine';
import { availableNodes } from '../src/game/map';
import { EVOLUTIONS, evolutionStatus, syncRouteData } from '../src/game/evolution';
import { parseSave } from '../src/game/storage';
import { CARDS, cardText } from '../src/game/data';
import type { Partner, Save } from '../src/game/types';
function start(partner: Partner = 'guilmon') {
  const base = emptySave();
  if (partner === 'impmon') base.meta.scans.beelzebumon = 100;
  return reduceGame(reduceGame(base, { type: 'start', partner, seed: 42 }), {
    type: 'bless',
    id: 'guard',
  });
}
function fight() {
  const s = start();
  return reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
}
function hand(s: Save, ids: string[]) {
  s.run!.battle!.energy = 30;
  s.run!.battle!.hand = ids.map((id, i) => ({ id, uid: `t${i}`, upgraded: false }));
  s.run!.battle!.enemies[0].hp = 999;
  s.run!.battle!.enemies[0].maxHp = 999;
}
function ready(form: string) {
  const d = EVOLUTIONS[form];
  const s = start(d.partner),
    r = s.run!;
  r.form = d.parents[0];
  r.stage = d.stage - 1;
  r.bosses = d.stage === 1 ? 0 : d.stage === 2 ? 1 : 3;
  r.victories = 8;
  r.row = d.stage === 1 ? 3 : d.stage === 2 ? 9 : 29;
  r.currentNode = r.nodes[r.row][0];
  r.screen = 'evolution';
  r.formHistory = [r.partner, r.form];
  return s;
}
const replacements = (s: Save) => s.run!.deck.slice(0, 2).map((c) => c.uid);

describe('real connected routes', () => {
  it('all generated nodes lead forward and all paths reach the final boss', () => {
    for (const seed of [1, 42, 984]) {
      const r = makeRun('guilmon', seed);
      const last = r.nodes.length - 1;
      let frontier = r.nodes[0].map((n) => n.id);
      for (let row = 0; row < last; row++) {
        const next = new Set<string>();
        for (const id of frontier) {
          const n = r.nodes[row].find((n) => n.id === id)!;
          expect(n.next.length).toBeGreaterThan(0);
          for (const target of n.next) {
            expect(r.nodes[row + 1].some((n) => n.id === target)).toBe(true);
            next.add(target);
          }
        }
        frontier = [...next];
      }
      expect(frontier).toEqual([r.nodes[last][0].id]);
    }
  });
  it('cannot jump between disconnected lanes even on the next row', () => {
    const s = start(),
      r = s.run!;
    r.row = 1;
    r.path = [r.nodes[0][1].id];
    expect(availableNodes(r).map((n) => n.id)).toEqual([r.nodes[1][1].id]);
    expect(reduceGame(s, { type: 'node', id: r.nodes[1][0].id })).toEqual(s);
  });
  it('a merge opens the next fork and reload preserves the selected branch', () => {
    const s = start();
    s.run!.row = 5;
    s.run!.path = [s.run!.nodes[4][0].id];
    expect(availableNodes(s.run!)).toHaveLength(3);
    const loaded = parseSave(JSON.stringify(s));
    expect(availableNodes(loaded.run!).map((n) => n.id)).toEqual(
      availableNodes(s.run!).map((n) => n.id),
    );
  });
});

describe('behavior counters', () => {
  it('upgraded text displays the actual damage and shield values', () => {
    expect(cardText({ id: 'guard', upgraded: true })).toContain('10 护盾');
    expect(cardText({ id: 'doublecut', upgraded: true })).toContain('8×2');
    expect(cardText({ id: 'bloodedge', upgraded: true })).toContain('失去 3 生命，造成 16');
  });
  it('multihit and area attacks count once per card rather than per hit or enemy', () => {
    let s = fight();
    hand(s, ['doublecut', 'heatwave']);
    s.run!.battle!.enemies.push({ ...s.run!.battle!.enemies[0], uid: 'other' });
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.attacks).toBe(1);
    s = reduceGame(s, { type: 'play', uid: 't1' });
    expect(s.run!.activity.counts.attacks).toBe(2);
    expect(s.run!.activity.counts.fire).toBe(1);
  });
  it('rejecting insufficient energy or replay does not count', () => {
    let s = fight();
    hand(s, ['inferno']);
    s.run!.battle!.energy = 0;
    const before = structuredClone(s);
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s).toEqual(before);
    s.run!.battle!.energy = 3;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(reduceGame(s, { type: 'play', uid: 't0' }).run!.activity.counts.attacks).toBe(1);
  });
  it('support and passive shields do not count as active defense', () => {
    let s = fight();
    s = reduceGame(s, { type: 'support' });
    expect(s.run!.activity.counts.defenses ?? 0).toBe(0);
    hand(s, ['guard']);
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.defenses).toBe(1);
  });
  it('actual healing and self-cost are counted, full-health healing is not', () => {
    let s = fight();
    hand(s, ['mend', 'sacrifice', 'mend']);
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.heals ?? 0).toBe(0);
    s = reduceGame(s, { type: 'play', uid: 't1' });
    s = reduceGame(s, { type: 'play', uid: 't2' });
    expect(s.run!.activity.counts.selfCosts).toBe(1);
    expect(s.run!.activity.counts.heals).toBe(1);
  });
  it('upgraded mend heals 7 and still counts as one heal', () => {
    let s = fight();
    hand(s, ['mend']);
    s.run!.battle!.hand[0].upgraded = true;
    s.run!.hp = s.run!.maxHp - 10;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.hp).toBe(s.run!.maxHp - 3);
    expect(s.run!.activity.counts.heals).toBe(1);
    expect(cardText({ id: 'mend', upgraded: true })).toBe('回复 7 点生命。耗竭。');
  });
  it('drain needs HP damage and missing player HP', () => {
    let s = fight();
    hand(s, ['drain', 'drain']);
    s.run!.hp -= 20;
    s.run!.battle!.enemies[0].block = 100;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.heals ?? 0).toBe(0);
    s.run!.battle!.enemies[0].block = 0;
    s = reduceGame(s, { type: 'play', uid: 't1' });
    expect(s.run!.activity.counts.heals).toBe(1);
  });
  it('each category caps at 10 and each card series at 3 per battle', () => {
    let s = fight();
    hand(s, Array(12).fill('fireball'));
    for (let i = 0; i < 12; i++) s = reduceGame(s, { type: 'play', uid: `t${i}` });
    expect(s.run!.activity.counts.attacks).toBe(10);
    expect(s.run!.activity.counts.fire).toBe(10);
    expect(s.run!.activity.cards.fireball).toBe(3);
  });
  it('copies contribute category progress but not named card progress', () => {
    let s = fight();
    hand(s, ['fireball']);
    s.run!.battle!.hand[0].copied = true;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.attacks).toBe(1);
    expect(s.run!.activity.counts.copies).toBe(1);
    expect(s.run!.activity.cards.fireball).toBeUndefined();
  });
  it('evolved signature cards continue their original series', () => {
    let s = fight();
    hand(s, ['fireball', 'darkflame']);
    s = reduceGame(s, { type: 'play', uid: 't0' });
    s = reduceGame(s, { type: 'play', uid: 't1' });
    expect(s.run!.activity.cards.fireball).toBe(2);
    expect(s.run!.activity.cards.darkflame).toBeUndefined();
  });
  it('mark application and consumption require an actual effect', () => {
    let s = fight();
    hand(s, ['seal', 'talisman', 'seal']);
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.markBursts ?? 0).toBe(0);
    s = reduceGame(s, { type: 'play', uid: 't1' });
    s = reduceGame(s, { type: 'play', uid: 't2' });
    expect(s.run!.activity.counts.marks).toBe(1);
    expect(s.run!.activity.counts.markBursts).toBe(1);
  });
  it('runeShard cashes marks at four each and costs no energy', () => {
    let s = fight();
    hand(s, ['runeShard']);
    s.run!.battle!.enemies[0].mark = 5;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    const e = s.run!.battle!.enemies[0];
    expect(e.hp).toBe(999 - 23);
    expect(e.mark).toBe(0);
    expect(s.run!.activity.counts.markBursts).toBe(1);
    expect(CARDS.runeShard.cost).toBe(0);
  });
  it('sealBurst consumes each enemys own marks', () => {
    let s = fight();
    hand(s, ['sealBurst']);
    s.run!.battle!.enemies[0].mark = 4;
    s.run!.battle!.enemies.push({ ...s.run!.battle!.enemies[0], uid: 'other', mark: 2 });
    s = reduceGame(s, { type: 'play', uid: 't0' });
    const [a, b] = s.run!.battle!.enemies;
    expect(a.hp).toBe(999 - 26);
    expect(b.hp).toBe(999 - 16);
    expect(a.mark).toBe(0);
    expect(b.mark).toBe(0);
    expect(s.run!.activity.counts.markBursts).toBe(1);
  });
  it('two-skill turn counts once even when a third skill follows', () => {
    let s = fight();
    hand(s, ['guard', 'guard', 'guard']);
    for (let i = 0; i < 3; i++) s = reduceGame(s, { type: 'play', uid: `t${i}` });
    expect(s.run!.activity.counts.combos).toBe(1);
  });
  it('burn kills count once, both direct finishing blows and end-turn burn', () => {
    let s = fight();
    hand(s, ['strike']);
    const e = s.run!.battle!.enemies[0];
    e.hp = 3;
    e.burn = 2;
    s = reduceGame(s, { type: 'play', uid: 't0' });
    expect(s.run!.activity.counts.burnKills).toBe(1);
    expect(reduceGame(s, { type: 'endTurn' }).run!.activity.counts.burnKills).toBe(1);
    s = fight();
    s.run!.battle!.enemies[0].hp = 2;
    s.run!.battle!.enemies[0].burn = 3;
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.activity.counts.burnKills).toBe(1);
    expect(s.run!.reward!.gains).toContain('灼烧击杀 +1');
  });
  it('reload preserves battle caps, target and permanent data', () => {
    let s = fight();
    hand(s, ['fireball', 'darkflame']);
    s = reduceGame(s, { type: 'track', form: 'megidramon' });
    s = reduceGame(s, { type: 'play', uid: 't0' });
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded).toEqual(s);
    expect(reduceGame(loaded, { type: 'play', uid: 't1' })).toEqual(
      reduceGame(s, { type: 'play', uid: 't1' }),
    );
  });
});

describe('evolution conditions and branching', () => {
  it('clears a same-stage target when another branch is chosen but retains future targets', () => {
    let s = ready('growlmon');
    s = reduceGame(s, { type: 'track', form: 'blackgrowmon' });
    expect(
      reduceGame(s, { type: 'evolve', form: 'growlmon', replace: replacements(s) }).run!
        .evolutionTarget,
    ).toBeNull();
    s = reduceGame(s, { type: 'track', form: 'dukemon' });
    expect(
      reduceGame(s, { type: 'evolve', form: 'growlmon', replace: replacements(s) }).run!
        .evolutionTarget,
    ).toBe('dukemon');
  });
  it.each([
    'blackgrowmon',
    'youkomon',
    'blackwargrowlmon',
    'doumon',
    'megidramon',
    'kuzuhamon',
    'chaosdukemon',
  ])('blocks %s until every group is met', (form) => {
    let s = ready(form);
    const d = EVOLUTIONS[form];
    expect(evolutionStatus(s.run!, s.meta, form).ready).toBe(false);
    expect(reduceGame(s, { type: 'evolve', form, replace: replacements(s) })).toEqual(s);
    for (const group of d.groups)
      for (const t of group) {
        if (t.metric) s.run!.activity.counts[t.metric] = t.goal;
        else s.run!.activity.cards[t.card!] = t.goal;
      }
    if (form === 'chaosdukemon') s.meta.unlockedRoutes.push('chaos');
    expect(evolutionStatus(s.run!, s.meta, form).ready).toBe(true);
    s.run!.deck[0].upgraded = true;
    s = reduceGame(s, { type: 'evolve', form, replace: replacements(s) });
    expect(s.run!.form).toBe(form);
    expect(s.run!.deck).toHaveLength(10);
    expect(s.run!.deck[0].upgraded).toBe(d.stage === 3);
    expect(s.run!.deck.slice(0, 2).map((c) => c.id)).toEqual(d.cards);
  });
  it.each([['growlmon'], ['kyubimon'], ['sorcerymon'], ['galgomon'], ['matadormon']])(
    'evolving to %s grants un-upgraded new cards',
    (form) => {
      const s = ready(form);
      for (const group of EVOLUTIONS[form].groups)
        for (const t of group) if (t.metric) s.run!.activity.counts[t.metric] = t.goal;
      const uids = replacements(s);
      const after = reduceGame(s, { type: 'evolve', form, replace: uids }).run!;
      expect(after.deck.filter((c) => uids.includes(c.uid)).map((c) => c.upgraded)).toEqual([
        false,
        false,
      ]);
    },
  );
  it.each([
    ['growlmon', ['fireball', 'rock']],
    ['kyubimon', ['leaf', 'talisman']],
    ['sorcerymon', ['nightfire', 'taunt']],
  ])(
    'evolving to %s upgrades existing signature cards instead of the new ones',
    (form, signature) => {
      const s = ready(form);
      for (const group of EVOLUTIONS[form].groups)
        for (const t of group) if (t.metric) s.run!.activity.counts[t.metric] = t.goal;
      const uids = replacements(s);
      const after = reduceGame(s, { type: 'evolve', form, replace: uids }).run!;
      const kept = after.deck.filter((c) => !uids.includes(c.uid) && signature.includes(c.id));
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.every((c) => c.upgraded)).toBe(true);
    },
  );
  it('OR alternatives work without also requiring the other option', () => {
    const s = ready('megidramon');
    s.run!.activity.counts = { fire: 32, burnKills: 18 };
    expect(evolutionStatus(s.run!, s.meta, 'megidramon').ready).toBe(true);
  });
  it('stage and parent restrictions cannot be bypassed with enough counters', () => {
    const s = ready('blackgrowmon');
    s.run!.activity.counts = { attacks: 99, fire: 99, selfCosts: 99 };
    s.run!.row = 2;
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(false);
    s.run!.row = 3;
    s.run!.form = 'renamon';
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(false);
  });
  it('Doumon purification needs data and both behavior conditions', () => {
    const s = ready('sakuyamon');
    s.run!.form = 'doumon';
    expect(evolutionStatus(s.run!, s.meta, 'sakuyamon').ready).toBe(false);
    s.meta.unlockedRoutes = ['purification'];
    s.run!.activity.counts = { defenses: 12, markBursts: 5 };
    expect(evolutionStatus(s.run!, s.meta, 'sakuyamon').ready).toBe(true);
  });
  it('dark mature paths can return to the standard Ultimate path', () => {
    for (const [from, to] of [
      ['blackgrowmon', 'wargrowlmon'],
      ['youkomon', 'taomon'],
    ]) {
      const s = ready(to);
      s.run!.form = from;
      expect(evolutionStatus(s.run!, s.meta, to).ready).toBe(true);
    }
  });
  it('camp evolution consumes one camp and preserves replacement upgrades', () => {
    let s = ready('blackgrowmon');
    s.run!.row = 5;
    s.run!.currentNode = s.run!.nodes[5][0];
    s.run!.screen = 'camp';
    s.run!.activity.counts = { selfCosts: 3, attacks: 8 };
    s = reduceGame(s, { type: 'campEvolution' });
    expect(s.run!.evolutionReturn).toBe('camp');
    s = reduceGame(s, { type: 'evolve', form: 'blackgrowmon', replace: replacements(s) });
    expect(s.run!.form).toBe('blackgrowmon');
    expect(s.run!.row).toBe(6);
    expect(s.run!.screen).toBe('map');
  });
  it('blackgrowmon needs three self-costs plus either attacks or fire alone', () => {
    const s = ready('blackgrowmon');
    s.run!.activity.counts = { attacks: 8, fire: 3 };
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(false);
    s.run!.activity.counts = { selfCosts: 3, attacks: 8 };
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(true);
    s.run!.activity.counts = { selfCosts: 3, fire: 3 };
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(true);
    s.run!.activity.counts = { selfCosts: 2, attacks: 8, fire: 3 };
    expect(evolutionStatus(s.run!, s.meta, 'blackgrowmon').ready).toBe(false);
  });
  it('canceling camp evolution keeps the camp action available', () => {
    let s = ready('growlmon');
    s.run!.screen = 'camp';
    s = reduceGame(s, { type: 'campEvolution' });
    s = reduceGame(s, { type: 'deferEvolution' });
    expect(s.run!.screen).toBe('camp');
    expect(s.run!.row).toBe(3);
  });
  it('deferring a boss evolution still grants blessing and advances', () => {
    let s = ready('wargrowlmon');
    s = reduceGame(s, { type: 'deferEvolution' });
    expect(s.run!.screen).toBe('blessing');
    s = reduceGame(s, { type: 'bless', id: 'bond' });
    expect(s.run!.row).toBe(10);
  });
  it('conditional holy shield inheritance is recorded only when earned', () => {
    let s = ready('dukemon');
    s.run!.activity.counts.defenses = 12;
    s = reduceGame(s, { type: 'evolve', form: 'dukemon', replace: replacements(s) });
    expect(s.run!.bonuses).toContain('holyward');
    const low = ready('dukemon');
    expect(
      reduceGame(low, { type: 'evolve', form: 'dukemon', replace: replacements(low) }).run!.bonuses,
    ).toEqual([]);
  });
  it('new forms have valid signature definitions', () => {
    for (const d of Object.values(EVOLUTIONS)) {
      expect(d.cards).toHaveLength(2);
      for (const id of d.cards) expect(CARDS[id]).toBeDefined();
    }
  });
});

describe('cross-run unlocks and migration', () => {
  it('scans unlock permanent data once and new runs reset behavior only', () => {
    let s = start();
    s.meta.scans.devidramon = 100;
    expect(syncRouteData(s.meta)).toEqual(['chaos']);
    expect(syncRouteData(s.meta)).toEqual([]);
    s.run!.activity.counts.attacks = 20;
    s = reduceGame(s, { type: 'abandon' });
    s = reduceGame(s, { type: 'start', partner: 'renamon' });
    expect(s.meta.unlockedRoutes).toContain('chaos');
    expect(s.run!.activity.counts).toEqual({});
  });
  it('a second chapter safe event permanently unlocks purification', () => {
    let s = start('renamon');
    s.run!.row = 11;
    s.run!.screen = 'event';
    s = reduceGame(s, { type: 'event', choice: 'safe' });
    expect(s.meta.unlockedRoutes).toContain('purification');
    expect(s.run!.row).toBe(12);
  });
  it('migrates v1 during battle without changing HP, hand or random state', () => {
    const s = fight();
    const legacy = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    legacy.version = 1;
    const r = legacy.run as Record<string, unknown>;
    for (const k of [
      'activity',
      'victories',
      'bosses',
      'formHistory',
      'evolutionTarget',
      'evolutionReturn',
      'legacyEvolution',
      'bonuses',
    ])
      delete r[k];
    const migrated = parseSave(JSON.stringify(legacy));
    expect(migrated.version).toBe(3);
    expect(migrated.run!.rng).toBe(s.run!.rng);
    expect(migrated.run!.battle!.hand).toEqual(s.run!.battle!.hand);
    expect(migrated.run!.hp).toBe(s.run!.hp);
    expect(migrated.run!.activity.counts).toEqual({});
    expect(migrated.run!.nodes[0][0].next).toHaveLength(1);
  });
  it('old pending Mega saves retain old choices without opening the new chaos route', () => {
    const s = ready('megidramon');
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 1;
    const loaded = parseSave(JSON.stringify(raw));
    expect(loaded.run!.legacyEvolution).toBe(true);
    expect(
      reduceGame(loaded, { type: 'evolve', form: 'megidramon', replace: replacements(loaded) }).run!
        .form,
    ).toBe('megidramon');
    expect(
      reduceGame(loaded, { type: 'evolve', form: 'chaosdukemon', replace: replacements(loaded) }),
    ).toEqual(loaded);
  });
  it('rejects future versions and invalid counters', () => {
    const s = start();
    expect(() => parseSave(JSON.stringify({ ...s, version: 99 }))).toThrow();
    s.run!.activity.counts.attacks = -1;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
});
