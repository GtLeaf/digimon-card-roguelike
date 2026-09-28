import { Backpack, Box, ChevronDown, GitBranch, ScanLine, Sparkles } from 'lucide-react';
import { BLESSINGS, BRANCHES, ENEMIES, FORM_NAMES, RELICS } from '../game/data';
import { EVOLUTIONS } from '../game/evolution';
import type { Run } from '../game/types';
import { Health } from './Health';
import { Sprite } from './Sprite';

const inheritance: Record<Run['inherit'], string> = {
  ember: '余烬：首次施加灼烧额外＋1',
  ward: '坚守：首次防御额外＋2 护盾',
  seal: '符心：第一张牌施加符印时额外＋1',
  flow: '灵巧：第一张牌为技能时获得 2 护盾',
};

export function PartnerSidebar({
  run,
  saveError,
  onCollection,
}: {
  run: Run;
  saveError: string;
  onCollection: () => void;
}) {
  const r = run;
  return (
    <aside className="partner-sidebar">
      <div className="eyebrow">PARTNER LINK</div>
      <Sprite id={r.form} size={170} />
      <h2>{FORM_NAMES[r.form]}</h2>
      <p>{r.branch ? BRANCHES[r.branch].tag : ['成长期', '成熟期', '完全体'][r.stage]}</p>
      <Health hp={r.hp} max={r.maxHp} />
      {r.stage > 0 && (
        <div className="passive-note">
          <GitBranch size={16} />
          <span>
            {EVOLUTIONS[r.form]?.passive}
            <small>{inheritance[r.inherit]}</small>
          </span>
        </div>
      )}
      <div className="aside-section">
        <h3>
          <Sparkles size={15} />
          旅途祝福
        </h3>
        <p>{BLESSINGS[r.blessing]?.name ?? '等待选择'}</p>
        <small>{BLESSINGS[r.blessing]?.text}</small>
      </div>
      <div className="aside-section">
        <h3>
          <Backpack size={15} />
          装置 <span>{r.relics.length}</span>
        </h3>
        {r.relics.map((id) => (
          <div className="relic-item" key={id}>
            <Box size={15} />
            <span>
              {RELICS[id].name}
              <small>{RELICS[id].text}</small>
            </span>
          </div>
        ))}
        {!r.relics.length && <small>精英与宝箱中藏着特别的力量。</small>}
      </div>
      <button className="secondary" onClick={onCollection}>
        <ScanLine size={16} />
        {ENEMIES[r.support]?.name ?? '应急防御程序'}
        <ChevronDown size={15} />
      </button>
      <small className="saved-indicator">
        <span className="signal-dot" />
        {saveError ? '存档需要处理' : '冒险进度已保存'}
      </small>
    </aside>
  );
}
