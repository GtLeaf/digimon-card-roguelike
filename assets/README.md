# 数码兽素材总目录

所有已下载的数码兽素材均保存在本游戏项目中。完整原始库含 **419 个 GIF 文件**，不是仅保留当前可玩角色；原始压缩包也一并保留。文件名沿用来源仓库，可能包含不同形态或变体。

## 从哪里找

| 内容 | 项目内位置 |
| --- | --- |
| 全部 419 个原始 GIF | [vendor/digimon-ds/original/](vendor/digimon-ds/original/) |
| 可搜索清单：名称、分类、路径、尺寸、帧数、时长、校验值 | [catalog.csv](vendor/digimon-ds/catalog.csv) |
| 原有程序用清单 | [inventory.json](vendor/digimon-ds/inventory.json) |
| 原始文件校验值 | [SHA256SUMS.txt](vendor/digimon-ds/SHA256SUMS.txt) |
| 下载时的完整原始 ZIP | [原始压缩包](vendor/digimon-ds/4b2273e163f023b9562cc69e4642f97a0684cb87.zip) |
| 最初整理的 12 个形态：立绘、动画帧、精灵图 | [characters/](characters/) |
| 游戏当前使用的立绘和横排动画 | [../public/sprites/](../public/sprites/) |
| 缺少像素动画时使用的静态角色立绘 | [../public/portraits/](../public/portraits/) |
| 通用卡生成插画原图与提示词 | [card-art/](card-art/) |
| 游戏使用的通用卡插画 | [../public/card-art/](../public/card-art/) |

## 原始 GIF 分类

| 目录 | 来源分类 | 文件数 |
| --- | --- | ---: |
| `in-training/` | 幼年期 | 23 |
| `rookie/` | 成长期 | 61 |
| `champion/` | 成熟期 | 109 |
| `ultimate/` | 完全体 | 105 |
| `mega/` | 究极体 | 100 |
| `unobtainable/` | 原档案特殊分类，非进化阶段 | 21 |
| 合计 | | **419** |

分类沿用原仓库；新增角色时仍需核对具体形态设定。

## 后续扩展

1. 在 `catalog.csv` 中按英文名称搜索，找到对应原始 GIF。例如 `Terriermon`、`Agumon`。
2. 将源文件名称加入 [build_game_assets.py](../tools/build_game_assets.py) 的 `names` 列表，运行脚本生成游戏立绘、动画图和 `src/game/sprites.json` 索引。脚本只需要项目内原始库，无需重新下载。
3. 在 `src/game/` 中配置角色、专属卡、进化路线或敌人。素材已收录不代表自动加入游戏角色池。

原始 GIF 保留不改，派生资源写入 `public/sprites/`。完整原始库放在 `assets/`，不会自动打包进网页首屏；游戏按需引用已接入的派生资源。迁移开发项目时，请连同 `assets/` 一起复制，不能只复制 `dist/`。

## 完整性记录

本次整理已确认：419 个 GIF 全部存在、与固定版本 ZIP 中对应文件逐字节一致、每一帧均能解码。素材目录没有项目外软链接，419 个原始 GIF 已在 Git 跟踪范围内，未被忽略。

源仓库：[E-M-B-E-R/digimon-world-ds-dawn-dusk-animated-sprites](https://github.com/E-M-B-E-R/digimon-world-ds-dawn-dusk-animated-sprites)，固定版本 `4b2273e163f023b9562cc69e4642f97a0684cb87`。原始说明保存在 [original/README.md](vendor/digimon-ds/original/README.md)；项目完整来源记录见 [THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt)。
