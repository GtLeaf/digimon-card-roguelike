import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),temp=await mkdtemp(join(tmpdir(),'digimon-combos-'));
const args=process.argv.slice(2);
const label=args.includes('--label')?args[args.indexOf('--label')+1]:'latest';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid label');
try{
 const bundle=join(temp,'audit.mjs');
 await build({stdin:{contents:`export * from './src/game/balance';export * from './src/game/data';export * from './src/game/engine';export * from './src/game/evolution';export * from './src/game/cardSkills';export * from './tests/helpers/balanceScenario';export * from './tests/helpers/journeySimulation';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,define:{'import.meta.env.BASE_URL':'"/"'}});
 const {CARDS,EVOLUTIONS,cardDefinition,skillUnlocked,calibrateAction,calibrateSequence,contextualBalanceOptions,reduceGame,combatCandidates,balanceScenario}=await import(pathToFileURL(bundle).href);
 const card=(id,uid,upgraded)=>({id,uid,upgraded});
 const history=form=>EVOLUTIONS[form].parents.length?[...history(EVOLUTIONS[form].parents[0]),form]:[form];
 function scenario(ids,form,upgraded,variant={}){
  const hand=ids.map((id,i)=>card(id,`hand-${i}`,upgraded));
  const s=balanceScenario(hand,form,Array(variant.enemies??1).fill(variant.enemy??'goblimon'));
  const r=s.run,b=r.battle;r.formHistory=history(form);r.hp=variant.hp??60;r.training=variant.training??'defense';r.relics=variant.cooler?['cooler']:[];
  b.turn=variant.turn??1;b.strength=variant.strength??0;b.burst=variant.burst??0;b.charge=variant.charge??0;
  for(const e of b.enemies){e.hp=variant.enemyHp??100;e.maxHp=100;e.block=variant.block??0;}
  const size=variant.size??10;
  b.draw=Array.from({length:Math.max(0,size-hand.length)},(_,i)=>card(i%2?'strike':'guard',`draw-${i}`,false));
  r.deck=[...hand,...b.draw];
  if(r.deck.some(c=>!skillUnlocked(r,CARDS[c.id])))throw Error(`未解锁场景 ${form}/${ids}`);
  return s;
 }
 function strip(result){const {state,...metric}=result;void state;return metric;}
 const sequenceRows=[];
 for(const source of ['battery','mend','ritual','leaf'])for(const upgraded of [false,true])for(const energy of [1,2,3]){
  const form=source==='ritual'?'taomon':'renamon',s=scenario(['illusion',source,'guard'],form,upgraded);s.run.battle.energy=energy;
  const action={type:'play',uid:'hand-0',copyUid:'hand-1'},next=reduceGame(s,action),copy=next.run.battle.hand.find(c=>c.copied);
  const actions=copy?[action,{type:'play',uid:copy.uid}]:[action];
  sequenceRows.push({source,upgraded,energy,actions,result:strip(calibrateSequence(s,actions,contextualBalanceOptions(s)))});
 }
 const candidates=[];
 for(const [form,ids] of [['blackgrowmon',['rock','darkflame','bloodedge']],['terriermon',['strike','tinyTwister','blazingShot']],['taomon',['guard','brace','barrier','fortify']],['blacksaintgalgomon',['cannon','blackMissile','heavySalvo']],['megidramon',['fireball','ignite','apocalypse','megido']]]){
  for(const id of ids)for(const upgraded of [false,true])for(const variant of [{enemies:1},{enemies:2},{enemy:'leomon'},{enemy:'sinduramon',turn:2},{enemy:'devidramon',turn:3},{enemyHp:8},{block:12},{charge:3},{charge:6},{strength:2,training:'attack',burst:3,cooler:true}]){
   const s=scenario([id,...(form==='megidramon'?['ignite']:form==='blacksaintgalgomon'?['cannon']:form==='taomon'?['seal']:['strike'])],form,upgraded,variant);
   if(id==='ignite')s.run.battle.enemies[0].burn=5;
   candidates.push({id,upgraded,form,variant,metric:calibrateAction(s,{type:'play',uid:'hand-0'},contextualBalanceOptions(s))});
  }
 }
 const themes=[
  {name:'多段力量',form:'growlmon',branch:'duke',ids:['roar','doublecut','fireball','guard','brace']},
  {name:'灼烧引爆',form:'megidramon',branch:'megidra',ids:['apocalypse','ignite','fireball','guard','megido']},
  {name:'自损恢复',form:'chaosdukemon',branch:'chaos',ids:['bloodedge','mend','chaoslance','sacrifice','guard']},
  {name:'符印解印',form:'sakuyamon',branch:'sakuya',ids:['talisman','leaf','mirrors','sacred','guard']},
  {name:'抽牌复制',form:'kuzuhamon',branch:'kuzuha',ids:['illusion','study','insight','ritual','foxguardian']},
  {name:'连射',form:'saintgalgomon',branch:'saint',ids:['gatling','rapidFire','giantMissile','battery','guard']},
  {name:'防守炮击',form:'blacksaintgalgomon',branch:'blacksaint',ids:['fortressLoad','heavySalvo','blackMissile','charge','guard']},
 ];
 const variants=[{},{enemies:2},{enemy:'leomon'},{enemy:'sinduramon',turn:2},{enemy:'devidramon',turn:3},{hp:4},{hp:100},{enemyHp:8},{block:12},{turn:2},{strength:2,training:'attack',burst:3,cooler:true}];
 const turns=[];
 for(const theme of themes)for(const size of [5,10,16])for(const upgraded of [false,true])for(const variant of variants){
  const s=scenario(theme.ids,theme.form,upgraded,{...variant,size});let next=s;const actions=[],trajectory=[];let reason='no-positive-action';
  const seen=new Set();
  while(actions.length<120&&next.run.screen==='battle'){
   const b=next.run.battle;
   const signature=JSON.stringify({energy:b.energy,hp:next.run.hp,hand:b.hand.map(c=>[c.id,c.upgraded,c.copied]),draw:b.draw.map(c=>[c.id,c.upgraded]),discard:b.discard.map(c=>[c.id,c.upgraded]),exhaust:b.exhaust.length,copyUses:b.copyUses,strength:b.strength,charge:b.charge,enemies:b.enemies.map(e=>[e.hp,e.burn,e.mark])});
   if(seen.has(signature)){reason='repeated-state';break;}seen.add(signature);
   const selected=combatCandidates(next,'synergy',theme.branch)[0];
   if(!selected||selected.score<=0)break;
   actions.push(selected.action);next=selected.next;trajectory.push({energy:next.run.battle.energy,hp:next.run.hp,strength:next.run.battle.strength,charge:next.run.battle.charge,copies:next.run.battle.copyUses});
  }
  if(actions.length>=120)reason='step-limit';else if(next.run.screen!=='battle')reason=next.run.screen;
  const result=actions.length?strip(calibrateSequence(s,actions,contextualBalanceOptions(s))):{legal:false,reason:'no-action'};
  const ended=next.run.screen==='battle'?reduceGame(next,{type:'endTurn'}):next;
  turns.push({theme:theme.name,size,upgraded,variant,reason,actions,trajectory,result,endHp:ended.run.hp,endScreen:ended.run.screen});
 }
 const loops=[];
 for(const source of ['battery','mend','ritual','apocalypse'])for(const size of [5,10,16]){
  const form=source==='apocalypse'?'megidramon':source==='ritual'?'taomon':'renamon';
  // 灼烧回路没有复制牌跨搭档；其他回路都在妖狐路线内。
  const ids=source==='apocalypse'?['study','study','apocalypse','guard','guard']:['illusion','illusion','study','study',source];
  const s=scenario(ids,form,true,{size,enemyHp:100});let next=s;const actions=[],trajectory=[];
  while(actions.length<120&&next.run.screen==='battle'){
   const b=next.run.battle;
   const viable=b.hand.filter(c=>cardDefinition(c).cost<=b.energy&&!(c.id==='illusion'&&(b.copyUses>=2||!b.hand.some(n=>n.id===source&&!n.copied))));
   const rank=c=>c.copied?0:c.id==='illusion'?1:c.id===source?2:c.id==='study'?3:4;
   const c=viable.sort((a,b)=>rank(a)-rank(b))[0];if(!c)break;
   const target=b.hand.find(c=>c.id===source&&!c.copied);
   const action={type:'play',uid:c.uid,...(c.id==='illusion'?{copyUid:target?.uid}:{})},after=reduceGame(next,action);
   if(after.run.battle.played===b.played)throw Error('循环检测非法行动');
   next=after;actions.push(action);trajectory.push({energy:next.run.battle.energy,hp:next.run.hp,strength:next.run.battle.strength,copyUses:next.run.battle.copyUses,burn:next.run.battle.enemies[0].burn});
  }
  loops.push({source,size,upgraded:true,form,ids,steps:actions.length,truncated:actions.length>=120,actions,trajectory});
 }
 const out=join(root,'reports');await mkdir(out,{recursive:true});
 const summary={sequences:sequenceRows.length,candidateScenes:candidates.length,turns:turns.length,loops:loops.length,loopTruncations:loops.filter(r=>r.truncated).length,turnTruncations:turns.filter(r=>r.reason==='step-limit'||r.reason==='repeated-state').length,maxTurnPlays:Math.max(...turns.map(r=>r.actions.length))};
 await writeFile(join(out,`combinations-${label}.json`),JSON.stringify({version:2,label,summary,limitations:['固定场景由正式引擎运行，人工构造初始牌堆；不是玩家试玩或胜率。','单牌默认使用有/无消费出口估计；序列初末资源池只核算一次。','各主题均验证本局来源形态解锁；场景为第一回合/指定意图，不能覆盖所有组合。','循环测试120步为诊断上限；有限策略检验不证明所有可构造循环不存在。'],sequenceRows,candidates,turns,loops},null,2)+'\n');
 console.log(JSON.stringify(summary));
}finally{await rm(temp,{recursive:true,force:true});}
