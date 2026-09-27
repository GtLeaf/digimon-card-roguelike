import { ENEMIES } from './data';
import { ENCOUNTERS } from './encounters';
import { EVENTS } from './events';
import { connectMap } from './map';
import type { MapNode, NodeKind } from './types';

// 不增加层数；每条路都经过营地，可恢复、强化或补进化。
const layouts:NodeKind[][][]=[
 [['battle'],['battle','event'],['battle','shop'],['battle'],['elite','treasure'],['camp','event'],['camp'],['boss']],
 [['battle'],['battle'],['battle','shop'],['event','battle'],['treasure','elite'],['event','camp'],['camp'],['boss']],
 [['battle'],['event','battle'],['shop','battle'],['battle'],['elite','treasure'],['camp','event'],['camp'],['boss']],
];
export function generateWorld(random:()=>number,tutorial:boolean):MapNode[][] {
 const usedEvents=new Set<string>(),nodes:MapNode[][]=[];
 const pick=<T,>(items:T[])=>items[Math.floor(random()*items.length)];
 for(let chapter=0;chapter<3;chapter++){
  const layout=pick(layouts),usedEncounters=new Set<string>();
  const boss=chapter===0?'sinduramon':chapter===1?pick(['beelzebumon','machinedramon']):'core';
  let researchPlaced=false;
  for(let local=0;local<8;local++){
   const row=chapter*8+local;
   const kinds=row===3?['evolution'] as NodeKind[]:tutorial&&row<2?['battle'] as NodeKind[]:layout[local];
   nodes.push(kinds.map((kind,lane)=>{
    let enemies:string[]=[],encounterId:string|undefined,eventId:string|undefined;
    if(kind==='battle'){
     if(tutorial&&row<2){enemies=['hagurumon'];encounterId=`tutorial-${row}`;}
     else{
      const pool=ENCOUNTERS.filter(e=>e.chapter===chapter&&!usedEncounters.has(e.id)&&(!(local<2)||e.opening)&&!(chapter===0&&tutorial&&e.id==='city-gears'));
      const encounter=pick(pool);usedEncounters.add(encounter.id);enemies=encounter.enemies;encounterId=encounter.id;
     }
    }
    if(kind==='elite')enemies=[pick(chapter===0?['devidramon','dokugumon','devimon']:chapter===1?['icedevimon','vajramon','skullgreymon']:['sentinel','devourer','skullgreymon'])];
    if(kind==='boss')enemies=[boss];
    if(kind==='event'){
     eventId=chapter===1&&!researchPlaced?'research':pick(Object.keys(EVENTS).filter(id=>id!=='research'&&!usedEvents.has(id)));
     if(eventId==='research')researchPlaced=true;
     usedEvents.add(eventId);
    }
    const labels:Record<NodeKind,string>={battle:'数码遭遇',elite:'危险信号',boss:ENEMIES[boss].name,camp:'休息营地',shop:'流浪商人',event:eventId?EVENTS[eventId].title:'未知信号',treasure:'数据宝箱',evolution:'进化之光'};
    return {id:`n${row}-${lane}`,row,lane,kind,label:labels[kind],enemies:[...enemies],next:[],...(encounterId?{encounterId}:{}),...(eventId?{eventId}:{})};
   }));
  }
 }
 connectMap(nodes);return nodes;
}
