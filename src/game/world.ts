import { ENEMIES } from './data';
import { ENCOUNTERS } from './encounters';
import { EVENTS } from './events';
import { connectMap, validateMap } from './map';
import type { MapNode, NodeKind } from './types';

// 五章各10层：第0层三路线起点；第4层进化与第7、8层为汇合点；第8层首领前必有营地。
// 模板内营地／商店互不相邻且不同层并列，生成后由 validateMap 强制校验。
const layouts:NodeKind[][][]=[
 [['battle','battle','battle'],['battle','battle','event'],['elite','battle','shop'],['battle','treasure','battle'],['evolution'],['battle','camp','event'],['elite','battle','shop'],['event'],['camp'],['boss']],
 [['battle','battle','battle'],['event','battle','battle'],['shop','battle','elite'],['battle','treasure','battle'],['evolution'],['event','camp','battle'],['shop','battle','elite'],['event'],['camp'],['boss']],
 [['battle','battle','battle'],['battle','event','battle'],['battle','shop','elite'],['treasure','battle','battle'],['evolution'],['battle','event','camp'],['elite','shop','battle'],['treasure'],['camp'],['boss']],
];
const BOSSES=['sinduramon','beelzebumon','machinedramon','diaboromon','core'];
const ELITES=[['devidramon','dokugumon','devimon'],['icedevimon','vajramon','skullgreymon'],['rookchessmon','bishopchessmon','vajramon','skullgreymon'],['devimon','icedevimon','infermon'],['sentinel','devourer','armageddemon']];
export function generateWorld(random:()=>number,tutorial:boolean):MapNode[][] {
 const usedEvents=new Set<string>(),nodes:MapNode[][]=[];
 const pick=<T,>(items:T[])=>items[Math.floor(random()*items.length)];
 for(let chapter=0;chapter<5;chapter++){
  const layout=pick(layouts),usedEncounters=new Set<string>();
  const boss=BOSSES[chapter];
  let researchPlaced=false;
  for(let local=0;local<10;local++){
   const row=chapter*10+local;
   const kinds=local===4?['evolution'] as NodeKind[]:tutorial&&row<2?['battle','battle','battle'] as NodeKind[]:layout[local];
   nodes.push(kinds.map((kind,lane)=>{
    let enemies:string[]=[],encounterId:string|undefined,eventId:string|undefined;
    if(kind==='battle'){
     if(tutorial&&row<2){enemies=['hagurumon'];encounterId=`tutorial-${row}`;}
     else{
      const pool=ENCOUNTERS.filter(e=>e.chapter===chapter&&!usedEncounters.has(e.id)&&(!(local<2)||e.opening)&&!(chapter===0&&tutorial&&e.id==='city-gears'));
      const encounter=pick(pool);usedEncounters.add(encounter.id);enemies=encounter.enemies;encounterId=encounter.id;
     }
    }
    if(kind==='elite')enemies=[pick(ELITES[chapter])];
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
 connectMap(nodes);
 const problems=validateMap(nodes);
 if(problems.length)throw new Error(`地图生成未通过校验：${problems.join('；')}`);
 return nodes;
}
