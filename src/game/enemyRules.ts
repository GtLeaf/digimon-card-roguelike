import type { Enemy, Intent, Run } from './types';

export function expandedIntent(run:Run,enemy:Enemy):Intent|undefined {
 const b=run.battle;
 const turn=b?.turn??1,phase=(turn-1)%3,ch=Math.floor(run.row/run.chapterRows);
 const alive=b?b.enemies.filter(x=>x.hp>0).length:1;
 const canSummon=(enemy.summons??0)<2&&alive<3;
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
  case 'machinedramon':{
   if(phase===0){const summonDetail=canSummon?'，并呼叫1只齿轮兽协防':'';return {...pause('装甲展开','block',`获得16护盾${summonDetail}；在炮击前击破这层护盾，可将下一次炮击从24降至14。`,16),...(canSummon?{summon:['hagurumon']}:{})};}
   if(phase===1)return pause('炮口充能','buff',enemy.armorBroken?'装甲已破，下一回合炮击降低为14。':'保留剩余装甲，下一回合炮击24；击破护盾可削弱炮击。');
   return attack('无限大炮',enemy.armorBroken?14:24,1,enemy.armorBroken?'装甲被击破，炮击伤害已降低。':'装甲未被击破：24伤害；也可用护盾或虚弱应对。');
  }
  case 'knightmon':return phase===0?pause('骑士守势','block','获得10护盾。护卫同伴：存活时，同伴受到的指定目标攻击由它承受。',10):attack('狂暴大剑',4+ch,2,'护卫同伴：存活时，同伴受到的指定目标攻击由它承受。');
  case 'phantomon':{const mad=enemy.hp*2<=enemy.maxHp;return mad?attack('幻影暴走',5+ch,2,'狂暴中：生命低于一半后每回合改为两段连续攻击。'):phase===2?pause('死灵咒唱','buff','下一回合发动灵魂收割；生命低于一半后进入狂暴。'):attack('灵魂收割',8+ch,1,'生命低于一半后进入狂暴，改为每回合两段攻击。');}
  case 'kuramon':return attack('数据啃噬',5+ch,1,'被击败时自爆，对搭档造成8伤害；被召唤的个体在召唤者被击败后随之消散。');
  case 'diaboromon':{
   if(phase===0)return canSummon?{...pause('集群增殖','buff','召唤1只库拉蒙（场上最多3个敌人，最多召唤2次）；库拉蒙被击败时自爆。优先清场可阻止召唤。'),summon:['kuramon']}:pause('数据屏障','block','场地已满或召唤次数用尽：改为获得12护盾。',12);
   return phase===1?attack('灾祸巨炮',13+ch):attack('失乐园',8+ch,2,'两段咆哮；召唤间隙是输出窗口。');
  }
  case 'vajramon':{const bonus=Math.min(3,enemy.effectiveAttacks??0)*3;return phase===1?pause('防御架势','block','获得14护盾；蓄力观察你的攻势。',14):attack('连续斩击',6+ch+bonus,2,`反击蓄能：本回合你的攻击牌每命中生命一次，斩击伤害＋3（当前＋${bonus}，至多＋9）。`);}
  case 'core':{
   const cycle=(turn-1)%4;
   if(cycle===0)return {...pause('数据删除','debuff','加入2张故障牌，核心获得8护盾。'),jam:2};
   if(cycle===1)return attack('侵蚀光束',9,2);
   if(cycle===2)return canSummon?{...pause('增殖','buff','召唤1只复制代理体（最多2次）；场上存活敌人越多，终末脉冲越强。'),summon:['replica']}:pause('增殖受阻','block','场地已满或增殖次数用尽：改为获得10护盾。',10);
   return attack('终末脉冲',24+Math.max(0,alive-1)*4,1,`场上每多1个存活敌人伤害＋4（当前${24+Math.max(0,alive-1)*4}）；增殖相位保留群攻牌应对。`);
  }
  default:return undefined;
 }
}
