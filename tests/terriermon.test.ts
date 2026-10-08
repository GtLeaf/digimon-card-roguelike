import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { CARDS, cardText } from '../src/game/data';
import { cardPool, skillUnlocked } from '../src/game/cardSkills';
import { emptySave, makeRun, reduceGame, cardCost, intent, previewAction } from '../src/game/engine';
import { EVOLUTIONS, evolutionStatus, syncRouteData } from '../src/game/evolution';
import { availableNodes } from '../src/game/map';
import { parseSave } from '../src/game/storage';
import type { Save, Action, Branch } from '../src/game/types';

function start() {
  return reduceGame(reduceGame(emptySave(), { type: 'start', partner: 'terriermon', seed: 42 }), {
    type: 'bless',
    id: 'guard',
  });
}
function fight(form = 'terriermon') {
  let s = start();
  s.run!.form = form;
  s.run!.stage = EVOLUTIONS[form].stage;
  s.run!.branch = EVOLUTIONS[form].branch ?? null;
  s = reduceGame(s, { type: 'node', id: s.run!.nodes[0][0].id });
  s.run!.battle!.enemies[0].hp = 999;
  s.run!.battle!.enemies[0].maxHp = 999;
  return s;
}
function hand(s: Save, ids: string[]) {
  s.run!.battle!.energy = 100;
  s.run!.battle!.hand = ids.map((id, i) => ({ id, uid: `t${i}`, upgraded: false }));
}
function play(s: Save, i: number) {
  return reduceGame(s, { type: 'play', uid: `t${i}` });
}
function ready(parent: string) {
  const s = start(),
    r = s.run!;
  r.form = parent;
  r.stage = EVOLUTIONS[parent].stage;
  r.formHistory = ['terriermon', parent];
  r.row = 29;
  r.bosses = 3;
  r.victories = 10;
  r.screen = 'evolution';
  return s;
}

describe('Terriermon starter and assets', () => {
  it('starts with ten legal cards and guaranteed charge / cannon access', () => {
    const r = makeRun('terriermon', 42);
    expect(r.deck).toHaveLength(10);
    expect(r.deck.map((c) => c.id)).toEqual(
      expect.arrayContaining(['charge', 'cannon', 'tinyTwister', 'blazingShot']),
    );
    expect(r.deck.every((c) => skillUnlocked(r, CARDS[c.id]))).toBe(true);
    expect(cardPool(r)).not.toContain('gatling');
    expect(cardPool(r)).not.toContain('blackReload');
    expect(r.inherit).toBe('ward');
  });
  it('every form has its own usable image and all animated sheets exist', () => {
    const sprites = JSON.parse(readFileSync('src/game/sprites.json', 'utf8')) as Record<
      string,
      { frames: number }
    >;
    for (const form of Object.values(EVOLUTIONS).filter((d) => d.partner === 'terriermon')) {
      if (form.id === 'blackgalgomon') {
        expect(existsSync(`public/portraits/${form.id}.jpg`)).toBe(true);
      } else {
        expect(sprites[form.id].frames).toBeGreaterThan(0);
        expect(existsSync(`public/sprites/${form.id}.png`)).toBe(true);
        expect(existsSync(`public/sprites/${form.id}-sheet.png`)).toBe(true);
      }
    }
  });
  it('cross-route inheritance retains visited skills without unlocking the other side', () => {
    const r = makeRun('terriermon', 42);
    r.form = 'rapidmon';
    r.formHistory = ['terriermon', 'blackgalgomon', 'rapidmon'];
    expect(cardPool(r)).toContain('blackGatling');
    expect(cardPool(r)).toContain('rapidFire');
    expect(cardPool(r)).not.toContain('gatling');
    expect(cardPool(r)).not.toContain('blackReload');
  });
});

