import { cardPool, skillUnlocked } from './cardSkills';
import { BLESSINGS, BRANCHES, CARDS, ENEMIES, PARTNERS, RELICS, inheritanceOptions, needsTarget } from './data';
import { emptyActivity, EVOLUTIONS, evolutionStatus, stageLimit, syncRouteData, activityGains } from './evolution';
import { connectMap, availableNodes } from './map';
import type { Metric, Action, Battle, Card, Enemy, Intent, MapNode, Meta, Partner, Run, Save } from './types';
export const emptySave=():Save=>({version:2,meta:{unlockedRoutes:[],scans:{},partners:[],games:0,wins:0,discovered:[]},run:null,settings:{reducedMotion:false,sound:false}});
const rand=(r:Run)=>{r.rng=(Math.imul(1664525,r.rng)+1013904223)>>>0;return r.rng/4294967296;};
const choose=<T,>(r:Run,items:T[]):T=>items[Math.floor(rand(r)*items.length)];
const shuffle=<T,>(r:Run,items:T[])=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand(r)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const makeCard=(r:Run,id:string,upgraded=false,temporary=false):Card=>({uid:`c${++r.seq}`,id,upgraded,temporary});
export function makeRun(partner:Partner,seed:number):Run{
 const r:Run={activity:emptyActivity(),victories:0,bosses:0,formHistory:[partner],evolutionTarget:null,evolutionReturn:'node',legacyEvolution:false,bonuses:[],partner,form:partner,stage:0,branch:null,training:'attack',inherit:partner==='guilmon'?'ember':partner==='renamon'?'seal':'ward',hp:partner==='guilmon'?90:partner==='renamon'?82:86,maxHp:partner==='guilmon'?90:partner==='renamon'?82:86,gold:65,deck:[],relics:[],blessing:'',support:'default',potions:1,rng:seed>>>0,seq:0,row:0,nodes:[],path:[],screen:'blessing',currentNode:null,battle:null,reward:null,shopStock:[],shopBought:[],shopRemoved:false,evolved:0,won:false,kills:0,damageDealt:0,message:'选择旅途祝福'};
 if(partner==='terriermon')r.deck=['strike','strike','strike','guard','guard','guard','charge','cannon','tinyTwister','blazingShot'].map(id=>makeCard(r,id));
 else r.deck=[...Array.from({length:4},()=>makeCard(r,'strike')),...Array.from({length:4},()=>makeCard(r,'guard')),makeCard(r,partner==='guilmon'?'fireball':'leaf'),makeCard(r,partner==='guilmon'?'rock':'talisman')];
 for(let row=0;row<24;row++){
  const chapter=Math.floor(row/8),local=row%8;
  const pool=chapter===0?['goblimon','mushmon','hagurumon','picodevimon','bakemon','impmon']:chapter===1?['ogremon','leomon','andromon','mushmon','picodevimon']:['scout','replica','corrupt'];
  let kinds:MapNode['kind'][];
  if(local===7)kinds=['boss'];else if(row===3)kinds=['evolution'];else if(local===6)kinds=['camp'];else if(local===0||row===1)kinds=['battle'];else if(local===1)kinds=['battle','event'];else if(local===2)kinds=['battle','shop'];else if(local===3)kinds=['event','battle'];else if(local===4)kinds=['elite','treasure'];else kinds=['camp','event'];
  r.nodes.push(kinds.map((kind,lane)=>{
   let enemies:string[]=[];
   if(kind==='battle')enemies=row<2?['hagurumon']:chapter===0?[choose(r,pool),choose(r,pool)]:[choose(r,pool),choose(r,pool)];
   if(kind==='elite')enemies=[choose(r,chapter===0?['devidramon','dokugumon']:chapter===1?['icedevimon','vajramon']:['sentinel','devourer'])];
   if(kind==='boss')enemies=[['sinduramon','beelzebumon','core'][chapter]];
   const labels:Record<MapNode['kind'],string>={battle:'数码遭遇',elite:'危险信号',boss:ENEMIES[enemies[0]]?.name??'首领',camp:'休息营地',shop:'流浪商人',event:'未知信号',treasure:'数据宝箱',evolution:'进化之光'};
   return {id:`n${row}-${lane}`,row,lane,kind,label:labels[kind],enemies,next:[]};
  }));
 }
 connectMap(r.nodes);
 return r;
}
export function cardCost(c:Card):number{const d=CARDS[c.id];return Math.max(0,d.cost-(c.upgraded&&!d.damage&&!d.shield?1:0));}
export function intent(r:Run,e:Enemy):Intent{
 const b=r.battle;const turn=b?.turn??1;const phase=(turn-1)%3;const ch=Math.floor(r.row/8);const style=ENEMIES[e.id].style;
 let i:Intent={name:'攻击',type:'attack',damage:6+ch*2,hits:1,shield:0,detail:'对搭档造成伤害。'};
 if(style==='charge')i=phase===1?{name:'蓄力',type:'buff',damage:0,hits:0,shield:0,detail:'准备下一回合的重击。'}:{...i,name:phase===2?'重击':'爪击',damage:phase===2?16+ch*3:7+ch*2};
 if(style==='shield')i=phase===0?{name:'充能护盾',type:'block',damage:0,hits:0,shield:8+ch*3,detail:'获得护盾，随后发动放电。'}:{...i,name:'放电',damage:8+ch*2};
 if(style==='jam'||style==='spider')i=phase===0?{name:style==='spider'?'蛛网封锁':'数据干扰',type:'debuff',damage:0,hits:0,shield:0,detail:`加入 ${style==='spider'?2:1} 张数据故障牌到弃牌堆。`}:{...i,name:'侵蚀',damage:7+ch*2};
 if(style==='buff')i=phase===0?{name:'鼓舞',type:'buff',damage:0,hits:0,shield:0,detail:'所有存活敌人攻击伤害＋2。'}:{...i,name:'恶魔飞镖',damage:5+ch*2};
 if(style==='evade')i={...i,name:'幽影攻击',damage:7,detail:'本回合第一段受到的攻击伤害减半。'};
 if(style==='rapid')i=phase===2?{name:'重新装填',type:'block',damage:0,hits:0,shield:6,detail:'重新装填弹药，并获得 6 护盾。'}:{...i,name:'连续射击',damage:e.id==='beelzebumon'?5:3+ch,hits:e.id==='beelzebumon'?3:2};
 if(style==='chicken')i=phase===0?{name:'电荷储存',type:'block',damage:0,hits:0,shield:9,detail:'获得 9 护盾。'}:{...i,name:phase===1?'电荷反应':'雷击',damage:phase===1?4+(b?.played??0)*2:16,detail:phase===1?'本回合每打出一张牌，本次攻击伤害＋2。':'强力雷击。'};
 if(style==='sword')i=phase===1?{name:'防御架势',type:'block',damage:0,hits:0,shield:14,detail:'获得 14 护盾。'}:{...i,name:'连续斩击',damage:6+ch*2,hits:2};
 if(style==='core')i=phase===0?{name:'数据删除',type:'debuff',damage:0,hits:0,shield:0,detail:'加入 2 张故障牌，核心获得 8 护盾。'}:phase===1?{...i,name:'侵蚀光束',damage:9,hits:2}:{...i,name:'终末脉冲',damage:24};
 if(e.id==='devidramon'&&phase===2&&e.stagger>=20)i={name:'重击被打断',type:'block',damage:0,hits:0,shield:0,detail:'本回合已承受 20 点攻击伤害，重击被打断。'};
 if(i.type==='attack')i.damage=Math.max(0,i.damage+e.strength-e.weakened);
 return i;
}
const log=(b:Battle,s:string)=>{b.log=[s,...b.log].slice(0,12);};
function draw(r:Run,n:number){const b=r.battle;if(!b)return;for(let i=0;i<n;i++){if(!b.draw.length){b.draw=shuffle(r,b.discard);b.discard=[];}const c=b.draw.pop();if(!c)break;if(b.hand.length<8)b.hand.push(c);else b.discard.push(c);}}
function beginBattle(r:Run,node:MapNode){
 r.battle={activity:emptyActivity(),startActivity:structuredClone(r.activity),selfCostThisTurn:false,countedKills:[],enemies:node.enemies.map((id,index)=>({uid:`${node.id}-e${index}`,id,hp:ENEMIES[id].hp,maxHp:ENEMIES[id].hp,block:0,burn:0,mark:0,strength:0,weakened:0,opening:true,stagger:0})),hand:[],draw:shuffle(r,r.deck),discard:[],exhaust:[],turn:1,enemyTurnIndex:null,energy:3+(r.relics.includes('battery')?1:0),block:r.relics.includes('armor')?3:0,sync:r.blessing==='bond'?2:0,syncThisTurn:0,burst:0,burstUsed:false,supportUsed:false,strength:0,charge:r.form==='wargrowlmon'?1:0,played:0,skillsPlayed:0,attacks:0,attackPlays:0,nextAttackBonus:0,cannonGuardUsed:false,burned:false,marked:false,defended:false,log:['连接建立。先观察敌人的行动意图。']};
 if(r.training==='defense'&&r.stage>0)r.battle.block+=3;
 if(r.bonuses.includes('holyward'))r.battle.block+=2;
 draw(r,5+(r.relics.includes('reader')?1:0)+(r.bonuses.includes('ritual')?1:0));r.screen='battle';
}
function count(r:Run,key:Metric){const b=r.battle;if(!b)return;const used=b.activity.counts[key]??0;if(used>=10)return;b.activity.counts[key]=used+1;r.activity.counts[key]=(r.activity.counts[key]??0)+1;}
function burnKill(r:Run,e:Enemy){const b=r.battle;if(b&&e.hp<=0&&e.burn>0&&!b.countedKills.includes(e.uid)){b.countedKills.push(e.uid);count(r,'burnKills');}}
function hit(r:Run,e:Enemy,amount:number,attack=true){
 const b=r.battle;if(!b||e.hp<=0)return;
 let damage=Math.max(0,amount);
 if(attack){damage+=b.strength+(b.burst>0?2:0);if(r.training==='attack'&&r.stage>0)damage+=1;if(r.relics.includes('cooler')&&b.attacks<3)damage++;b.attacks++;if(ENEMIES[e.id].style==='evade'&&e.opening){damage=Math.floor(damage/2);e.opening=false;}}
 const blocked=Math.min(e.block,damage);e.block-=blocked;const actual=Math.min(e.hp,damage-blocked);e.hp-=actual;r.damageDealt+=actual;e.stagger+=actual;burnKill(r,e);
}
function awardRelic(r:Run){const available=Object.keys(RELICS).filter(id=>!r.relics.includes(id));if(!available.length){r.gold+=35;return undefined;}const id=choose(r,available);r.relics.push(id);return id;}
function resolve(r:Run,meta:Meta){
 if(r.hp<=0){r.hp=0;r.screen='result';r.won=false;return;}
 const b=r.battle;if(!b||b.enemies.some(e=>e.hp>0))return;
 const node=r.currentNode;if(!node)return;
 const scans:{id:string;before:number;after:number}[]=[];
 for(const id of new Set(b.enemies.map(e=>e.id))){if(!ENEMIES[id].scan)continue;const before=meta.scans[id]??0;const after=Math.min(100,before+(node.kind==='boss'?100:50));meta.scans[id]=after;scans.push({id,before,after});}
 r.victories++;if(node.kind==='boss')r.bosses++;
 const unlocks=syncRouteData(meta);
 r.kills+=b.enemies.length;const gold=node.kind==='boss'?65:node.kind==='elite'?45:24;r.gold+=gold;
 if(r.relics.includes('memory'))r.hp=Math.min(r.maxHp,r.hp+3);
 const relic=node.kind==='elite'||node.kind==='boss'?awardRelic(r):undefined;
 r.reward={cards:shuffle(r,cardPool(r)).slice(0,3),gold,scans,relic,gains:activityGains(b.startActivity,r.activity),unlocks};r.screen='reward';
}
function finishNode(r:Run){if(r.currentNode&&!r.path.includes(r.currentNode.id))r.path.push(r.currentNode.id);r.row++;r.screen='map';r.battle=null;r.reward=null;r.currentNode=null;}
function afterReward(r:Run,meta:Meta){
 if(r.currentNode?.kind==='boss'){
  if(r.row===23){r.won=true;r.screen='result';meta.wins++;if(!r.path.includes(r.currentNode.id))r.path.push(r.currentNode.id);return;}
  r.screen='evolution';r.evolutionReturn='node';return;
 }
 finishNode(r);
}
function playCard(r:Run,meta:Meta,uid:string,target?:string){
 const b=r.battle;if(!b)return;const index=b.hand.findIndex(c=>c.uid===uid);if(index<0)return;const c=b.hand[index],d=CARDS[c.id];const cost=cardCost(c);if(cost>b.energy)return;
 const chosen=b.enemies.find(e=>e.uid===target&&e.hp>0)??b.enemies.find(e=>e.hp>0);
 if(needsTarget(d)&&!chosen)return;
 b.energy-=cost;b.hand.splice(index,1);
 if(d.kind==='attack'){count(r,'attacks');b.attackPlays++;}if(d.kind==='skill'||d.kind==='power')count(r,'skills');if(d.burn||d.special==='detonate')count(r,'fire');if(c.copied)count(r,'copies');
 if(!c.copied){const series=d.series??d.id;const used=b.activity.cards[series]??0;if(used<3){b.activity.cards[series]=used+1;r.activity.cards[series]=(r.activity.cards[series]??0)+1;}}
 b.played++;if(d.kind==='skill'||d.kind==='power')b.skillsPlayed++;
 if((d.kind==='skill'||d.kind==='power')&&b.skillsPlayed===2)count(r,'combos');
 if(b.syncThisTurn<3){b.sync=Math.min(6,b.sync+1);b.syncThisTurn++;}
 log(b,`${d.name}${c.upgraded?'＋':''}`);
 const up=c.upgraded?3:0,damageUp=c.upgraded?(d.upgradeDamage??3):0;
 const firstDefense=!!d.shield&&!b.defended;
 let tacticalBonus=d.kind==='attack'&&d.damage?b.nextAttackBonus:0;
 if(tacticalBonus)b.nextAttackBonus=0;
 if(d.special==='sacrifice'){r.hp=Math.max(0,r.hp-3);count(r,'selfCosts');if(!b.selfCostThisTurn){if(r.form==='blackwargrowlmon')b.energy++;if(r.branch==='chaos')b.block+=6;b.selfCostThisTurn=true;}if(!r.hp){b.exhaust.push(c);resolve(r,meta);return;}}
 if(d.shield){count(r,'defenses');let shield=d.shield+up;if(!b.defended){if(r.blessing==='guard')shield+=3;if(r.branch==='duke')shield+=3;if(r.inherit==='ward'&&r.stage>0)shield+=2;if(['blackrapidmon','blacksaintgalgomon'].includes(r.form))b.charge++;b.defended=true;}b.block+=shield;}
 if(d.heal&&r.hp<r.maxHp){r.hp=Math.min(r.maxHp,r.hp+d.heal);count(r,'heals');}
 if(d.energy)b.energy+=d.energy;if(d.strength)b.strength+=d.strength;if(d.charge){b.charge+=d.charge;count(r,'charges');}
 if(d.special==='copy'){const original=b.hand.find(x=>!x.copied&&CARDS[x.id].kind!=='status'&&CARDS[x.id].special!=='copy');if(original&&b.hand.length<8)b.hand.push({...makeCard(r,original.id,original.upgraded,true),copied:true});}
 if(d.special==='purge'){const faults=b.hand.filter(x=>CARDS[x.id].kind==='status');b.hand=b.hand.filter(x=>CARDS[x.id].kind!=='status');b.exhaust.push(...faults);}
 let bonus=b.charge>0?(d.chargedDamage??0):0;if(d.special==='shieldhit')bonus+=Math.floor(b.block/2);if(d.special==='cannon'){if(b.charge>0){count(r,'cannonShots');if(r.form==='blacksaintgalgomon'&&!b.cannonGuardUsed){b.block+=6;b.cannonGuardUsed=true;}}bonus+=b.charge*(d.chargeMultiplier??4);b.charge=0;}
 const targets=d.all?b.enemies.filter(e=>e.hp>0):chosen?[chosen]:[];
 const beforeDamage=r.damageDealt;let appliedMark=false,appliedWeak=false,detonated=false,consumedMark=false;
 const burnBonus=!b.burned&&d.burn?((r.branch==='megidra'?2:r.form==='blackgrowmon'?1:0)+(r.inherit==='ember'&&r.stage>0?1:0)):0;
 for(const e of targets){
  let extra=bonus;
  if(d.special==='detonate'){extra+=e.burn*3;if(e.burn>0)detonated=true;e.burn=0;}
  if(d.special==='markburst'){extra+=e.mark*5;if(e.mark>0)consumedMark=true;if(e.mark>0&&!b.marked){if(r.branch==='sakuya')draw(r,1);b.marked=true;}e.mark=0;}
  if(d.damage)for(let h=0;h<(d.hits??1)&&e.hp>0;h++){hit(r,e,d.damage+damageUp+extra+tacticalBonus);tacticalBonus=0;}
  if(e.hp>0){if(d.burn)e.burn+=d.burn+burnBonus;if(d.mark){appliedMark=true;e.mark+=d.mark+(r.inherit==='seal'&&r.stage>0&&b.played===1?1:0)+(r.form==='youkomon'&&!b.marked?1:0);}if(d.weak){e.weakened+=d.weak;appliedWeak=true;}}
 }
 if(appliedMark){count(r,'marks');if(r.form==='youkomon')b.marked=true;}if(appliedWeak)count(r,'weakens');if(detonated)count(r,'detonations');if(consumedMark)count(r,'markBursts');
 if(d.drain&&r.damageDealt>beforeDamage&&r.hp<r.maxHp){r.hp=Math.min(r.maxHp,r.hp+d.drain);count(r,'heals');}
 if(r.form==='taomon'&&(d.kind==='skill'||d.kind==='power')&&b.skillsPlayed===1)b.block+=2;
 if(r.form==='doumon'&&(d.kind==='skill'||d.kind==='power')&&b.skillsPlayed===2){const e=b.enemies.find(x=>x.hp>0);if(e)e.mark++;}
 if(d.burn&&!b.burned){if(r.relics.includes('firewall'))b.block+=3;b.burned=true;}
 if(r.branch==='kuzuha'&&(d.kind==='skill'||d.kind==='power')&&b.skillsPlayed===2){const e=b.enemies.find(x=>x.hp>0);if(e)hit(r,e,4,false);log(b,'管狐追击 · 4 伤害');}
 if(firstDefense&&r.form==='blackgalgomon')b.nextAttackBonus=2;
 if(d.kind==='attack'&&b.attackPlays===2){if(['galgomon','saintgalgomon'].includes(r.form))b.charge++;if(['rapidmon','saintgalgomon'].includes(r.form))draw(r,1);}
 if(d.draw)draw(r,d.draw);
 if(r.inherit==='flow'&&r.stage>0&&b.played===1&&d.kind==='skill')b.block+=2;
 if(d.exhaust||c.copied||c.temporary)b.exhaust.push(c);else b.discard.push(c);
 resolve(r,meta);
}
function beginEnemyTurn(r:Run){
 const b=r.battle;if(!b||b.enemyTurnIndex!==null)return;
 b.discard.push(...b.hand.filter(c=>!c.temporary));b.exhaust.push(...b.hand.filter(c=>c.temporary));b.hand=[];
 b.enemyTurnIndex=0;
}
function enemyStep(r:Run,meta:Meta){
 const b=r.battle;if(!b||b.enemyTurnIndex===null||b.enemyTurnIndex>=b.enemies.length)return;
 const e=b.enemies[b.enemyTurnIndex++];if(e.hp<=0)return;const i=intent(r,e);e.block=0;
  if(i.type==='attack'){for(let h=0;h<i.hits;h++){const absorbed=Math.min(b.block,i.damage);b.block-=absorbed;r.hp=Math.max(0,r.hp-i.damage+absorbed);}e.weakened=0;log(b,`${ENEMIES[e.id].name} · ${i.name} ${i.damage}${i.hits>1?`×${i.hits}`:''}`);}
  if(i.shield)e.block=i.shield;
  if(i.type==='buff'&&ENEMIES[e.id].style==='buff')b.enemies.filter(x=>x.hp>0).forEach(x=>x.strength+=2);
  if(i.type==='debuff'){const n=['spider','core'].includes(ENEMIES[e.id].style)?2:1;for(let j=0;j<n;j++)b.discard.push(makeCard(r,'fault',false,true));if(e.id==='core')e.block+=8;}
 if(r.hp<=0)resolve(r,meta);
}
function finishEnemyTurn(r:Run,meta:Meta){
 const b=r.battle;if(!b||b.enemyTurnIndex===null||b.enemyTurnIndex<b.enemies.length)return;
 b.enemyTurnIndex=null;
 for(const e of b.enemies){if(e.hp<=0||!e.burn)continue;const damage=Math.min(e.hp,e.burn);e.hp-=damage;r.damageDealt+=damage;burnKill(r,e);e.burn=Math.max(0,e.burn-1);}
 resolve(r,meta);if(r.screen!=='battle')return;
 b.turn++;b.energy=3;b.block=(r.relics.includes('armor')?3:0)+(r.training==='defense'&&r.stage>0?3:0)+(r.bonuses.includes('holyward')?2:0);b.selfCostThisTurn=false;b.syncThisTurn=0;b.played=0;b.skillsPlayed=0;b.attacks=0;b.attackPlays=0;b.nextAttackBonus=0;b.cannonGuardUsed=false;b.burned=false;b.marked=false;b.defended=false;b.burst=Math.max(0,b.burst-1);for(const e of b.enemies){e.opening=true;e.stagger=0;}draw(r,5);log(b,`第 ${b.turn} 回合 · 行动力已恢复`);
}
function endTurn(r:Run,meta:Meta){
 const b=r.battle;if(!b||b.enemyTurnIndex!==null)return;
 beginEnemyTurn(r);
 while(r.screen==='battle'&&b.enemyTurnIndex!==null&&b.enemyTurnIndex<b.enemies.length)enemyStep(r,meta);
 if(r.screen==='battle')finishEnemyTurn(r,meta);
}
export function reduceGame(state:Save,action:Action):Save{
 const s=structuredClone(state);const meta=s.meta;
 if(action.type==='settings'){s.settings[action.key]=!s.settings[action.key];return s;}
 if(action.type==='start'){if(s.run&&s.run.screen!=='result')return state;s.run=makeRun(action.partner,action.seed??Date.now());meta.games++;return s;}
 if(action.type==='convert'){if((meta.scans[action.id]??0)>=100&&ENEMIES[action.id]?.support&&!meta.partners.includes(action.id))meta.partners.push(action.id);return s;}
 const r=s.run;if(!r)return state;
 if(action.type==='track'){if(action.form===null||(EVOLUTIONS[action.form]?.partner===r.partner))r.evolutionTarget=action.form;return s;}
 if(action.type==='campEvolution'&&r.screen==='camp'&&r.stage<stageLimit(r)){r.evolutionReturn='camp';r.screen='evolution';return s;}
 if(action.type==='deferEvolution'&&r.screen==='evolution'){if(r.evolutionReturn==='camp')r.screen='camp';else if(r.currentNode?.kind==='boss')r.screen='blessing';else finishNode(r);return s;}
 if(action.type==='abandon'){r.screen='result';r.won=false;return s;}
 if(action.type==='equip'){if(r.screen!=='battle'&&(action.id==='default'||meta.partners.includes(action.id)))r.support=action.id;return s;}
 if(action.type==='node'){
  if(r.screen!=='map')return state;const n=availableNodes(r).find(x=>x.id===action.id);if(!n)return state;r.currentNode=n;r.message='';
  if(['battle','elite','boss'].includes(n.kind))beginBattle(r,n);
  else{r.screen=n.kind as Run['screen'];if(n.kind==='evolution')r.evolutionReturn='node';if(n.kind==='shop'){r.shopStock=shuffle(r,cardPool(r)).slice(0,3);r.shopBought=[];r.shopRemoved=false;}if(n.kind==='treasure'){const id=awardRelic(r);r.message=id?`获得 ${RELICS[id].name}`:'获得 35 金币';}}
  return s;
 }
 if(action.type==='play'&&r.screen==='battle'&&r.battle?.enemyTurnIndex===null)playCard(r,meta,action.uid,action.target);
 if(action.type==='endTurn'&&r.screen==='battle')endTurn(r,meta);
 if(action.type==='beginEnemyTurn'&&r.screen==='battle')beginEnemyTurn(r);
 if(action.type==='enemyStep'&&r.screen==='battle')enemyStep(r,meta);
 if(action.type==='finishEnemyTurn'&&r.screen==='battle')finishEnemyTurn(r,meta);
 if(action.type==='potion'&&r.screen==='battle'&&r.battle?.enemyTurnIndex===null&&r.potions>0&&r.hp<r.maxHp){r.potions--;r.hp=Math.min(r.maxHp,r.hp+18);count(r,'heals');if(r.battle)log(r.battle,'恢复磁盘 · 回复 18 生命');}
 if(action.type==='support'&&r.screen==='battle'&&r.battle&&r.battle.enemyTurnIndex===null&&!r.battle.supportUsed){const b=r.battle;const target=b.enemies.find(e=>e.uid===action.target&&e.hp>0)??b.enemies.find(e=>e.hp>0);b.supportUsed=true;if(r.support==='mushmon'&&target){target.weakened+=2;count(r,'weakens');}else if(r.support==='picodevimon'&&target)hit(r,target,8,false);else b.block+=r.support==='hagurumon'?10:8;log(b,`${ENEMIES[r.support]?.name??'应急防御程序'} · 支援已抵达`);resolve(r,meta);}
 if(action.type==='burst'&&r.screen==='battle'&&r.battle&&r.battle.enemyTurnIndex===null&&r.branch){const b=r.battle;if(b.sync>=6&&!b.burstUsed){b.sync-=6;b.burstUsed=true;b.burst=3;const signature=makeCard(r,BRANCHES[r.branch].cards[0],true,true);if(b.hand.length<8)b.hand.push(signature);else b.draw.push(signature);log(b,'同步爆发！本回合起三回合攻击每段＋2，获得强化必杀牌。');}}
 if(action.type==='reward'&&r.screen==='reward'&&r.reward){if(action.card&&(!r.reward.cards.includes(action.card)||!CARDS[action.card]||!skillUnlocked(r,CARDS[action.card])))return state;if(action.card)r.deck.push(makeCard(r,action.card));afterReward(r,meta);}
 if(action.type==='continue'&&['treasure','shop'].includes(r.screen))finishNode(r);
 if(action.type==='camp'&&r.screen==='camp'){if(action.mode==='heal'){r.hp=Math.min(r.maxHp,r.hp+Math.ceil(r.maxHp*.3));finishNode(r);}else{const c=r.deck.find(x=>x.uid===action.uid&&!x.upgraded);if(c){c.upgraded=true;finishNode(r);}}}
 if(action.type==='buy'&&r.screen==='shop'&&!r.shopBought.includes(action.id)){
  if(r.shopStock.includes(action.id)&&r.gold>=45&&CARDS[action.id]&&skillUnlocked(r,CARDS[action.id])){r.gold-=45;r.deck.push(makeCard(r,action.id));r.shopBought.push(action.id);}
  else if(action.id==='potion'&&r.gold>=30&&r.potions<2){r.gold-=30;r.potions++;r.shopBought.push(action.id);}
  else if(action.id==='relic'&&r.gold>=80){r.gold-=80;awardRelic(r);r.shopBought.push(action.id);}
 }
 if(action.type==='remove'&&r.screen==='shop'&&!r.shopRemoved&&r.gold>=45&&r.deck.length>5){const i=r.deck.findIndex(c=>c.uid===action.uid);if(i>=0){r.deck.splice(i,1);r.gold-=45;r.shopRemoved=true;}}
 if(action.type==='event'&&r.screen==='event'){if(action.choice==='safe'){r.hp=Math.min(r.maxHp,r.hp+10);if(Math.floor(r.row/8)===1&&!meta.unlockedRoutes.includes('purification')){meta.unlockedRoutes.push('purification');r.message='净化资料已永久解锁';}if(Math.floor(r.row/8)===1&&!meta.unlockedRoutes.includes('mechanical')){meta.unlockedRoutes.push('mechanical');r.message=[r.message,'机械研究已永久解锁'].filter(Boolean).join(' · ');}}else{r.hp=Math.max(1,r.hp-8);r.gold+=35;const c=r.deck.find(x=>!x.upgraded&&x.id!=='guard');if(c)c.upgraded=true;}finishNode(r);}
 if(action.type==='bless'&&r.screen==='blessing'&&BLESSINGS[action.id]){r.message='';if(action.id==='growth'){r.maxHp+=10;r.hp=Math.min(r.maxHp,r.hp+10);}r.blessing=action.id;if(r.currentNode)finishNode(r);else r.screen='map';}
 if(action.type==='evolve'&&r.screen==='evolution'){
  const form=action.form??(action.branch?BRANCHES[action.branch].art:PARTNERS[r.partner].forms[r.stage+1]);
  const d=EVOLUTIONS[form];if(!d)return state;
  const legacy=r.legacyEvolution&&r.stage===2&&d.partner===r.partner&&d.stage===3&&['dukemon','megidramon','sakuyamon','kuzuhamon'].includes(form);
  if(!evolutionStatus(r,meta,form).ready&&!legacy)return state;
  const ids=[...new Set(action.replace??[])];
  if(ids.length!==2||ids.some(uid=>!r.deck.some(c=>c.uid===uid)))return state;
  ids.forEach((uid,i)=>{const c=r.deck.find(x=>x.uid===uid);if(c){c.id=d.cards[i];if(d.stage<3)c.upgraded=true;}});
  r.form=form;r.stage=d.stage;r.evolved=d.stage;r.branch=d.branch??null;r.training=action.training??r.training;
  if(action.inherit&&inheritanceOptions(r.partner).includes(action.inherit))r.inherit=action.inherit;
  if(form==='dukemon'&&(r.activity.counts.defenses??0)>=12&&!r.bonuses.includes('holyward'))r.bonuses.push('holyward');
  if(form==='sakuyamon'&&(r.activity.counts.markBursts??0)>=6&&!r.bonuses.includes('ritual'))r.bonuses.push('ritual');
  r.formHistory.push(form);if(!meta.discovered.includes(form))meta.discovered.push(form);
  if(r.evolutionTarget&&(EVOLUTIONS[r.evolutionTarget]?.stage??0)<=r.stage)r.evolutionTarget=null;
  r.legacyEvolution=false;
  if(r.evolutionReturn==='camp'){finishNode(r);r.evolutionReturn='node';}
  else if(r.stage<stageLimit(r)){r.screen='evolution';}
  else if(r.currentNode?.kind==='boss')r.screen='blessing';
  else finishNode(r);
 }
 return s;
}
