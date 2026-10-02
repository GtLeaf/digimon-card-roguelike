import { CARDS } from '../src/game/data';
import type { CardDef } from '../src/game/types';

// 权重：以攻击指令/防御插件（1 费 = 7 点价值）为基准锚点。
const W = {
  damage: 1,
  shield: 1,
  draw: 3.5,
  energy: 7,
  devourGain: 4,
  charge: 4,
  burn: 2.5,
  mark: 2,
  weak: 2.5,
  vuln: 2.5,
  heal: 1.5,
  strength: 4.5,
  multiHit: 1.1, // 多段协同溢价
  all: 1.8, // 群攻按平均存活目标数折算
};
// 难以折算的 special 给固定分，按实战期望估值。
const SPECIAL_FLAT: Record<string, number> = {
  detonate: 5,
  markburst: 5,
  shieldhit: 5,
  copy: 6,
  purge: 4,
  lure: 2,
  devouraura: 6,
  sacrifice: -4.5,
};

function value(d: CardDef, upgraded: boolean, layers: number): number {
  let v = 0;
  const dmg = (d.damage ?? 0) + (upgraded && d.damage ? (d.upgradeDamage ?? 3) : 0);
  const hits = d.hits ?? 1;
  let targetValue = 0;
  if (dmg) targetValue += dmg * hits * (hits > 1 ? W.multiHit : 1);
  if (d.burn) targetValue += d.burn * W.burn;
  if (d.mark) targetValue += d.mark * W.mark;
  if (d.weak) targetValue += d.weak * W.weak;
  if (d.all) targetValue *= W.all;
  v += targetValue;
  if (d.shield) v += (d.shield + (upgraded ? 3 : 0)) * W.shield;
  if (d.heal) v += (d.heal + (upgraded && d.upgradeText ? 2 : 0)) * W.heal;
  if (d.drain) v += d.drain * W.heal;
  if (d.draw) v += (d.draw + (upgraded && d.upgradeText ? 1 : 0)) * W.draw;
  else if (upgraded && d.upgradeDraw) v += d.upgradeDraw * W.draw;
  if (d.energy) v += (d.energy + (upgraded && d.upgradeText && !d.upgradeDraw ? 1 : 0)) * W.energy;
  if (d.strength) v += (d.strength + (upgraded && d.upgradeText ? 1 : 0)) * W.strength;
  if (d.charge) v += d.charge * W.charge;
  if (d.devour) v += d.devour * W.devourGain;
  // 内建转化：按本牌伤害折算的期望层数（至多 2 层）。
  if (d.convert && dmg) v += Math.min(2, Math.floor((dmg * hits * (d.all ? W.all : 1)) / d.convert)) * W.devourGain;
  // 噬能/蓄能转化：按当前层数折算（资源消耗是花存款，不计成本）。
  if (d.devourShield) v += layers * d.devourShield * W.shield;
  if (d.devourWeak) v += layers * d.devourWeak * W.weak * (d.all ? W.all : 1);
  if (d.devourHeal) v += layers * d.devourHeal * W.heal;
  if (d.devourVuln) v += (layers >= 3 ? d.devourVuln : 1) * W.vuln + (upgraded ? W.vuln : 0);
  if (d.special === 'devour') v += layers * (d.devourPower ?? 4);
  if (d.special === 'cannon') v += Math.min(layers, 2) * (d.chargeMultiplier ?? 4); // 蓄能期望 2 层
  v += SPECIAL_FLAT[d.special ?? ''] ?? 0;
  return v;
}

function score(d: CardDef, upgraded: boolean): { base: number; full: number } {
  const cost = upgraded && !d.damage && !d.shield && !d.upgradeText ? Math.max(0, d.cost - 1) : d.cost;
  const effCost = cost === 0 ? 0.5 : cost; // 0 费牌按半费计（占一次出牌位）
  const layers = d.devourAll ? 6 : 3;
  return {
    base: value(d, upgraded, 0) - 7 * effCost,
    full: value(d, upgraded, layers) - 7 * effCost,
  };
}

const rows = Object.values(CARDS)
  .filter((d) => d.family !== 'status')
  .map((d) => {
    const b = score(d, false);
    const u = score(d, true);
    const limit = d.family === 'common' ? 2.5 : 4.5; // 专属牌允许解锁溢价
    const flag = b.full > limit || b.full < -1.5 ? '⚠️' : '';
    return { d, base: b, up: u, limit, flag };
  })
  .sort((a, b) => b.up.full - a.up.full);

const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

// ===== Combo 校验：产出牌 + 消费牌的整包价值必须跑赢白板基准（每费 7 分）=====
// 产出牌只计牌面直接收益（剥掉资源产生分），资源价值全部在消费端结算——避免双层计分。
const allCards = Object.values(CARDS).filter((d) => d.family !== 'status');

interface Producer {
  d: CardDef;
  layers: number;
  net: number; // 剥掉资源分后的净价值
}
const devourProducers: Producer[] = [],
  chargeProducers: Producer[] = [];
