import { skillLabel, skillDescription } from '../game/cardSkills';
import { Flame, Shield, Sparkles, Swords, Zap, Lock } from 'lucide-react';
import { CARDS, asset, cardText } from '../game/data';
import { cardCost } from '../game/engine';
import type { Card, Run } from '../game/types';
const icons={attack:Swords,skill:Shield,power:Sparkles,status:Lock};
export function GameCard({card,selected=false,disabled=false,onClick,compact=false,run}:{card:Card;selected?:boolean;disabled?:boolean;onClick?:()=>void;compact?:boolean;run?:Run|null}){
 const d=CARDS[card.id],Icon=icons[d.kind];
 const isGeneric=d.family==='common'||d.family==='status';
 const artwork=isGeneric?`${import.meta.env.BASE_URL}card-art/${d.id}.jpg`:asset(d.art);
 return <button className={`game-card ${d.kind} ${selected?'selected':''} ${compact?'compact':''}`} disabled={disabled} onClick={onClick} aria-label={`${d.name}${card.upgraded?'强化':''}，${cardCost(card)}费`} aria-pressed={selected}>
  <span className="card-cost">{cardCost(card)}</span><span className="card-category"><Icon size={13}/>{d.kind==='attack'?'攻击':d.kind==='skill'?'技能':d.kind==='power'?'强化':'故障'}</span>
  <span className={`card-art ${isGeneric?'generated-art':''}`}><img src={artwork} alt="" decoding="async"/>{!isGeneric&&<span className="card-sigil">{d.burn?<Flame/>:d.shield?<Shield/>:<Zap/>}</span>}</span>
  <span className="card-origin" title={skillDescription(d,run)}>{skillLabel(d,run)}</span>
  <strong>{d.name}{card.upgraded&&<em>＋</em>}</strong><span className="card-description">{cardText(card)}</span><span className="card-footer">CARD SLASH <span>{d.exhaust?'耗竭':'数码指令'}</span></span>
 </button>;
}
