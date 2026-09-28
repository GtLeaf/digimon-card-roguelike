import type { CardDef, EnemyDef, Partner, Branch } from './types';
const card = (id: string,name: string,cost: number,kind: CardDef['kind'],family: CardDef['family'],text: string,art: string,effects: Partial<CardDef>={}):CardDef => ({id,name,cost,kind,family,text,art,...(family!=='common'&&family!=='status'?{unlockForm:art}:{}),...effects});
export const CARDS:Record<string,CardDef> = Object.fromEntries([
 card('strike','攻击指令',1,'attack','common','造成 7 点伤害。','guilmon',{damage:7}),
 card('guard','防御插件',1,'skill','common','获得 7 点护盾。','hagurumon',{shield:7}),
 card('haste','高速插件',0,'skill','common','抽 1 张牌。耗竭。','picodevimon',{draw:1,exhaust:true,upgradeText:'抽 2 张牌。耗竭。'}),
 card('fortify','防护屏障',2,'skill','common','获得 17 点护盾。','andromon',{shield:17}),
 card('mend','数据修复',1,'skill','common','回复 5 点生命。耗竭。','mushmon',{heal:5,exhaust:true,upgradeText:'回复 7 点生命。耗竭。'}),
 card('battery','能量装填',0,'skill','common','获得 1 点行动力。耗竭。','hagurumon',{energy:1,exhaust:true,upgradeText:'获得 2 点行动力。耗竭。'}),
 card('study','紧急分析',1,'skill','common','抽 2 张牌。','renamon',{draw:2}),
 card('purge','净化程序',0,'skill','common','清除手牌中的故障牌，抽 1 张。耗竭。','taomon',{special:'purge',draw:1,exhaust:true,upgradeText:'清除手牌中的故障牌，抽 2 张。耗竭。'}),
 card('brace','战术整备',1,'skill','common','获得 5 护盾，抽 1 张牌。','leomon',{shield:5,draw:1}),
 card('shieldbash','盾击',1,'attack','common','造成 4 ＋当前护盾一半的伤害。','dukemon',{damage:4,special:'shieldhit'}),
 card('charge','蓄能指令',1,'power','common','获得 2 蓄能，获得 4 护盾。','andromon',{charge:2,shield:4}),
 card('cannon','脉冲炮',2,'attack','common','造成 14 伤害，消耗全部蓄能，每层额外 4 伤害。','wargrowlmon',{damage:14,special:'cannon'}),
 card('fireball','火球',1,'attack','guilmon','造成 6 伤害，施加 2 灼烧。','guilmon',{damage:6,burn:2}),
 card('rock','岩石粉碎',1,'attack','guilmon','造成 11 点伤害。','guilmon',{damage:11}),
 card('ignite','烈焰引爆',1,'attack','guilmon','造成 3 伤害；消耗目标灼烧，每层额外 3 伤害。','growlmon',{damage:3,special:'detonate'}),
 card('inferno','原子爆焰',2,'attack','guilmon','对所有敌人造成 15 伤害。耗竭。','wargrowlmon',{damage:15,all:true,exhaust:true}),
 card('doublecut','双刃斩',1,'attack','guilmon','造成 5×2 段伤害。','growlmon',{damage:5,hits:2}),
 card('roar','勇气咆哮',1,'power','guilmon','本场攻击每段伤害＋1。耗竭。','guilmon',{strength:1,exhaust:true}),
 card('heatwave','热浪',1,'attack','guilmon','对所有敌人造成 3 伤害，施加 2 灼烧。','growlmon',{damage:3,burn:2,all:true}),
 card('sacrifice','危险过载',0,'skill','guilmon','失去 3 生命，获得 1 行动力，抽 1 张牌。耗竭。','guilmon',{special:'sacrifice',energy:1,draw:1,exhaust:true,upgradeText:'失去 3 生命，获得 2 行动力，抽 2 张牌。耗竭。'}),
 card('flare','余烬护甲',1,'skill','guilmon','获得 8 护盾，对所有敌人施加 1 灼烧。','wargrowlmon',{shield:8,burn:1,all:true}),
 card('leaf','狐叶楔',1,'attack','renamon','造成 3×2 段伤害，施加 1 符印。','renamon',{damage:3,hits:2,mark:1}),
 card('illusion','狐变虚',1,'skill','renamon','复制手中最左侧非复制、非故障牌；复制牌耗竭。','renamon',{special:'copy'}),
 card('talisman','符咒',1,'skill','renamon','施加 3 符印，获得 4 护盾。','renamon',{mark:3,shield:4}),
 card('seal','解印',1,'attack','renamon','造成 5 伤害；消耗符印，每层额外 5 伤害。','renamon',{damage:5,special:'markburst'}),
 card('spirit','狐火',1,'attack','renamon','造成 7 伤害，施加 1 灼烧和 1 符印。','kyubimon',{damage:7,burn:1,mark:1}),
 card('barrier','金刚结界',1,'skill','renamon','获得 10 护盾。','taomon',{shield:10}),
 card('insight','灵视',0,'skill','renamon','抽 2 张牌。耗竭。','renamon',{draw:2,exhaust:true,upgradeText:'抽 3 张牌。耗竭。'}),
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
 card('runeShard','碎符',0,'attack','renamon','造成 3 伤害；消耗符印，每层额外 4 伤害。','youkomon',{damage:3,special:'markburst',markPower:4}),
 card('shadowseal','咒符结界',1,'skill','renamon','获得 7 护盾，施加 2 符印。','doumon',{shield:7,mark:2,series:'talisman'}),
 card('sealBurst','封灭阵',2,'attack','renamon','对所有敌人造成 6 伤害；消耗各自符印，每层额外 5 伤害。','doumon',{damage:6,all:true,special:'markburst'}),
 card('drain','生命汲取',1,'attack','common','造成 8 伤害；若造成生命伤害，回复 3 生命。','chaosdukemon',{damage:8,drain:3}),
 card('chaoslance','混沌枪击',2,'attack','chaos','失去 3 生命，造成 23 伤害；若造成生命伤害，回复 5 生命。','chaosdukemon',{damage:23,special:'sacrifice',drain:5}),
 card('chaosward','暗黑圣盾',1,'skill','chaos','失去 3 生命，获得 18 护盾，抽 1 张牌。','chaosdukemon',{shield:18,draw:1,special:'sacrifice'}),
 card('tinyTwister','小型龙卷风',1,'attack','terriermon','对所有敌人造成 4 伤害。','terriermon',{damage:4,all:true}),
 card('blazingShot','炽热气弹',1,'attack','terriermon','造成 8 伤害；若有蓄能，额外造成 2 伤害，不消耗蓄能。','terriermon',{damage:8,chargedDamage:2}),
 card('gatling','加特林机枪',1,'attack','terriermon','造成 3×3 段伤害。','galgomon',{damage:3,hits:3,upgradeDamage:1}),
 card('dumUpper','达姆达姆勾拳',1,'attack','terriermon','造成 9 伤害，获得 4 护盾。','galgomon',{damage:9,shield:4}),
 card('blackGatling','黑加特林机枪',1,'attack','terriermon','造成 4×2 段伤害，获得 3 护盾。','blackgalgomon',{damage:4,hits:2,shield:3,upgradeDamage:1}),
 card('ambushUpper','伏击勾拳',1,'attack','terriermon','造成 10 伤害，施加 2 虚弱。','blackgalgomon',{damage:10,weak:2}),
 card('rapidFire','疾速射击',1,'attack','terriermon','造成 3×3 段伤害，抽 1 张牌。','rapidmon',{damage:3,hits:3,draw:1,upgradeDamage:1}),
 card('goldTriangle','黄金三角',2,'attack','terriermon','对所有敌人造成 13 伤害。','rapidmon',{damage:13,all:true}),
 card('blackReload','战术·装甲装填',1,'skill','terriermon','获得 8 护盾，获得 2 蓄能。','blackrapidmon',{shield:8,charge:2}),
 card('blackMissile','战术·定点轰击',2,'attack','terriermon','造成 15 伤害，消耗全部蓄能，每层额外 4 伤害。','blackrapidmon',{damage:15,special:'cannon'}),
 card('giantMissile','巨型导弹',2,'attack','saint','造成 8×3 段伤害。','saintgalgomon',{damage:8,hits:3,upgradeDamage:1}),
 card('burstShot','爆裂射击',1,'attack','saint','对所有敌人造成 4×2 段伤害。','saintgalgomon',{damage:4,hits:2,all:true,upgradeDamage:1}),
 card('heavySalvo','战术·重装齐射',2,'attack','blacksaint','造成 12 伤害，消耗全部蓄能，每层额外 5 伤害。耗竭。','blacksaintgalgomon',{damage:12,special:'cannon',chargeMultiplier:5,exhaust:true}),
 card('fortressLoad','战术·要塞整备',1,'skill','blacksaint','获得 12 护盾，获得 2 蓄能。','blacksaintgalgomon',{shield:12,charge:2}),
 card('fault','数据故障',1,'status','status','不能产生效果。支付 1 行动力清除，本场耗竭。','core',{exhaust:true}),
].map(c=>[c.id,c]));
export const PARTNERS:Record<Partner,{name:string;tag:string;description:string;forms:string[];branches:Branch[]}>={
 guilmon:{name:'基尔兽',tag:'火焰 · 勇气',description:'用烈焰突破防线，或以圣盾守护羁绊。',forms:['guilmon','growlmon','wargrowlmon'],branches:['duke','megidra','chaos']},
 renamon:{name:'妖狐兽',tag:'符印 · 灵巧',description:'编织符印与术式，让每一次出牌彼此呼应。',forms:['renamon','kyubimon','taomon'],branches:['sakuya','kuzuha']},
 terriermon:{name:'大耳兽',tag:'连射 · 蓄能',description:'用连射掌握节奏，或蓄能化身重装炮台。',forms:['terriermon','galgomon','rapidmon'],branches:['saint','blacksaint']}
};
export const BRANCHES:Record<Branch,{name:string;art:string;tag:string;passive:string;cards:string[];partner:Partner}>={
 saint:{name:'撒多格杜兽',art:'saintgalgomon',tag:'连射压制',passive:'每回合第二张攻击牌结算后，获得 1 蓄能并抽 1 张牌。',cards:['giantMissile','burstShot'],partner:'terriermon'},
 blacksaint:{name:'黑撒多格杜兽',art:'blacksaintgalgomon',tag:'重装炮击',passive:'每回合首次防御出牌额外获得 1 蓄能；首次成功消耗蓄能后，获得 6 护盾。',cards:['heavySalvo','fortressLoad'],partner:'terriermon'},
 chaos:{name:'混沌红莲骑士兽',art:'chaosdukemon',tag:'血契循环',passive:'每回合首次主动自损后获得 6 护盾。',cards:['chaoslance','chaosward'],partner:'guilmon'},
 duke:{name:'红莲骑士兽',art:'dukemon',tag:'圣盾反击',passive:'每回合首张防御技能额外获得 3 护盾。',cards:['royal','aegis'],partner:'guilmon'},
 megidra:{name:'灭世魔龙兽',art:'megidramon',tag:'灼烧爆发',passive:'每回合首次施加灼烧，额外增加 2 层。',cards:['megido','apocalypse'],partner:'guilmon'},
 sakuya:{name:'沙古牙兽',art:'sakuyamon',tag:'术式循环',passive:'每回合首次消耗符印，抽 1 张牌。',cards:['sacred','mirrors'],partner:'renamon'},
 kuzuha:{name:'葛叶兽',art:'kuzuhamon',tag:'结界式神',passive:'每回合第二张技能牌触发式神，攻击一名敌人造成 4 伤害。',cards:['foxguardian','mandala'],partner:'renamon'}
};
export const FORM_NAMES:Record<string,string>={terriermon:'大耳兽',galgomon:'加鲁哥兽',blackgalgomon:'黑加鲁哥兽',rapidmon:'拉比兽',blackrapidmon:'黑拉比兽',saintgalgomon:'撒多格杜兽',blacksaintgalgomon:'黑撒多格杜兽',blackgrowmon:'黑古拉兽',blackwargrowlmon:'黑大古拉兽',chaosdukemon:'混沌红莲骑士兽',youkomon:'妖狐兽（蓝）',doumon:'道士兽',guilmon:'基尔兽',growlmon:'古拉兽',wargrowlmon:'大古拉兽',renamon:'妖狐兽',kyubimon:'九尾狐兽',taomon:'祭师兽',dukemon:'红莲骑士兽',megidramon:'灭世魔龙兽',sakuyamon:'沙古牙兽',kuzuhamon:'葛叶兽'};
const enemy=(id:string,name:string,hp:number,style:EnemyDef['style'],support?:string):EnemyDef=>({id,name,hp,style,art:id,scan:true,support});
export const ENEMIES:Record<string,EnemyDef>=Object.fromEntries([
 enemy('gotsumon','矿石兽',30,'expanded','矿石核心：获得 2 蓄能。'),enemy('betamon','比多兽',26,'expanded','数据汲取：抽 2 张牌。'),enemy('monodramon','独角龙兽',32,'expanded'),enemy('clockmon','时钟兽',34,'expanded'),enemy('seadramon','海龙兽',46,'expanded'),enemy('gekomon','怪蛙兽',30,'expanded'),enemy('devimon','恶魔兽',68,'expanded'),enemy('skullgreymon','丧尸暴龙兽',82,'expanded'),enemy('machinedramon','无限龙兽',148,'expanded'),
 enemy('goblimon','哥布林兽',29,'charge'),enemy('mushmon','蘑菇兽',25,'jam','蘑菇孢子：目标下次攻击每段伤害－2。'),enemy('hagurumon','齿轮兽',28,'shield','防御充能：获得 10 护盾。'),enemy('picodevimon','小恶魔兽',24,'buff','恶作剧：对目标造成 8 伤害。'),enemy('bakemon','猛鬼兽',30,'evade'),enemy('impmon','小妖兽',28,'rapid','恶作剧·双响：造成 8 伤害；目标生命低于一半时改为 14。'),enemy('devidramon','邪龙兽',65,'charge'),enemy('dokugumon','毒蜘蛛兽',58,'spider'),enemy('sinduramon','铁鸡兽',110,'chicken'),enemy('ogremon','奥加兽',49,'charge'),enemy('leomon','狮子兽',52,'sword','兽王咆哮：所有敌人虚弱 2，下次攻击每段伤害－2。'),enemy('andromon','安杜路兽',54,'shield','防御矩阵：获得 12 护盾。'),enemy('icedevimon','冰恶魔兽',82,'jam'),enemy('vajramon','蛮牛兽',92,'sword'),enemy('beelzebumon','别西卜兽',148,'rapid'),
 {id:'lopmon',name:'黑大耳兽',art:'lopmon',hp:1,style:'rapid' as const,scan:false,support:'安慰之光：清除手牌中 1 张故障牌；没有故障牌时回复 6 生命。'},
 ...['scout','replica','corrupt','sentinel','devourer','core'].map((id,i):EnemyDef=>({id,name:['侦察代理体','复制代理体','侵蚀代理体','护卫代理体','吞噬代理体','帝厉魔核心'][i],art:id,hp:[46,48,50,90,95,190][i],style:(['rapid','buff','jam','shield','spider','core'] as const)[i],scan:false}))
].map(e=>[e.id,e]));
export const RELICS:Record<string,{name:string;text:string}>={reader:{name:'备用读卡器',text:'每场首回合多抽 1 张牌。'},cooler:{name:'散热芯片',text:'每回合前三次攻击伤害段＋1。'},firewall:{name:'防火模块',text:'每回合首次施加灼烧，获得 3 护盾。'},memory:{name:'记忆晶片',text:'战斗胜利后回复 3 生命。'},battery:{name:'应急电池',text:'每场首回合额外获得 1 行动力。'},armor:{name:'合金装甲',text:'每回合开始时获得 3 护盾。'}};
export const BLESSINGS:Record<string,{name:string;text:string}>={bond:{name:'羁绊共鸣',text:'每场战斗开始时获得 2 同步值。'},guard:{name:'守护之心',text:'每回合第一张防御技能额外获得 3 护盾。'},growth:{name:'生命之光',text:'最大生命＋10，并回复 10 生命。'}};
export const CHAPTERS=[{name:'现实的裂隙',subtitle:'新宿 · 黄昏边界',theme:'city'},{name:'迷失的数据原野',subtitle:'数码世界 · 记忆森林',theme:'forest'},{name:'最后的信号',subtitle:'侵蚀区域 · 帝厉魔核心',theme:'void'}];
export const PORTRAIT_FORMS=['blackgrowmon','youkomon','doumon','blackgalgomon'];
export const asset=(id:string)=>`${import.meta.env.BASE_URL}${PORTRAIT_FORMS.includes(id)?'portraits/'+id+'.jpg':'sprites/'+id+'.png'}`;
export const cardText=(c:{id:string;upgraded:boolean})=>{
 const d=CARDS[c.id];if(!c.upgraded)return d.text;
 if(d.upgradeText)return d.upgradeText;
 let text=d.text;if(d.damage)text=text.replace(/造成 \d+/,`造成 ${d.damage+(d.upgradeDamage??3)}`);
 if(d.shield)text=text.replace(/获得 \d+ (?:点)?护盾/,`获得 ${d.shield+3} 护盾`);
 if(!d.damage&&!d.shield)text+=` 强化：费用 ${d.cost}→${Math.max(0,d.cost-1)}。`;
 return text;
};
export const needsTarget=(d:CardDef)=>!d.all&&!!(d.damage||d.mark||d.burn||d.special==='markburst'||d.special==='detonate');

export const PARTNER_IDS=Object.keys(PARTNERS) as Partner[];
export const inheritanceOptions=(partner:Partner)=>partner==='guilmon'?['ember','ward']:partner==='renamon'?['seal','flow']:['ward','flow'];
