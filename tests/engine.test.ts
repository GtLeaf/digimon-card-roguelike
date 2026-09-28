import { describe,expect,it } from 'vitest';
import { emptySave, makeRun, reduceGame, intent, cardCost } from '../src/game/engine';
import { availableNodes } from '../src/game/map';
import { evolutionStatus, nextEvolutions } from '../src/game/evolution';
import { CARDS, BRANCHES, cardText } from '../src/game/data';
import { parseSave } from '../src/game/storage';
import type { Save, Partner, Branch, Action } from '../src/game/types';
function start(partner:Partner='guilmon',seed=42){let s=reduceGame(emptySave(),{type:'start',partner,seed});s=reduceGame(s,{type:'bless',id:'guard'});return s;}
function fight(){let s=start();s=reduceGame(s,{type:'node',id:s.run!.nodes[0][0].id});return s;}
function hand(s:Save,ids:string[]){s.run!.battle!.hand=ids.map((id,i)=>({uid:`test${i}`,id,upgraded:false}));s.run!.battle!.energy=5;}
function win(s:Save){hand(s,['strike']);s.run!.battle!.enemies.forEach(e=>e.hp=1);return reduceGame(s,{type:'play',uid:'test0'});}
describe('battle invariants',()=>{
 it('seeded maps, rewards and initial hands are reproducible',()=>{expect(fight()).toEqual(fight());});
 it('does not mutate previous state while paying energy and moving card',()=>{const s=fight();hand(s,['strike']);const copy=structuredClone(s);const next=reduceGame(s,{type:'play',uid:'test0'});expect(s).toEqual(copy);expect(next.run!.battle!.energy).toBe(4);expect(next.run!.battle!.discard.map(c=>c.uid)).toContain('test0');expect(next.run!.battle!.enemies[0].hp).toBe(21);});
 it('does not allow an unaffordable card or double play',()=>{let s=fight();hand(s,['inferno']);s.run!.battle!.energy=1;expect(reduceGame(s,{type:'play',uid:'test0'})).toEqual(s);s.run!.battle!.energy=3;s=reduceGame(s,{type:'play',uid:'test0'});expect(reduceGame(s,{type:'play',uid:'test0'})).toEqual(s);});
 it('shield absorbs damage and resets at new player turn',()=>{let s=fight();hand(s,['guard']);s.run!.battle!.turn=2;s=reduceGame(s,{type:'play',uid:'test0'});const hp=s.run!.hp;expect(s.run!.battle!.block).toBe(10);s=reduceGame(s,{type:'endTurn'});expect(s.run!.hp).toBe(hp);expect(s.run!.battle!.block).toBe(0);expect(s.run!.battle!.energy).toBe(3);});
 it('resolves queued enemies one at a time and resumes after reload',()=>{
  const s=fight(),battle=s.run!.battle!;battle.enemies.push({...battle.enemies[0],uid:'second-enemy',id:'goblimon',hp:30,maxHp:30});
  const atomic=reduceGame(s,{type:'endTurn'});
  let queued=reduceGame(s,{type:'beginEnemyTurn'});
  expect(queued.run!.battle!.enemyTurnIndex).toBe(0);
  expect(queued.run!.battle!.hand).toHaveLength(0);
  expect(queued.run!.hp).toBe(s.run!.hp);
  expect(reduceGame(queued,{type:'finishEnemyTurn'})).toEqual(queued);
  expect(reduceGame(queued,{type:'play',uid:battle.hand[0].uid})).toEqual(queued);
  queued=parseSave(JSON.stringify(queued));
  queued=reduceGame(queued,{type:'enemyStep'});
  expect(queued.run!.battle!.enemyTurnIndex).toBe(1);
  expect(queued.run!.hp).toBe(s.run!.hp);
  queued=reduceGame(queued,{type:'enemyStep'});
  expect(queued.run!.hp).toBeLessThan(s.run!.hp);
  queued=reduceGame(queued,{type:'finishEnemyTurn'});
  expect(queued).toEqual(atomic);
 });
 it('defaults older battle saves to the player turn',()=>{
  const original=fight();
  const legacy=structuredClone(original);
  delete (legacy.run!.battle! as {enemyTurnIndex?:number|null}).enemyTurnIndex;
  expect(parseSave(JSON.stringify(legacy)).run!.battle!.enemyTurnIndex).toBeNull();
 });
 it('stops a queued enemy turn on lethal damage',()=>{
  let s=fight();s.run!.hp=1;s.run!.battle!.enemies[0].id='goblimon';
  s=reduceGame(s,{type:'beginEnemyTurn'});
  s=reduceGame(s,{type:'enemyStep'});
  expect(s.run!.screen).toBe('result');
  expect(s.run!.hp).toBe(0);
  expect(reduceGame(s,{type:'finishEnemyTurn'})).toEqual(s);
 });
 it('burn damage ignores block and decays',()=>{let s=fight();s.run!.battle!.enemies[0].burn=5;s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[0].hp).toBe(23);expect(s.run!.battle!.enemies[0].block).toBe(8);expect(s.run!.battle!.enemies[0].burn).toBe(4);});
 it('detonation consumes burn and mark burst consumes marks',()=>{let s=fight();hand(s,['ignite']);s.run!.battle!.enemies[0].burn=3;s=reduceGame(s,{type:'play',uid:'test0'});expect(s.run!.battle!.enemies[0].hp).toBe(16);expect(s.run!.battle!.enemies[0].burn).toBe(0);s=fight();hand(s,['seal']);s.run!.battle!.enemies[0].mark=2;s=reduceGame(s,{type:'play',uid:'test0'});expect(s.run!.battle!.enemies[0].hp).toBe(13);expect(s.run!.battle!.enemies[0].mark).toBe(0);});
 it('sync gain caps at three per turn',()=>{let s=fight();hand(s,['guard','guard','guard','guard']);for(let i=0;i<4;i++)s=reduceGame(s,{type:'play',uid:`test${i}`});expect(s.run!.battle!.sync).toBe(3);});
 it('a lethal self-cost ends the run without healing or dealing damage',()=>{let s=fight();hand(s,['sacrifice']);s.run!.hp=3;s=reduceGame(s,{type:'play',uid:'test0'});expect(s.run!.screen).toBe('result');expect(s.run!.won).toBe(false);expect(s.run!.hp).toBe(0);});
 it('copy cards cannot recursively copy themselves',()=>{let s=fight();hand(s,['illusion','illusion']);s=reduceGame(s,{type:'play',uid:'test0'});expect(s.run!.battle!.hand).toHaveLength(1);});
 it('burst is once per battle and does not revert evolution',()=>{let s=fight();s.run!.stage=3;s.run!.branch='duke';s.run!.form='dukemon';s.run!.battle!.sync=6;s=reduceGame(s,{type:'burst'});expect(s.run!.battle!.burst).toBe(3);expect(s.run!.battle!.burstUsed).toBe(true);s.run!.battle!.sync=6;const before=structuredClone(s);expect(reduceGame(s,{type:'burst'})).toEqual(before);for(let i=0;i<3;i++)s=reduceGame(s,{type:'endTurn'});expect(s.run!.form).toBe('dukemon');expect(s.run!.battle!.burst).toBe(0);});
 it('limits the hand to eight while preserving overflow in discard',()=>{let s=fight();hand(s,Array(8).fill('study'));s=reduceGame(s,{type:'play',uid:'test0'});expect(s.run!.battle!.hand).toHaveLength(8);expect(s.run!.battle!.discard.length).toBeGreaterThan(0);});
 it('enemy reactive intent updates after card plays',()=>{let s=fight();s.run!.battle!.enemies[0].id='sinduramon';s.run!.battle!.turn=2;hand(s,['guard']);expect(intent(s.run!,s.run!.battle!.enemies[0]).damage).toBe(4);s=reduceGame(s,{type:'play',uid:'test0'});expect(intent(s.run!,s.run!.battle!.enemies[0]).damage).toBe(6);});
});
describe('progress, scanning and evolution',()=>{
 it('records scan once per battle and prevents duplicate reward claims',()=>{let s=win(fight());expect(s.meta.scans.hagurumon).toBe(50);const again=reduceGame(s,{type:'play',uid:'test0'});expect(again.meta.scans.hagurumon).toBe(50);const before=s.run!.gold;s=reduceGame(s,{type:'reward'});expect(s.run!.row).toBe(1);s=reduceGame(s,{type:'reward'});expect(s.run!.gold).toBe(before);});
 it('two wins unlock support conversion; loss retains collection',()=>{let s=reduceGame(win(fight()),{type:'reward'});s=reduceGame(s,{type:'node',id:s.run!.nodes[1][0].id});s=win(s);expect(s.meta.scans.hagurumon).toBe(100);s=reduceGame(s,{type:'convert',id:'hagurumon'});expect(s.meta.partners).toContain('hagurumon');s=reduceGame(s,{type:'abandon'});expect(s.meta.scans.hagurumon).toBe(100);expect(s.meta.partners).toContain('hagurumon');});
 it('cannot equip support mid-battle or convert an incomplete scan',()=>{const s=fight();expect(reduceGame(s,{type:'convert',id:'mushmon'}).meta.partners).toEqual([]);s.meta.partners=['mushmon'];expect(reduceGame(s,{type:'equip',id:'mushmon'}).run!.support).toBe('default');});
 it('prevents jumping map rows',()=>{const s=start();expect(reduceGame(s,{type:'node',id:s.run!.nodes[7][0].id})).toEqual(s);});
 it.each(['duke','megidra','sakuya','kuzuha'] as Branch[])('evolves %s, swaps two cards without losing upgrades',branch=>{let s=start(BRANCHES[branch].partner);const r=s.run!;r.row=29;r.currentNode=r.nodes[29][0];r.screen='evolution';r.stage=2;r.bosses=3;r.form=r.partner==='guilmon'?'wargrowlmon':'taomon';r.activity.counts={fire:32,detonations:4,skills:70,combos:22};r.deck[0].upgraded=true;const uids=r.deck.slice(0,2).map(c=>c.uid);s=reduceGame(s,{type:'evolve',branch,replace:uids});expect(s.run!.form).toBe(BRANCHES[branch].art);expect(s.run!.deck).toHaveLength(10);expect(s.run!.deck[0].upgraded).toBe(true);expect(s.run!.deck.slice(0,2).map(c=>c.id)).toEqual(BRANCHES[branch].cards);expect(s.run!.screen).toBe('blessing');s=reduceGame(s,{type:'bless',id:'bond'});expect(s.run!.row).toBe(30);});
 it('rejects wrong-partner evolution and duplicate replacement cards',()=>{const s=start();s.run!.row=15;s.run!.screen='evolution';const uid=s.run!.deck[0].uid;expect(reduceGame(s,{type:'evolve',branch:'sakuya',replace:[uid,s.run!.deck[1].uid]})).toEqual(s);expect(reduceGame(s,{type:'evolve',branch:'duke',replace:[uid,uid]})).toEqual(s);});
 it('does not sell twice and does not allow buying without gold',()=>{let s=start();s.run!.screen='shop';s.run!.shopStock=['fireball'];s.run!.gold=45;s=reduceGame(s,{type:'buy',id:'fireball'});expect(s.run!.gold).toBe(0);expect(s.run!.deck).toHaveLength(11);expect(reduceGame(s,{type:'buy',id:'fireball'})).toEqual(s);});
 it('save round-trip preserves RNG and next draw exactly',()=>{let s=fight();s=reduceGame(s,{type:'play',uid:s.run!.battle!.hand[0].uid});const restored=parseSave(JSON.stringify(s));expect(restored).toEqual(s);expect(reduceGame(restored,{type:'endTurn'})).toEqual(reduceGame(s,{type:'endTurn'}));});
 it('rejects malformed, incompatible, and unknown card saves',()=>{expect(()=>parseSave('{}')).toThrow();const s=fight();s.run!.deck[0].id='bad-card';expect(()=>parseSave(JSON.stringify(s))).toThrow();});
});
// 使用真实伤害、生命和规则的固定策略通关回归；不注入血量或跳过战斗。
export function autoplay(partner:Partner,branch:Branch,seed:number){
 let s=start(partner,seed),steps=0;
 const favs:string[]=partner==='guilmon'?(branch==='chaos'?['sacrifice','mend','bloodedge','brace','roar','fireball']:branch==='megidra'?['ignite','fireball','heatwave','flare','roar','brace','mend']:['roar','fireball','brace','fortify','doublecut','inferno','mend']):(branch==='kuzuha'?['barrier','brace','talisman','ritual','mend','insight','leaf']:['leaf','seal','barrier','brace','ritual','fortify','mend']);
 while(s.run!.screen!=='result'&&steps++<2000){
  const r=s.run!;let action:Action;
  switch(r.screen){
   case 'map':{const nodes=availableNodes(r);const research=branch==='chaos'?r.nodes.flat().find(n=>n.eventId==='research'):undefined;const reachesResearch=research?((n:(typeof nodes)[number]):boolean=>{const byId=new Map(r.nodes.flat().map(m=>[m.id,m]));const seen=new Set([n.id]);const queue=[n.id];while(queue.length){const id=queue.shift()!;if(id===research.id)return true;for(const t of byId.get(id)!.next)if(!seen.has(t)){seen.add(t);queue.push(t);}}return false;}):undefined;const node=(research&&nodes.some(n=>n.id===research.id)?nodes.find(n=>n.id===research.id):undefined)??(research&&research.row-r.row<=2&&reachesResearch?nodes.find(n=>reachesResearch(n)):undefined)??((branch==='megidra'||branch==='kuzuha'||branch==='chaos')?nodes.find(n=>n.kind==='battle'):undefined)??nodes.find(n=>n.kind==='camp')??nodes.find(n=>n.kind==='treasure')??nodes.find(n=>n.kind==='event')??nodes[0];action={type:'node',id:node.id};break;}
   case 'battle':{
    const b=r.battle!,target=(branch==='megidra'?b.enemies.filter(e=>e.hp>0).sort((a,b)=>(b.burn-a.burn)||(a.hp-b.hp))[0]:undefined)??b.enemies.find(e=>e.hp>0)!;
    if(r.potions>0&&r.hp<=r.maxHp-18){action={type:'potion'};break;}
    if(!b.supportUsed){action={type:'support',target:target.uid};break;}
    if(r.branch&&b.sync>=6&&!b.burstUsed){action={type:'burst'};break;}
    const incoming=b.enemies.filter(e=>e.hp>0).reduce((n,e)=>{const i=intent(r,e);return n+i.damage*i.hits;},0);
    const candidates=b.hand.filter(c=>cardCost(c)<=b.energy);
    const score=(c:typeof candidates[number])=>{const d=CARDS[c.id];let score=(d.damage??0)*(d.hits??1)+(d.burn??0)*2+(d.mark??0)+(d.heal??0)*2+(d.draw??0)*2+(d.strength??0)*7+(d.energy??0)*10;if(d.shield)score+=Math.min(d.shield+ (c.upgraded?3:0),Math.max(0,incoming-b.block))*1.7;if(d.special==='detonate')score+=target.burn*(branch==='megidra'?6:3);if(branch==='megidra'&&d.burn&&!target.burn)score+=12;if(d.special==='markburst')score+=target.mark*5;if(d.special==='copy')score=1;if(branch==='megidra'&&d.burn)score+=10;if(branch==='kuzuha'&&(d.kind==='skill'||d.kind==='power'))score+=4;if(d.all)score*=b.enemies.filter(e=>e.hp>0).length;if(d.special==='sacrifice')score-=8;if(branch==='chaos'){if(r.stage===0&&d.burn)score+=10;if(d.special==='sacrifice'&&r.hp>15)score+=15;if(d.heal&&r.hp<r.maxHp)score+=15;}return score;};
    candidates.sort((a,b)=>score(b)-score(a));const c=candidates[0];action=c?{type:'play',uid:c.uid,target:target.uid}:{type:'endTurn'};break;
   }
   case 'reward':{const pool=r.reward!.cards;const fav=favs;const pick=fav.find(id=>pool.includes(id));action={type:'reward',card:pick};break;}
   case 'camp':if(r.stage===2&&evolutionStatus(r,s.meta,BRANCHES[branch].art).ready){action={type:'campEvolution'};break;}action=r.hp<r.maxHp*.78?{type:'camp',mode:'heal'}:{type:'camp',mode:'upgrade',uid:r.deck.find(c=>!c.upgraded&&CARDS[c.id].family===partner)?.uid??r.deck.find(c=>!c.upgraded)?.uid};if(action.type==='camp'&&!action.uid&&action.mode==='upgrade')action={type:'camp',mode:'heal'};break;
   case 'event':action={type:'event',choice:branch==='chaos'&&r.currentNode?.eventId==='research'?'risk':'safe'};break;
   case 'shop':{const id=favs.find(id=>r.shopStock!.includes(id)&&!r.shopBought.includes(id));action=id&&r.gold>=45?{type:'buy',id}:{type:'continue'};break;}
   case 'treasure':action={type:'continue'};break;
   case 'evolution':{const candidates=nextEvolutions(r);const goal=branch==='chaos'?['blackgrowmon','blackwargrowlmon','chaosdukemon'][r.stage]:r.stage===2?BRANCHES[branch].art:candidates[0]?.id;const d=candidates.find(d=>d.id===goal&&evolutionStatus(r,s.meta,d.id).ready);const uids=r.deck.filter(c=>c.id==='strike').slice(0,2).map(c=>c.uid);action=d?{type:'evolve',form:d.id,replace:uids.length===2?uids:r.deck.slice(0,2).map(c=>c.uid),training:'defense',inherit:partner==='guilmon'?'ward':'seal'}:{type:'deferEvolution'};break;}
   case 'blessing':action={type:'bless',id:'guard'};break;
   default:throw Error(`Unhandled ${r.screen}`);
  }
  s=reduceGame(s,action);
  if(s.run!.screen==='reward'&&(s.meta.scans.hagurumon??0)>=100&&!s.meta.partners.includes('hagurumon')){s=reduceGame(s,{type:'convert',id:'hagurumon'});s=reduceGame(s,{type:'equip',id:'hagurumon'});}
 }
 return {save:s,steps};
}
describe('full journey',()=>{it.each(['duke','megidra','sakuya','kuzuha','chaos'] as Branch[])('finishes all five chapters with %s',branch=>{const {save,steps}=autoplay(BRANCHES[branch].partner,branch,1);expect(steps,JSON.stringify({row:save.run!.row,screen:save.run!.screen,form:save.run!.form,counts:save.run!.activity})).toBeLessThan(2000);expect(save.run!.screen).toBe('result');expect(save.run!.won,`Stopped at row ${save.run!.row}, hp ${save.run!.hp}`).toBe(true);expect(save.run!.stage,JSON.stringify(save.run!.activity)).toBe(3);expect(save.run!.branch).toBe(branch);if(branch==='chaos'){expect(save.run!.formHistory).toEqual(['guilmon','blackgrowmon','blackwargrowlmon','chaosdukemon']);expect(save.meta.unlockedRoutes).toContain('chaos');}expect(save.meta.wins).toBe(1);});});

