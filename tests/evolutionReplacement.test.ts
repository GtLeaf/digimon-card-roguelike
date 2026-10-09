import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { EVOLUTIONS } from '../src/game/evolution';

describe('进化固定槽位与强化配对',()=>{
 it.each(['wargrowlmon','chaosdukemon'])('%s 按槽位顺序替换指定拷贝，保留牌组顺序和其他同名牌',(form)=>{
  const save=reduceGame(emptySave(),{type:'start',partner:'guilmon',seed:42});
  const ultimate=form==='chaosdukemon';
  Object.assign(save.run!,{screen:'evolution',form:ultimate?'blackwargrowlmon':'growlmon',stage:ultimate?2:1,row:16,bosses:2,victories:6});
  save.run!.activity.counts={selfCosts:6,heals:4};save.meta.unlockedRoutes=['chaos'];
  save.run!.deck=save.run!.deck.map((card,i)=>({...card,id:'guard',upgraded:i===4}));
  const before=structuredClone(save.run!.deck),uids=[before[4].uid,before[1].uid];
  const after=reduceGame(save,{type:'evolve',form,replace:uids,training:'defense',inherit:'ward'}).run!;
  expect(after.form).toBe(form);expect(after.deck.map(card=>card.uid)).toEqual(before.map(card=>card.uid));
  expect(after.deck[4]).toEqual({...before[4],id:EVOLUTIONS[form].cards[0],upgraded:true});
  expect(after.deck[1]).toEqual({...before[1],id:EVOLUTIONS[form].cards[1],upgraded:!ultimate});
  expect(after.deck.filter(card=>!uids.includes(card.uid))).toEqual(before.filter(card=>!uids.includes(card.uid)));
 });
});
