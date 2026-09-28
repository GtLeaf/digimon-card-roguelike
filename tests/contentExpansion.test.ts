import { describe,expect,it } from 'vitest';
import { existsSync } from 'node:fs';
import { ENEMIES } from '../src/game/data';
import { ENCOUNTERS } from '../src/game/encounters';
import { EVENTS, eventChoiceBlock, eventFor } from '../src/game/events';
import { emptySave, makeRun, reduceGame, intent, previewAction } from '../src/game/engine';
import { parseSave } from '../src/game/storage';
import type { Save } from '../src/game/types';

function start(){return reduceGame(reduceGame(emptySave(),{type:'start',partner:'guilmon',seed:42}),{type:'bless',id:'guard'});}
function fight(id:string){let s=start();s.run!.nodes[0][0].enemies=[id];s=reduceGame(s,{type:'node',id:s.run!.nodes[0][0].id});return s;}
function hand(s:Save,ids:string[]){s.run!.battle!.hand=ids.map((id,i)=>({id,uid:`t${i}`,upgraded:false}));s.run!.battle!.energy=30;}
function play(s:Save,i:number){return reduceGame(s,{type:'play',uid:`t${i}`});}
function event(id:string){const s=start();s.run!.hp=40;s.run!.currentNode={id:'event-test',kind:'event',label:EVENTS[id].title,eventId:id,row:5,lane:0,enemies:[],next:[]};s.run!.screen='event';s.run!.row=5;return s;}

describe('curated world generation',()=>{
 it('contains 54 distinct formations and fourteen new digimon assets',()=>{
  expect(ENCOUNTERS).toHaveLength(54);
  const counts=[10,10,12,12,10];
  for(let ch=0;ch<5;ch++){const set=ENCOUNTERS.filter(e=>e.chapter===ch);expect(set).toHaveLength(counts[ch]);expect(new Set(set.map(e=>[...e.enemies].sort().join(','))).size).toBe(set.length);}
  for(const e of ENCOUNTERS){expect(e.enemies.length).toBeLessThanOrEqual(3);expect(e.enemies.every(id=>!!ENEMIES[id])).toBe(true);expect(e.enemies.filter(id=>['jam','spider'].includes(ENEMIES[id].style)||id==='clockmon').length).toBeLessThan(2);}
  expect(ENCOUNTERS.filter(e=>e.enemies.length===3).length).toBeGreaterThanOrEqual(4);
  const added=['gotsumon','betamon','monodramon','clockmon','seadramon','gekomon','devimon','skullgreymon','machinedramon'];
  expect(Object.keys(ENEMIES)).toHaveLength(51);
  for(const id of added){expect(existsSync(`public/sprites/${id}.png`)).toBe(true);expect(existsSync(`public/sprites/${id}-sheet.png`)).toBe(true);}
  for(const id of ['knightmon','phantomon','kuramon','diaboromon']){expect(existsSync(`public/sprites/${id}.png`)).toBe(true);expect(existsSync(`public/sprites/${id}-sheet.png`)).toBe(true);}
  for(const id of ['pawnchessmonblack','pawnchessmonwhite','knightchessmonblack','knightchessmonwhite','rookchessmon','bishopchessmon','keramon','chrysalimon','infermon','armageddemon','lilithmon','leviamon','grandracmon','daemon','belphemon','barbamon']){expect(existsSync(`public/sprites/${id}.png`)).toBe(true);expect(existsSync(`public/sprites/${id}-sheet.png`)).toBe(true);}
 });
 it('varies templates across three-lane chapters while every path can reach recovery and the finale',()=>{
  const layouts=new Set<string>(),seen=new Set<string>();
  for(let seed=0;seed<100;seed++){
   const r=makeRun('guilmon',seed*7919,false);layouts.add(JSON.stringify(r.nodes.map(row=>row.map(n=>n.kind))));
   expect(r.nodes).toHaveLength(50);const events=r.nodes.flat().flatMap(n=>n.eventId?[n.eventId]:[]);expect(new Set(events).size).toBe(events.length);expect(events).toContain('research');
   for(let ch=0;ch<5;ch++){
    const rows=r.nodes.slice(ch*10,ch*10+10),encounters=rows.flat().flatMap(n=>n.encounterId?[n.encounterId]:[]);
    encounters.forEach(id=>seen.add(id));expect(new Set(encounters).size).toBe(encounters.length);
    expect(rows[8]).toHaveLength(1);expect(rows[8][0].kind).toBe('camp');expect(rows[4]).toHaveLength(1);expect(rows[4][0].kind).toBe('evolution');
    expect(rows.some(row=>row.some(n=>n.kind==='shop'))).toBe(true);expect(rows[9][0].kind).toBe('boss');
    expect(rows[0]).toHaveLength(3);
    // 营地与商店互不相邻（连线方向与同层并列）
    for(const n of rows.flat())if(['camp','shop'].includes(n.kind)){for(const id of n.next){const t=r.nodes[n.row+1]?.find(x=>x.id===id);expect(['camp','shop'].includes(t?.kind??'')).toBe(false);}expect(rows[n.row-ch*10].filter(x=>['camp','shop'].includes(x.kind))).toHaveLength(1);}
   }
   let frontier=r.nodes[0].map(n=>n.id);
   for(let row=0;row<49;row++){const next=new Set<string>();for(const id of frontier){const node=r.nodes[row].find(n=>n.id===id)!;expect(node.next.length).toBeGreaterThan(0);for(const target of node.next){expect(r.nodes[row+1].some(n=>n.id===target)).toBe(true);next.add(target);}}frontier=[...next];}
   expect(frontier).toEqual([r.nodes[49][0].id]);
  }
  expect(layouts.size).toBeGreaterThan(3);expect(seen.size).toBe(ENCOUNTERS.length);
 });
 it('tutorial repeats only until the initial gear scan is completed',()=>{const first=start();expect(first.run!.nodes.slice(0,2).map(row=>row[0].encounterId)).toEqual(['tutorial-0','tutorial-1']);const s=emptySave();s.meta.scans.hagurumon=100;const repeat=reduceGame(s,{type:'start',partner:'guilmon',seed:42});expect(repeat.run!.nodes.flat().some(n=>n.encounterId?.startsWith('tutorial'))).toBe(false);});
 it('save reload never regenerates the chosen formations, boss or event',()=>{let s=start();const before=structuredClone(s.run!.nodes);s=parseSave(JSON.stringify(s));expect(s.run!.nodes).toEqual(before);expect(makeRun('guilmon',42)).toEqual(makeRun('guilmon',42));});
});

