// 5193独立端口仅保存测试状态，避免与正常游戏及其他验收页共享存档。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { emptySave, reduceGame } from '../../src/game/engine';
import { writeSave } from '../../src/game/storage';
import type { Card } from '../../src/game/types';
import '../../src/styles.css';

type Scenario='growl'|'war-burn'|'dark-heal'|'evolve-war'|'evolve-chaos';
function Preview(){
 const [key,setKey]=useState(0);
 function open(scenario:Scenario){
  if(location.port!=='5193')throw Error('请使用独立验收端口5193');
  let save=reduceGame(reduceGame(emptySave(),{type:'start',partner:'guilmon',seed:42}),{type:'bless',id:'guard'});
  const evolution=scenario.startsWith('evolve');
  if(!evolution){
   save.run!.nodes[0][0].enemies=scenario==='war-burn'?['core','core']:['core'];
   save=reduceGame(save,{type:'node',id:save.run!.nodes[0][0].id});
  }
  const form=scenario==='growl'||scenario==='evolve-war'?'growlmon':scenario==='war-burn'?'wargrowlmon':'blackwargrowlmon';
  const ids=scenario==='evolve-war'?['fireball','doublecut','rock','guard','guard','strike','strike','ignite','roar','heatwave']:scenario==='growl'?['fireball','doublecut','ignite']:scenario==='war-burn'?['fireball','fireball','flare']:scenario==='dark-heal'?['bloodedge','drain','sacrifice','ignite']:['darkflame','bloodedge','sacrifice','drain','fireball','guard','guard','strike','strike','ignite'];
  const cards:Card[]=ids.map((id,i)=>({id,uid:`guilmon-qa-${i}`,upgraded:scenario!=='war-burn'}));
  Object.assign(save.run!,{deck:cards,form,stage:form==='growlmon'?1:2,formHistory:form==='growlmon'?['guilmon','growlmon']:form==='wargrowlmon'?['guilmon','growlmon','wargrowlmon']:['guilmon','blackgrowmon','blackwargrowlmon'],hp:60,training:'defense',inherit:'ember',blessing:''});
  if(evolution){
   Object.assign(save.run!,{screen:'evolution',row:scenario==='evolve-war'?8:16,bosses:scenario==='evolve-war'?1:2,victories:6,currentNode:null});
   save.run!.activity.counts={attacks:20,fire:10,selfCosts:6,heals:4,detonations:3,burnKills:6};
   save.meta.unlockedRoutes=['chaos'];
  }else{
   Object.assign(save.run!.battle!,{hand:cards,draw:[],discard:[],exhaust:[],block:0,energy:3,charge:form==='wargrowlmon'?1:0});
   save.run!.battle!.enemies.forEach(e=>{e.hp=100;e.maxHp=100;});
   if(scenario==='war-burn')save.run!.battle!.enemies[0].hp=5;
  }
  save.settings.reducedMotion=true;writeSave(save);setKey(k=>k+1);
 }
 return <><aside><b>基尔兽独立验收</b><button onClick={()=>open('growl')}>烈焰追击验收</button><button onClick={()=>open('war-burn')}>余烬触发验收</button><button onClick={()=>open('dark-heal')}>自损恢复验收</button><button onClick={()=>open('evolve-war')}>大古拉兽赠牌验收</button><button onClick={()=>open('evolve-chaos')}>混沌转型验收</button></aside><App key={key}/></>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
