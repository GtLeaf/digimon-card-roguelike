import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const label = arg('--label', 'round1-20261010');
const baseline = arg('--baseline', null);
if (!baseline || baseline.startsWith('--')) {
  console.error('必须通过 --baseline 指定调整前冻结的模型，用于相同策略与种子的前后数值对照。\n用法：node tools/audit_boss2.mjs --baseline <model.mjs> [--baseline-hashes <source-hashes.json>] [--label <report-label>]\n未指定 --baseline-hashes 时读取模型同目录的 source-hashes.json。');
  process.exit(1);
}
const baselinePath = resolve(root, baseline);
const baselineHashesPath = resolve(root, arg('--baseline-hashes', join(dirname(baselinePath), 'source-hashes.json')));
const count = Number(arg('--count', '10'));
const journeyCount = Number(arg('--journey-count', '5'));
if (!/^[a-z0-9-]+$/.test(label) || !Number.isInteger(count) || count < 1 || !Number.isInteger(journeyCount) || journeyCount < 1) throw Error('Invalid arguments');
const sha = (content) => createHash('sha256').update(content).digest('hex');
const mean = (xs) => xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : null;
const sourcePaths = [
  'src/game/battle.ts', 'src/game/engine.ts', 'src/game/data.ts', 'src/game/cardUpgrades.ts',
  'src/game/evolution.ts', 'src/game/enemyRules.ts', 'src/game/hooks.ts', 'src/game/cardSkills.ts',
  'src/game/world.ts', 'src/game/map.ts', 'src/game/events.ts', 'src/game/encounters.ts',
  'tests/helpers/journeySimulation.ts', 'tools/audit_boss2.mjs',
];
const temp = await mkdtemp(join(tmpdir(), 'digimon-boss2-audit-'));
const out = join(root, 'docs/reports');
const reportJson = join(out, `boss2-${label}.json`);
const reportMarkdown = join(out, `boss2-${label}.md`);
try {
  // 先占用报告名；不得覆盖之前的校准记录。
  await mkdir(out, { recursive: true });
  for (const file of [reportJson, reportMarkdown]) {
    try { await readFile(file); throw Error(`Report already exists: ${file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, sha(await readFile(join(root, file)))])));
  const baselineSourceHashes = JSON.parse(await readFile(baselineHashesPath, 'utf8'));
  if (sourceHashes['tests/helpers/journeySimulation.ts'] !== baselineSourceHashes['tests/helpers/journeySimulation.ts']) throw Error('固定策略源码已变化，不能生成同策略对照');
  const currentBundle = join(temp, 'current.mjs');
  await build({ stdin: { contents: "export * from './src/game/engine'; export * from './src/game/battle'; export * from './src/game/data'; export * from './src/game/evolution'; export { skillUnlocked } from './src/game/cardSkills'; export { ENCOUNTERS } from './src/game/encounters'; export { combatCandidates, simulateJourney, ROUTES } from './tests/helpers/journeySimulation';", resolveDir: root }, bundle: true, platform: 'node', format: 'esm', outfile: currentBundle, define: { 'import.meta.env.BASE_URL': '"/"' } });
  const before = await import(pathToFileURL(baselinePath).href);
  const after = await import(pathToFileURL(currentBundle).href);
  for (const field of ['CARDS', 'EVOLUTIONS', 'ENEMIES', 'RELICS', 'ENCOUNTERS', 'ROUTES']) deepStrictEqual(after[field], before[field], `${field}存在Boss之外的数据差异`);
  for (let i = 0; i < count; i++) for (const tutorial of [true, false]) deepStrictEqual(after.makeRun('guilmon', i * 7919 + 42, tutorial).nodes, before.makeRun('guilmon', i * 7919 + 42, tutorial).nodes, '前后地图不一致');
  const models = [['before', before], ['after', after]];
  const mature = ['growlmon', 'kyubimon', 'galgomon', 'blackgalgomon', 'sorcerymon', 'devimon'];
  const bossNode = { id: 'boss2-fixed', row: 19, lane: 0, kind: 'boss', label: '别西卜兽', enemies: ['beelzebumon'], next: [] };
  const history = (model, form) => [...(model.EVOLUTIONS[form].parents.length ? history(model, model.EVOLUTIONS[form].parents[0]) : []), form];
  function setup(model, form, seed, protectedHp = false) {
    const d = model.EVOLUTIONS[form], s = model.emptySave(), r = model.makeRun(d.partner, seed, false);
    s.run = r;
    Object.assign(r, { form, stage: d.stage, branch: d.branch ?? null, formHistory: history(model, form), row: 19, currentNode: structuredClone(bossNode), hp: protectedHp ? 10000 : 100, maxHp: protectedHp ? 10000 : 100, blessing: 'guard', training: 'defense', inherit: 'flow' });
    const ids = [...new Set(r.formHistory.flatMap(f => model.EVOLUTIONS[f].cards))];
    r.deck = ['guard', 'guard', 'guard', 'guard', 'strike', 'strike', ...ids].map((id, i) => ({ id, uid: `deck-${i}`, upgraded: i % 3 === 0 }));
    if (!r.deck.every(c => model.skillUnlocked(r, model.CARDS[c.id]))) throw Error(`非法固定牌组：${form}`);
    model.beginBattle(r, bossNode);
    return s;
  }
  function cannonWindow(model, r) {
    const enemy = r.battle.enemies.find(e => e.id === 'beelzebumon' && e.hp > 0);
    if (!enemy) return null;
    const planned = model.intent(r, enemy);
    if (!planned.name.includes('加农')) return null;
    const neutralEnemy = { ...enemy, stagger: 0 };
    const neutralRun = { ...r, battle: { ...r.battle, enemies: r.battle.enemies.map(e => e.uid === enemy.uid ? neutralEnemy : e) } };
    const unsuppressed = model.intent(neutralRun, neutralEnemy);
    return { turn: r.battle.turn, directHpDamage: enemy.stagger, shield: r.battle.block, preview: planned, unsuppressedDamage: unsuppressed.damage, suppressed: planned.damage < unsuppressed.damage };
  }
  const pressure = [];
  for (const [version, model] of models) {
    const s = setup(model, 'guilmon', 42, true), turns = [];
    for (let turn = 1; turn <= 18; turn++) {
      const r = s.run;
      r.battle.block = 0;
      const hp = r.hp, preview = model.intent(r, r.battle.enemies[0]);
      model.endTurn(r, s.meta);
      turns.push({ turn, preview, previewTotal: preview.damage * preview.hits, actualDamage: hp - r.hp });
    }
    const mismatches = turns.filter(t => t.previewTotal !== t.actualDamage);
    if (mismatches.length) throw Error(`${version}无防御曲线预告与实伤不一致`);
    pressure.push({ version, totalDamage: turns.reduce((n, t) => n + t.actualDamage, 0), firstThreeDamage: turns.slice(0, 3).map(t => t.actualDamage), mismatches: mismatches.length, turns });
  }
  const suppressionBoundary = [];
  for (const [version, model] of models) for (const directHpDamage of [17, 18]) {
    const s = setup(model, 'guilmon', 42, true);
    for (let turn = 1; turn < 3; turn++) {
      s.run.battle.block = 0;
      model.endTurn(s.run, s.meta);
    }
    s.run.battle.block = 0;
    s.run.battle.enemies[0].stagger = directHpDamage;
    const hp = s.run.hp, window = cannonWindow(model, s.run);
    model.endTurn(s.run, s.meta);
    const actualDamage = hp - s.run.hp;
    if (!window || window.preview.damage * window.preview.hits !== actualDamage) throw Error(`${version}压制边界预告与实伤不一致`);
    suppressionBoundary.push({ version, directHpDamage, ...window, actualDamage });
  }
  const fixedBattles = [];
  for (const [version, model] of models) for (const form of mature) for (let i = 0; i < count; i++) {
    const seed = i * 7919 + 42;
    let s = setup(model, form, seed), plays = 0, truncated = false;
    const startingDeck = structuredClone(s.run.deck), startHp = s.run.hp, cannonWindows = [];
    for (let turn = 0; turn < 24 && s.run.screen === 'battle'; turn++) {
      let turnPlays = 0;
      while (s.run.screen === 'battle' && turnPlays < 60) {
        const best = model.combatCandidates(s, 'survival', s.run.branch ?? 'duke', [])[0];
        if (!best || best.score <= 0) break;
        s = best.next;
        plays++; turnPlays++;
      }
      if (turnPlays === 60) { truncated = true; break; }
      if (s.run.screen === 'battle') {
        const window = cannonWindow(model, s.run);
        if (window) cannonWindows.push(window);
        s = model.reduceGame(s, { type: 'endTurn' });
      }
    }
    fixedBattles.push({ version, form, seed, startingDeck, won: s.run.screen === 'reward', screen: s.run.screen, hpLoss: startHp - s.run.hp, turns: s.run.battle.turn, plays, cannonWindows, suppressedCannons: cannonWindows.filter(w => w.suppressed).length, unsuppressedCannons: cannonWindows.filter(w => !w.suppressed).length, truncated: truncated || s.run.screen === 'battle' });
  }
  const fixedSummaries = [];
  for (const [version] of models) for (const form of mature) {
    const rows = fixedBattles.filter(r => r.version === version && r.form === form);
    fixedSummaries.push({ version, form, n: rows.length, wins: rows.filter(r => r.won).length, meanHpLoss: mean(rows.map(r => r.hpLoss)), meanTurns: mean(rows.map(r => r.turns)), truncations: rows.filter(r => r.truncated).length, cannonActions: rows.reduce((n, r) => n + r.cannonWindows.length, 0), suppressedCannons: rows.reduce((n, r) => n + r.suppressedCannons, 0), unsuppressedCannons: rows.reduce((n, r) => n + r.unsuppressedCannons, 0) });
  }

  // 观察器只读取正式apply提交边界，不改变候选动作、评分、随机调用或策略预算。
  const helperPath = join(root, 'tests/helpers/journeySimulation.ts');
  const helperSource = await readFile(helperPath, 'utf8');
  async function makeObserver(modelPath, version) {
    let source = helperSource;
    for (const module of ['data', 'engine', 'evolution']) source = source.replace(`'../../src/game/${module}'`, JSON.stringify(modelPath));
    const initialMarker = '  const diagnostics: string[] = [];';
    const applyMarker = '    const a = s.run!;';
    const returnMarker = '    seed,\n    strategy,';
    if (!source.includes(initialMarker) || !source.includes(applyMarker) || !source.includes(returnMarker)) throw Error('旅途观察器标记不匹配');
    source = source.replace(initialMarker, `${initialMarker}\n  const boss2Observations: unknown[] = [];\n  let boss2Current: null | { row: number; form: string; hpStart: number; maxHp: number; potionsStart: number; potionUses: number; deck: unknown[]; relics: string[]; cannonWindows: unknown[] } = null;`);
    source = source.replace(applyMarker, `${applyMarker}
    if (action.type === 'node' && a.currentNode?.kind === 'boss' && a.battle?.enemies.some(e => e.id === 'beelzebumon')) boss2Current = { row: a.row, form: a.form, hpStart: a.hp, maxHp: a.maxHp, potionsStart: a.potions, potionUses: 0, deck: structuredClone(a.deck), relics: [...a.relics], cannonWindows: [] };
    if (boss2Current && before) {
      if (action.type === 'potion') boss2Current.potionUses++;
      if (action.type === 'endTurn') {
        const enemy = before.enemies.find(e => e.id === 'beelzebumon' && e.hp > 0);
        if (enemy) {
          const planned = intent(r, enemy);
          if (planned.name.includes('加农')) {
            const neutralEnemy = { ...enemy, stagger: 0 };
            const neutralRun = { ...r, battle: { ...before, enemies: before.enemies.map(e => e.uid === enemy.uid ? neutralEnemy : e) } };
            const unsuppressed = intent(neutralRun, neutralEnemy);
            boss2Current.cannonWindows.push({ turn: before.turn, directHpDamage: enemy.stagger, shield: before.block, preview: planned, unsuppressedDamage: unsuppressed.damage, suppressed: planned.damage < unsuppressed.damage });
          }
        }
      }
      if (a.screen !== 'battle') {
        boss2Observations.push({ ...boss2Current, hpEnd: a.hp, hpLoss: boss2Current.hpStart - a.hp, turns: a.battle!.turn, won: a.screen === 'reward', screen: a.screen, potionsEnd: a.potions });
        boss2Current = null;
      }
    }`);
    source = source.replace(returnMarker, `    boss2Observations,\n${returnMarker}`);
    const observerPath = join(temp, `observer-${version}.mjs`);
    await build({ stdin: { contents: source, loader: 'ts', resolveDir: join(root, 'tests/helpers') }, bundle: true, platform: 'node', format: 'esm', outfile: observerPath, define: { 'import.meta.env.BASE_URL': '"/"' } });
    return { module: await import(pathToFileURL(observerPath).href), instrumentedSourceHash: sha(source), observerHash: sha(await readFile(observerPath)) };
  }
  const observers = {
    before: await makeObserver(baselinePath, 'before'),
    after: await makeObserver(currentBundle, 'after'),
  };
  const veteranPath = join(root, 'docs/reports/balance-veteran-profile.json');
  const veteran = JSON.parse(await readFile(veteranPath, 'utf8')).meta;
  const journeys = [];
  for (const [version, model] of models) for (const profile of ['new', 'veteran']) for (const branch of model.ROUTES) for (let i = 0; i < journeyCount; i++) {
    const seed = i * 7919 + 42;
    const profileMeta = profile === 'veteran' ? veteran : undefined;
    const original = model.simulateJourney(branch, seed, 'survival', profileMeta);
    const observed = observers[version].module.simulateJourney(branch, seed, 'survival', profileMeta);
    const { boss2Observations, ...unchanged } = observed;
    deepStrictEqual(unchanged, original, `${version}/${profile}/${branch}/${seed}观察器改变旅途行为`);
    journeys.push({ version, profile, branch, seed, won: original.won, reached: original.reached, row: original.row, hp: original.hp, steps: original.steps, diagnostics: original.diagnostics, death: original.death, targetMissing: original.targetMissing, deckSize: original.deck.length, evolutionCardsGranted: original.evolutionCardsGranted, purchases: original.purchases, removals: original.removals, boss2: boss2Observations[0] ?? null });
  }
  const journeySummaries = [];
  for (const [version] of models) for (const profile of ['new', 'veteran']) for (const branch of before.ROUTES) {
    const rows = journeys.filter(r => r.version === version && r.profile === profile && r.branch === branch), boss = rows.flatMap(r => r.boss2 ? [r.boss2] : []), cannons = boss.flatMap(r => r.cannonWindows);
    journeySummaries.push({ version, profile, branch, n: rows.length, journeyWins: rows.filter(r => r.won).length, targetReached: rows.filter(r => r.reached).length, diagnostics: rows.filter(r => r.diagnostics.length).length, boss2Entered: boss.length, boss2Wins: boss.filter(r => r.won).length, boss2Deaths: boss.filter(r => !r.won).length, meanBoss2HpLoss: mean(boss.map(r => r.hpLoss)), meanBoss2Turns: mean(boss.map(r => r.turns)), meanBoss2Potions: mean(boss.map(r => r.potionUses)), cannonActions: cannons.length, suppressedCannons: cannons.filter(w => w.suppressed).length, unsuppressedCannons: cannons.filter(w => !w.suppressed).length });
  }
  // 运行期间变更代码会破坏“当前版本”的可复现性；失败时不保存报告。
  for (const [file, hash] of Object.entries(sourceHashes)) if (sha(await readFile(join(root, file))) !== hash) throw Error(`审核期间源码变化：${file}`);
  const method = [
    '前后采用同一合法卡牌定义、地图、成长数据、策略源码和种子；固定场景沿用既有敌人审核牌组与survival评分，不调整权重。',
    `固定场景：6种成熟期形态，各${count}个种子、前后${fixedBattles.length}场；100初始生命，守护祝福、防御训练、flow继承，约三分之一牌强化，无装置，不使用支援、磁盘或爆发；60出牌/回合、24回合诊断上限。`,
    '18回合威胁曲线：不出牌、不防御、不压制，临时提高生命仅记录完整循环；逐回合比较伤害预告与实际损血。',
    `完整旅途：7路线，新/历史档案各${journeyCount}种子，前后共${journeys.length}局；survival策略，主动获取最多16张、商店购卡最多2次、删卡最多2次，进化赠牌另计。`,
    '旅途观察器只读记录正式动作提交；每局与冻结model原simulateJourney的所有返回字段一致，证明没有改策略或随机行为。',
    '净损血为入战生命减出战生命，包含治疗磁盘、吸血、卡牌治疗、战斗胜利回复和自损；负数表示净回复，不等于敌方总伤害。',
    '压制分母仅为存活Boss实际进入敌方加农行动的窗口；击杀前结束的窗口不计为压制失败。未压制加农单列，旧版本不支持压制。',
    '该样本描述固定策略，不代表玩家胜率；同初始种子但Boss行动不同可能使卡牌策略与后续随机调用分叉，整局变化不能全部归因于某一个Boss数值。',
  ];
  const summary = { fixedBattles: fixedBattles.length, fixedTruncations: fixedBattles.filter(r => r.truncated).length, journeys: journeys.length, journeyDiagnostics: journeys.filter(r => r.diagnostics.length).length, pressureMismatches: pressure.reduce((n, r) => n + r.mismatches, 0), observedJourneysMatched: journeys.length };
  const report = { label, createdAt: new Date().toISOString(), baselineBundle: baselinePath, baselineBundleHash: sha(await readFile(baselinePath)), baselineSourceHashes, currentBundleHash: sha(await readFile(currentBundle)), sourceHashes, strategyHash: sourceHashes['tests/helpers/journeySimulation.ts'], veteranProfileHash: sha(await readFile(veteranPath)), observerHashes: Object.fromEntries(Object.entries(observers).map(([version, observer]) => [version, { instrumentedSourceHash: observer.instrumentedSourceHash, observerHash: observer.observerHash }])), policies: { count, journeyCount, seedFormula: 'i*7919+42', fixedStrategy: 'survival', journeyStrategy: 'survival' }, method, summary, pressure, suppressionBoundary, fixedSummaries, fixedBattles, journeySummaries, journeys };
  const fixedLines = fixedSummaries.map(r => `| ${r.version} | ${r.form} | ${r.wins}/${r.n} | ${r.meanHpLoss.toFixed(2)} | ${r.meanTurns.toFixed(2)} | ${r.suppressedCannons}/${r.cannonActions} | ${r.truncations} |`);
  const journeyLines = journeySummaries.map(r => `| ${r.version} | ${r.profile} | ${r.branch} | ${r.boss2Wins}/${r.boss2Entered} | ${r.meanBoss2HpLoss?.toFixed(2) ?? '—'} | ${r.meanBoss2Turns?.toFixed(2) ?? '—'} | ${r.meanBoss2Potions?.toFixed(2) ?? '—'} | ${r.suppressedCannons}/${r.cannonActions} | ${r.journeyWins}/${r.n} | ${r.diagnostics} |`);
  const curveLines = pressure[0].turns.map((turn, i) => `| ${turn.turn} | ${turn.actualDamage} | ${pressure[1].turns[i].actualDamage} |`);
  const markdown = `# 第二章首领第一轮校准：${label}\n\n${method.map(text => '- ' + text).join('\n')}\n\n## 压制边界\n\n人工固定直接生命伤害计数17与18时，调整后的第三拍加农预告/实伤分别为${suppressionBoundary.find(r => r.version === 'after' && r.directHpDamage === 17).actualDamage}与${suppressionBoundary.find(r => r.version === 'after' && r.directHpDamage === 18).actualDamage}，前后均一致。该场景仅验证阈值结算，实际策略触发率见下表。\n\n## 固定成熟期牌组\n\n| 版本 | 形态 | 胜出 | 平均净损血 | 平均回合 | 压制/加农行动 | 超限 |\n| --- | --- | --- | --- | --- | --- | --- |\n${fixedLines.join('\n')}\n\n## 完整旅途\n\n| 版本 | 档案 | 路线 | 第二章首领胜出/入战 | 平均净损血 | 平均回合 | 平均磁盘 | 压制/加农行动 | 整局胜出 | 异常 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${journeyLines.join('\n')}\n\n## 18回合无防御威胁曲线\n\n| 回合 | 调整前损血 | 调整后损血 |\n| --- | --- | --- |\n${curveLines.join('\n')}\n\n18回合合计：前${pressure[0].totalDamage}，后${pressure[1].totalDamage}；预告与实伤不一致${summary.pressureMismatches}处。固定场景超限${summary.fixedTruncations}场，旅途异常${summary.journeyDiagnostics}局，${summary.observedJourneysMatched}局观察器与原策略结果完全一致。完整牌组、种子、压制窗口、旅途死亡和源码哈希见[原始记录](boss2-${label}.json)。\n`;
  await writeFile(reportJson, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(reportMarkdown, markdown, { flag: 'wx' });
  console.log(JSON.stringify({ summary, fixedSummaries, journeySummaries, pressure: pressure.map(({ turns, ...rest }) => rest), reportJson, reportMarkdown }));
} finally { await rm(temp, { recursive: true, force: true }); }