it('assigns a fixed boss to each of the five chapters',()=>{
 for(const seed of [1,42,984]){
  const nodes=makeRun('guilmon',seed).nodes;
  expect(nodes).toHaveLength(50);
  expect([9,19,29,39,49].map(row=>nodes[row][0].enemies[0])).toEqual(['sinduramon','beelzebumon','machinedramon','diaboromon','core']);
 }
 const {save,steps}=autoplay('guilmon','duke',7);
 expect(steps).toBeLessThan(2000);
 expect(save.run!.won,JSON.stringify({row:save.run!.row,hp:save.run!.hp})).toBe(true);
 expect(save.run!.branch).toBe('duke');
});

describe('support squad expansion',()=>{
 const sup=(id:string)=>{const s=fight();s.run!.support=id;return s;};
 it('impmon deals 8 to a healthy target and 14 to a wounded one',()=>{
  let s=sup('impmon');const e=s.run!.battle!.enemies[0];e.block=0;
  s=reduceGame(s,{type:'support',target:e.uid});
  expect(s.run!.battle!.enemies[0].hp).toBe(e.maxHp-8);
  let t=sup('impmon');const w=t.run!.battle!.enemies[0];w.block=0;w.hp=Math.floor(w.maxHp/2);
  t=reduceGame(t,{type:'support',target:w.uid});
  expect(t.run!.battle!.enemies[0].hp).toBe(0);
 });
 it('leomon weakens every living enemy and records the weaken count',()=>{
  let s=sup('leomon');const b=s.run!.battle!;
  b.enemies.push({...b.enemies[0],uid:'second-enemy',id:'goblimon',hp:30,maxHp:30,block:0});
  s=reduceGame(s,{type:'support'});
  expect(s.run!.battle!.enemies.every(e=>e.weakened>=2)).toBe(true);
  expect(s.run!.battle!.activity.counts.weakens).toBe(1);
 });
 it('andromon grants 12 block and gotsumon grants 2 charge with a charge count',()=>{
  let s=sup('andromon');s.run!.battle!.block=0;
  s=reduceGame(s,{type:'support'});
  expect(s.run!.battle!.block).toBe(12);
  let t=sup('gotsumon');t.run!.battle!.charge=0;
  t=reduceGame(t,{type:'support'});
  expect(t.run!.battle!.charge).toBe(2);
  expect(t.run!.battle!.activity.counts.charges).toBe(1);
 });
 it('betamon draws two cards from the draw pile',()=>{
  let s=sup('betamon');hand(s,['strike']);const pile=s.run!.battle!.draw.length;
  s=reduceGame(s,{type:'support'});
  expect(s.run!.battle!.hand).toHaveLength(3);
  expect(s.run!.battle!.draw).toHaveLength(pile-2);
 });
 it('lopmon purges one fault card, or heals 6 when the hand is clean',()=>{
  let s=sup('lopmon');hand(s,['fault','strike']);
  s=reduceGame(s,{type:'support'});
  expect(s.run!.battle!.hand.map(c=>c.id)).toEqual(['strike']);
  expect(s.run!.battle!.exhaust.map(c=>c.id)).toContain('fault');
  let t=sup('lopmon');hand(t,['strike']);t.run!.hp=t.run!.maxHp-10;
  t=reduceGame(t,{type:'support'});
  expect(t.run!.hp).toBe(t.run!.maxHp-4);
  expect(t.run!.battle!.activity.counts.heals).toBe(1);
 });
});
describe('rescue event',()=>{
 const withRescue=()=>{const s=start();s.run!.screen='event';s.run!.currentNode={id:'n-test',row:0,lane:0,kind:'event',label:'幼兽的求救',enemies:[],next:[],eventId:'rescue'};return s;};
 it('risk choice recruits lopmon at a cost of 6 hp',()=>{
  let s=withRescue();const hp=s.run!.hp;
  s=reduceGame(s,{type:'event',choice:'risk'});
  expect(s.meta.partners).toContain('lopmon');
  expect(s.run!.hp).toBe(hp-6);
  expect(s.run!.screen).toBe('map');
 });
 it('safe choice heals without recruiting lopmon',()=>{
  let s=withRescue();s.run!.hp=20;
  s=reduceGame(s,{type:'event',choice:'safe'});
  expect(s.meta.partners).not.toContain('lopmon');
  expect(s.run!.hp).toBe(30);
 });
 it('equips lopmon as support outside battle once recruited',()=>{
  let s=withRescue();s.meta.partners=['lopmon'];
  s=reduceGame(s,{type:'equip',id:'lopmon'});
  expect(s.run!.support).toBe('lopmon');
 });
});

