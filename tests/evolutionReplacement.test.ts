import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { EVOLUTIONS } from '../src/game/evolution';

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

describe('进化直接赠牌与自动强化', () => {
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
  it('九尾狐兽自动强化所有招牌拷贝，不增牌、不改变 UID 或顺序', () => {
    const save = ready('kyubimon');
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'kyubimon' }).run!;
    expect(after.form).toBe('kyubimon');
    expect(after.deck).toEqual(
      before.map((c) => (['leaf', 'talisman'].includes(c.id) ? { ...c, upgraded: true } : c)),
    );
    expect(after.spotlight).toEqual([]);
  });
  it('已经移除的招牌牌不补发，已强化的招牌牌不重复强化或赠送', () => {
    const save = ready('kyubimon');
    save.run!.deck = save.run!.deck.filter((c) => c.id !== 'leaf');
    save.run!.deck.forEach((c) => {
      if (c.id === 'talisman') c.upgraded = true;
    });
    const before = structuredClone(save.run!.deck);
    expect(reduceGame(save, { type: 'evolve', form: 'kyubimon' }).run!.deck).toEqual(before);
  });
  it('巫师兽强化已有招牌牌，同时赠送不同的新招式', () => {
    const save = ready('sorcerymon');
    const before = structuredClone(save.run!.deck);
    const after = reduceGame(save, { type: 'evolve', form: 'sorcerymon' }).run!;
    expect(after.deck.slice(0, before.length)).toEqual(
      before.map((c) => (['nightfire', 'taunt'].includes(c.id) ? { ...c, upgraded: true } : c)),
    );
    expect(after.deck.slice(before.length).map((c) => c.id)).toEqual([
      'frostSorcery',
      'magicShield',
    ]);
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
