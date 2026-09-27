import { CARDS } from './data';
import type { Meta, Run } from './types';

interface EventEffect { hpCost?:number; goldCost?:number; heal?:number; gold?:number; card?:'upgrade'|'remove'; autoUpgrade?:boolean; potion?:boolean; training?:Run['training']; routes?:string[] }
export interface EventChoice { id:'risk'|'safe'; title:string; text:string; effect:EventEffect }
export interface StoryEvent { id:string; title:string; story:string; hint:string; choices:EventChoice[] }
export const EVENTS:Record<string,StoryEvent>={
 reader:{id:'reader',title:'损坏的读卡器',story:'废墟里的读卡器仍在发出信号。搭档守在身旁，等你决定是否修复它。',hint:'生命换资源 / 安全恢复',choices:[
  {id:'risk',title:'接通不稳定电源',text:'失去8生命（最低保留1），获得35金币，强化第一张未强化的非防御插件牌。',effect:{hpCost:8,gold:35,autoUpgrade:true}},
  {id:'safe',title:'在这里休息',text:'回复10生命。',effect:{heal:10}},
 ]},
 shelter:{id:'shelter',title:'临时避难所',story:'避难所里留着一张整理卡片的工作台。远处的警报暂时无法打扰你们。',hint:'恢复 / 付费删牌',choices:[
  {id:'risk',title:'整理冗余数据',text:'支付15金币，选择移除一张牌；至少保留5张。',effect:{goldCost:15,card:'remove'}},
  {id:'safe',title:'让搭档睡一会儿',text:'回复18生命。',effect:{heal:18}},
 ]},
 laboratory:{id:'laboratory',title:'废弃实验室',story:'实验设备还剩一点能源。你可以用它校准一张卡，也可以带走还能使用的零件。',hint:'指定强化 / 获得金币',choices:[
  {id:'risk',title:'校准卡片',text:'支付25金币，选择强化一张未强化卡。',effect:{goldCost:25,card:'upgrade'}},
  {id:'safe',title:'回收零件',text:'获得15金币。',effect:{gold:15}},
 ]},
 training:{id:'training',title:'训练终端',story:'一段旧训练程序等待接入。搭档可以练习冲刺，也可以学习如何挡住下一次攻击。',hint:'训练方向 / 成熟期起生效',choices:[
  {id:'risk',title:'练习主动出击',text:'失去5生命（最低保留1），获得10金币，训练改为进攻：成熟期起攻击每段＋1。',effect:{hpCost:5,gold:10,training:'attack'}},
  {id:'safe',title:'练习守护',text:'回复6生命，训练改为守护：成熟期起每回合开始＋3护盾。',effect:{heal:6,training:'defense'}},
 ]},
 research:{id:'research',title:'失控机械档案',story:'档案中交织着机械设计与被污染的记忆。安全修复能还原资料，深入读取则可能找到混沌进化的线索。',hint:'永久路线资料',choices:[
  {id:'risk',title:'读取混沌记忆',text:'失去8生命（最低保留1），永久解锁混沌资料；本局进化仍需满足行为条件。',effect:{hpCost:8,routes:['chaos']}},
  {id:'safe',title:'修复并净化档案',text:'回复8生命，永久解锁机械研究与净化资料。',effect:{heal:8,routes:['mechanical','purification']}},
 ]},
 supply:{id:'supply',title:'流浪补给商',story:'商人从行囊里翻出一张恢复磁盘，也愿意收走你们沿途拾到的旧零件。',hint:'补充消耗品 / 获得金币',choices:[
  {id:'risk',title:'购买恢复磁盘',text:'支付20金币，获得1个恢复磁盘，最多携带2个。',effect:{goldCost:20,potion:true}},
  {id:'safe',title:'出售旧零件',text:'获得10金币。',effect:{gold:10}},
 ]},
};
export const eventFor=(run:Run):StoryEvent|undefined=>run.currentNode?.eventId?EVENTS[run.currentNode.eventId]:undefined;
export function eligibleEventCards(run:Run,choice:EventChoice){return run.deck.filter(c=>choice.effect.card==='upgrade'?!c.upgraded:true);}
export function eventChoiceBlock(run:Run,choice:EventChoice):string {
 const e=choice.effect;
 if(run.gold<(e.goldCost??0))return '金币不足';
 if(e.potion&&run.potions>=2)return '恢复磁盘已满';
 if(e.card==='remove'&&run.deck.length<=5)return '至少保留5张牌';
 if(e.card&&!eligibleEventCards(run,choice).length)return '没有可选择的卡牌';
 return '';
}
// 仅验证通过后提交效果；选择卡片前不扣金币，重复点击由事件页面状态拦截。
export function applyEvent(run:Run,meta:Meta,choiceId:'risk'|'safe',uid?:string):boolean {
 const event=eventFor(run),choice=event?.choices.find(c=>c.id===choiceId);
 if(!choice||eventChoiceBlock(run,choice))return false;
 const e=choice.effect,card=e.card?eligibleEventCards(run,choice).find(c=>c.uid===uid):undefined;
 if(e.card&&!card)return false;
 run.gold=run.gold-(e.goldCost??0)+(e.gold??0);
 run.hp=Math.min(run.maxHp,Math.max(1,run.hp-(e.hpCost??0))+(e.heal??0));
 if(e.card==='upgrade'&&card)card.upgraded=true;
 if(e.card==='remove'&&card)run.deck=run.deck.filter(c=>c.uid!==card.uid);
 if(e.autoUpgrade){const c=run.deck.find(c=>!c.upgraded&&c.id!=='guard');if(c)c.upgraded=true;}
 if(e.potion)run.potions++;
 if(e.training)run.training=e.training;
 for(const route of e.routes??[])if(!meta.unlockedRoutes.includes(route))meta.unlockedRoutes.push(route);
 run.message=`${event!.title} · ${choice.title}：${choice.text}${card?`（${CARDS[card.id].name}）`:''}`;
 return true;
}
