import type { Enemy, Intent, Run } from './types';

export function expandedIntent(run:Run,enemy:Enemy):Intent|undefined {
 const phase=((run.battle?.turn??1)-1)%3,ch=Math.floor(run.row/8);
 const attack=(name:string,damage:number,hits=1,detail='对搭档造成伤害。'):Intent=>({name,type:'attack',damage,hits,shield:0,detail});
 const pause=(name:string,type:Intent['type'],detail:string,shield=0):Intent=>({name,type,damage:0,hits:0,shield,detail});
 switch(enemy.id){
  case 'gotsumon':return phase===0?pause('岩石硬化','block','获得8护盾；之后两个回合以轻击为主。',8):attack(phase===1?'岩石拳':'硬化消退',phase===1?6+ch:4+ch);
  case 'betamon':return phase===0?pause('电荷聚集','buff','下一回合发动电击；本回合不攻击。'):attack(phase===1?'电击':'尾击',phase===1?10+ch:4+ch);
  case 'monodramon':return phase===2?pause('突击间歇','block','连续两回合攻击后休整，获得3护盾。',3):attack('连续突击',3+ch,2,'造成两段伤害；第三回合休整。');
  case 'clockmon':return phase===0?{...pause('时序干扰','debuff','向弃牌堆加入1张故障牌；行动前击败它可避免本次干扰。'),jam:1}:attack('指针冲击',6+ch);
  case 'seadramon':return phase===0?attack('潮汐冲击',13+ch,1,'重击后进入低输出回合，可以提前防御或施加虚弱。'):phase===1?attack('退潮',4+ch):pause('水流屏障','block','获得5护盾，下回合再次发动潮汐冲击。',5);
  case 'gekomon':return phase===0?{...pause('鼓舞之歌','buff','所有存活同伴攻击伤害＋1；下回合治疗受伤最多的同伴。'),strength:1}:phase===1?{...pause('修复之歌','heal','为缺失生命最多的存活同伴回复8生命，不复活已击败单位。'),heal:8}:attack('音波',5+ch);
  case 'devimon':return phase===0?{...attack('生命吸取',10,1,'回复本次造成的生命伤害，最多6点；完全格挡可阻止回复。'),drain:6}:phase===1?{...pause('暗影干扰','debuff','向弃牌堆加入1张故障牌，下回合发动重击。'),jam:1}:attack('暗影爪击',13);
  case 'skullgreymon':{
   if(phase===2){const stopped=enemy.stagger>=18||(enemy.effectiveAttacks??0)>=3;return stopped?pause('蓄力被打断','block','本回合已造成18直接生命伤害，或用3张攻击牌造成生命伤害，重击取消。'):attack('零式巡航导弹',23,1,`本回合造成18直接生命伤害（${enemy.stagger}/18），或3张攻击牌命中生命（${enemy.effectiveAttacks??0}/3），可取消重击。`);}
   return phase===0?attack('骨爪',9):pause('导弹锁定','buff','下一回合预定23伤害；可用重击或连续攻击打断。');
  }
  case 'machinedramon':return phase===0?pause('装甲展开','block','获得16护盾；在炮击前击破这层护盾，可将下一次炮击从24降至14。',16):phase===1?pause('炮口充能','buff',enemy.armorBroken?'装甲已破，下一回合炮击降低为14。':'保留剩余装甲，下一回合炮击24；击破护盾可削弱炮击。'):attack('无限大炮',enemy.armorBroken?14:24,1,enemy.armorBroken?'装甲被击破，炮击伤害已降低。':'装甲未被击破：24伤害；也可用护盾或虚弱应对。');
  default:return undefined;
 }
}