describe('new enemy mechanics',()=>{
 it('Devimon heals only actual HP damage and cannot heal through full block',()=>{let s=fight('devimon');s.run!.battle!.enemies[0].hp=20;s.run!.battle!.block=99;s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[0].hp).toBe(20);s=fight('devimon');s.run!.battle!.enemies[0].hp=20;s.run!.battle!.block=7;const feedback=previewAction(s,{type:'endTurn'});s=reduceGame(s,{type:'endTurn'});expect(s.run!.hp).toBe(87);expect(s.run!.battle!.enemies[0].hp).toBe(23);expect(feedback).toContainEqual({target:s.run!.battle!.enemies[0].uid,kind:'heal',amount:3});});
 it('Gekomon heals the most injured living ally without resurrecting',()=>{let s=fight('gekomon');const b=s.run!.battle!;b.turn=2;b.enemies[0].hp=29;b.enemies.push({...b.enemies[0],id:'gotsumon',uid:'ally',maxHp:30,hp:10},{...b.enemies[0],uid:'dead',hp:0});s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[1].hp).toBe(18);expect(s.run!.battle!.enemies[2].hp).toBe(0);});
 it('clock interference adds exactly one temporary fault per cycle',()=>{let s=fight('clockmon');const plan=intent(s.run!,s.run!.battle!.enemies[0]);expect(plan.jam).toBe(1);s=reduceGame(s,{type:'endTurn'});const b=s.run!.battle!;expect([...b.hand,...b.draw,...b.discard].filter(c=>c.id==='fault')).toHaveLength(1);expect(s.run!.deck.some(c=>c.id==='fault')).toBe(false);});
 it('SkullGreymon can be interrupted by damage or by three separate cards, not three hits',()=>{
  let s=fight('skullgreymon');s.run!.battle!.turn=3;hand(s,['gatling']);s=play(s,0);expect(s.run!.battle!.enemies[0].effectiveAttacks).toBe(1);expect(intent(s.run!,s.run!.battle!.enemies[0]).type).toBe('attack');
  s=fight('skullgreymon');s.run!.battle!.turn=3;hand(s,['tinyTwister','tinyTwister','tinyTwister']);for(let i=0;i<3;i++)s=play(s,i);expect(s.run!.battle!.enemies[0].stagger).toBe(12);expect(intent(s.run!,s.run!.battle!.enemies[0]).type).toBe('block');
  s=fight('skullgreymon');s.run!.battle!.turn=3;hand(s,['royal']);s=play(s,0);expect(intent(s.run!,s.run!.battle!.enemies[0]).type).toBe('block');
 });
 it('Machinedramon retains armor through charging and breaking it weakens only this cycle',()=>{
  let s=fight('machinedramon');s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[0].block).toBe(16);s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[0].block).toBe(16);expect(intent(s.run!,s.run!.battle!.enemies[0]).damage).toBe(24);
  hand(s,['royal']);s=play(s,0);expect(s.run!.battle!.enemies[0].armorBroken).toBe(true);expect(intent(s.run!,s.run!.battle!.enemies[0]).damage).toBe(14);const loaded=parseSave(JSON.stringify(s));expect(intent(loaded.run!,loaded.run!.battle!.enemies[0]).damage).toBe(14);
  s=reduceGame(s,{type:'endTurn'});s=reduceGame(s,{type:'endTurn'});expect(s.run!.battle!.enemies[0].armorBroken).toBe(false);expect(s.run!.battle!.enemies[0].block).toBe(16);
 });
 it('new scanned enemies grant normal data and boss data once',()=>{for(const [id,kind,expected] of [['gotsumon','battle',50],['machinedramon','boss',100]] as const){let s=fight(id);s.run!.currentNode!.kind=kind;s.run!.battle!.enemies[0].hp=1;hand(s,['strike']);s=play(s,0);expect(s.meta.scans[id]).toBe(expected);expect(play(s,0).meta.scans[id]).toBe(expected);}});
});