describe('charge and multihit combat rules', () => {
  it('counts paid charge and nonempty cannon use, once per card', () => {
    let s = fight();
    hand(s, ['cannon', 'charge', 'blazingShot', 'cannon']);
    s = play(s, 0);
    expect(s.run!.activity.counts.cannonShots ?? 0).toBe(0);
    s = play(s, 1);
    expect(s.run!.activity.counts.charges).toBe(1);
    const hp = s.run!.battle!.enemies[0].hp;
    s = play(s, 2);
    expect(hp - s.run!.battle!.enemies[0].hp).toBe(10);
    expect(s.run!.battle!.charge).toBe(1);
    s = play(s, 3);
    expect(s.run!.activity.counts.cannonShots).toBe(1);
    expect(s.run!.battle!.charge).toBe(0);
  });
  it('caps both new metrics per battle and keeps copy progress separate from series', () => {
    let s = fight();
    hand(s, Array.from({ length: 12 }, () => ['charge', 'cannon']).flat());
    s.run!.battle!.hand[0].copied = true;
    for (let i = 0; i < 24; i++) s = play(s, i);
    expect(s.run!.activity.counts.charges).toBe(10);
    expect(s.run!.activity.counts.cannonShots).toBe(10);
    expect(s.run!.activity.cards.charge).toBe(3);
  });
  it.each(['galgomon', 'rapidmon', 'saintgalgomon'])(
    '%s triggers once on the second attack card, not the second hit',
    (form) => {
      let s = fight(form);
      hand(s, ['gatling', 'gatling', 'gatling']);
      const draw = s.run!.battle!.draw.length;
      s = play(s, 0);
      expect(s.run!.battle!.charge).toBe(0);
      expect(s.run!.battle!.draw.length).toBe(draw);
      s = play(s, 1);
      const charges = form === 'rapidmon' ? 0 : 1;
      expect(s.run!.battle!.charge).toBe(charges);
      expect(s.run!.activity.counts.charges ?? 0).toBe(0);
      if (form !== 'galgomon') expect(s.run!.battle!.draw.length).toBe(draw - 1);
      s = play(s, 2);
      expect(s.run!.battle!.charge).toBe(charges);
      expect(s.run!.activity.counts.attacks).toBe(3);
    },
  );
  it('tactical bonus is two damage total and does not apply to the shield attack itself', () => {
    let s = fight('blackgalgomon');
    hand(s, ['blackGatling', 'gatling']);
    s = play(s, 0);
    expect(s.run!.battle!.enemies[0].hp).toBe(989);
    expect(s.run!.battle!.nextAttackBonus).toBe(2);
    s = play(s, 1);
    expect(s.run!.battle!.enemies[0].hp).toBe(975);
    expect(s.run!.battle!.nextAttackBonus).toBe(0);
  });
  it('armor passives do not count as active charge and cannon guard triggers once per turn', () => {
    let s = fight('blacksaintgalgomon');
    hand(s, ['guard', 'charge', 'cannon', 'charge', 'cannon']);
    s = play(s, 0);
    expect(s.run!.battle!.charge).toBe(1);
    expect(s.run!.activity.counts.charges ?? 0).toBe(0);
    s = play(s, 1);
    const block = s.run!.battle!.block;
    s = play(s, 2);
    expect(s.run!.battle!.block).toBe(block + 6);
    s = play(s, 3);
    s = play(s, 4);
    expect(s.run!.battle!.block).toBe(block + 10);
    expect(s.run!.activity.counts.cannonShots).toBe(2);
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!.cannonGuardUsed).toBe(false);
    expect(s.run!.battle!.attackPlays).toBe(0);
  });
  it('heavy cannon uses its multiplier and exhausts; upgraded multihit text agrees with damage', () => {
    let s = fight();
    hand(s, ['heavySalvo']);
    s.run!.battle!.charge = 3;
    s = play(s, 0);
    expect(s.run!.battle!.enemies[0].hp).toBe(972);
    expect(s.run!.battle!.exhaust[0].id).toBe('heavySalvo');
    s = fight();
    hand(s, ['gatling']);
    s.run!.battle!.hand[0].upgraded = true;
    s = play(s, 0);
    expect(s.run!.battle!.enemies[0].hp).toBe(987);
    expect(cardText({ id: 'gatling', upgraded: true })).toContain('4×3');
  });
  describe('巨型导弹散射', () => {
    function scatterFight(charge = 0, upgraded = false) {
      const s = fight('saintgalgomon');
      s.run!.training = 'defense'; // 排除训练加成，保证每段恰好 6/7
      const b = s.run!.battle!;
      b.hand = [{ id: 'giantMissile', uid: 't0', upgraded }];
      b.energy = 10;
      b.charge = charge;
      b.enemies = ['e1', 'e2', 'e3'].map((uid) => ({
        uid,
        id: 'gotsumon',
        hp: 40,
        maxHp: 40,
        block: 0,
        burn: 0,
        mark: 0,
        strength: 0,
        weakened: 0,
        opening: false,
        stagger: 0,
      }));
      return s;
    }
    const losses = (s: Save) =>
      ['e1', 'e2', 'e3'].map(
        (uid) => 40 - s.run!.battle!.enemies.find((e) => e.uid === uid)!.hp,
      );
    it('first segment locks the target, the rest scatter among alive enemies', () => {
      const s = play(scatterFight(), 0);
      const l = losses(s);
      expect(l.reduce((a, c) => a + c, 0)).toBe(18); // 3 段 × 6
      for (const x of l) expect(x % 6).toBe(0);
      expect(l[0]).toBeGreaterThanOrEqual(6); // 首段必中锁定目标（其余段允许再中）
      expect(l[0]).toBeLessThanOrEqual(18);
    });
    it('each charge layer adds 1 damage per segment and is spent', () => {
      const s = play(scatterFight(2), 0);
      const l = losses(s);
      expect(l.reduce((a, c) => a + c, 0)).toBe(24); // 3 段 × (6+2)
      for (const x of l) expect(x % 8).toBe(0);
      expect(s.run!.battle!.charge).toBe(0);
    });
    it('spends only the layers it needs and upgraded raises each segment to 7', () => {
      const s = play(scatterFight(1), 0);
      const l = losses(s);
      expect(l.reduce((a, c) => a + c, 0)).toBe(21); // 3 段 × (6+1)
      expect(s.run!.battle!.charge).toBe(0);
      const up = play(scatterFight(0, true), 0);
      const lu = losses(up);
      expect(lu.reduce((a, c) => a + c, 0)).toBe(21); // 强化每段 +1
      for (const x of lu) expect(x % 7).toBe(0);
    });
    it('never targets corpses and never drops hp below zero', () => {
      const s = scatterFight();
      // 只剩 e2 存活且生命 5：三段全部（含锁定的首段）打向 e2，
      // 伤害被生命上限截断，尸体 e1/e3 不会被随机索敌命中。
      s.run!.battle!.enemies[0].hp = 0;
      s.run!.battle!.enemies[2].hp = 0;
      s.run!.battle!.enemies[1].hp = 5;
      const dealt = s.run!.damageDealt;
      const after = play(s, 0);
      const es = after.run!.battle!.enemies;
      expect(es[0].hp).toBe(0);
      expect(es[2].hp).toBe(0);
      expect(es[1].hp).toBe(0); // 不倒扣、不为负
      expect(after.run!.damageDealt - dealt).toBe(5);
    });
    it('emits one feedback event per segment for independent hit animations', () => {
      const fb = previewAction(scatterFight(), { type: 'play', uid: 't0' }).filter(
        (f) => f.kind === 'damage',
      );
      expect(fb).toHaveLength(3); // 每段一条，前端按段播放动画
      expect(fb[0].target).toBe('e1'); // 首段命中锁定目标
    });
    it('burst shot grants 1 charge for the salvo engine', () => {
      const s = fight('saintgalgomon');
      s.run!.training = 'defense';
      hand(s, ['burstShot']);
      const after = play(s, 0);
      expect(after.run!.battle!.charge).toBe(1);
      expect(after.run!.battle!.enemies[0].hp).toBe(991); // 4×2 段
    });
  });
  it('charge persists across turns and resets in the next battle', () => {
    let s = fight();
    hand(s, ['charge']);
    s = play(s, 0);
    s = reduceGame(s, { type: 'endTurn' });
    expect(s.run!.battle!.charge).toBe(1);
    s.run!.battle!.enemies[0].hp = 1;
    s.run!.battle!.enemies[0].block = 0;
    hand(s, ['strike']);

    s = play(s, 0);
    expect(s.run!.screen).toBe('reward');
    s = reduceGame(s, { type: 'reward' });
    s = reduceGame(s, { type: 'node', id: s.run!.nodes[1][0].id });
    expect(s.run!.battle!.charge).toBe(0);
  });
});