describe('zero-cost card upgrades',()=>{
 const upgradedHand=(s:Save,id:string)=>{hand(s,[id]);s.run!.battle!.hand[0].upgraded=true;return s;};
 it('upgraded battery grants 2 energy instead of 1',()=>{
  let s=upgradedHand(fight(),'battery');
  s=reduceGame(s,{type:'play',uid:'test0'});
  expect(s.run!.battle!.energy).toBe(7);
  let t=fight();hand(t,['battery']);
  t=reduceGame(t,{type:'play',uid:'test0'});
  expect(t.run!.battle!.energy).toBe(6);
 });
 it('upgraded haste draws two and insight draws three',()=>{
  let s=upgradedHand(fight(),'haste');
  s=reduceGame(s,{type:'play',uid:'test0'});
  expect(s.run!.battle!.hand).toHaveLength(2);
  let t=upgradedHand(fight(),'insight');
  t=reduceGame(t,{type:'play',uid:'test0'});
  expect(t.run!.battle!.hand).toHaveLength(3);
 });
 it('upgraded sacrifice keeps the self cost but grants 2 energy and draws 2',()=>{
  let s=upgradedHand(fight(),'sacrifice');const hp=s.run!.hp;
  s=reduceGame(s,{type:'play',uid:'test0'});
  expect(s.run!.hp).toBe(hp-3);
  expect(s.run!.battle!.energy).toBe(7);
  expect(s.run!.battle!.hand).toHaveLength(2);
 });
 it('upgraded purge still clears faults and draws two',()=>{
  let s=upgradedHand(fight(),'purge');hand(s,['fault','purge']);s.run!.battle!.hand[1].upgraded=true;
  s=reduceGame(s,{type:'play',uid:'test1'});
  expect(s.run!.battle!.hand.map(c=>c.id)).not.toContain('fault');
  expect(s.run!.battle!.exhaust.map(c=>c.id)).toContain('fault');
  expect(s.run!.battle!.hand).toHaveLength(2);
 });
 it('cardText shows the upgraded effect instead of an empty cost reduction',()=>{
  expect(cardText({id:'battery',upgraded:true})).toBe('获得 2 点行动力。耗竭。');
  expect(cardText({id:'battery',upgraded:false})).toBe('获得 1 点行动力。耗竭。');
  expect(cardText({id:'haste',upgraded:true})).toBe('抽 2 张牌。耗竭。');
 });
});
