import type { CSSProperties } from 'react';
import { PORTRAIT_FORMS, asset } from '../game/data';
import sprites from '../game/sprites.json';
const bank:Record<string,{frames:number;duration:number}>=sprites;
export function Sprite({id,size=200,className=''}:{id:string;size?:number;className?:string}){
 if(PORTRAIT_FORMS.includes(id))return <span className={`sprite-wrap portrait-sprite ${className}`} style={{width:size,height:size}} aria-hidden="true"><img src={asset(id)} alt=""/></span>;
 const s=bank[id]??bank.guilmon;
 const style={width:size,height:size,'--frames':s.frames,'--duration':`${s.duration}ms`,'--sheet-end':`${-256*s.frames}px`,'--sprite-scale':size/256,backgroundImage:`url("${import.meta.env.BASE_URL}sprites/${id}-sheet.png")`} as CSSProperties;
 return <span className={`sprite-wrap ${className}`} style={{width:size,height:size}} aria-hidden="true"><span className="sprite" style={style}/></span>;
}