describe('black-line suppression theme', () => {
  it('suppressBarrage hits the whole field and primes the blackgalgomon weaken bonus', () => {
    let s = fight('blackgalgomon');
    s.run!.battle!.enemies.push({ ...s.run!.battle!.enemies[0], uid: 'second' });
    hand(s, ['suppressBarrage', 'suppressBarrage']);
    s = play(s, 0);
    expect(s.run!.battle!.enemies.map((e) => e.hp)).toEqual([993, 993]);
    expect(s.run!.battle!.enemies.map((e) => e.weakened)).toEqual([1, 1]);
    expect(s.run!.activity.counts.weakens).toBe(1);
    s = play(s, 1);
    expect(s.run!.battle!.enemies.map((e) => e.hp)).toEqual([986, 986]);
  });
  it('gravityField shields and feeds blackrapidmon one charge per turn on first weaken', () => {
    let s = fight('blackrapidmon');
    s.run!.battle!.enemies.push({ ...s.run!.battle!.enemies[0], uid: 'second' });
    hand(s, ['gravityField', 'suppressBarrage']);
    s = play(s, 0);
    expect(s.run!.battle!.block).toBe(12);
    expect(s.run!.battle!.charge).toBe(2);
    s = play(s, 1);
    expect(s.run!.battle!.charge).toBe(2);
    expect(s.run!.battle!.enemies.every((e) => e.weakened > 0)).toBe(true);
  });
  it('zoneSuppress spends charge into a weakened AoE and counts as a cannon shot', () => {
    const s = fight('blacksaintgalgomon');
    s.run!.battle!.enemies.push({ ...s.run!.battle!.enemies[0], uid: 'second' });
    s.run!.battle!.charge = 3;
    hand(s, ['zoneSuppress']);
    const next = play(s, 0);
    expect(next.run!.battle!.enemies.map((e) => e.hp)).toEqual([981, 981]);
    expect(next.run!.battle!.enemies.map((e) => e.weakened)).toEqual([1, 1]);
    expect(next.run!.battle!.charge).toBe(0);
    expect(next.run!.activity.counts.cannonShots).toBe(1);
  });
  it('suppression cards enter the pool only after visiting their forms', () => {
    const r = makeRun('terriermon', 42);
    const pool = cardPool(r);
    expect(pool).not.toContain('suppressBarrage');
    expect(pool).not.toContain('gravityField');
    expect(pool).not.toContain('zoneSuppress');
    r.formHistory = ['terriermon', 'blackgalgomon'];
    r.form = 'blackrapidmon';
    expect(cardPool(r)).toContain('suppressBarrage');
    expect(cardPool(r)).toContain('gravityField');
    r.formHistory.push('blackrapidmon');
    r.form = 'blacksaintgalgomon';
    expect(cardPool(r)).toContain('zoneSuppress');
  });
});