describe('ten events and persistence',()=>{
 it('all ten events are reachable and have a free safe exit',()=>{expect(Object.keys(EVENTS)).toHaveLength(10);for(const id of Object.keys(EVENTS)){const s=event(id);s.run!.gold=0;const safe=EVENTS[id].choices.find(c=>c.id==='safe')!;expect(eventChoiceBlock(s.run!,safe)).toBe('');const next=reduceGame(s,{type:'event',choice:'safe'});expect(next.run!.screen).toBe('map');expect(next.run!.row).toBe(6);}});
 it('validates costs and exact card target atomically and blocks repeat rewards',()=>{let s=event('shelter');const before=structuredClone(s);expect(reduceGame(s,{type:'event',choice:'risk'})).toEqual(before);expect(reduceGame(s,{type:'event',choice:'risk',uid:'missing'})).toEqual(before);s.run!.gold=14;expect(reduceGame(s,{type:'event',choice:'risk',uid:s.run!.deck[0].uid})).toEqual(s);s=before;const uid=s.run!.deck[0].uid;s=reduceGame(s,{type:'event',choice:'risk',uid});expect(s.run!.gold).toBe(50);expect(s.run!.deck.some(c=>c.uid===uid)).toBe(false);expect(reduceGame(s,{type:'event',choice:'risk',uid})).toEqual(s);});
 it('does not remove below five cards or upgrade an already upgraded card',()=>{const s=event('shelter');s.run!.deck=s.run!.deck.slice(0,5);expect(reduceGame(s,{type:'event',choice:'risk',uid:s.run!.deck[0].uid})).toEqual(s);const lab=event('laboratory');lab.run!.deck[0].upgraded=true;expect(reduceGame(lab,{type:'event',choice:'risk',uid:lab.run!.deck[0].uid})).toEqual(lab);const good=reduceGame(lab,{type:'event',choice:'risk',uid:lab.run!.deck[1].uid});expect(good.run!.deck[1].upgraded).toBe(true);expect(good.run!.gold).toBe(40);});
 it('research unlocks persist without granting evolution behaviors',()=>{for(const choice of ['safe','risk'] as const){let s=event('research');s=reduceGame(s,{type:'event',choice});expect(s.meta.unlockedRoutes).toEqual(choice==='safe'?['mechanical','purification']:['chaos']);expect(s.run!.activity.counts).toEqual({});s=parseSave(JSON.stringify(s));s=reduceGame(s,{type:'abandon'});s=reduceGame(s,{type:'start',partner:'renamon',seed:123});expect(s.meta.unlockedRoutes.length).toBeGreaterThan(0);}});
 it('training and supplies pay their stated costs and honor potion capacity',()=>{let s=event('training');s=reduceGame(s,{type:'event',choice:'risk'});expect(s.run!.training).toBe('attack');expect(s.run!.hp).toBe(35);expect(s.run!.gold).toBe(75);s=event('supply');s.run!.potions=2;expect(reduceGame(s,{type:'event',choice:'risk'})).toEqual(s);s.run!.potions=1;s=reduceGame(s,{type:'event',choice:'risk'});expect(s.run!.potions).toBe(2);expect(s.run!.gold).toBe(45);});
 it('reload keeps pending event choice and legacy events keep their old behavior',()=>{const s=event('laboratory');expect(eventFor(parseSave(JSON.stringify(s)).run!)?.id).toBe('laboratory');const legacy=event('reader');delete legacy.run!.currentNode!.eventId;legacy.run!.row=11;const loaded=parseSave(JSON.stringify(legacy));expect(eventFor(loaded.run!)).toBeUndefined();const done=reduceGame(loaded,{type:'event',choice:'safe'});expect(done.meta.unlockedRoutes).toContain('purification');expect(done.run!.hp).toBe(50);});
});

