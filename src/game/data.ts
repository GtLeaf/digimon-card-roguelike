import type { CardDef, EnemyDef, Partner, Branch } from './types';
const card = (id: string,name: string,cost: number,kind: CardDef['kind'],family: CardDef['family'],text: string,art: string,effects: Partial<CardDef>={}):CardDef => ({id,name,cost,kind,family,text,art,...(family!=='common'&&family!=='status'?{unlockForm:art}:{}),...effects});
export const CARDS:Record<string,CardDef> = Object.fromEntries([
 card('strike','攻击指令',1,'attack','common','造成 7 点伤害。','guilmon',{damage:7}),
 card('guard','防御插件',1,'skill','common','获得 7 点护盾。','hagurumon',{shield:7}),
 card('haste','高速插件',0,'skill','common','抽 1 张牌。耗竭。','picodevimon',{draw:1,exhaust:true}),
 card('fortify','防护屏障',2,'skill','common','获得 17 点护盾。','andromon',{shield:17}),
 card('mend','数据修复',1,'skill','common','回复 5 点生命。耗竭。','mushmon',{heal:5,exhaust:true}),
 card('battery','能量装填',0,'skill','common','获得 1 点行动力。耗竭。','hagurumon',{energy:1,exhaust:true}),
 card('study','紧急分析',1,'skill','common','抽 2 张牌。','renamon',{draw:2}),
 card('purge','净化程序',0,'skill','common','清除手牌中的故障牌，抽 1 张。耗竭。','taomon',{special:'purge',draw:1,exhaust:true}),
 card('brace','战术整备',1,'skill','common','获得 5 护盾，抽 1 张牌。','leomon',{shield:5,draw:1}),
 card('shieldbash','盾击',1,'attack','common','造成 4 ＋当前护盾一半的伤害。','dukemon',{damage:4,special:'shieldhit'}),
 card('charge','蓄能指令',1,'power','common','获得 2 蓄能，获得 4 护盾。','andromon',{charge:2,shield:4}),
 card('cannon','脉冲炮',2,'attack','common','造成 14 伤害，消耗全部蓄能，每层额外 4 伤害。','wargrowlmon',{damage:14,special:'cannon'}),
 card('fireball','火球',1,'attack','guilmon','造成 6 伤害，施加 2 灼烧。','guilmon',{damage:6,burn:2}),
 card('rock','岩石粉碎',1,'attack','guilmon','造成 11 点伤害。','guilmon',{damage:11}),
 card('ignite','烈焰引爆',1,'attack','guilmon','造成 3 伤害；消耗目标灼烧，每层额外 3 伤害。','growlmon',{damage:3,special:'detonate'}),
 card('inferno','原子爆焰',2,'attack','guilmon','对所有敌人造成 15 伤害。耗竭。','wargrowlmon',{damage:15,all:true,exhaust:true}),
 card('doublecut','双刃斩',1,'attack','guilmon','造成 5×2 段伤害。','growlmon',{damage:5,hits:2}),
 card('roar','勇气咆哮',1,'power','guilmon','本场攻击每段伤害＋2。耗竭。','guilmon',{strength:2,exhaust:true}),
 card('heatwave','热浪',1,'attack','guilmon','对所有敌人造成 3 伤害，施加 2 灼烧。','growlmon',{damage:3,burn:2,all:true}),
 card('sacrifice','危险过载',0,'skill','guilmon','失去 3 生命，获得 1 行动力，抽 1 张牌。耗竭。','blackwargrowlmon',{special:'sacrifice',energy:1,draw:1,exhaust:true}),
 card('flare','余烬护甲',1,'skill','guilmon','获得 8 护盾，对所有敌人施加 1 灼烧。','wargrowlmon',{shield:8,burn:1,all:true}),
 card('leaf','狐叶楔',1,'attack','renamon','造成 3×2 段伤害，施加 1 符印。','renamon',{damage:3,hits:2,mark:1}),
 card('illusion','狐变虚',1,'skill','renamon','复制手中最左侧非复制、非故障牌；复制牌耗竭。','renamon',{special:'copy'}),
 card('talisman','符咒',1,'skill','renamon','施加 3 符印，获得 4 护盾。','renamon',{mark:3,shield:4}),
 card('seal','解印',1,'attack','renamon','造成 5 伤害；消耗符印，每层额外 5 伤害。','renamon',{damage:5,special:'markburst'}),
 card('spirit','狐火',1,'attack','renamon','造成 7 伤害，施加 1 灼烧和 1 符印。','kyubimon',{damage:7,burn:1,mark:1}),
 card('barrier','金刚结界',1,'skill','renamon','获得 10 护盾。','taomon',{shield:10}),
 card('insight','灵视',0,'skill','renamon','抽 2 张牌。耗竭。','renamon',{draw:2,exhaust:true}),
 card('cyclone','狐炎龙',2,'attack','renamon','对所有敌人造成 11 伤害，施加 1 符印。','kyubimon',{damage:11,mark:1,all:true}),
 card('ritual','阴阳术',1,'power','renamon','本场攻击每段伤害＋1，抽 1 张牌。耗竭。','taomon',{strength:1,draw:1,exhaust:true}),
 card('royal','皇家枪击',2,'attack','duke','造成 22 伤害，获得 8 护盾。','dukemon',{damage:22,shield:8}),
 card('aegis','圣盾守护',1,'skill','duke','获得 13 护盾，抽 1 张牌。','dukemon',{shield:13,draw:1}),
 card('megido','灭世烈焰',2,'attack','megidra','失去 3 生命；对所有敌人造成 19 伤害、施加 4 灼烧。耗竭。','megidramon',{damage:19,burn:4,all:true,special:'sacrifice',exhaust:true}),
 card('apocalypse','地狱咆哮',1,'attack','megidra','对所有敌人施加 5 灼烧。','megidramon',{burn:5,all:true}),
 card('sacred','金刚界曼荼罗',1,'skill','sakuya','获得 10 护盾，抽 2 张牌。耗竭。','sakuyamon',{shield:10,draw:2,exhaust:true}),
 card('mirrors','净化之印',1,'attack','sakuya','造成 8 伤害，消耗符印每层追加 5 伤害。','sakuyamon',{damage:8,special:'markburst'}),
 card('foxguardian','管狐术',1,'attack','kuzuha','造成 10 伤害，获得 6 护盾。','kuzuhamon',{damage:10,shield:6}),
 card('mandala','胎藏界曼荼罗',2,'skill','kuzuha','获得 19 护盾，对所有敌人施加 2 符印。','kuzuhamon',{shield:19,mark:2,all:true}),
 card('darkflame','暗炎弹',1,'attack','guilmon','造成 7 伤害，施加 3 灼烧。','blackgrowmon',{damage:7,burn:3,series:'fireball'}),
 card('bloodedge','血色利刃',1,'attack','guilmon','失去 3 生命，造成 13 伤害。','blackgrowmon',{damage:13,special:'sacrifice'}),
 card('foxcurse','焰玉咒',1,'attack','renamon','造成 5 伤害，施加 2 符印和 1 虚弱。','youkomon',{damage:5,mark:2,weak:1,series:'leaf'}),
 card('shadowseal','咒符结界',1,'skill','renamon','获得 7 护盾，施加 2 符印。','doumon',{shield:7,mark:2,series:'talisman'}),
 card('drain','生命汲取',1,'attack','common','造成 8 伤害；若造成生命伤害，回复 3 生命。','chaosdukemon',{damage:8,drain:3}),
 card('chaoslance','混沌枪击',2,'attack','chaos','失去 3 生命，造成 23 伤害；若造成生命伤害，回复 5 生命。','chaosdukemon',{damage:23,special:'sacrifice',drain:5}),
 card('chaosward','暗黑圣盾',1,'skill','chaos','失去 3 生命，获得 18 护盾，抽 1 张牌。','chaosdukemon',{shield:18,draw:1,special:'sacrifice'}),
 card('fault','数据故障',1,'status','status','不能产生效果。支付 1 行动力清除，本场耗竭。','core',{exhaust:true}),
].map(c=>[c.id,c]));
export const PARTNERS:Record<Partner,{name:string;tag:string;description:string;forms:string[];branches:Branch[]}>={
 guilmon:{name:'基尔兽',tag:'火焰 · 勇气',description:'用烈焰突破防线，或以圣盾守护羁绊。',forms:['guilmon','growlmon','wargrowlmon'],branches:['duke','megidra','chaos']},
 renamon:{name:'妖狐兽',tag:'符印 · 灵巧',description:'编织符印与术式，让每一次出牌彼此呼应。',forms:['renamon','kyubimon','taomon'],branches:['sakuya','kuzuha']}
};
export const BRANCHES:Record<Branch,{name:string;art:string;tag:string;passive:string;cards:string[];partner:Partner}>={
 chaos:{name:'混沌红莲骑士兽',art:'chaosdukemon',tag:'血契循环',passive:'每回合首次主动自损后获得 6 护盾。',cards:['chaoslance','chaosward'],partner:'guilmon'},
 duke:{name:'红莲骑士兽',art:'dukemon',tag:'圣盾反击',passive:'每回合首张防御技能额外获得 3 护盾。',cards:['royal','aegis'],partner:'guilmon'},
 megidra:{name:'灭世魔龙兽',art:'megidramon',tag:'灼烧爆发',passive:'每回合首次施加灼烧，额外增加 2 层。',cards:['megido','apocalypse'],partner:'guilmon'},
 sakuya:{name:'沙古牙兽',art:'sakuyamon',tag:'术式循环',passive:'每回合首次消耗符印，抽 1 张牌。',cards:['sacred','mirrors'],partner:'renamon'},
 kuzuha:{name:'葛叶兽',art:'kuzuhamon',tag:'结界式神',passive:'每回合第二张技能牌触发式神，攻击一名敌人造成 4 伤害。',cards:['foxguardian','mandala'],partner:'renamon'}
};
export const FORM_NAMES:Record<string,string>={blackgrowmon:'黑古拉兽',blackwargrowlmon:'黑大古拉兽',chaosdukemon:'混沌红莲骑士兽',youkomon:'妖狐兽（蓝）',doumon:'道士兽',guilmon:'基尔兽',growlmon:'古拉兽',wargrowlmon:'大古拉兽',renamon:'妖狐兽',kyubimon:'九尾狐兽',taomon:'祭师兽',dukemon:'红莲骑士兽',megidramon:'灭世魔龙兽',sakuyamon:'沙古牙兽',kuzuhamon:'葛叶兽'};
const enemy=(id:string,name:string,hp:number,style:EnemyDef['style'],support?:string):EnemyDef=>({id,name,hp,style,art:id,scan:true,support});
export const ENEMIES:Record<string,EnemyDef>=Object.fromEntries([
 enemy('goblimon','哥布林兽',29,'charge'),enemy('mushmon','蘑菇兽',25,'jam','蘑菇孢子：目标下次攻击每段伤害－2。'),enemy('hagurumon','齿轮兽',28,'shield','防御充能：获得 10 护盾。'),enemy('picodevimon','小恶魔兽',24,'buff','恶作剧：对目标造成 8 伤害。'),enemy('bakemon','猛鬼兽',30,'evade'),enemy('impmon','小妖兽',28,'rapid'),enemy('devidramon','邪龙兽',65,'charge'),enemy('dokugumon','毒蜘蛛兽',58,'spider'),enemy('sinduramon','铁鸡兽',110,'chicken'),enemy('ogremon','奥加兽',49,'charge'),enemy('leomon','狮子兽',52,'sword'),enemy('andromon','安杜路兽',54,'shield'),enemy('icedevimon','冰恶魔兽',82,'jam'),enemy('vajramon','蛮牛兽',92,'sword'),enemy('beelzebumon','别西卜兽',148,'rapid'),
 ...['scout','replica','corrupt','sentinel','devourer','core'].map((id,i):EnemyDef=>({id,name:['侦察代理体','复制代理体','侵蚀代理体','护卫代理体','吞噬代理体','帝厉魔核心'][i],art:id,hp:[46,48,50,90,95,190][i],style:(['rapid','buff','jam','shield','spider','core'] as const)[i],scan:false}))
].map(e=>[e.id,e]));
export const RELICS:Record<string,{name:string;text:string}>={reader:{name:'备用读卡器',text:'每场首回合多抽 1 张牌。'},cooler:{name:'散热芯片',text:'每回合前三次攻击伤害段＋1。'},firewall:{name:'防火模块',text:'每回合首次施加灼烧，获得 3 护盾。'},memory:{name:'记忆晶片',text:'战斗胜利后回复 3 生命。'},battery:{name:'应急电池',text:'每场首回合额外获得 1 行动力。'},armor:{name:'合金装甲',text:'每回合开始时获得 3 护盾。'}};
export const BLESSINGS:Record<string,{name:string;text:string}>={bond:{name:'羁绊共鸣',text:'每场战斗开始时获得 2 同步值。'},guard:{name:'守护之心',text:'每回合第一张防御技能额外获得 3 护盾。'},growth:{name:'生命之光',text:'最大生命＋10，并回复 10 生命。'}};
export const CHAPTERS=[{name:'现实的裂隙',subtitle:'新宿 · 黄昏边界',theme:'city'},{name:'迷失的数据原野',subtitle:'数码世界 · 记忆森林',theme:'forest'},{name:'最后的信号',subtitle:'侵蚀区域 · 帝厉魔核心',theme:'void'}];
export const PORTRAIT_FORMS=['blackgrowmon','youkomon','doumon'];
export const asset=(id:string)=>`${import.meta.env.BASE_URL}${PORTRAIT_FORMS.includes(id)?'portraits/'+id+'.jpg':'sprites/'+id+'.png'}`;
export const cardText=(c:{id:string;upgraded:boolean})=>{
 const d=CARDS[c.id];if(!c.upgraded)return d.text;
 let text=d.text;if(d.damage)text=text.replace(/造成 \d+/,`造成 ${d.damage+3}`);
 if(d.shield)text=text.replace(/获得 \d+ (?:点)?护盾/,`获得 ${d.shield+3} 护盾`);
 if(!d.damage&&!d.shield)text+=` 强化：费用 ${d.cost}→${Math.max(0,d.cost-1)}。`;
 return text;
};
export const needsTarget=(d:CardDef)=>!d.all&&!!(d.damage||d.mark||d.burn||d.special==='markburst'||d.special==='detonate');
