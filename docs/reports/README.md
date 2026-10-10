# 审核报告与原始数据

本目录同时保存文字报告、JSON 样本和验收截图。`round1`、`round2`、`guilmon` 及其配对样本是合并前的历史结果；三章、60张卡的模拟不能代表当前五章104张卡的胜率。移动目录没有重算或改写 JSON 与图片。

## 阅读顺序

| 范围 | 报告 | 配套资料 |
| --- | --- | --- |
| 第一轮单牌校准 | [card-balance-round1](card-balance-round1.md) | [逐项数据](card-balance-round1.json) |
| 第二轮单牌校准 | [card-balance-round2](card-balance-round2.md) | [单牌数据](card-balance-round2.json)、[组合数据](combinations-round2.json) |
| 第二轮前后对照 | [balance-round2-comparison](balance-round2-comparison.md) | [配对数据](balance-round2-comparison.json) |
| 基尔兽单牌校准 | [card-balance-guilmon](card-balance-guilmon.md) | [单牌数据](card-balance-guilmon.json)、[组合数据](combinations-guilmon.json) |
| 基尔兽六路径对照 | [guilmon-chain-comparison](guilmon-chain-comparison.md) | [配对数据](guilmon-chain-comparison.json)、[调整前](guilmon-chain-before.json)、[调整后](guilmon-chain-after.json) |
| 静态基准差值审核 | [card-balance](card-balance.md) | 已停用的历史口径，仅保留原始报告 |

旅途报告：[基线](journeys-baseline.md)、[第二轮](journeys-round2.md)、[独立基线](journeys-holdout-baseline.md)、[独立验证](journeys-holdout.md)、[冒烟](journeys-smoke.md)。每份报告链接同名 JSON；`cards-*.json` 保留当时卡牌快照，[历史档案](balance-veteran-profile.json) 保留来源与跨局资料。

历史截图：[复制](balance-copy-mobile.png)、[第二轮](balance-round2-mobile.png)、[基尔兽](guilmon-chain-mobile.png)。

## 当前 v3

属性第一阶段：[资料覆盖与页面验收](../design/属性资料与互动设计.md#第一阶段验证记录)、[手机首页截图](attributes-phase1-mobile.png)。仅接入资料展示；同一文档内的第二阶段卡牌与装置仍为设计候选。

离线功能：[实施与浏览器验收](offline/README.md)、[验证数据](offline/verification.json)、[320px设置](offline/settings-320.png)。检查完整缓存、断网冷启动、安全更新与存档导入；尚未做手机真机安装验收。

圣枪格拉墨与深渊龙枪调整后的[单牌报告](card-balance-lance-buffs-20261009.md)与[逐项数据](card-balance-lance-buffs-20261009.json)。下方 `v3-20261009` 为调整前快照。

唯一现行评分来自 `src/game/balance.ts`。本轮[单牌报告](card-balance-v3-20261009.md)、[逐项数据](card-balance-v3-20261009.json)、[组合与循环](combinations-v3-20261009.json)；解释见[公式](../balance/卡牌平衡校准公式.md)。旧报告保留追溯，不与v3混排。

## 生成方式

当前敌人 AI：[1088场固定牌组对照](enemy-ai-round1-20261009.md)、[威胁曲线与原始数据](enemy-ai-round1-20261009.json)、[手机装填窗口](enemy-ai-mobile.jpg)。实现说明见[敌人 AI 优化结果](../balance/敌人AI优化结果.md)。场景对照不代表玩家胜率。

在仓库根目录执行：

```sh
npm run audit:balance -- --label latest
npm run audit:combinations -- --label latest
npm run audit:journeys -- --label latest --count 1 --offset 0
npm run audit:enemies -- --label latest --count 8
```

当前默认输出到本目录；新版本结果应使用新标签并注明规则版本。单次旅途冒烟不能替代大规模平衡验证。

`audit:compare` 用于既有第二轮配对样本；`audit:guilmon` 依赖本地冻结基线和完全一致的策略。五章合并后策略与卡牌集合已变化，不能直接与旧样本生成有效对照，需要先重新冻结基线。旧入口 `scripts/cardAudit.ts` 现在只转发到唯一实际结算审核，不再生成独立静态评分。
