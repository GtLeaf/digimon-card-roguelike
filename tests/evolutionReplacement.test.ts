import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { EVOLUTIONS, evolutionCardGains } from '../src/game/evolution';
import { CARDS } from '../src/game/data';
import { skillForms } from '../src/game/cardSkills';
import { parseSave } from '../src/game/storage';
import { makeCard } from '../src/game/random';

function ready(form: string) {
  const d = EVOLUTIONS[form];
  const base = emptySave();
  if (d.partner === 'impmon') base.meta.scans.beelzebumon = 100;
  const save = reduceGame(base, { type: 'start', partner: d.partner, seed: 42 });
  Object.assign(save.run!, {
    screen: 'evolution',
    form: d.parents[0],
    stage: d.stage - 1,
    row: 29,
    bosses: 3,
    victories: 6,
  });
  save.run!.activity.counts = { selfCosts: 6, heals: 4 };
  save.meta.unlockedRoutes = ['chaos'];
  return save;
}

describe('进化固定两个奖励名额', () => {
  it.each(['wargrowlmon', 'chaosdukemon'])(
    '%s 无需指定旧牌，保留所有旧卡并赠送未强化新卡',
    (form) => {
      const save = ready(form);
      save.run!.deck[0].upgraded = true;
      const before = structuredClone(save.run!.deck);
      const after = reduceGame(save, {
        type: 'evolve',
        form,
        training: 'defense',
        inherit: 'ward',
      }).run!;
      expect(after.form).toBe(form);
      expect(after.deck.slice(0, before.length)).toEqual(before);
      const added = after.deck.slice(before.length);
      expect(added.map((c) => c.id)).toEqual(EVOLUTIONS[form].cards);
      expect(added.every((c) => !c.upgraded)).toBe(true);
      expect(new Set(after.deck.map((c) => c.uid)).size).toBe(after.deck.length);
      expect(after.spotlight).toEqual(added.map((c) => c.uid));
      expect(after.training).toBe('defense');
      expect(after.inherit).toBe('ward');
      expect(reduceGame({ ...save, run: after }, { type: 'evolve', form }).run!.deck).toEqual(
        after.deck,
      );
    },
  );
  it('忽略旧客户端传入的替换字段，不消耗对应旧牌', () => {
    const save = ready('wargrowlmon');
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, {
      type: 'evolve',
      form: 'wargrowlmon',
      replace: [before[0].uid, before[0].uid, 'missing'],
    }).run!;
    expect(after.form).toBe('wargrowlmon');
    expect(after.deck.slice(0, before.length)).toEqual(before);
    expect(after.deck).toHaveLength(before.length + 2);
  });
  it('九尾狐兽每种招牌只强化一张，保留其他同名拷贝和顺序', () => {
    const save = ready('kyubimon');
    save.run!.deck.push(makeCard(save.run!, 'leaf'), makeCard(save.run!, 'talisman'));
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'kyubimon' }).run!;
    expect(after.form).toBe('kyubimon');
    expect(after.deck).toEqual(
      before.map((c, index) =>
        [
          before.findIndex((card) => card.id === 'leaf'),
          before.findIndex((card) => card.id === 'talisman'),
        ].includes(index)
          ? { ...c, upgraded: true }
          : c,
      ),
    );
    expect(after.spotlight).toEqual([]);
  });
  it('已经移除和全部强化的旧招式改送两张新形态卡，不补发旧卡', () => {
    const save = ready('kyubimon');
    save.run!.deck = save.run!.deck.filter((c) => c.id !== 'leaf');
    save.run!.deck.forEach((c) => {
      if (c.id === 'talisman') c.upgraded = true;
    });
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'kyubimon' }).run!;
    expect(after.deck.slice(0, before.length)).toEqual(before);
    expect(after.deck.slice(before.length).map((card) => card.id)).toEqual(['spirit', 'cyclone']);
    expect(after.spotlight).toEqual(after.deck.slice(before.length).map((card) => card.uid));
  });
  it('巫师兽只赠送两张新形态卡，不额外强化旧招式', () => {
    const save = ready('sorcerymon');
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'sorcerymon' }).run!;
    expect(after.deck.slice(0, before.length)).toEqual(before);
    expect(after.deck.slice(before.length).map((c) => c.id)).toEqual([
      'frostSorcery',
      'magicShield',
    ]);
  });
  it('古拉兽强化一张未强化火球并赠送双刃斩，不增加重复火球', () => {
    const save = ready('growlmon');
    save.run!.deck.find((card) => card.id === 'fireball')!.upgraded = true;
    const first = makeCard(save.run!, 'fireball');
    const second = makeCard(save.run!, 'fireball');
    save.run!.deck.push(first, second);
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'growlmon' }).run!;
    expect(after.deck.slice(0, before.length)).toEqual(
      before.map((card) => (card.uid === first.uid ? { ...card, upgraded: true } : card)),
    );
    expect(after.deck.slice(before.length).map((card) => card.id)).toEqual(['doublecut']);
    expect(after.deck.filter((card) => card.id === 'fireball')).toHaveLength(3);
    expect(after.deck.find((card) => card.uid === second.uid)!.upgraded).toBe(false);
    expect(after.spotlight).toEqual([after.deck.at(-1)!.uid]);
    expect(after.rng).toBe(save.run!.rng);
    expect(parseSave(JSON.stringify({ ...save, run: after })).run!.deck).toEqual(after.deck);
  });
  it('只缺少一个旧招式时，一张补为新卡、另一张照常强化', () => {
    const save = ready('kyubimon');
    save.run!.deck = save.run!.deck.filter((card) => card.id !== 'leaf');
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'kyubimon' }).run!;
    expect(after.deck.slice(before.length).map((card) => card.id)).toEqual(['spirit']);
    expect(after.deck.find((card) => card.id === 'talisman')!.upgraded).toBe(true);
    expect(after.deck.map((card) => card.id)).not.toContain('leaf');
  });
  it('所有形态在旧卡缺失或全部强化时都有两个合法的新形态奖励，预览不改变进度', () => {
    for (const d of Object.values(EVOLUTIONS).filter((form) => form.stage > 0)) {
      for (const mode of ['missing', 'upgraded']) {
        const run = ready(d.id).run!;
        if (mode === 'missing') run.deck = [];
        else
          run.deck.forEach((card) => {
            card.upgraded = true;
          });
        const before = structuredClone(run);
        const gains = evolutionCardGains(run, d.id);
        expect(gains.upgradeUids, d.id).toEqual([]);
        expect(gains.newIds, d.id).toHaveLength(2);
        expect(new Set(gains.newIds).size, d.id).toBe(2);
        for (const id of gains.newIds) expect(skillForms(CARDS[id]), d.id).toContain(d.id);
        expect(evolutionCardGains(run, d.id)).toEqual(gains);
        expect(run).toEqual(before);
      }
    }
  });
  it('黑大古拉兽的新赠牌不替换旧存档中过载和汲取卡', () => {
    const save = ready('blackwargrowlmon');
    save.run!.activity.counts.attacks = 48;
    save.run!.deck.push(makeCard(save.run!, 'sacrifice', true), makeCard(save.run!, 'drain'));
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'blackwargrowlmon' }).run!;
    expect(after.form).toBe('blackwargrowlmon');
    expect(after.deck.slice(0, before.length)).toEqual(before);
    expect(after.deck.slice(before.length).map((card) => card.id)).toEqual([
      'darkOverload',
      'darkDrain',
    ]);
    expect(parseSave(JSON.stringify({ ...save, run: after })).run!.deck).toEqual(after.deck);
  });
  it('连续进化保留尚未进入战斗的新卡优先抽取记录', () => {
    const save = ready('wargrowlmon');
    save.run!.spotlight = [save.run!.deck[0].uid];
    const after = reduceGame(save, { type: 'evolve', form: 'wargrowlmon' }).run!;
    expect(after.spotlight).toEqual([
      save.run!.deck[0].uid,
      ...after.deck.slice(-2).map((c) => c.uid),
    ]);
  });
});
