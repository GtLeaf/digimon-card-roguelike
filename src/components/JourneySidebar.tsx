import { ArrowLeft, Check, GitBranch, Radio } from 'lucide-react';
import { CHAPTERS } from '../game/data';
import type { Run } from '../game/types';

export function JourneySidebar({
  run,
  onTree,
  onHome,
}: {
  run: Run;
  onTree: () => void;
  onHome: () => void;
}) {
  const r = run;
  const current = Math.floor(r.row / r.chapterRows);
  const chapter = CHAPTERS[current];
  return (
    <aside className="journey-sidebar">
      <div className="eyebrow">YOUR JOURNEY</div>
      <h2>{chapter.name}</h2>
      <p>{chapter.subtitle}</p>
      <div className="chapter-steps">
        {CHAPTERS.map((ch, i) => (
          <div key={ch.name} className={i === current ? 'current' : i < current ? 'completed' : ''}>
            <span>{i < current ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span>
            <div>
              {ch.name}
              <small>
                {i === current
                  ? `${(r.row % r.chapterRows) + 1} / ${r.chapterRows} 节点`
                  : i < current
                    ? '已穿越'
                    : '等待连接'}
              </small>
            </div>
          </div>
        ))}
      </div>
      <div className="sidebar-note">
        <Radio size={20} />
        <p>
          选牌塑造战术，
          <br />
          进化决定可能。
        </p>
      </div>
      <button className="secondary" onClick={onTree}>
        <GitBranch size={16} />
        查看进化路线
      </button>
      <button className="text-btn" onClick={onHome}>
        <ArrowLeft size={14} />
        返回首页 · 进度已保存
      </button>
    </aside>
  );
}
