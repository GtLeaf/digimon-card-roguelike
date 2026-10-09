import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2),arg=(name,fallback)=>args[args.indexOf(name)+1]??fallback;
const label=args.includes('--label')?arg('--label','latest'):'latest';
const count=Number(args.includes('--count')?arg('--count','50'):50),offset=Number(args.includes('--offset')?arg('--offset','0'):0);
if(!/^[a-z0-9-]+$/.test(label)||!Number.isInteger(count)||count<1||!Number.isInteger(offset)||offset<0)throw Error('Invalid arguments');
const profiles=(args.includes('--profiles')?arg('--profiles','new,veteran'):'new,veteran').split(',');
const temp=await mkdtemp(join(tmpdir(),'digimon-sim-'));
try {
 const bundle=join(temp,'simulation.mjs');
 await build({stdin:{contents:`export * from './tests/helpers/journeySimulation'; export * from './src/game/data';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,define:{'import.meta.env.BASE_URL':'"/"'}});
 const {simulateJourney,ROUTES,CARDS}=await import(pathToFileURL(bundle).href);
 // 可加载本轮变更前冻结的卡牌定义，在独立验证种子上做相同策略对照。
 const snapshot=args.includes('--cards')?arg('--cards',null):null;
 if(snapshot){
  const old=JSON.parse(await readFile(join(root,snapshot),'utf8'));
  if(Object.keys(old).length!==Object.keys(CARDS).length||Object.keys(CARDS).some(id=>!old[id]||old[id].id!==id))throw Error('Invalid card snapshot');
  Object.assign(CARDS,old);
 }
 const out=join(root,'reports');await mkdir(out,{recursive:true});
 let veteran;
 try{veteran=JSON.parse(await readFile(join(out,'balance-veteran-profile.json'),'utf8')).meta;}
 catch{
  const provenance=[];
  for(const branch of ROUTES){const run=simulateJourney(branch,42,'synergy',veteran);veteran=run.meta;provenance.push({branch,seed:42,won:run.won,unlocked:run.unlocked,steps:run.steps,diagnostics:run.diagnostics});}
  await writeFile(join(out,'balance-veteran-profile.json'),JSON.stringify({description:'按七条路线连续执行真实行动获得的历史档案；未手工赋予研究或扫描。',provenance,meta:veteran},null,2)+'\n');
 }
 const rows=[];
 for(const profile of profiles)for(const strategy of ['survival','synergy'])for(const branch of ROUTES){
  for(let i=0;i<count;i++){
   const result=simulateJourney(branch,(offset+i)*7919+42,strategy,profile==='veteran'?veteran:undefined);
   delete result.meta;rows.push(result);
  }
  console.log(`${label}: ${profile} / ${strategy} / ${branch} ${count}局完成`);
 }
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
 const quantile=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]:0;
 const wilson=(wins,n)=>{const z=1.96,p=wins/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [c-h,c+h].map(x=>Math.round(x*1000)/10);};
 const summaries=[];
 for(const profile of profiles)for(const strategy of ['survival','synergy'])for(const branch of ROUTES){
  const group=rows.filter(r=>r.profile===profile&&r.strategy===strategy&&r.branch===branch),battles=group.flatMap(r=>r.battles),plays=battles.flatMap(b=>b.plays);
  const wins=group.filter(r=>r.won).length;
  summaries.push({profile,strategy,branch,n:group.length,wins,targetWins:group.filter(r=>r.targetWon).length,targetWinInterval95:wilson(group.filter(r=>r.targetWon).length,group.length),reached:group.filter(r=>r.reached).length,winInterval95:wilson(wins,group.length),diagnostics:group.filter(r=>r.diagnostics.length).length,meanBattleLoss:mean(battles.map(b=>b.hpStart-b.hpEnd)),meanBattleTurns:mean(battles.map(b=>b.turns)),p95Plays:quantile(plays,.95),maxPlays:Math.max(0,...plays),meanDeck:mean(group.map(r=>r.deck.length)),meanCopies:mean(battles.map(b=>b.copies)),meanRemainingCharge:mean(battles.map(b=>b.charge)),meanRemainingMarks:mean(battles.map(b=>b.marks)),deaths:group.reduce((out,r)=>{if(r.death){const key=`chapter${r.death.chapter}:${r.death.enemies.join('+')}`;out[key]=(out[key]??0)+1;}return out;},{})});
 }
 const policies={version:1,strategies:['survival','synergy'],maxDeck:16,maxShopCardPurchases:2,maxShopRemovals:2,seedFormula:'(offset+i)*7919+42',newProfile:'emptySave()',veteranProfile:'balance-veteran-profile.json',limitations:['固定策略测试，不代表玩家胜率；Wilson区间为该策略种子样本的描述。','两策略读取同一真实规则、采用同一卡组与商店预算；不窥视未来奖励/抽牌顺序。','地图节点内容与路线条件公开可见，可据此规划；路线未达成单独计数。','同种子行动不同会改变随机调用，后续遭遇/奖励并非全程完全相同。','战斗净失血包含自损与战斗胜利回复；回合数包括胜利所在回合。']};
 await writeFile(join(out,`journeys-${label}.json`),JSON.stringify({label,count,offset,policies,summaries,rows},null,2)+'\n');
 await writeFile(join(out,`cards-${label}.json`),JSON.stringify(CARDS,null,2)+'\n');
 const lines=summaries.map(s=>`| ${s.profile} | ${s.strategy} | ${s.branch} | ${s.wins}/${s.n} | ${s.targetWins}/${s.n} | ${s.reached}/${s.n} | ${s.winInterval95.join('～')}% | ${s.meanBattleLoss.toFixed(2)} | ${s.meanBattleTurns.toFixed(2)} | ${s.p95Plays}/${s.maxPlays} | ${s.diagnostics} |`);
 await writeFile(join(out,`journeys-${label}.md`),`# 多种子模拟：${label}\n\n共${rows.length}局；每组${count}个种子，offset=${offset}。\n\n${policies.limitations.map(s=>'- '+s).join('\n')}\n\n| 历史档案 | 策略 | 路线 | 通关 | 目标通关 | 到达终点 | 通关95%区间 | 每战净失血 | 每战回合 | 每回合出牌P95/最大 | 停滞/超限 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${lines.join('\n')}\n\n完整死亡、卡组、装置、选牌、强化、核心牌取得时间、资源残留与战斗记录见 [JSON](./journeys-${label}.json)。\n`);
 console.log(`完成 ${rows.length} 局，异常 ${rows.filter(r=>r.diagnostics.length).length} 局。`);
} finally{await rm(temp,{recursive:true,force:true});}
