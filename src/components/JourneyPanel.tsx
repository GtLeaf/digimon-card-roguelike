import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Coins, Heart, Layers, X } from 'lucide-react';
import { cardDefinition, cardText } from '../game/data';
import { cardCost } from '../game/engine';
import type { Card, CardKind, Run } from '../game/types';
import { GameCard } from './GameCard';
import './JourneyInteractions.css';

export function JourneyResources({run}:{run:Run}){
 return <div className="journey-resources" aria-label="当前资源"><span><Heart size={15}/>{run.hp}/{run.maxHp}</span><span><Coins size={15}/>{run.gold} 金币</span><span><Layers size={15}/>{run.deck.length} 张</span><span>磁盘 {run.potions}/2</span></div>;
}

export function JourneyHeader({icon,title,eyebrow,children}:{icon:ReactNode;title:string;eyebrow:string;children:ReactNode}){
 return <header className="journey-heading"><span className="journey-heading-icon">{icon}</span><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div><p>{children}</p></header>;
}

// 独立滚动面板：保留底层位置，确认/取消始终在可视区域内。
export function JourneyPanel({title,children,footer,onClose,wide=false}:{title:string;children:ReactNode;footer:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
  const before=document.activeElement,overflow=document.body.style.overflow;
  const root=document.getElementById('root'),wasInert=root?.inert;
  document.body.style.overflow='hidden';if(root)root.inert=true;ref.current?.focus();
  const handle=(event:KeyboardEvent)=>{
   if(event.key==='Escape')closeRef.current();
   if(event.key!=='Tab')return;
   const items=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,a[href]');
   if(!items?.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handle);
  return()=>{document.body.style.overflow=overflow;if(root)root.inert=wasInert??false;document.removeEventListener('keydown',handle);if(before instanceof HTMLElement&&before.isConnected)before.focus({preventScroll:true});};
 },[]);
 return createPortal(<div className="journey-panel-backdrop" onClick={onClose}><section className={`journey-panel ${wide?'journey-panel-wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={event=>event.stopPropagation()}><header className="journey-panel-heading"><h2>{title}</h2><button className="icon-btn" aria-label="关闭面板" onClick={onClose}><X size={21}/></button></header><div className="journey-panel-content">{children}</div><footer className="journey-panel-actions">{footer}</footer></section></div>,document.body);
}

export function CardEffectPreview({card,upgrade=false}:{card:Card;upgrade?:boolean}){
 return <div className="journey-card-effect"><h3>{cardDefinition(card).name}{card.upgraded?'＋':''}</h3><div className="effect-comparison"><div><h4>{upgrade?'强化前':'卡牌效果'} · {cardCost(card)} 费</h4><p>{cardText(card)}</p></div>{upgrade&&<div className="effect-after"><h4>强化后 · {cardCost({...card,upgraded:true})} 费</h4><p>{cardText({...card,upgraded:true})}</p></div>}</div></div>;
}

export function CardChoicePanel({run,cards,mode,title,cost=0,blocked='',onConfirm,onClose}:{run:Run;cards:Card[];mode:'upgrade'|'remove';title:string;cost?:number;blocked?:string;onConfirm:(uid:string)=>void;onClose:()=>void}){
 const [uid,setUid]=useState(''),[kind,setKind]=useState<CardKind|'all'>('all');
 const selected=cards.find(card=>card.uid===uid),visible=cards.filter(card=>kind==='all'||cardDefinition(card).kind===kind);
 const name=mode==='upgrade'?'强化':'移除';
 return <JourneyPanel title={title} wide onClose={onClose} footer={<><p className="journey-action-note">{blocked|| (selected?`${name}后${mode==='remove'?`卡组 ${run.deck.length} → ${run.deck.length-1} 张`:'仅影响本局这张牌'}${cost?` · 余额 ${run.gold-cost} 金币`:''}`:'选择一张牌，查看完整效果') }</p><div><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!selected||!!blocked} onClick={()=>{if(selected&&!blocked)onConfirm(selected.uid);}}>确认{name}{cost?` · ${cost} 金币`:''}<ArrowRight size={16}/></button></div></>}>
  <JourneyResources run={run}/><p className="journey-hint">{cost?`费用 ${cost} 金币，确认前不扣费。`:'确认后消耗本次营地行动。'}{mode==='remove'?'移除会从本局牌组中删除这张牌。':'点牌查看强化前后的变化。'}</p>
  <div className="journey-filters" aria-label="卡牌类型筛选">{(['all','attack','skill','power','status'] as const).map(value=><button key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{{all:'全部',attack:'攻击',skill:'技能',power:'强化',status:'故障'}[value]}</button>)}</div>
  <div className="journey-picker"><div className="deck-grid">{visible.map(card=><GameCard key={card.uid} run={run} compact card={card} selected={uid===card.uid} onClick={()=>setUid(card.uid)}/>)}</div><aside className="journey-selection" aria-live="polite">{selected?<CardEffectPreview card={selected} upgrade={mode==='upgrade'}/>:<p>点选卡牌查看详情<br/>再次点牌可以更换目标</p>}</aside></div>
  {!visible.length&&<p className="journey-hint">没有符合条件的卡牌，请切换筛选。</p>}
 </JourneyPanel>;
}