describe('branch gates, research and saves', () => {
  it.each(['blackgalgomon', 'blackrapidmon', 'blacksaintgalgomon'])(
    '%s enforces every behavior gate',
    (form) => {
      const d = EVOLUTIONS[form];
      const s = ready(d.parents[0]);
      expect(evolutionStatus(s.run, s.meta, form).ready).toBe(false);
      for (const group of d.groups) {
        const term = group[0];
        s.run!.activity.counts[term.metric!] = term.goal;
      }
      expect(evolutionStatus(s.run, s.meta, form).ready).toBe(true);
    },
  );
  it('requires permanent research only for Galgomon to BlackRapidmon', () => {
    const s = ready('galgomon');
    s.run!.activity.counts = { charges: 20, weakens: 10 };
    const action: Action = {
      type: 'evolve',
      form: 'blackrapidmon',
      replace: s.run!.deck.slice(0, 2).map((c) => c.uid),
    };
    expect(reduceGame(s, action)).toEqual(s);
    s.meta.scans.andromon = 100;
    expect(syncRouteData(s.meta)).toEqual(['mechanical']);
    expect(reduceGame(s, action).run!.form).toBe('blackrapidmon');
    s.meta.unlockedRoutes = [];
    s.run!.form = 'blackgalgomon';
    expect(reduceGame(s, action).run!.form).toBe('blackrapidmon');
  });
  it('always leaves a stage-appropriate standard exit', () => {
    for (const [parent, child] of [
      ['blackgalgomon', 'rapidmon'],
      ['blackrapidmon', 'saintgalgomon'],
    ]) {
      const s = ready(parent);
      expect(evolutionStatus(s.run, s.meta, child).ready).toBe(true);
    }
  });
  it('chapter two safe event unlocks research permanently; restarting clears behavior', () => {
    let s = start();
    s.run!.screen = 'event';
    s.run!.row = 11;
    s.run!.currentNode = {
      id: 'n11-2',
      row: 11,
      lane: 2,
      kind: 'event',
      label: '失控机械档案',
      enemies: [],
      next: [],
      eventId: 'research',
    };
    s = reduceGame(s, { type: 'event', choice: 'safe' });
    expect(s.meta.unlockedRoutes).toContain('mechanical');
    s.run!.activity.counts.charges = 5;
    s = reduceGame(s, { type: 'abandon' });
    s = reduceGame(s, { type: 'start', partner: 'terriermon', seed: 42 });
    expect(s.meta.unlockedRoutes).toContain('mechanical');
    expect(s.run!.activity.counts).toEqual({});
  });
  it('new battle state round trips and old saves default only the new fields', () => {
    let s = fight('blacksaintgalgomon');
    hand(s, ['charge', 'cannon']);
    s = play(s, 0);
    s = play(s, 1);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    const old = reduceGame(
      reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 42 }),
      { type: 'bless', id: 'guard' },
    );
    const battle = reduceGame(old, { type: 'node', id: old.run!.nodes[0][0].id });
    const raw = JSON.parse(JSON.stringify(battle)) as { run: { battle: Record<string, unknown> } };
    delete raw.run.battle.attackPlays;
    delete raw.run.battle.nextAttackBonus;
    delete raw.run.battle.cannonGuardUsed;
    const loaded = parseSave(JSON.stringify(raw));
    expect(loaded).toEqual(battle);
    expect(loaded.run!.partner).toBe('guilmon');
  });
});

