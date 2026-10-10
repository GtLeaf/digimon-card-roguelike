import { BLESSINGS, CARDS, ENEMIES, RELICS } from './data';
import { EVOLUTIONS } from './evolution';
import { parseSave, SAVE_KEY } from './storage';
import type { Save } from './types';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const IMPORT_BACKUP_KEY = `${SAVE_KEY}-before-import`;

export function prepareImport(raw: string): Save {
  if (new Blob([raw]).size > MAX_IMPORT_BYTES)
    throw new Error('存档超过 2MB，请选择游戏导出的 JSON 备份。');
  let save: Save;
  try {
    save = parseSave(raw);
  } catch {
    throw new Error('无法读取此存档，请选择数码旅途导出的兼容 JSON 备份。');
  }
  const r = save.run;
  // 导入是外部输入；除迁移校验外，检查界面会直接读取的配置与进度。
  if (
    r &&
    (r.hp > r.maxHp ||
      !r.nodes[r.row]?.length ||
      EVOLUTIONS[r.form].partner !== r.partner ||
      EVOLUTIONS[r.form].stage !== r.stage ||
      [
        ...r.deck,
        ...(r.battle
          ? [...r.battle.hand, ...r.battle.draw, ...r.battle.discard, ...r.battle.exhaust]
          : []),
      ].some((card) => !Object.hasOwn(CARDS, card.id)) ||
      r.battle?.enemies.some((enemy) => !Object.hasOwn(ENEMIES, enemy.id)) ||
      r.nodes.flat().some((node) => node.enemies.some((id) => !Object.hasOwn(ENEMIES, id))) ||
      r.relics.some((id) => !Object.hasOwn(RELICS, id)) ||
      (r.blessing !== '' && !Object.hasOwn(BLESSINGS, r.blessing)) ||
      (r.support !== 'default' && !ENEMIES[r.support]?.support) ||
      r.shopStock.some((id) => !Object.hasOwn(CARDS, id)) ||
      ('shopRelicStock' in r &&
        Array.isArray(r.shopRelicStock) &&
        r.shopRelicStock.some((id: string) => !Object.hasOwn(RELICS, id))) ||
      r.reward?.scans.some((scan) => !Object.hasOwn(ENEMIES, scan.id)))
  )
    throw new Error('此存档包含无法识别的游戏内容或进度，原记录未改动。');
  return save;
}

export function commitImport(
  raw: string,
  expectedRaw: string | null,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): Save {
  const save = prepareImport(raw);
  const previous = storage.getItem(SAVE_KEY);
  if (previous !== expectedRaw) throw new Error('当前进度已发生变化，请重新选择备份后确认。');
  try {
    // 备份失败时不覆盖原存档；单次 setItem 失败也不会清除旧值。
    if (previous !== null) storage.setItem(IMPORT_BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    throw new Error('未能保存导入结果，当前记录仍保留。请先下载备份并检查浏览器存储。');
  }
  return save;
}

export function downloadSave(save: Save | string, name = '数码旅途-存档备份.json') {
  const blob = new Blob([typeof save === 'string' ? save : JSON.stringify(save, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
