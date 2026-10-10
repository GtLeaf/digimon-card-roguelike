import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const label = arg('--label', 'latest');
const count = Number(arg('--count', '8'));
if (!/^[a-z0-9-]+$/.test(label) || !Number.isInteger(count) || count < 1) throw Error('Invalid arguments');
const temp = await mkdtemp(join(tmpdir(), 'digimon-enemy-ai-'));
try {
  const bundle = join(temp, 'model.mjs');
  await build({
    stdin: { contents: "export * from './src/game/engine'; export * from './src/game/battle'; export * from './src/game/data'; export * from './src/game/evolution'; export { ENCOUNTERS } from './src/game/encounters'; export { skillUnlocked } from './src/game/cardSkills'; export { combatCandidates } from './tests/helpers/journeySimulation';", resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', outfile: bundle,
    define: { 'import.meta.env.BASE_URL': '"/"' },
  });
  const current = await import(pathToFileURL(bundle).href);
  const baselinePath = arg('--baseline', null);
  const baseline = baselinePath ? await import(pathToFileURL(resolve(root, baselinePath)).href) : null;
  // 只比较敌人变更；前后用同一套当前卡牌，防止并行的卡牌校准混入结果。
  if (baseline) Object.assign(baseline.CARDS, structuredClone(current.CARDS));
  const models = baseline ? [['before', baseline], ['after', current]] : [['after', current]];

  function chessNode(model, id) {
    for (let seed = 0; seed < 30; seed++) {
      const node = model.makeRun('guilmon', seed * 7919 + 42, false).nodes.flat()
        .find(n => n.kind === 'elite' && n.enemies[0] === id);
      if (node) return node;
    }
    throw Error(`Missing chess formation: ${id}`);
  }
  function nodeFor(model, id) {
    if (['rookchessmon', 'bishopchessmon'].includes(id)) return chessNode(model, id);
    const formation = current.ENCOUNTERS.find(e => e.id === id);
    const chapter = formation?.chapter ?? ({ beelzebumon: 1, lilithmon: 3 })[id] ?? 4;
    return { id, row: chapter * 10, lane: 0, kind: ['beelzebumon', 'core'].includes(id) ? 'boss' : formation ? 'battle' : 'elite', label: id, enemies: formation?.enemies ?? [id], enemyModifiers: formation?.enemyModifiers, next: [] };
  }
  const history = (model, form) => [...(model.EVOLUTIONS[form].parents.length ? history(model, model.EVOLUTIONS[form].parents[0]) : []), form];
  function setup(model, node, form, seed, protectedHp = false) {
    const d = model.EVOLUTIONS[form];
    const s = model.emptySave(), r = model.makeRun(d.partner, seed, false);
    s.run = r;
    Object.assign(r, { form, stage: d.stage, branch: d.branch ?? null, formHistory: history(model, form), row: node.row, currentNode: structuredClone(node), hp: protectedHp ? 10000 : 100, maxHp: protectedHp ? 10000 : 100, blessing: 'guard', training: 'defense', inherit: 'flow' });
    const ids = [...new Set(r.formHistory.flatMap(f => model.EVOLUTIONS[f].cards))];
    r.deck = ['guard', 'guard', 'guard', 'guard', 'strike', 'strike', ...ids].map((id, i) => ({ id, uid: `deck-${i}`, upgraded: i % 3 === 0 }));
    if (!r.deck.every(c => current.skillUnlocked(r, current.CARDS[c.id]))) throw Error(`Illegal fixture cards: ${form}`);
    model.beginBattle(r, node);
    return s;
  }
  const sceneIds = ['wild-duet', 'steel-trio', 'rookchessmon', 'bishopchessmon', 'beelzebumon', 'belphemon', 'lilithmon', 'armageddemon', 'core'];
  const pressure = [];
  for (const [version, model] of models) for (const id of sceneIds) {
    const node = nodeFor(model, id), s = setup(model, node, 'guilmon', 42, true);
    const turns = [];
    for (let t = 1; t <= 16; t++) {
      const r = s.run, b = r.battle;
      b.block = 0;
      const hp = r.hp;
      const plans = b.enemies.filter(e => e.hp > 0).map(e => ({ id: e.id, ...model.intent(r, e) }));
      model.endTurn(r, s.meta);
      turns.push({ turn: t, preview: plans, previewTotal: plans.reduce((n, p) => n + p.damage * p.hits, 0), actualDamage: hp - r.hp });
    }
    pressure.push({ version, id, enemies: node.enemies, totalHp: s.run.battle.enemies.filter(e => !e.summonedBy).reduce((n, e) => n + e.maxHp, 0), firstThree: turns.slice(0, 3).map(t => t.actualDamage), peakBeforeEnrage: Math.max(...turns.slice(0, 12).map(t => t.actualDamage)), mismatches: turns.filter(t => t.previewTotal !== t.actualDamage).length, turns });
  }

  const mid = ['wargrowlmon', 'blackwargrowlmon', 'taomon', 'rapidmon', 'blackrapidmon', 'vamdemon'];
  const mature = ['growlmon', 'kyubimon', 'galgomon', 'blackgalgomon', 'sorcerymon', 'devimon'];
  const ultimate = ['dukemon', 'megidramon', 'chaosdukemon', 'sakuyamon', 'kuzuhamon', 'saintgalgomon', 'blacksaintgalgomon', 'beelzebumon', 'beelzebumonblaster', 'venommyotismon', 'belialvamdemon'];
  const battles = [];
  for (const [version, model] of models) {
    for (const id of sceneIds.filter(id => id !== 'wild-duet')) {
      const forms = id === 'beelzebumon' ? mature : ['steel-trio', 'rookchessmon', 'bishopchessmon'].includes(id) ? mid : ultimate;
      const node = nodeFor(model, id);
      for (const form of forms) for (let seed = 0; seed < count; seed++) {
        let s = setup(model, node, form, seed * 7919 + 42), plays = 0, truncated = false;
        const startHp = s.run.hp;
        for (let turn = 0; turn < 24 && s.run.screen === 'battle'; turn++) {
          let turnPlays = 0;
          while (s.run.screen === 'battle' && turnPlays < 60) {
            const best = model.combatCandidates(s, 'survival', s.run.branch ?? 'duke', [])[0];
            if (!best || best.score <= 0) break;
            s = best.next;
            plays++; turnPlays++;
          }
          if (turnPlays === 60) { truncated = true; break; }
          if (s.run.screen === 'battle') s = model.reduceGame(s, { type: 'endTurn' });
        }
        battles.push({ version, id, form, seed, enemies: node.enemies, deck: s.run.deck, won: s.run.screen === 'reward', hpLoss: startHp - s.run.hp, turns: s.run.battle.turn, plays, truncated: truncated || s.run.screen === 'battle' });
      }
      console.log(`${version}: ${id} ${forms.length * count} fixed battles`);
    }
  }
  const summaries = [];
  for (const [version] of models) for (const id of sceneIds.filter(id => id !== 'wild-duet')) {
    const rows = battles.filter(r => r.version === version && r.id === id);
    summaries.push({ version, id, n: rows.length, wins: rows.filter(r => r.won).length, meanHpLoss: rows.reduce((n, r) => n + r.hpLoss, 0) / rows.length, meanTurns: rows.reduce((n, r) => n + r.turns, 0) / rows.length, truncations: rows.filter(r => r.truncated).length });
  }
  const out = join(root, 'docs/reports');
  await mkdir(out, { recursive: true });
  const sourceHashes = {};
  for (const f of ['src/game/battle.ts', 'src/game/enemyRules.ts', 'src/game/encounters.ts', 'src/game/world.ts', 'src/game/data.ts', 'src/game/cardUpgrades.ts']) sourceHashes[f] = createHash('sha256').update(await readFile(join(root, f))).digest('hex');
  const report = { label, count, sourceHashes, baselineHash: baselinePath ? createHash('sha256').update(await readFile(resolve(root, baselinePath))).digest('hex') : null, method: ['威胁曲线不出牌、不防御、不清增援；提高生命只用于记录完整周期，不表示实际损血。', '固定牌组具有合法形态来源，100初始生命、守护祝福、防御训练，三分之一卡牌强化，无装置或额外道具。', '固定防守策略、每组相同种子；不是完整旅途或玩家胜率。卡牌前后统一为当前定义。', '每回合60张牌、24回合诊断上限；超限单独记录，不视为胜利。'], pressure, summaries, battles };
  await writeFile(join(out, `enemy-ai-${label}.json`), JSON.stringify(report, null, 2) + '\n');
  const lines = summaries.map(r => `| ${r.version} | ${r.id} | ${r.wins}/${r.n} | ${r.meanHpLoss.toFixed(2)} | ${r.meanTurns.toFixed(2)} | ${r.truncations} |`);
  await writeFile(join(out, `enemy-ai-${label}.md`), `# 敌人 AI 场景校准：${label}\n\n${report.method.map(s => '- ' + s).join('\n')}\n\n| 版本 | 场景 | 固定策略胜出 | 平均净损血 | 平均回合 | 超限 |\n| --- | --- | --- | --- | --- | --- |\n${lines.join('\n')}\n\n共${battles.length}场。完整威胁曲线、牌组、种子与源码哈希见[原始数据](enemy-ai-${label}.json)。\n`);
  console.log(JSON.stringify({ battles: battles.length, summaries, pressure: pressure.map(({ turns, ...summary }) => summary), mismatchesAfter: pressure.filter(r => r.version === 'after').reduce((n, r) => n + r.mismatches, 0) }));
} finally { await rm(temp, { recursive: true, force: true }); }
