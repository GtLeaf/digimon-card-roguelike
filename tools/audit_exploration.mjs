import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Error(`${name} requires a value`);
  return args[index + 1];
};
const label = value('--label', 'latest');
const count = Number(value('--count', '5'));
const maps = Number(value('--maps', '1000'));
const baselinePath = value('--baseline', null);
if (!/^[a-z0-9-]+$/.test(label) || !Number.isInteger(count) || count < 1 || !Number.isInteger(maps) || maps < 1)
  throw Error('Invalid label, count or maps');
const allowed = new Set(['--label', '--count', '--maps', '--baseline']);
for (let i = 0; i < args.length; i += 2) if (!allowed.has(args[i])) throw Error(`Unknown argument: ${args[i]}`);

const output = join(root, 'docs/reports');
const jsonPath = join(output, `exploration-${label}.json`);
const markdownPath = join(output, `exploration-${label}.md`);
for (const path of [jsonPath, markdownPath]) {
  try { await access(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  throw Error(`Report exists; use a new --label: ${path}`);
}
const hash = (content) => createHash('sha256').update(content).digest('hex');
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const isCombat = (node) => ['battle', 'elite', 'boss'].includes(node.kind);
const isFreeRecovery = (event) => Boolean(event?.choices.some((choice) =>
  choice.effect.heal > 0 && !choice.effect.goldCost && !choice.effect.hpCost));
const seedFor = (index) => index * 7919 + 42;

async function gitHead(path) {
  try { return (await promisify(execFile)('git', ['-C', path, 'rev-parse', 'HEAD'])).stdout.trim(); }
  catch { return null; }
}
async function sourceHashes(path) {
  const files = [];
  const walk = async (relative) => {
    for (const entry of await readdir(join(path, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(next);
    }
  };
  await walk('src/game');
  files.push('tests/helpers/journeySimulation.ts');
  return Object.fromEntries(await Promise.all(files.sort().map(async (file) => [file, hash(await readFile(join(path, file)))])));
}

// 在临时 bundle 中记录行动；不改模拟策略、工程源码或实际存档。
async function loadModel(path, version, temp) {
  const outfile = join(temp, `${version}.mjs`);
  await build({
    stdin: {
      contents: "export { makeRun } from './src/game/engine'; export { EVENTS } from './src/game/events'; export { validateMap } from './src/game/map'; export { ROUTES, simulateJourney } from './tests/helpers/journeySimulation';",
      resolveDir: path,
    },
    bundle: true, platform: 'node', format: 'esm', outfile,
    define: { 'import.meta.env.BASE_URL': '"/"' },
    plugins: [{
      name: 'readonly-exploration-audit',
      setup(builder) {
        builder.onLoad({ filter: /[/\\]tests[/\\]helpers[/\\]journeySimulation\.ts$/ }, async ({ path: sourcePath }) => {
          let contents = await readFile(sourcePath, 'utf8');
          const applyAnchor = '  const apply = (action: Action, cached?: Save) => {';
          const recordAnchor = "    if (action.type === 'play' && before) {";
          const returnAnchor = '    battles,\n    meta: s.meta,';
          for (const anchor of [applyAnchor, recordAnchor, returnAnchor])
            if (contents.split(anchor).length !== 2) throw Error(`Simulation instrumentation anchor changed: ${anchor}`);
          contents = contents.replace(applyAnchor, `  const explorationAudit: Record<string, unknown>[] = [];
${applyAnchor}`);
          contents = contents.replace(recordAnchor, `    const enteredNode = action.type === 'node'
      ? r.nodes[r.row]?.find((node) => node.id === action.id)
      : undefined;
    explorationAudit.push({
      row: r.row,
      type: action.type,
      mode: action.type === 'camp' ? action.mode : undefined,
      choice: action.type === 'event' ? action.choice : undefined,
      screenBefore: r.screen,
      screenAfter: next.run!.screen,
      nodeKind: r.currentNode?.kind,
      nodeEnteredKind: enteredNode?.kind,
      nodeEnteredId: enteredNode?.id,
      eventId: enteredNode?.eventId ?? r.currentNode?.eventId,
      hpBefore: r.hp,
      hpAfter: next.run!.hp,
      maxHpBefore: r.maxHp,
      maxHpAfter: next.run!.maxHp,
    });
${recordAnchor}`);
          contents = contents.replace(returnAnchor, '    battles,\n    explorationAudit,\n    meta: s.meta,');
          return { contents, loader: 'ts' };
        });
      },
    }],
  });
  return import(pathToFileURL(outfile).href);
}

// 只枚举章内路径，避免把五章分支做无意义的笛卡尔积；不依赖新版 helper。
function chapterPaths(rows) {
  const paths = [];
  const walk = (path) => {
    if (path.length === rows.length) { paths.push(path); return; }
    for (const node of rows[path.length] ?? [])
      if (path[path.length - 1].next.includes(node.id)) walk([...path, node]);
  };
  for (const start of rows[0] ?? []) walk([start]);
  return paths;
}
function pathMetrics(path) {
  let streak = 0, peacefulStreakMax = 0, consecutiveElite = false;
  for (let i = 0; i < path.length; i++) {
    streak = isCombat(path[i]) ? 0 : streak + 1;
    peacefulStreakMax = Math.max(peacefulStreakMax, streak);
    if (i && path[i].kind === 'elite' && path[i - 1].kind === 'elite') consecutiveElite = true;
  }
  return {
    combats: path.filter(isCombat).length,
    shops: path.filter((node) => node.kind === 'shop').length,
    camps: path.filter((node) => node.kind === 'camp').length,
    peacefulStreakMax, consecutiveElite,
  };
}
function newExtrema() {
  return { paths: 0, combatMin: Infinity, combatMax: 0, shopsMax: 0, campsMin: Infinity, campsMax: 0, peacefulStreakMax: 0 };
}
function absorb(target, metrics) {
  target.paths++;
  target.combatMin = Math.min(target.combatMin, metrics.combats);
  target.combatMax = Math.max(target.combatMax, metrics.combats);
  target.shopsMax = Math.max(target.shopsMax, metrics.shops);
  target.campsMin = Math.min(target.campsMin, metrics.camps);
  target.campsMax = Math.max(target.campsMax, metrics.camps);
  target.peacefulStreakMax = Math.max(target.peacefulStreakMax, metrics.peacefulStreakMax);
}
function finiteExtrema(extrema) {
  return { ...extrema, combatMin: Number.isFinite(extrema.combatMin) ? extrema.combatMin : null, campsMin: Number.isFinite(extrema.campsMin) ? extrema.campsMin : null };
}

function auditMaps(model, version, tutorial) {
  const allPaths = newExtrema();
  const chapters = Array.from({ length: 5 }, (_, index) => ({ chapter: index + 1, ...newExtrema(), freeHealingMax: 0, eventRepeatRuns: 0 }));
  const result = {
    version, tutorial, maps, generated: 0, eventMissingNodes: 0, eventMissingRuns: 0,
    chapterFreeHealingMax: 0, researchForcedRuns: 0, researchForced: false,
    validation: { generationErrors: 0, graphFailedRuns: 0, budgetFailedRuns: 0, examples: [] },
  };
  for (let index = 0; index < maps; index++) {
    const seed = seedFor(index);
    let nodes;
    try { nodes = model.makeRun('guilmon', seed, tutorial).nodes; }
    catch (error) {
      result.validation.generationErrors++;
      if (result.validation.examples.length < 10) result.validation.examples.push({ seed, type: 'generation', problem: error.message });
      continue;
    }
    result.generated++;
    const graphProblems = model.validateMap(nodes);
    const budgetProblems = new Set();
    const missing = nodes.flat().filter((node) => node.kind === 'event' && !model.EVENTS[node.eventId]);
    result.eventMissingNodes += missing.length;
    if (missing.length) result.eventMissingRuns++;
    let researchForced = true;
    for (let chapterIndex = 0; chapterIndex < 5; chapterIndex++) {
      const rows = nodes.slice(chapterIndex * 10, chapterIndex * 10 + 10);
      const paths = chapterPaths(rows);
      const chapter = chapters[chapterIndex];
      if (!paths.length) budgetProblems.add(`chapter${chapterIndex + 1}:no-path`);
      const reachable = new Set(paths.flat().map((node) => node.id));
      if (rows.flat().some((node) => !reachable.has(node.id))) budgetProblems.add(`chapter${chapterIndex + 1}:unreachable-node`);
      const events = rows.flat().filter((node) => node.kind === 'event');
      // 同层等价入口仅算一个事件机会；检查玩家实际路径上是否重复经历。
      if (paths.some((path) => {
        const ids = path.filter((node) => node.kind === 'event').map((node) => node.eventId).filter(Boolean);
        return new Set(ids).size !== ids.length;
      })) chapter.eventRepeatRuns++;
      const healing = new Set(events.filter((node) => isFreeRecovery(model.EVENTS[node.eventId])).map((node) => node.eventId)).size;
      chapter.freeHealingMax = Math.max(chapter.freeHealingMax, healing);
      result.chapterFreeHealingMax = Math.max(result.chapterFreeHealingMax, healing);
      if (chapterIndex === 1) researchForced = paths.length > 0 && paths.every((path) => path.some((node) => node.eventId === 'research'));
      for (const path of paths) {
        const metrics = pathMetrics(path);
        absorb(chapter, metrics); absorb(allPaths, metrics);
        if (metrics.combats < 4 || metrics.combats > 6) budgetProblems.add(`chapter${chapterIndex + 1}:combats-outside-4-6`);
        if (metrics.shops > 1) budgetProblems.add(`chapter${chapterIndex + 1}:shops-over-1`);
        if (metrics.camps < 1 || metrics.camps > 2) budgetProblems.add(`chapter${chapterIndex + 1}:camps-outside-1-2`);
        if (metrics.peacefulStreakMax > 3) budgetProblems.add(`chapter${chapterIndex + 1}:peaceful-streak-over-3`);
        if (metrics.consecutiveElite) budgetProblems.add(`chapter${chapterIndex + 1}:consecutive-elite`);
      }
    }
    if (researchForced) result.researchForcedRuns++;
    if (graphProblems.length) result.validation.graphFailedRuns++;
    if (budgetProblems.size) result.validation.budgetFailedRuns++;
    if ((graphProblems.length || budgetProblems.size) && result.validation.examples.length < 10)
      result.validation.examples.push({ seed, type: 'validation', graphProblems, budgetProblems: [...budgetProblems] });
  }
  result.researchForced = result.generated === maps && result.researchForcedRuns === maps;
  result.allPaths = finiteExtrema(allPaths);
  result.chapters = chapters.map(finiteExtrema);
  return result;
}

function journeyMetrics(result) {
  const actions = result.explorationAudit;
  const nodes = actions.filter((action) => action.type === 'node');
  const outside = actions.filter((action) => action.screenBefore !== 'battle' && action.hpAfter > action.hpBefore);
  const bosses = nodes.filter((action) => action.nodeEnteredKind === 'boss').map((action) => ({
    row: action.row, hp: action.hpAfter, maxHp: action.maxHpAfter,
    full: action.hpAfter === action.maxHpAfter, ratio: action.hpAfter / action.maxHpAfter,
  }));
  const outsideActualHealByType = {};
  for (const action of outside) outsideActualHealByType[action.type] = (outsideActualHealByType[action.type] ?? 0) + action.hpAfter - action.hpBefore;
  return {
    enteredNodeKinds: nodes.reduce((out, action) => { out[action.nodeEnteredKind] = (out[action.nodeEnteredKind] ?? 0) + 1; return out; }, {}),
    enteredBattles: nodes.filter((action) => ['battle', 'elite', 'boss'].includes(action.nodeEnteredKind)).length,
    completedBattles: result.battles.length,
    campHeal: actions.filter((action) => action.type === 'camp' && action.mode === 'heal').length,
    campUpgrade: actions.filter((action) => action.type === 'camp' && action.mode === 'upgrade').length,
    campEvolution: actions.filter((action) => action.type === 'campEvolution').length,
    restCount: actions.filter((action) => action.type === 'rest').length,
    outsideActualHeal: outside.reduce((sum, action) => sum + action.hpAfter - action.hpBefore, 0),
    outsideActualHealByType,
    preBoss: bosses,
  };
}
function summarizeJourneys(rows, version, profile, branch = null) {
  const group = rows.filter((row) => row.version === version && row.profile === profile && (!branch || row.branch === branch));
  const bosses = group.flatMap((row) => row.exploration.preBoss);
  return {
    version, profile, branch: branch ?? 'all', n: group.length,
    wins: group.filter((row) => row.won).length,
    targetReached: group.filter((row) => row.reached).length,
    targetWins: group.filter((row) => row.targetWon).length,
    diagnosticRuns: group.filter((row) => row.diagnostics.length).length,
    diagnostics: group.flatMap((row) => row.diagnostics),
    meanBattles: mean(group.map((row) => row.exploration.enteredBattles)),
    meanCompletedBattles: mean(group.map((row) => row.exploration.completedBattles)),
    campHeal: group.reduce((sum, row) => sum + row.exploration.campHeal, 0),
    campUpgrade: group.reduce((sum, row) => sum + row.exploration.campUpgrade, 0),
    campEvolution: group.reduce((sum, row) => sum + row.exploration.campEvolution, 0),
    restCount: group.reduce((sum, row) => sum + row.exploration.restCount, 0),
    outsideActualHeal: group.reduce((sum, row) => sum + row.exploration.outsideActualHeal, 0),
    meanOutsideActualHeal: mean(group.map((row) => row.exploration.outsideActualHeal)),
    preBossEntrances: bosses.length,
    preBossFullHpCount: bosses.filter((boss) => boss.full).length,
    preBossFullHpRatio: bosses.length ? bosses.filter((boss) => boss.full).length / bosses.length : null,
    meanPreBossHpRatio: mean(bosses.map((boss) => boss.ratio)),
  };
}

const temp = await mkdtemp(join(tmpdir(), 'digimon-exploration-audit-'));
try {
  const profileFile = 'docs/reports/balance-veteran-profile.json';
  const profileBytes = await readFile(join(root, profileFile));
  const veteran = JSON.parse(profileBytes).meta;
  if (!veteran) throw Error('Veteran profile has no meta');
  const sourceRoots = baselinePath ? [['before', resolve(root, baselinePath)], ['after', root]] : [['after', root]];
  if (baselinePath) {
    const baselineProfile = await readFile(join(sourceRoots[0][1], profileFile));
    if (hash(baselineProfile) !== hash(profileBytes)) throw Error('Baseline and current veteran profiles differ; comparison requires one identical profile');
  }
  const models = [];
  const sources = {};
  for (const [version, path] of sourceRoots) {
    models.push([version, await loadModel(path, version, temp)]);
    sources[version] = { path, gitHead: await gitHead(path), hashes: await sourceHashes(path) };
  }
  const mapSummaries = [];
  const journeys = [];
  for (const [version, model] of models) {
    for (const tutorial of [false, true]) {
      mapSummaries.push(auditMaps(model, version, tutorial));
      console.log(`${version}: ${maps} maps, tutorial=${tutorial}`);
    }
    for (const profile of ['new', 'veteran']) for (const branch of model.ROUTES) {
      for (let index = 0; index < count; index++) {
        const result = model.simulateJourney(branch, seedFor(index), 'survival', profile === 'veteran' ? veteran : undefined);
        delete result.meta;
        journeys.push({ version, ...result, exploration: journeyMetrics(result) });
      }
      console.log(`${version}: ${profile}/${branch}, ${count} journeys`);
    }
  }
  const journeySummaries = [];
  for (const [version, model] of models) for (const profile of ['new', 'veteran']) {
    journeySummaries.push(summarizeJourneys(journeys, version, profile));
    for (const branch of model.ROUTES) journeySummaries.push(summarizeJourneys(journeys, version, profile, branch));
  }
  const report = {
    label, count, maps, createdAt: new Date().toISOString(), sources,
    veteranProfile: { path: profileFile, sha256: hash(profileBytes) },
    method: [
      '每版本分别生成教学与非教学地图各 maps 张，枚举五章各自所有可达路径；路径数不是整局路线的笛卡尔积。',
      '固定七条路线、生存策略、新档案与同一历史档案，每组 count 个种子；种子公式 i*7919+42。',
      '只在临时打包的模拟 apply 中记录已执行行动，未修改策略、实际存档或模拟规则。',
      '战外实际回复统计行动前处于非战斗页面的生命正增长，不包括战斗内磁盘、卡牌治疗或战斗胜利回复；按生命上限后的实际增长计。',
      '首领入场生命读取选择首领节点后的生命；满血比例以实际进入的首领次数为分母，死亡后未到达的首领不计入。',
      '地图预算采用每章4～6战、最多1商店、1～2营地、连续非战斗最多3层；旧版不满足预算是对照证据，不表示旧图生成失败。',
      '同种子地图结构和随机调用会随变更而变化；这是固定策略的旅途样本比较，不能视为逐战配对或玩家胜率，不能单独据此调整难度。',
      '冻结基线目录没有 Git 元信息时 gitHead 为 null，以路径与全部游戏源码 SHA-256 标识快照。',
    ],
    mapSummaries, journeySummaries, journeys,
  };
  const mapLines = mapSummaries.map((summary) => {
    const metric = summary.allPaths;
    return `| ${summary.version} | ${summary.tutorial ? '教学' : '非教学'} | ${summary.generated}/${summary.maps} | ${metric.combatMin}～${metric.combatMax} | ${metric.shopsMax} | ${metric.campsMin}～${metric.campsMax} | ${metric.peacefulStreakMax} | ${summary.eventMissingRuns}/${summary.eventMissingNodes} | ${summary.chapterFreeHealingMax} | ${summary.researchForcedRuns}/${summary.maps} | ${summary.validation.generationErrors}/${summary.validation.graphFailedRuns}/${summary.validation.budgetFailedRuns} |`;
  });
  const journeyLines = journeySummaries.map((summary) => `| ${summary.version} | ${summary.profile} | ${summary.branch} | ${summary.wins}/${summary.n} | ${summary.targetReached}/${summary.n} | ${summary.targetWins}/${summary.n} | ${summary.meanBattles?.toFixed(2) ?? '—'} | ${summary.campHeal}/${summary.campUpgrade} | ${summary.restCount} | ${summary.meanOutsideActualHeal?.toFixed(2) ?? '—'} | ${summary.preBossFullHpCount}/${summary.preBossEntrances}（${summary.preBossFullHpRatio === null ? '—' : (summary.preBossFullHpRatio * 100).toFixed(1) + '%'}） | ${summary.diagnosticRuns} |`);
  const markdown = `# 探索节奏审核：${label}\n\n${report.method.map((line) => '- ' + line).join('\n')}\n\n## 地图结构\n\n事件缺失列为“涉及地图数/节点数”；校验列依次为“生成失败/图连通失败/新预算不符”。研究必经仅检查第二章。\n\n| 版本 | 教学 | 生成 | 每路径战斗 | 商店最多 | 营地 | 连续非战斗 | 事件缺失 | 章内免费回血事件最多 | 研究必经地图 | 校验 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${mapLines.join('\n')}\n\n## 固定策略旅途\n\n共${journeys.length}局。每组${count}个种子；camp计数为已执行的营地动作，战斗次数含未结束的死亡战。\n\n| 版本 | 档案 | 路线 | 通关 | 目标到达 | 目标通关 | 平均战斗 | 营地治疗/强化 | 旧进化休整 | 平均战外实际回复 | 首领满血入场 | 异常局 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${journeyLines.join('\n')}\n\n源快照路径、Git HEAD（可用时）、源码哈希、章内统计、诊断、目标未达原因及全部行动记录见[原始数据](./exploration-${label}.json)。\n`;
  await mkdir(output, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(markdownPath, markdown, { flag: 'wx' });
  console.log(JSON.stringify({ reports: [jsonPath, markdownPath], mapSummaries, journeySummaries: journeySummaries.filter((summary) => summary.branch === 'all') }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
