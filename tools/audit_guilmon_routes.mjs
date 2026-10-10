import { build } from 'esbuild';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2);
const phase=args.includes('--phase')?args[args.indexOf('--phase')+1]:'after';
if(!['before','after'].includes(phase))throw Error('phase需为before或after');
const paths=[
 {id:'standard-duke',branch:'duke',forms:['growlmon','wargrowlmon','dukemon']},
 {id:'standard-megidra',branch:'megidra',forms:['growlmon','wargrowlmon','megidramon']},
 {id:'dark-duke',branch:'duke',forms:['blackgrowmon','wargrowlmon','dukemon']},
 {id:'dark-return-megidra',branch:'megidra',forms:['blackgrowmon','wargrowlmon','megidramon']},
 {id:'dark-megidra',branch:'megidra',forms:['blackgrowmon','blackwargrowlmon','megidramon']},
 {id:'dark-chaos',branch:'chaos',forms:['blackgrowmon','blackwargrowlmon','chaosdukemon']},
];
const temp=await mkdtemp(join(tmpdir(),'guilmon-routes-'));
try {
 const bundle=phase==='before'?join(root,'.backups/guilmon-chain-20261009/baseline.mjs'):join(temp,'after.mjs');
 if(phase==='after')await build({stdin:{contents:"export * from './tests/helpers/journeySimulation';export * from './src/game/data';export * from './src/game/evolution';",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,define:{'import.meta.env.BASE_URL':'"/"'}});
 const {simulateJourney,CARDS,EVOLUTIONS}=await import(pathToFileURL(bundle).href);
 const veteran=JSON.parse(await readFile(join(root,'docs/reports/balance-veteran-profile.json'),'utf8')).meta;
 const rows=[];
 for(const cohort of ['development','holdout'])for(const profile of ['new','veteran'])for(const strategy of ['survival','synergy'])for(const path of paths){
  const offset=cohort==='development'?0:50;
  for(let i=0;i<50;i++){
   const result=simulateJourney(path.branch,(offset+i)*7919+42,strategy,profile==='veteran'?veteran:undefined,path.forms);
   delete result.meta;rows.push({...result,cohort,path:path.id,plannedForms:path.forms});
  }
  console.log(`${phase}: ${cohort}/${profile}/${strategy}/${path.id} 完成50局`);
 }
 const simulationSource=phase==='before'?'.backups/guilmon-chain-20261009/journeySimulation.ts':'tests/helpers/journeySimulation.ts';
 const policies={seeds:'i*7919+42; development i=0..49; holdout i=50..99',strategies:['survival','synergy'],maxDeck:16,maxShopCardPurchases:2,maxShopRemovals:2,paths,veteran:'balance-veteran-profile.json',simulationHash:createHash('sha256').update(await readFile(join(root,simulationSource))).digest('hex')};
 const out=join(root,'docs','reports');await mkdir(out,{recursive:true});
 const file=join(out,`guilmon-chain-${phase}.json`);
 await writeFile(file,JSON.stringify({phase,modelHash:createHash('sha256').update(await readFile(bundle)).digest('hex'),policies,cards:CARDS,evolutions:EVOLUTIONS,rows},null,2)+'\n');
 if(phase==='after'){
  const before=JSON.parse(await readFile(join(out,'guilmon-chain-before.json'),'utf8'));
  if(JSON.stringify(before.policies)!==JSON.stringify(policies))throw Error('前后策略约定不一致，不能生成公平对照');
  const key=r=>[r.cohort,r.profile,r.strategy,r.path,r.seed].join('/'),old=new Map(before.rows.map(r=>[key(r),r]));
  if(old.size!==rows.length)throw Error('前后样本数量不一致');
  const mean=xs=>xs.reduce((n,x)=>n+x,0)/xs.length;
  const stats=[];
  for(const cohort of ['development','holdout'])for(const path of paths){
   const paired=rows.filter(r=>r.cohort===cohort&&r.path===path.id).map(b=>{const a=old.get(key(b));if(!a)throw Error('缺少配对基线');return {a,b};});
   const wins=side=>paired.filter(p=>p[side].won).length,target=side=>paired.filter(p=>p[side].targetWon).length;
   stats.push({cohort,path:path.id,n:paired.length,winsBefore:wins('a'),winsAfter:wins('b'),targetBefore:target('a'),targetAfter:target('b'),lossDelta:mean(paired.map(({a,b})=>mean(b.battles.map(x=>x.hpStart-x.hpEnd))-mean(a.battles.map(x=>x.hpStart-x.hpEnd)))),turnDelta:mean(paired.map(({a,b})=>mean(b.battles.map(x=>x.turns))-mean(a.battles.map(x=>x.turns))))});
  }
  const regressions=rows.filter(b=>old.get(key(b)).targetWon&&!b.targetWon).map(b=>({cohort:b.cohort,profile:b.profile,strategy:b.strategy,path:b.path,seed:b.seed,before:old.get(key(b)).counts,after:b.counts,missing:b.targetMissing}));
  const diagnostics=rows.filter(r=>r.diagnostics.length);
  await writeFile(join(out,'guilmon-chain-comparison.json'),JSON.stringify({policies,stats,regressions,diagnostics},null,2)+'\n');
  const table=stats.map(s=>`| ${s.cohort} | ${s.path} | ${s.winsBefore}→${s.winsAfter}/${s.n} | ${s.targetBefore}→${s.targetAfter}/${s.n} | ${s.lossDelta.toFixed(3)} | ${s.turnDelta.toFixed(3)} |`).join('\n');
  await writeFile(join(out,'guilmon-chain-comparison.md'),`# 基尔兽六路径前后对照\n\n前后各2400局，共4800局；两种策略、新／历史档案、每组50个种子。独立种子与开发种子不重叠。固定策略和预算保持一致，规则、赠牌与卡池同时调整；差额不能归因于单个改动，也不代表玩家胜率。失血差额先在每局取每战均值，再按种子配对；负值表示减少。\n\n| 种子组 | 路径 | 总体通关 | 目标通关 | 每战净失血差额 | 每战回合差额 |\n| --- | --- | --- | --- | --- | --- |\n${table}\n\n调整后异常${diagnostics.length}局；丢失目标的配对种子${regressions.length}局，逐项诊断见[对照JSON](./guilmon-chain-comparison.json)。全部行动结果、卡牌／形态快照见[调整前](./guilmon-chain-before.json)、[调整后](./guilmon-chain-after.json)。\n`);
 }
 console.log(`已保存${rows.length}局；异常${rows.filter(r=>r.diagnostics.length).length}。`);
}finally{await rm(temp,{recursive:true,force:true});}
