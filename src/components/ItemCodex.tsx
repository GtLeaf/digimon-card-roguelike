import { useState } from 'react';
import { BatteryCharging, BookOpen, Disc3, Flame, Heart, MemoryStick, Shield, Snowflake, Sparkles, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BLESSINGS, RELICS } from '../game/data';
import type { Run } from '../game/types';

type Category = 'all' | 'relic' | 'blessing' | 'consumable';
const categories: { id: Category; name: string }[] = [
 { id:'all', name:'全部' }, { id:'relic', name:'装置' },
 { id:'blessing', name:'祝福' }, { id:'consumable', name:'消耗品' },
];
const relicIcons: Record<string, LucideIcon> = {reader:BookOpen,cooler:Snowflake,firewall:Flame,memory:MemoryStick,battery:BatteryCharging,armor:Shield};
const blessingIcons: Record<string, LucideIcon> = {bond:Zap,guard:Shield,growth:Heart};

export function ItemCodex({run}:{run:Run|null}) {
 const [category,setCategory]=useState<Category>('all');
 const items = [
  ...Object.entries(RELICS).map(([id,item])=>({id,category:'relic' as const,...item,icon:relicIcons[id]??MemoryStick,owned:!!run?.relics.includes(id),status:'本局持有',source:'精英／首领战胜利、数据宝箱，或商店花费80金币随机获得。',note:'获得后自动生效，同种装置不重复持有，本局结束后清空。'})),
  ...Object.entries(BLESSINGS).map(([id,item])=>({id,category:'blessing' as const,...item,icon:blessingIcons[id]??Sparkles,owned:run?.blessing===id,status:'当前祝福',source:'旅途开始、第一章及第二章首领后的祝福选择。',note:id==='growth'?'选中时立即生效，增加的生命上限保留到本局结束。':'选中后自动生效，同时只能保留一种当前祝福。'})),
  {id:'potion',category:'consumable' as const,name:'恢复磁盘',text:'战斗中回复18生命，不超过生命上限；使用后消耗1个，不消耗行动力。',icon:Disc3,owned:!!run&&run.potions>0,status:`持有 ${run?.potions??0} / 2`,source:'每局初始携带1个；商店花费30金币购买，每个商店限购1次。',note:'最多携带2个，仅在战斗中且生命未满时可用。'},
 ];
 const visible=items.filter(item=>category==='all'||item.category===category);
 return <div className="item-codex">
  <div className="item-codex-intro"><span className="eyebrow">FIELD GUIDE / 道具档案</span><p>查看效果，规划下一站的补给。</p><small>{run?'高亮标记本局持有的装置、当前祝福和剩余消耗品。':'开启旅途后，这里会显示本局持有状态。'}</small></div>
  <div className="item-codex-filters" role="group" aria-label="道具分类">{categories.map(c=><button key={c.id} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.name}<span>{c.id==='all'?items.length:items.filter(item=>item.category===c.id).length}</span></button>)}</div>
  <p className="item-codex-count" aria-live="polite">共 {visible.length} 项</p>
  <div className="item-codex-grid">{visible.map(item=>{const Icon=item.icon;return <article key={item.id} className={`item-codex-entry ${item.owned?'owned':''}`}>
   <div className="item-codex-title"><span className="item-codex-icon"><Icon size={25} aria-hidden="true"/></span><div><small>{categories.find(c=>c.id===item.category)?.name}</small><h3>{item.name}</h3></div>{item.owned&&<span className="item-codex-status">{item.status}</span>}</div>
   <p className="item-codex-effect">{item.text}</p><dl><dt>获取方式</dt><dd>{item.source}</dd><dt>使用说明</dt><dd>{item.note}</dd></dl>
  </article>;})}</div>
 </div>;
}
