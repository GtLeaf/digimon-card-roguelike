import { useState } from 'react';
import { ArrowRight, Check, Radio } from 'lucide-react';
import { CARDS } from '../game/data';
import { ROUTE_DATA } from '../game/evolution';
import { eligibleEventCards, eventChoiceBlock, eventChoicePreview, storyEventFor } from '../game/events';
import type { Action, Meta, Run } from '../game/types';
import { CardChoicePanel, JourneyHeader, JourneyPanel, JourneyResources } from './JourneyPanel';

export function StoryEventView({run,meta,onAction}:{run:Run;meta:Meta;onAction:(action:Action)=>void}){
 const [pending,setPending]=useState<'risk'|'safe'|null>(null);
 const event=storyEventFor(run);
 const autoCard=run.deck.find(card=>!card.upgraded&&card.id!=='guard');
 const choice=event.choices.find(c=>c.id===pending),cards=choice?eligibleEventCards(run,choice):[];
 return <div className="journey-screen event-screen">
  <JourneyHeader icon={<Radio/>} title={event.title} eyebrow="AN UNEXPECTED SIGNAL">{event.hint}</JourneyHeader>
  <JourneyResources run={run}/><p className="journey-story">{event.story}</p>
  <p className="journey-hint">只能选择一项，确认后继续旅程。</p>
  <div className="option-list">{event.choices.map(option=>{
   const blocked=eventChoiceBlock(run,option);
   return <button className="option" key={option.id} disabled={!!blocked} onClick={()=>setPending(option.id)}>
    <Radio size={20}/><span><strong>{option.title}</strong><small>{option.text}</small>
     <span className="journey-effect-tags">{eventChoicePreview(run,option).map(text=><span key={text}>{text}</span>)}</span>
     {blocked&&<small className="journey-blocked">{blocked}</small>}
     {option.effect.routes?.map(id=><small key={id}>{meta.unlockedRoutes.includes(id)?<Check size={12}/>:null}{ROUTE_DATA[id].name} · {meta.unlockedRoutes.includes(id)?'已永久解锁':'本次可永久解锁'}</small>)}
    </span><ArrowRight size={18}/>
   </button>;
  })}</div>
  {choice?.effect.card&&<CardChoicePanel run={run} cards={cards} mode={choice.effect.card} title={choice.title} cost={choice.effect.goldCost} blocked={eventChoiceBlock(run,choice)} onClose={()=>setPending(null)} onConfirm={uid=>onAction({type:'event',choice:choice.id,uid})}/>}
  {choice&&!choice.effect.card&&<JourneyPanel title={choice.title} onClose={()=>setPending(null)} footer={<><p className="journey-action-note">{eventChoiceBlock(run,choice)||'确认后完成本次事件，继续旅程'}</p><div><button className="secondary" onClick={()=>setPending(null)}>返回选择</button><button className="primary" disabled={!!eventChoiceBlock(run,choice)} onClick={()=>onAction({type:'event',choice:choice.id})}>确认选择<ArrowRight size={16}/></button></div></>}><JourneyResources run={run}/><p className="journey-story">{choice.text}</p><div className="journey-outcome-preview">{eventChoicePreview(run,choice).map(text=><p key={text}>{text}</p>)}{choice.effect.autoUpgrade&&<p>{autoCard?`将强化：${CARDS[autoCard.id].name}`:'没有符合条件的卡牌，本次不会强化'}</p>}{choice.effect.routes?.map(id=><p key={id}>{ROUTE_DATA[id].name} · {meta.unlockedRoutes.includes(id)?'已永久解锁':'永久解锁，跨局保留'}</p>)}</div></JourneyPanel>}
 </div>;
}