describe('summon, guard, enrage and on-death mechanics',()=>{
 it('Machinedramon calls one hagurumon during armor phase, capped by field size and summon count',()=>{
  let s=fight('machinedramon');
  expect(intent(s.run!,s.run!.battle!.enemies[0]).summon).toEqual(['hagurumon']);
  s=reduceGame(s,{type:'endTurn'});
  const b=s.run!.battle!;
  expect(b.enemies).toHaveLength(2);expect(b.enemies[1].id).toBe('hagurumon');expect(b.enemies[1].summons).toBeUndefined();expect(b.enemies[0].summons).toBe(1);
  b.enemies.push({...b.enemies[1],uid:'third'},{...b.enemies[1],uid:'fourth'});
  expect(intent(s.run!,b.enemies[0]).summon).toBeUndefined();
  b.enemies.pop();b.enemies.pop();b.enemies[0].summons=2;
  expect(intent(s.run!,b.enemies[0]).summon).toBeUndefined();
 });
 it('summoned minions skip their first turn and use their own behavior after',()=>{
  let s=fight('machinedramon');s=reduceGame(s,{type:'endTurn'});
  expect(s.run!.hp).toBe(s.run!.maxHp);
  s=reduceGame(s,{type:'endTurn'});
  expect(s.run!.battle!.enemies[1].summonedTurn).toBe(1);
  expect(s.run!.hp).toBeLessThan(s.run!.maxHp);
 });
 it('killing the summoner retreats its minions without triggering their on-death',()=>{
  let s=fight('diaboromon');s=reduceGame(s,{type:'endTurn'});
  const b=s.run!.battle!;
  expect(b.enemies.map(e=>e.id)).toEqual(['diaboromon','kuramon']);
  b.enemies[0].hp=1;b.enemies[0].block=0;const hp=s.run!.hp;
  hand(s,['strike']);
  s=reduceGame(s,{type:'play',uid:'t0'});
  expect(s.run!.screen).toBe('reward');
  expect(s.run!.hp).toBe(hp);
 });
 it('kuramon explodes for 8 on defeat, absorbed by block first',()=>{
  let s=fight('kuramon');const b=s.run!.battle!;b.enemies[0].hp=3;b.block=5;hand(s,['strike']);
  s=reduceGame(s,{type:'play',uid:'t0'});
  expect(s.run!.hp).toBe(s.run!.maxHp-3);
  expect(s.run!.battle!.block).toBe(0);
 });
 it('guard enemy intercepts targeted attacks for its allies but not area attacks',()=>{
  let s=fight('knightmon');const b=s.run!.battle!;
  b.enemies.push({...b.enemies[0],uid:'ally',id:'goblimon',hp:30,maxHp:30});
  hand(s,['strike','heatwave']);
  s=reduceGame(s,{type:'play',uid:'t0',target:'ally'});
  expect(s.run!.battle!.enemies[0].hp).toBe(44-7);
  expect(s.run!.battle!.enemies[1].hp).toBe(30);
  s=reduceGame(s,{type:'play',uid:'t1',target:'ally'});
  expect(s.run!.battle!.enemies[1].hp).toBeLessThan(30);
 });
 it('phantomon enrages below half health with a two-hit attack',()=>{
  const s=fight('phantomon');const e=s.run!.battle!.enemies[0];
  expect(intent(s.run!,e).hits).toBe(1);
  e.hp=Math.floor(e.maxHp/2);
  const plan=intent(s.run!,e);
  expect(plan.name).toBe('幻影暴走');expect(plan.hits).toBe(2);
 });
 it('vajramon counter-charges from attack cards that hit this turn',()=>{
  let s=fight('vajramon');const b=s.run!.battle!;
  const base=intent(s.run!,b.enemies[0]).damage;
  hand(s,['doublecut','doublecut']);
  s=reduceGame(s,{type:'play',uid:'t0'});
  s=reduceGame(s,{type:'play',uid:'t1'});
  expect(intent(s.run!,s.run!.battle!.enemies[0]).damage).toBe(base+6);
 });
 it('core runs a four-phase cycle with a summon phase and scaling finale',()=>{
  const s=fight('core');const b=s.run!.battle!;
  expect(intent(s.run!,b.enemies[0]).jam).toBe(2);
  b.turn=3;expect(intent(s.run!,b.enemies[0]).summon).toEqual(['replica']);
  b.turn=4;expect(intent(s.run!,b.enemies[0]).damage).toBe(24);
  b.enemies.push({...b.enemies[0],uid:'add',id:'replica',hp:48,maxHp:48});
  expect(intent(s.run!,b.enemies[0]).damage).toBe(28);
 });
 it('chess, virus and demon-lord line enemies always expose a defined intent',()=>{
  for(const id of ['pawnchessmonblack','pawnchessmonwhite','knightchessmonblack','knightchessmonwhite','rookchessmon','bishopchessmon','keramon','chrysalimon','infermon','armageddemon','lilithmon','leviamon','grandracmon','daemon','belphemon','barbamon']){
   const s=fight(id);const b=s.run!.battle!;
   for(let t=1;t<=3;t++){b.turn=t;const plan=intent(s.run!,b.enemies[0]);expect(plan,`${id} turn ${t}`).toBeTruthy();expect(plan.name).not.toBe('');}
  }
 });
 it('rookchessmon guards allies like knightmon and bishop heals the most injured',()=>{
  let s=fight('rookchessmon');const b=s.run!.battle!;
  b.enemies.push({...b.enemies[0],uid:'ally',id:'goblimon',hp:30,maxHp:30});
  hand(s,['strike']);
  s=reduceGame(s,{type:'play',uid:'t0',target:'ally'});
  expect(s.run!.battle!.enemies[0].hp).toBe(85-7);
  expect(s.run!.battle!.enemies[1].hp).toBe(30);
  const s2=fight('bishopchessmon');const b2=s2.run!.battle!;
  b2.turn=2;b2.enemies.push({...b2.enemies[0],uid:'hurt',id:'goblimon',hp:10,maxHp:30});
  const healed=reduceGame(s2,{type:'endTurn'});
  expect(healed.run!.battle!.enemies[1].hp).toBe(20);
 });
});
