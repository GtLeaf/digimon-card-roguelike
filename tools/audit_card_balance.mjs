import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2),label=args.includes('--label')?args[args.indexOf('--label')+1]:'latest';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid label');
const temp=await mkdtemp(join(tmpdir(),'digimon-balance-'));
try {
 const sourceHashes=Object.fromEntries(await Promise.all(['src/game/balance.ts','src/game/data.ts','src/game/cardUpgrades.ts','src/game/battle.ts','src/game/hooks.ts','src/game/evolution.ts','src/game/enemyRules.ts','src/game/engine.ts','src/game/cardSkills.ts','tests/helpers/balanceScenario.ts','tests/helpers/balanceLoop.ts','tools/audit_card_balance.mjs'].map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 const bundle=join(temp,'model.mjs');
 await build({stdin:{contents:`export * from './src/game/balance'; export * from './src/game/data'; export * from './src/game/engine'; export * from './tests/helpers/balanceScenario';export * from './src/game/cardSkills';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,define:{'import.meta.env.BASE_URL':'"/"'}});
 const {skillUnlocked,BALANCE_VERSION,CARDS,cardDefinition,calibrateAction,contextualBalanceOptions,BALANCE_DEFAULTS,balanceScenario}=await import(pathToFileURL(bundle).href);
 const rows=[];
 function measure(id,upgraded,count,threat,extra={}) {
  const def=cardDefinition({id,upgraded}),form=extra.form??def.unlockForm??'renamon';
  const cards=[{id,uid:'audit-card',upgraded},...['battery','guard','strike'].map((id,i)=>({id,uid:`source-${i}`,upgraded:true}))];
  const s=balanceScenario(cards,form,Array(count).fill(threat==='multihit'?'leomon':'goblimon'));
  const b=s.run.battle;b.turn=extra.turn??(threat==='reactive'?2:1);
  b.charge=extra.charge??(def.special==='cannon'?3:0);
  b.devour=extra.devour??((def.special==='devour'||def.devourHits||def.devourStrength||def.devourVuln||def.devourHeal||def.devourShield||def.devourWeak)?3:0);
  b.block=extra.block??0;b.selfCostThisTurn=extra.selfCost??false;b.attackPlays=extra.attackPlays??0;s.run.hp=extra.hp??60;
  if(def.special==='detonate'||def.special==='pyre')b.enemies[0].burn=5;
  if(def.special==='markburst')b.enemies[0].mark=3;
  b.draw=Array.from({length:8},(_,i)=>({id:i%2?'strike':'guard',uid:`draw-${i}`,upgraded:false}));
  // 只从此进化历史可获得的牌中补充出口；禁止跨终点混搭。
  const legal=Object.values(CARDS).filter(d=>skillUnlocked(s.run,d));
  const exits=extra.noOutlets?[]:[
    legal.find(d=>d.special==='markburst'),
    legal.find(d=>d.special==='cannon'||d.chargeSeg||d.chargedDamage),
    legal.find(d=>d.special==='devour'||d.devourHits||d.devourStrength||d.devourShield||d.devourHeal||d.devourVuln||d.devourWeak),
  ].filter(Boolean);
  for(const [i,d] of [...new Map(exits.map(d=>[d.id,d])).values()].entries()) b.draw[i]={id:d.id,uid:`outlet-${i}`,upgraded};
  s.run.deck=[...b.hand,...b.draw];
  if(s.run.deck.some(c=>!skillUnlocked(s.run,CARDS[c.id])))throw Error(`非法来源场景 ${id}/${form}`);
  const options={...extra.options};
  const result=calibrateAction(s,{type:'play',uid:'audit-card',copyUid:'source-0'},options);
  rows.push({id,name:def.name,upgraded,form,stage:s.run.stage,enemyCount:count,threat,turn:b.turn,initialDevour:b.devour,block:b.block,selfCost:b.selfCostThisTurn,attackPlays:b.attackPlays,hp:s.run.hp,noSupplementalOutlets:!!extra.noOutlets,history:s.run.formHistory,deck:s.run.deck.map(c=>({id:c.id,upgraded:c.upgraded})),initialCharge:b.charge,initialBurn:b.enemies[0].burn,initialMark:b.enemies[0].mark,copySource:def.special==='copy'?'battery+':null,exhaust:!!def.exhaust,tags:[...(def.special?[def.special]:[]),...(def.copyChoice?['指定复制']:[])],options,context:contextualBalanceOptions(s),...result});
 }
 const normal=Object.values(CARDS).filter(d=>d.kind!=='status');
 for(const d of normal)for(const upgraded of [false,true])for(const count of [1,2,3])for(const threat of ['attack','multihit']){
  const forms=d.family==='common'?['guilmon','blackwargrowlmon','renamon','taomon','terriermon','blacksaintgalgomon','impmon','matadormonAwakened']:[d.unlockForm];
  for(const form of forms)measure(d.id,upgraded,count,threat,{form});
 }
 const standardCount=rows.length;
 // 同形态、同蓄能比较炮击；额外覆盖短战/长战与无消费出口。
 for(const id of ['blackMissile','heavySalvo'])for(const upgraded of [false,true])for(const charge of [0,3,6])measure(id,upgraded,1,'attack',{form:'blacksaintgalgomon',charge});
 for(const id of ['apocalypse','talisman','charge'])for(const upgraded of [false,true])for(const options of [{turns:1},{turns:5},{markChance:0,chargeChance:0}])measure(id,upgraded,1,'attack',{options});
 for(const d of normal)for(const upgraded of [false,true]){
  if(d.devour||d.convert||d.special==='devouraura'||d.special==='devour'||d.devourHits||d.devourStrength||d.devourVuln||d.devourHeal||d.devourShield||d.devourWeak)
   for(const devour of [0,3,6]) measure(d.id,upgraded,1,'attack',{devour});
  if(d.charge||d.chargeSeg||d.chargedDamage)for(const charge of [0,3,6])measure(d.id,upgraded,1,'attack',{charge});
  if(d.special==='shieldhit')for(const block of [0,10,20,30])measure(d.id,upgraded,1,'attack',{block});
  if(d.selfCostBonus)measure(d.id,upgraded,1,'attack',{selfCost:true});
  if(d.special==='spinstep')measure(d.id,upgraded,1,'attack',{attackPlays:1});
  if(d.heal||d.devourHeal||d.drain||d.drainRatio)measure(d.id,upgraded,1,'attack',{hp:100});
  if(d.mark||d.charge||d.devour)measure(d.id,upgraded,1,'attack',{noOutlets:true});
 }
 for(const id of ['gramLance','royal'])for(const upgraded of [false,true])for(const block of [0,10,20,30])measure(id,upgraded,1,'attack',{block});
 for(const id of ['abyssLance','chaoslance'])for(const upgraded of [false,true])for(const selfCost of [false,true])measure(id,upgraded,1,'attack',{selfCost});
 const limitations=['唯一公式v3，权重仍为待验证的筛查假设；分数不是通关率或官方公式。','常规场景：HP60/100，3行动力，无装置，守护训练，灵巧继承，来源形态首张出牌；敌方HP100、无护盾；通用牌另测8个搭档/阶段场景。','引爆/末日审判预置5灼烧；解印预置3符印；炮击预置3蓄能；噬能消费者预置3噬能；额外场景以JSON字段为准；复制来源固定为能量装填＋。','不将破盾、耗竭减薄、清故障、进化进度与复制选择灵活性压成分数。','资源出口来自合法进化历史；噬能/蓄能用引擎反事实试算，最多三次同出口。试算补能/取牌属于估值假设，不是合法连招。未计价收益单列。','有限场景不证明不存在其他循环；完整回合与通关测试独立执行。'];
 const report={version:BALANCE_VERSION,label,sourceHashes,defaults:BALANCE_DEFAULTS,cardCount:normal.length,standardCount,scenarioCount:rows.length,limitations,rows};
 const out=join(root,'docs','reports');await mkdir(out,{recursive:true});
 // 每场景一行，便于查看与追踪参数变化。
 await writeFile(join(out,`card-balance-${label}.json`),JSON.stringify({...report,rows:undefined},null,2).replace(/\n\}$/,'')+',\n  "rows": [\n'+rows.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
 const table=normal.map(d=>{
  const values=upgraded=>rows.slice(0,standardCount).filter(r=>r.id===d.id&&r.upgraded===upgraded).map(r=>r.score);
  const range=vs=>`${Math.min(...vs).toFixed(2)} ～ ${Math.max(...vs).toFixed(2)}`;
  return `| ${d.name} | ${cardDefinition({id:d.id,upgraded:false}).cost} / ${cardDefinition({id:d.id,upgraded:true}).cost} | ${range(values(false))} | ${range(values(true))} |`;
 });
 const markdown=`# 卡牌校准报告：${label}\n\n由 \`npm run audit:balance -- --label ${label}\` 生成。${normal.length}张非故障牌，${standardCount}项常规场景，含额外场景共${rows.length}项。\n\n${limitations.map(s=>'- '+s).join('\n')}\n\n公式与参数见 [卡牌平衡校准公式](../balance/卡牌平衡校准公式.md)，逐项指标见 [JSON报告](./card-balance-${label}.json)。下表范围来自单敌／双敌／三敌、普通攻击／多段攻击；请比较相同来源阶段与获取成本。\n\n| 卡牌 | 基础/强化费用 | 基础U范围 | 强化U范围 |\n| --- | --- | --- | --- |\n${table.join('\n')}\n`;
 await writeFile(join(out,`card-balance-${label}.md`),markdown);
 if(rows.some(r=>!r.legal||!Number.isFinite(r.score)))throw Error('发现非法或非有限校准结果。');
 console.log(`已生成 ${normal.length} 张卡、${rows.length} 项场景：docs/reports/card-balance-${label}.md / .json`);
} finally {await rm(temp,{recursive:true,force:true});}
