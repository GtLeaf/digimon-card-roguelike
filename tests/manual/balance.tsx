// 独立端口构造验收状态，不访问正常游戏页面的存档。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { emptySave, reduceGame } from '../../src/game/engine';
import { writeSave } from '../../src/game/storage';
import type { Card, Partner } from '../../src/game/types';
import '../../src/styles.css';

function Preview() {
 const [key, setKey] = useState(0);
 function open(scenario: 'copy' | 'upgrades' | 'cannon' | 'legacy' | 'cap' | 'empty' | 'blood' | 'twister') {
  if (location.port !== '5179') throw Error('请使用独立验收端口5179。');
  const partner: Partner = scenario === 'blood' ? 'guilmon' : ['cannon','twister'].includes(scenario) ? 'terriermon' : 'renamon';
  let save = reduceGame(reduceGame(emptySave(), {type:'start', partner, seed:42}), {type:'bless', id:'guard'});
  save.run!.nodes[0][0].enemies = scenario === 'twister' ? ['goblimon','goblimon'] : ['core'];
  save = reduceGame(save, {type:'node', id:save.run!.nodes[0][0].id});
  const ids = scenario === 'blood' ? ['bloodedge','guard'] : scenario === 'twister' ? ['tinyTwister','guard'] : scenario === 'empty' ? ['illusion','fault'] : ['copy','legacy','cap'].includes(scenario) ? ['illusion','guard','insight','fault'] : scenario === 'cannon' ? ['heavySalvo','blackMissile','fortressLoad'] : ['haste','battery','purge','sacrifice','insight','study','apocalypse'];
  const cards: Card[] = ids.map((id,i)=>({id,uid:`qa-${i}`,upgraded:scenario !== 'cannon'}));
  const form = scenario === 'blood' ? 'blackgrowmon' : scenario === 'twister' ? 'terriermon' : scenario === 'cannon' ? 'blacksaintgalgomon' : 'taomon';
  const draw: Card[] = scenario === 'copy' ? [{id:'strike',uid:'qa-draw',upgraded:false}] : [];
  Object.assign(save.run!, {deck:[...cards,...draw], form, stage:scenario==='blood'?1:scenario==='twister'?0:scenario==='cannon'?3:2, training:scenario==='cannon'?'attack':'defense', branch:scenario === 'cannon'?'blacksaint':null, hp:40, formHistory:form===partner?[partner]:[partner,form]});
  Object.assign(save.run!.battle!, {hand:cards, draw, discard:[], exhaust:[], charge:scenario === 'cannon'?3:0, energy:3, copyUses:scenario==='cap'?2:0});
  save.settings.reducedMotion = true;
  if (scenario === 'legacy') localStorage.setItem('digimon-journey-v1',JSON.stringify({...save,version:1}));
  else writeSave(save);
  setKey(value=>value+1);
 }
 return <><aside style={{padding:12,display:'flex',flexWrap:'wrap',gap:8}}><b>独立平衡验收</b><button onClick={()=>open('copy')}>复制验收</button><button onClick={()=>open('blood')}>血刃验收</button><button onClick={()=>open('twister')}>群攻验收</button><button onClick={()=>open('upgrades')}>强化验收</button><button onClick={()=>open('cannon')}>重炮验收</button><button onClick={()=>open('legacy')}>旧档验收</button><button onClick={()=>open('cap')}>复制上限验收</button><button onClick={()=>open('empty')}>无目标验收</button></aside><App key={key}/></>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
