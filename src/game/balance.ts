import { CARDS, cardDefinition } from './data';
import { previewAction, reduceGame } from './engine';
import type { Action, BattleNumber, Save } from './types';

// 筛查权重沿用第一轮；终局、资源池与序列核算在v2中修正。
export const BALANCE_DEFAULTS = {
 prevented:1.25, healing:2, cards:3, energy:7, lifeCost:2, cardSlot:3,
 turns:3, discount:0.8, markChance:0.6, chargeChance:0.75, chargeMultiplier:4, futureHits:6,
};
export type BalanceOptions = Partial<typeof BALANCE_DEFAULTS>;
export type PlayAction = Extract<Action,{type:'play'}>;

export function burnValue(stacks:number,turns:number,discount=1,hp=Infinity):number {
 let total=0,remaining=hp;
 for(let t=0;t<turns&&remaining>0;t++){
  const damage=Math.min(remaining,Math.max(0,stacks-t));
  total+=damage*discount**t;remaining-=damage;
 }
 return total;
}

function incomingOutcome(state:Save) {
 if(state.run?.screen!=='battle')return {loss:0,screen:state.run?.screen,hp:state.run?.hp};
 // 从伤害反馈取损失，不让回合末胜利回复重复获得“防伤分”。
 const feedback=previewAction(state,{type:'endTurn'});
 const after=reduceGame(state,{type:'endTurn'});
 return {loss:feedback.filter(n=>n.target==='player'&&n.kind==='damage').reduce((n,x)=>n+x.amount,0),screen:after.run?.screen,hp:after.run?.hp};
}

/** 明确的牌堆场景估计，不读取隐藏抽牌顺序，也不声称是精确概率。 */
export function contextualBalanceOptions(state:Save):BalanceOptions {
 const b=state.run?.battle;if(!b)return {markChance:0,chargeChance:0,futureHits:0};
 const remaining=[...b.hand,...b.draw,...b.discard].map(cardDefinition);
 const marks=remaining.some(d=>d.special==='markburst');
 const cannons=remaining.filter(d=>d.special==='cannon');
 const affordable=b.hand.some(c=>cardDefinition(c).special==='cannon'&&cardDefinition(c).cost<=b.energy);
 return {markChance:marks?.6:0,chargeChance:cannons.length?(affordable?1:.75):0,chargeMultiplier:cannons.length?Math.max(...cannons.map(d=>d.chargeMultiplier??4)):4,
  futureHits:Math.min(6,remaining.reduce((n,d)=>n+(d.damage?(d.hits??1)*b.enemies.filter(e=>e.hp>0).length:0),0))};
}

function resourcePool(state:Save,config:typeof BALANCE_DEFAULTS) {
 const b=state.run?.battle;
 if(!b||state.run?.screen!=='battle')return {burn:0,marks:0,charge:0,strength:0};
 let burn=0,marks=0;
 for(const e of b.enemies){
  if(e.hp<=0)continue;
  const rawBurn=burnValue(e.burn,config.turns,config.discount,e.hp);
  // 假设灼烧先兑现，符印只认领其后剩余的生命预算；避免两个池各占一份HP。
  burn+=rawBurn;marks+=Math.min(Math.max(0,e.hp-rawBurn),e.mark*5)*config.markChance;
 }
 const hpBudget=Math.max(0,b.enemies.reduce((n,e)=>n+Math.max(0,e.hp),0)-burn-marks);
 const charge=Math.min(hpBudget,b.charge*config.chargeMultiplier*config.chargeChance);
 const strength=Math.min(Math.max(0,hpBudget-charge),b.strength*config.futureHits);
 return {burn,marks,charge,strength};
}

/** 序列严格依次验证，任意非法步骤返回诊断；不提交部分状态。 */
export function calibrateSequence(state:Save,actions:PlayAction[],options:BalanceOptions={}) {
 if(!state.run?.battle||state.run.screen!=='battle')throw Error('校准需要战斗状态。');
 if(!actions.length)return {legal:false as const,score:0,reason:'empty-sequence'};
 const config={...BALANCE_DEFAULTS,...options},before=state.run.battle;
 let next=state,drawn=0,paid=0;
 const feedback:BattleNumber[]=[];
 for(const [index,action] of actions.entries()){
  const b=next.run?.battle,c=b?.hand.find(c=>c.uid===action.uid);
  if(next.run?.screen!=='battle'||!b||!c)return {legal:false as const,score:0,reason:'unavailable-card',index};
  const after=reduceGame(next,action);
  if(after.run!.battle!.played===b.played)return {legal:false as const,score:0,reason:'rejected-action',index};
  paid+=cardDefinition(c).cost;
  feedback.push(...previewAction(next,action));
  const previous=new Set(b.hand.map(c=>c.uid));
  drawn+=after.run!.battle!.hand.filter(c=>!previous.has(c.uid)&&CARDS[c.id].kind!=='status').length;
  next=after;
 }
 const after=next.run!.battle!,terminal=next.run!.screen!=='battle',dead=next.run!.hp<=0;
 const damage=feedback.filter(n=>n.target!=='player'&&n.kind==='damage').reduce((sum,n)=>sum+n.amount,0);
 const healing=feedback.filter(n=>n.target==='player'&&n.kind==='heal').reduce((sum,n)=>sum+n.amount,0);
 const lifeCost=feedback.filter(n=>n.target==='player'&&n.kind==='damage').reduce((sum,n)=>sum+n.amount,0);
 const baseline=incomingOutcome(state),incoming=incomingOutcome(next);
 const prevented=dead?0:baseline.loss-incoming.loss;
 // 胜利/死亡后新牌和返能不再具有本场利用价值，支付成本仍保留。
 const cards=terminal?0:drawn,energy=terminal?0-paid:after.energy-before.energy;
 const oldPool=resourcePool(state,config),pool=resourcePool(next,config);
 const burn=pool.burn-oldPool.burn,marks=pool.marks-oldPool.marks,charge=pool.charge-oldPool.charge,strength=pool.strength-oldPool.strength;
 const future=burn+marks+charge+strength;
 const score=damage+config.prevented*prevented+config.healing*healing+config.cards*cards+config.energy*energy+future-config.lifeCost*lifeCost-config.cardSlot*actions.length;
 return {legal:true as const,score,damage,prevented,healing,cards,drawn,energy,paid,lifeCost,future,burn,marks,charge,strength,plays:actions.length,
  netLife:next.run!.hp-state.run.hp,terminal,dead,screen:next.run!.screen,endTurnScreen:incoming.screen,endTurnHp:incoming.hp,baselineEndTurnHp:baseline.hp,state:next};
}

export function calibrateAction(state:Save,action:PlayAction,options:BalanceOptions={}) {
 const metric=calibrateSequence(state,[action],options);
 if(!metric.legal)return {legal:false as const,score:0};
 const {state:result,...report}=metric;
 void result;
 return report;
}