for (const d of allCards) {
  const dmg = (d.damage ?? 0) * (d.hits ?? 1);
  const dv =
    (d.devour ?? 0) + (d.convert && dmg ? Math.min(2, Math.floor(dmg / d.convert)) : 0);
  if (dv > 0)
    devourProducers.push({
      d,
      layers: dv,
      net: value(d, false, 0) - dv * W.devourGain,
    });
  if (d.charge)
    chargeProducers.push({ d, layers: d.charge, net: value(d, false, 0) - d.charge * W.charge });
}
// 选费效比最优的产出牌（净价值/费用），模拟真实玩家会带的那张。
const effCostOf = (d: CardDef) => (d.cost === 0 ? 0.5 : d.cost);
const bestProducer = (ps: Producer[]) =>
  ps.length
    ? ps.reduce((a, b) => (a.net / effCostOf(a.d) > b.net / effCostOf(b.d) ? a : b))
    : undefined;

interface ComboRow {
  spender: CardDef;
  resource: '噬能' | '蓄能';
  producerName: string;
  minLayers: number;
  minRatio: number;
  fullLayers: number;
  fullRatio: number;
  flag: string;
}
const comboRows: ComboRow[] = [];
const checkCombos = (
  spender: CardDef,
  resource: '噬能' | '蓄能',
  producer: Producer,
  minLayers: number,
  cap: number,
) => {
  const pkg = (layers: number) => {
    const prodCount = Math.ceil(layers / producer.layers);
    const cost = prodCount * effCostOf(producer.d) + effCostOf(spender);
    const v = prodCount * producer.net + (value(spender, false, layers) - 0);
    return v / (7 * cost); // 1.0 = 与白板等效
  };
  const minRatio = pkg(minLayers),
    fullRatio = pkg(cap);
  comboRows.push({
    spender,
    resource,
    producerName: producer.d.name,
    minLayers,
    minRatio,
    fullLayers: cap,
    fullRatio,
    // 最小 combo 必须 ≥ 白板，满载 combo 应给出 ≥15% 滚雪球奖励
    flag: minRatio < 1 || fullRatio < 1.15 ? '⚠️' : '',
  });
};
const devourBest = bestProducer(devourProducers),
  chargeBest = bestProducer(chargeProducers);
for (const d of allCards) {
  if (d.special === 'devour' && devourBest)
    checkCombos(d, '噬能', devourBest, 1, d.devourAll ? 6 : 3);
  else if ((d.devourShield || d.devourWeak || d.devourHeal || d.devourVuln) && devourBest)
    checkCombos(d, '噬能', devourBest, 1, 3);
  else if (d.special === 'cannon' && chargeBest)
    checkCombos(d, '蓄能', chargeBest, 1, 2);
}

const lines: string[] = [
  '# 卡牌强度审计（基准差值法：1 费 = 7 点价值）',
  '',
  '空载 = 无资源加成；满载 = 噬能 3 层（加农炮 6 层）/蓄能 2 层。专属牌允许 ≤+4.5 溢价，通用牌 ≤+2.5。',
  '',
  '| 卡牌 | 费用 | 阵营 | 空载 | 满载 | 强化满载 | 异常 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const { d, base, up, flag } of rows)
  lines.push(
    `| ${d.name} | ${d.cost} | ${d.family} | ${fmt(base.base)} | ${fmt(base.full)} | ${fmt(up.full)} | ${flag} |`,
  );
const outliers = rows.filter((r) => r.flag);
lines.push('', `## 异常卡（${outliers.length} 张）`, '');
for (const { d, base, up, flag } of outliers)
  lines.push(`- ${flag} **${d.name}**（${d.family}，${d.cost} 费）：空载 ${fmt(base.base)}，满载 ${fmt(base.full)}，强化满载 ${fmt(up.full)}——${d.text}`);

lines.push(
  '',
  '## Combo 校验（产出＋消费整包对白板）',
  '',
  '比率 = 整包价值 ÷（7 × 整包费用）。1.00 = 与白板等效；最小 combo 必须 ≥1.00，满载应 ≥1.15。产出牌只计牌面净收益，资源价值在消费端结算。',
  '',
  '| 消费牌 | 资源 | 产出牌（最优费效） | 最小 combo | 满载 combo | 异常 |',
  '| --- | --- | --- | --- | --- | --- |',
);
for (const c of comboRows)
  lines.push(
    `| ${c.spender.name} | ${c.resource} | ${c.producerName} | ${c.minLayers} 层 ${c.minRatio.toFixed(2)} | ${c.fullLayers} 层 ${c.fullRatio.toFixed(2)} | ${c.flag} |`,
  );

import { writeFileSync } from 'node:fs';
writeFileSync('scripts/card-balance.md', lines.join('\n') + '\n');
console.log(lines.slice(0, 8).join('\n'));
console.log(`\n共 ${rows.length} 张，异常 ${outliers.length} 张：`);
for (const { d, base, up } of outliers)
  console.log(`  ${d.name} (${d.family}) 空载 ${fmt(base.base)} 满载 ${fmt(base.full)} 强化 ${fmt(up.full)}`);
const comboFlags = comboRows.filter((c) => c.flag);
console.log(`\nCombo 校验 ${comboRows.length} 组，不达标 ${comboFlags.length} 组：`);
for (const c of comboFlags)
  console.log(
    `  ⚠️ ${c.spender.name} × ${c.producerName}：最小 ${c.minRatio.toFixed(2)} / 满载 ${c.fullRatio.toFixed(2)}`,
  );
console.log('\n报告已写入 scripts/card-balance.md');
