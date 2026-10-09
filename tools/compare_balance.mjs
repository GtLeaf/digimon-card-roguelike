import { readFile,writeFile } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),out=join(root,'reports');
const load=async name=>JSON.parse(await readFile(join(out,name),'utf8'));
const trainingOld=await load('journeys-baseline.json'),trainingNew=await load('journeys-round2.json'),testOld=await load('journeys-holdout-baseline.json'),testNew=await load('journeys-holdout.json');
const oldCards=await load('cards-baseline.json'),newCards=await load('cards-round2.json');
const changes=Object.keys(oldCards).filter(id=>JSON.stringify(oldCards[id])!==JSON.stringify(newCards[id])).map(id=>({id,name:newCards[id].name,before:oldCards[id],after:newCards[id]}));
const key=r=>`${r.profile}/${r.strategy}/${r.branch}/${r.seed}`;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
function interval(xs,scale=1){let rng=42;const sample=[];for(let i=0;i<2000;i++){let sum=0;for(let j=0;j<xs.length;j++){rng=(Math.imul(1664525,rng)+1013904223)>>>0;sum+=xs[Math.floor((rng/4294967296)*xs.length)];}sample.push(sum/xs.length*scale);}sample.sort((a,b)=>a-b);return [sample[50],sample[1949]];}
function compare(before,after,label){
 if(JSON.stringify(before.policies)!==JSON.stringify(after.policies))throw Error(`策略约定不一致：${label}`);
 const map=new Map(before.rows.map(r=>[key(r),r]));
 if(map.size!==after.rows.length)throw Error('种子数量不一致');
 const pairs=after.rows.map(b=>{const a=map.get(key(b));if(!a)throw Error(`缺失种子${key(b)}`);return {a,b};});
 const report=[];
 for(const summary of before.summaries){
  const group=pairs.filter(({a})=>a.profile===summary.profile&&a.strategy===summary.strategy&&a.branch===summary.branch);
  const perRunLoss=r=>mean(r.battles.map(b=>b.hpStart-b.hpEnd));
  const perRunTurns=r=>mean(r.battles.map(b=>b.turns));
  const target=group.map(({a,b})=>Number(b.targetWon)-Number(a.targetWon)),loss=group.map(({a,b})=>perRunLoss(b)-perRunLoss(a));
  report.push({label,profile:summary.profile,strategy:summary.strategy,branch:summary.branch,n:group.length,beforeWins:group.filter(({a})=>a.won).length,afterWins:group.filter(({b})=>b.won).length,beforeTarget:group.filter(({a})=>a.targetWon).length,afterTarget:group.filter(({b})=>b.targetWon).length,targetDeltaPP:mean(target)*100,targetDelta95:interval(target,100),pairedMeanLossDelta:mean(loss),lossDelta95:interval(loss),pairedMeanTurnsDelta:mean(group.map(({a,b})=>perRunTurns(b)-perRunTurns(a))),newTargetWins:target.filter(x=>x>0).length,lostTargetWins:target.filter(x=>x<0).length,diagnosticsBefore:group.filter(({a})=>a.diagnostics.length).length,diagnosticsAfter:group.filter(({b})=>b.diagnostics.length).length});
 }
 return {label,n:pairs.length,report,wonBefore:before.rows.filter(r=>r.won).length,wonAfter:after.rows.filter(r=>r.won).length,targetBefore:before.rows.filter(r=>r.targetWon).length,targetAfter:after.rows.filter(r=>r.targetWon).length};
}
const training=compare(trainingOld,trainingNew,'调参种子'),holdout=compare(testOld,testNew,'独立验证种子');
const oldComb=await load('combinations-baseline.json'),newComb=await load('combinations-round2.json');
const one=c=>c.candidates.filter(r=>r.id==='bloodedge'&&!r.upgraded&&JSON.stringify(r.variant)==='{"enemies":1}')[0].metric;
const copy=c=>c.sequenceRows.filter(r=>r.source==='battery'&&r.upgraded&&r.energy===3)[0].result;
const aggregate=rows=>Object.fromEntries(['illusion','bloodedge','tinyTwister'].map(id=>[id,{picked:rows.reduce((n,r)=>n+(r.picked[id]??0),0),used:rows.reduce((n,r)=>n+(r.used[id]??0),0),upgraded:rows.reduce((n,r)=>n+(r.upgraded[id]??0),0)}]));
// 保留独立验证中丢失目标终点的配对诊断，避免总胜率掩盖路线退化。
const heldoutBefore=new Map(testOld.rows.map(r=>[key(r),r]));
const routeRegressions=testNew.rows.filter(r=>heldoutBefore.get(key(r)).targetWon&&!r.targetWon).map(after=>{
 const before=heldoutBefore.get(key(after));
 return {seed:after.seed,profile:after.profile,strategy:after.strategy,branch:after.branch,before:{form:before.form,counts:before.counts,used:before.used},after:{form:after.form,counts:after.counts,used:after.used,missing:after.targetMissing}};
});
const result={version:2,changes,routeRegressions,training,holdout,combinationSummary:newComb.summary,specificEvidence:{bloodedgeBefore:one(oldComb),bloodedgeAfter:one(newComb),copyBatteryBefore:copy(oldComb),copyBatteryAfter:copy(newComb)},strategyUsageBefore:aggregate(trainingOld.rows),strategyUsageAfter:aggregate(trainingNew.rows),limitations:['配对自助法95%区间为固定策略种子差额的描述，非玩家胜率；50种子仍有较大不确定性。','每战净失血差额先在每局取均值，再按种子配对；与单份报告的全战斗加权均值不同。','训练与独立验证种子不重叠；新档案和历史档案分别列示。','任何目标路线退化、回合延长或失血增加均需结合变化原因，不自动判为统计显著。']};
await writeFile(join(out,'balance-round2-comparison.json'),JSON.stringify(result,null,2)+'\n');
const table=cohort=>cohort.report.map(r=>`| ${r.profile} | ${r.strategy} | ${r.branch} | ${r.beforeWins}→${r.afterWins} | ${r.beforeTarget}→${r.afterTarget} | ${r.targetDelta95.map(x=>x.toFixed(1)).join('～')} | ${r.pairedMeanLossDelta.toFixed(3)} | ${r.lossDelta95.map(x=>x.toFixed(3)).join('～')} | ${r.pairedMeanTurnsDelta.toFixed(3)} |`).join('\n');
const head='| 档案 | 策略 | 路线 | 通关/50 | 目标通关/50 | 目标差额95%区间（百分点） | 每战失血差额 | 失血差额95%区间 | 每战回合差额 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const missing=testNew.rows.filter(r=>!r.reached).reduce((acc,r)=>{for(const group of r.targetMissing){const labels=Array.isArray(group)?group.map(x=>x.label).join('或'):group.label;acc[`${r.branch}: ${labels}`]=(acc[`${r.branch}: ${labels}`]??0)+1;}return acc;},{});
const evidence=`血色利刃同形态、单敌：实际伤害 ${one(oldComb).damage}→${one(newComb).damage}，自损仍3。狐变虚＋复制并使用能量装填＋，净能量仍＋1；新增可用牌 ${copy(oldComb).cards}→${copy(newComb).cards}，序列U ${copy(oldComb).score}→${copy(newComb).score}。`;
await writeFile(join(out,'balance-round2-comparison.md'),`# 第二轮平衡前后对照\n\n三张牌发生变化：血色利刃16/19伤害、小型龙卷风5/8伤害、狐变虚＋追加抽1张。其余牌和路线门槛保持第一轮规则。\n\n调参种子前后各${training.n}局，独立验证种子前后各${holdout.n}局，共${training.n*2+holdout.n*2}局正式模拟。每份报告均包括新档案700局与历史档案700局。历史资料由7场真实行动旅途获得，见[档案来源](./balance-veteran-profile.json)。\n\n${result.limitations.map(s=>'- '+s).join('\n')}\n\n${evidence}\n\n## 调参种子\n\n总体通关 ${training.wonBefore}→${training.wonAfter}/${training.n}，目标路线通关 ${training.targetBefore}→${training.targetAfter}/${training.n}。\n\n${head}\n${table(training)}\n\n## 独立验证种子\n\n总体通关 ${holdout.wonBefore}→${holdout.wonAfter}/${holdout.n}，目标路线通关 ${holdout.targetBefore}→${holdout.targetAfter}/${holdout.n}。\n\n${head}\n${table(holdout)}\n\n## 未达成终点的原因\n\n${Object.entries(missing).map(([label,count])=>'- '+label+'：'+count+'局').join('\n')}\n\n## 路线下降的配对诊断\n\n独立验证中新档案、生存策略的混沌路线41→38/50，丢失的三个种子为435587、768185、784023：最终有效治疗均为4次，但错过剩余进化机会；调整前分别为7、8、8次并已到达混沌终点。血色利刃使用次数分别11→11、9→12、7→9。该组平均每战少0.128回合、净失血多0.278；这是效率与自损／行为进度的取舍信号。推测更快结束战斗减少了及时治疗的机会，后续随机奖励也随行动变化，不能将全部差额归因于一张牌。完整丢失终点的配对记录见JSON中的routeRegressions。\n\n## 组合与循环\n\n${newComb.summary.sequences}项复制序列、${newComb.summary.candidateScenes}项同形态单牌、${newComb.summary.turns}项主题回合、${newComb.summary.loops}项资源回路。循环超限${newComb.summary.loopTruncations}，主题回合重复/超限${newComb.summary.turnTruncations}，主题回合最多${newComb.summary.maxTurnPlays}次出牌。合法但第二步支付不起的复制序列记录为失败，不能当作可兑现收益。\n\n原始[对照数据](./balance-round2-comparison.json)、[组合数据](./combinations-round2.json)、[基线](./journeys-baseline.md)、[调整后](./journeys-round2.md)、[独立基线](./journeys-holdout-baseline.md)、[独立调整后](./journeys-holdout.md)。自动模拟不能替代人工难度与趣味评估。\n`);
console.log(JSON.stringify({training:{wins:[training.wonBefore,training.wonAfter],target:[training.targetBefore,training.targetAfter]},holdout:{wins:[holdout.wonBefore,holdout.wonAfter],target:[holdout.targetBefore,holdout.targetAfter]},changed:changes.map(c=>c.id),combined:newComb.summary}));
