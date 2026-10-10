# 数码旅途 · 本地试玩版

当前版本：**v0.3.0**（2026-10-10）。当前规则与本轮改动见[项目说明](docs/项目说明.md)。

面向手机竖屏的数码兽卡牌冒险：五章50层探索、四位初始搭档、分支进化与跨局扫描收集。使用 React、TypeScript 和 Vite，进度保存在当前浏览器。

## 开始试玩

```sh
npm install
npm run dev
```

电脑访问 http://localhost:5177/ 。手机与电脑连接同一 Wi-Fi，访问启动时显示的 Network 地址；电脑需保持运行。不同浏览器、不同访问地址分别保存进度。

`npm run build` 生成 `dist/`，`npm run preview` 检查构建结果。不支持直接双击 HTML 运行。

## 离线游玩与安装

发布后，首次联网访问正式 HTTPS 游戏地址，等待首页或设置显示 **已可离线游玩**。随后可以断网、关闭页面再打开，继续旧局或开始新局；全部角色图片、动画和卡面会一并保存，无需提前浏览每个角色。

Android 可在设置中点击“安装数码旅途”（浏览器支持时显示），也可使用浏览器安装菜单。iPhone／iPad 使用 Safari 的“分享 → 添加到主屏幕”，作为 Web App 打开。安装到主屏幕与离线资源准备是独立步骤，须确认资源准备完成。

联网发现新版本后，会先下载再提示“保存并更新”；战斗期间延后更新，多游戏窗口打开时需先关闭其他窗口。下载失败仍可使用已缓存的旧版。

存档继续保存在当前浏览器。设置支持导出和导入 JSON：导入先预览、再确认替换，并保存导入前记录；战斗中不能导入。更换游戏地址或浏览器前，请通过导出／导入转移进度。可申请“保护本地进度”，但主动清除站点数据仍会删除资源和存档。

离线功能要求首次联网准备完成。手机访问普通局域网 HTTP 开发地址不提供离线安装；电脑可使用 localhost 的生产预览验证。日常开发服务器不注册离线缓存。

离线浏览器回归使用独立构建与测试存储，不修改试玩存档：

```sh
npx playwright install chromium
npm run test:offline
# 本机已有 Google Chrome 时也可使用：
PWA_BROWSER_CHANNEL=chrome npm run test:offline
```

运行结果与手机视口截图保存在 `docs/reports/offline/`。实现范围和验收边界见[离线运行改造方案](docs/design/离线运行改造方案.md)。

## 文档入口

项目文档集中在 [`docs/`](docs/README.md)，当前规则与历史提案分别维护。

| 内容 | 入口 |
| --- | --- |
| 当前玩法、进化赠牌规则、存档与实现边界 | [项目说明](docs/项目说明.md) |
| 卡牌平衡公式、审核命令与适用范围 | [平衡校准公式](docs/balance/卡牌平衡校准公式.md) |
| 设计方案、手机版交互、各轮开发记录 | [文档索引](docs/README.md) |
| 审核报告、原始数据与验收截图 | [报告目录](docs/reports/README.md) |
| 素材位置与来源 | [素材目录](docs/assets/素材目录.md) |

## 开发与验证

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`src/game/` 保存卡牌、敌人、进化配置、游戏引擎与存档逻辑；`src/components/`、`src/screens/` 保存界面；`tests/` 保存规则测试和独立浏览器验收页；`tools/`、`scripts/` 保存素材与平衡工具。审核产物统一写入 `docs/reports/`。

## 发布到 GitHub Pages

在仓库的 Settings → Pages 中，将 Build and deployment 的 Source 设为 **GitHub Actions**。推送到 `main` 后，`.github/workflows/deploy.yml` 会安装依赖、按 `/digimon-card-roguelike/` 路径构建，并发布 `dist/`。可在 Actions 页面查看部署结果；不要选择从 `main` 根目录直接发布，那里是需要构建的源码。

原始素材保留在 `assets/`，运行时素材位于 `public/`；第三方原始 README 和校验文件保留在素材包内。[来源声明](public/THIRD_PARTY_NOTICES.txt) 随正式构建提供。