// 完整路线只通过真实游戏操作推进，不修改牌堆、生命、进度或行为计数。
function journey(branch: Branch) {
  let s = start(),
    steps = 0;
  const dark = branch === 'blacksaint';
  const forms = dark
    ? ['blackgalgomon', 'blackrapidmon', 'blacksaintgalgomon']
    : ['galgomon', 'rapidmon', 'saintgalgomon'];
  while (s.run!.screen !== 'result' && steps++ < 2000) {
    const r = s.run!;
    let action: Action;
    switch (r.screen) {
      case 'map': {
        const options = availableNodes(r);
        const node =
          options.find((n) => n.kind === 'battle') ??
          options.find((n) => n.kind === 'camp') ??
          options.find((n) => n.kind === 'treasure') ??
          options[0];
        action = { type: 'node', id: node.id };
        break;
      }
      case 'battle': {
        const b = r.battle!,
          alive = b.enemies.filter((e) => e.hp > 0),
          // 多场战斗先清低血小怪减少承伤，单体 Boss 战则集火本体。
          target =
            alive.length >= 3 ? alive.sort((a, b2) => a.hp - b2.hp)[0] : alive[0];
        const incoming = b.enemies
          .filter((e) => e.hp > 0)
          .reduce((n, e) => {
            const i = intent(r, e);
            return n + i.damage * i.hits;
          }, 0);
        // 药水留给致命威胁或濒死时刻，模拟真实玩家为 boss 战存药。
        if (
          r.potions &&
          r.hp <= r.maxHp - 18 &&
          (incoming >= r.hp || r.hp <= r.maxHp * 0.25)
        ) {
          action = { type: 'potion' };
          break;
        }
        if (!b.supportUsed) {
          action = { type: 'support' };
          break;
        }
        if (r.branch && b.sync >= 6 && !b.burstUsed) {
          action = { type: 'burst' };
          break;
        }
        const score = (id: string, upgraded: boolean) => {
          const d = CARDS[id],
            up = upgraded ? 3 : 0;
          let damage =
            (d.damage ? (d.damage + (upgraded ? (d.upgradeDamage ?? 3) : 0)) * (d.hits ?? 1) : 0) +
            (d.special === 'cannon' ? b.charge * (d.chargeMultiplier ?? 4) : 0);
          if (d.all) damage *= b.enemies.filter((e) => e.hp > 0).length;
          let score =
            damage +
            (d.draw ?? 0) * 3 +
            (d.energy ?? 0) * 12 +
            (d.heal ?? 0) * 2 +
            (d.weak ?? 0) * 3;
          if (d.shield) score += Math.min(d.shield + up, Math.max(0, incoming - b.block)) * 2;
          if (d.charge) score += d.charge * 4;
          if (dark && (r.activity.counts.defenses ?? 0) < (r.stage === 0 ? 14 : 58) && d.shield)
            score += 8;
          if (dark && (r.activity.counts.charges ?? 0) < 20 && d.charge) score += 10;
          if (dark && (r.activity.counts.weakens ?? 0) < 10 && d.weak) score += 20;
          if (
            dark &&
            r.stage === 0 &&
            (r.activity.counts.attacks ?? 0) < 20 &&
            d.special === 'cannon'
          )
            score -= 25;
          // Boss 拖局惩罚意识：狂暴叠满后进入纯竞速，与全旅程回归 bot 一致。
          if (r.currentNode?.kind === 'boss' && b.turn >= 8 && damage) score *= 1.6;
          if (r.currentNode?.kind === 'boss' && b.turn >= 11) {
            if (damage) score *= 1.4;
            if (d.shield) score *= 0.5;
          }
          return score / Math.max(0.5, cardCost({ id, upgraded, uid: '' }));
        };
        const c = b.hand
          .filter((c) => cardCost(c) <= b.energy)
          .sort((a, b) => score(b.id, b.upgraded) - score(a.id, a.upgraded))[0];
        action = c ? { type: 'play', uid: c.uid, target: target.uid } : { type: 'endTurn' };
        break;
      }
      case 'reward': {
        const order = dark
          ? [
              'blackReload',
              'suppressBarrage',
              'fortressLoad',
              'gravityField',
              'zoneSuppress',
              'blackMissile',
              'brace',
              'fortify',
              'mend',
              'ambushUpper',
              'charge',
            ]
          : ['rapidFire', 'gatling', 'dumUpper', 'brace', 'mend', 'battery', 'blazingShot'];
        action = {
          type: 'reward',
          card: r.deck.length < 16 ? order.find((id) => r.reward!.cards.includes(id)) : undefined,
        };
        break;
      }
      case 'camp':
        if (evolutionStatus(r, s.meta, forms[r.stage] ?? r.form).ready) {
          action = { type: 'campEvolution' };
          break;
        }
        action =
          r.hp < r.maxHp * 0.85
            ? { type: 'camp', mode: 'heal' }
            : {
                type: 'camp',
                mode: 'upgrade',
                uid:
                  r.deck.find((c) => !c.upgraded && CARDS[c.id].family === 'terriermon')?.uid ??
                  r.deck.find((c) => !c.upgraded)?.uid,
              };
        if (action.type === 'camp' && action.mode === 'upgrade' && !action.uid)
          action = { type: 'camp', mode: 'heal' };
        break;
      case 'evolution': {
        const form = forms[r.stage] ?? r.form;
        const uids = [...r.deck]
          .sort((a, b) => {
            const priority = (id: string) =>
              id === 'strike' ? 0 : CARDS[id].family === 'terriermon' ? 1 : id === 'guard' ? 2 : 3;
            return priority(a.id) - priority(b.id);
          })
          .slice(0, 2)
          .map((c) => c.uid);
        action = evolutionStatus(r, s.meta, form).ready
          ? { type: 'evolve', form, replace: uids, training: 'defense', inherit: 'ward' }
          : { type: 'deferEvolution' };
        break;
      }
      case 'event':
        action = { type: 'event', choice: 'safe' };
        break;
      case 'shop':
        // 加权抽样后通用治疗牌变稀有，药水补给优先级上调，模拟真人的续航意识。
        action =
          r.potions < 2 && r.gold >= 30 && !r.shopBought.includes('potion')
            ? { type: 'buy', id: 'potion' }
            : { type: 'continue' };
        break;
      case 'treasure':
        action = { type: 'continue' };
        break;
      case 'blessing':
        action = { type: 'bless', id: 'guard' };
        break;
      case 'rest':
        action = { type: 'rest' };
        break;
      default:
        throw Error(`Unexpected screen: ${r.screen}`);
    }
    s = reduceGame(s, action);
    if (
      s.run!.screen === 'reward' &&
      (s.meta.scans.hagurumon ?? 0) >= 100 &&
      !s.meta.partners.includes('hagurumon')
    ) {
      s = reduceGame(s, { type: 'convert', id: 'hagurumon' });
      s = reduceGame(s, { type: 'equip', id: 'hagurumon' });
    }
    if (steps % 13 === 0) s = parseSave(JSON.stringify(s));
  }
  return { s, steps };
}
describe('Terriermon full journeys', () => {
  it.each(['saint', 'blacksaint'] as Branch[])(
    'finishes all chapters on the %s route with real actions',
    (branch) => {
      const { s, steps } = journey(branch);
      const context = JSON.stringify({
        row: s.run!.row,
        form: s.run!.form,
        hp: s.run!.hp,
        counts: s.run!.activity.counts,
        screen: s.run!.screen,
        log: s.run!.battle?.log?.slice(-25),
        foes: s.run!.battle?.enemies?.map((e) => `${e.id}:${e.hp}`),
        deck: s.run!.deck.map((c) => c.id + (c.upgraded ? '+' : '')),
      });
      expect(steps, context).toBeLessThan(2000);
      expect(s.run!.won, context).toBe(true);
      expect(s.run!.branch, context).toBe(branch);
      expect(s.run!.formHistory).toEqual(
        branch === 'saint'
          ? ['terriermon', 'galgomon', 'rapidmon', 'saintgalgomon']
          : ['terriermon', 'blackgalgomon', 'blackrapidmon', 'blacksaintgalgomon'],
      );
    },
  );
});
