// 只读规则 review：独立战斗夹具复现循环与误评分，不改游戏配置。
import {mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
const temp=mkdtempSync(join(tmpdir(),'digimon-review-'));
try {
const bundle=join(temp,'model.mjs');
await build({stdin:{contents:`export * from './src/game/balance';export * from './src/game/data';export * from './src/game/engine';export * from './src/game/battle';export * from './src/game/evolution';export * from './src/game/cardSkills';export * from './tests/helpers/balanceScenario';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,define:{'import.meta.env.BASE_URL':'"/"'}});
const {CARDS,EVOLUTIONS,cardDefinition,skillUnlocked,balanceScenario,reduceGame,calibrateAction,contextualBalanceOptions,playCost}=await import(pathToFileURL(bundle).href);
const card=(id,uid=id,upgraded=false)=>({id,uid,upgraded});
const history=form=>[...(EVOLUTIONS[form].parents.length?history(EVOLUTIONS[form].parents[0]):[]),form];
function scene(cards,form,opts={}){const s=balanceScenario(cards,form,opts.enemies??['goblimon']);s.run.formHistory=opts.history??history(form);s.run.inherit='ward';Object.assign(s.run.battle,opts.battle??{});if(cards.some(c=>!skillUnlocked(s.run,CARDS[c.id])))throw Error('illegal card history');return s;}
const play=(s,c)=>{const next=reduceGame(s,{type:'play',uid:c.uid});if(next.run.battle.played!==s.run.battle.played+1)throw Error('rejected');return next;};
const summary=s=>({hp:s.run.hp,energy:s.run.battle.energy,turn:s.run.battle.turn,played:s.run.battle.played,copyUses:s.run.battle.copyUses,enemies:s.run.battle.enemies.map(e=>({hp:e.hp,mark:e.mark,burn:e.burn})),hand:s.run.battle.hand.map(c=>c.id),exhaust:s.run.battle.exhaust.length,screen:s.run.screen});
const report={date:'2026-10-09',method:'人工构造5张合法归属牌的战斗起始夹具；此后只调用正式出牌规则。不代表整局获取概率，不修改玩家存档。',sourceHashes:Object.fromEntries(['src/game/balance.ts','src/game/data.ts','src/game/cardUpgrades.ts','src/game/battle.ts','src/game/hooks.ts','src/game/evolution.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),loops:[],comparisons:[],formula:[]};
for(const [id,form,hist] of [['kaguraBell','sakuyamon',['renamon','youkomon','doumon','sakuyamon']],['izuna','kuzuhamon',['renamon','youkomon','doumon','kuzuhamon']],['curtainSpin','matadormonAwakened',undefined]]){
 let s=scene([card(id,'a',true),card(id,'b',true),card(id==='curtainSpin'?'strike':'runeShard','finisher'),card('guard','g1'),card('guard','g2')],form,{history:hist});
 if(id==='curtainSpin')s=play(s,s.run.battle.hand.find(c=>c.id==='strike'));
 const before=summary(s);
 for(let i=0;i<120;i++)s=play(s,s.run.battle.hand.find(c=>c.id===id));
 const after=summary(s);let steps=0;
 while(s.run.screen==='battle'&&steps++<150){const c=s.run.battle.hand.find(c=>c.uid==='finisher')??s.run.battle.hand.find(c=>c.id===id);s=play(s,c);}
 report.loops.push({id,form,history:hist??history(form),deck:s.run.deck,before,after120:after,finish:summary(s),finishActions:steps});
}
for(const [form,ids,opts] of [['chaosdukemon',['abyssLance','chaoslance'],{selfCostThisTurn:true}],['dukemon',['gramLance','royal'],{block:20}],['vamdemon',['batSwarm','nightfire'],{}],['beelzebumonblaster',['gustCannon'],{devour:3}]]){
 for(const id of ids)for(const upgraded of [false,true]){const s=scene([card(id,'a',upgraded)],form,{battle:opts,enemies:id==='gustCannon'?['goblimon','goblimon','goblimon']:undefined});const n=play(s,s.run.battle.hand[0]);report.comparisons.push({id,form,upgraded,initialBlock:opts.block??0,initialDevour:opts.devour??0,hpDamage:n.run.damageDealt-s.run.damageDealt,hpChange:n.run.hp-s.run.hp,shield:n.run.battle.block-s.run.battle.block,energy:n.run.battle.energy-s.run.battle.energy,devour:n.run.battle.devour,exhaust:n.run.battle.exhaust.length});}
}
for(const id of ['prank','devourAura','devourCorrode','windPressure']){const form=CARDS[id].unlockForm,s=scene([card(id,'a',true),card('strike','atk')],form);const before=s.run.battle,n=play(s,before.hand[0]);report.formula.push({id,upgraded:true,metric:calibrateAction(s,{type:'play',uid:'a'},contextualBalanceOptions(s)),gain:{devour:n.run.battle.devour-before.devour,vulnerable:(n.run.battle.enemies[0].vulnerable??0)-(before.enemies[0].vulnerable??0),nextAttackHits:n.run.battle.nextAttackHits-before.nextAttackHits}});}
let s=scene([card('strike','a')],'matadormonAwakened',{battle:{attackPlays:1}});s.run.battle.enemies[0].hp=1;report.formula.push({id:'second-attack-lethal',printed:cardDefinition(s.run.battle.hand[0]).cost,actualCost:playCost(s.run,s.run.battle.hand[0]),metric:calibrateAction(s,{type:'play',uid:'a'},contextualBalanceOptions(s))});
mkdirSync('docs/reports',{recursive:true});
writeFileSync('docs/reports/balance-review-probes-20261009.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({loops:report.loops.map(r=>({card:r.id,after120:r.after120,finish:r.finish.screen})),comparisons:report.comparisons.length,formulaProbes:report.formula.length}));
} finally {rmSync(temp,{recursive:true,force:true});}
