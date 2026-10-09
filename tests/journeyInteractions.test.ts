import { describe, expect, it } from 'vitest';
import { emptySave, reduceGame } from '../src/game/engine';
import { EVENTS, eventChoicePreview } from '../src/game/events';
import { RELICS } from '../src/game/data';
import { parseSave } from '../src/game/storage';
import type { Run } from '../src/game/types';

function node(screen:Run['screen'],eventId?:string){
 const save=reduceGame(reduceGame(emptySave(),{type:'start',partner:'guilmon',seed:42}),{type:'bless',id:'guard'});
 const run=save.run!;run.screen=screen;run.row=5;run.gold=180;run.message='';
 run.currentNode={...run.nodes[5][0],kind:screen==='reward'?'battle':screen==='camp'?'camp':screen==='shop'?'shop':'event',...(eventId?{eventId}:{})};
 if(screen==='shop')run.shopStock=['strike','guard','charge'];
 return save;
}
describe('journey interaction outcomes',()=>{
 it('buying a disk stores it without healing and repeat clicks cannot buy twice',()=>{
  const save=node('shop');save.run!.hp=40;
  const bought=reduceGame(save,{type:'buy',id:'potion'});
  expect(bought.run).toMatchObject({hp:40,potions:2,gold:150});
  expect(bought.run!.message).toContain('战斗中使用');
  expect(reduceGame(bought,{type:'buy',id:'potion'})).toEqual(bought);
 });
 it('random relic receipt identifies the actual relic and survives reload',()=>{
  const bought=reduceGame(node('shop'),{type:'buy',id:'relic'}),id=bought.run!.relics[0];
  expect(bought.run!.gold).toBe(100);
  expect(bought.run!.message).toContain(RELICS[id].name);
  expect(bought.run!.message).toContain(RELICS[id].text);
  expect(parseSave(JSON.stringify(bought)).run!.message).toBe(bought.run!.message);
 });
 it('card removal pays once, targets the chosen copy and respects the minimum deck size',()=>{
  const save=node('shop'),uid=save.run!.deck[1].uid;
  const removed=reduceGame(save,{type:'remove',uid});
  expect(removed.run!.deck.some(card=>card.uid===uid)).toBe(false);
  expect(removed.run!.deck[0].uid).toBe(save.run!.deck[0].uid);
  expect(removed.run!.gold).toBe(135);
  expect(removed.run!.message).toContain('10 → 9');
  expect(reduceGame(removed,{type:'remove',uid:removed.run!.deck[0].uid})).toEqual(removed);
  save.run!.deck=save.run!.deck.slice(0,5);
  expect(reduceGame(save,{type:'remove',uid:save.run!.deck[0].uid})).toEqual(save);
 });
 it('camp recovery reports capped healing, rejects full HP and always permits leaving',()=>{
  const save=node('camp');save.run!.hp=88;
  const rested=reduceGame(save,{type:'camp',mode:'heal'});
  expect(rested.run).toMatchObject({hp:90,row:6,screen:'map'});
  expect(rested.run!.message).toContain('实际回复 2');
  save.run!.hp=90;save.run!.deck.forEach(card=>card.upgraded=true);
  expect(reduceGame(save,{type:'camp',mode:'heal'})).toEqual(save);
  expect(reduceGame(save,{type:'continue'}).run).toMatchObject({screen:'map',row:6,hp:90});
 });
 it('event previews match capped recovery and HP cost floor, and record actual changes',()=>{
  const heal=node('event','shelter');heal.run!.hp=88;
  expect(eventChoicePreview(heal.run!,EVENTS.shelter.choices[1])).toContain('生命 88 → 90');
  expect(reduceGame(heal,{type:'event',choice:'safe'}).run!.message).toContain('生命 88 → 90');
  const risk=node('event','reader');risk.run!.hp=3;
  expect(eventChoicePreview(risk.run!,EVENTS.reader.choices[0])).toContain('生命 3 → 1');
  expect(reduceGame(risk,{type:'event',choice:'risk'}).run!.hp).toBe(1);
 });
 it('blocked events never preview impossible inventory or a negative balance',()=>{
  const save=node('event','supply');save.run!.potions=2;
  expect(eventChoicePreview(save.run!,EVENTS.supply.choices[0])).toEqual([]);
  save.run!.potions=1;save.run!.gold=10;
  expect(eventChoicePreview(save.run!,EVENTS.supply.choices[0])).toEqual([]);
  expect(reduceGame(save,{type:'event',choice:'risk'})).toEqual(save);
 });
 it('skipping reward keeps earned gold and scans and cannot grant a card afterward',()=>{
  const save=node('reward');save.run!.reward={cards:['strike','guard','charge'],gold:24,scans:[]};save.meta.scans.hagurumon=100;
  const skipped=reduceGame(save,{type:'reward'});
  expect(skipped.run!.deck).toHaveLength(10);expect(skipped.run!.gold).toBe(180);expect(skipped.meta.scans.hagurumon).toBe(100);
  expect(reduceGame(skipped,{type:'reward',card:'strike'})).toEqual(skipped);
 });
});
