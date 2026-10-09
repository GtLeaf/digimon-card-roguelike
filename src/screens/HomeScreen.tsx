import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  GitBranch,
  Lock,
  Play,
  RotateCcw,
  ScanLine,
  Swords,
} from 'lucide-react';
import { BRANCHES, CARDS, ENEMIES, FORM_NAMES, PARTNERS, PARTNER_IDS } from '../game/data';
import type { Partner, Run } from '../game/types';
import { SceneDecor } from '../components/SceneDecor';
import { Sprite } from '../components/Sprite';

export function HomeScreen({
  run,
  wins,
  scans,
  discovered,
  onStart,
  onContinue,
  onAbandon,
  onCodex,
}: {
  run: Run | null;
  wins: number;
  scans: Record<string, number>;
  discovered: string[];
  onStart: (partner: Partner) => void;
  onContinue: () => void;
  onAbandon: () => void;
  onCodex: () => void;
}) {
  const isActive = !!run && run.screen !== 'result';
  return (
    <main className="home">
      <div className="home-copy">
        <div className="eyebrow">
          <span className="signal-dot" /> 与搭档，再次连接
        </div>
        <h1>
          每一次选择，
          <br />
          都是新的<span>进化。</span>
        </h1>
        <p>
          跨越现实与数码世界。
          <br />
          抽换你的卡片，寻找属于你们的进化路线。
        </p>
        <div className="home-tags">
          <span>
            <Swords size={15} />
            卡牌构筑
          </span>
          <span>
            <GitBranch size={15} />
            分支进化
          </span>
          <span>
            <ScanLine size={15} />
            扫描伙伴
          </span>
        </div>
        <div className="home-actions">
          {isActive && (
            <button className="primary continue-btn" onClick={onContinue}>
              <Play size={18} />
              继续冒险{' '}
              <span>
                第 {Math.floor(run.row / run.chapterRows) + 1} 章 · {FORM_NAMES[run.form]}
              </span>
              <ArrowRight size={18} />
            </button>
          )}
          {isActive && (
            <button className="secondary restart-btn" onClick={onAbandon}>
              <RotateCcw size={16} />
              重新出发
            </button>
          )}
        </div>
        <div className="home-meta">
          <span>单人冒险</span>
          <i />
          <span>自动保存</span>
          <i />
          <span>手机竖屏</span>
        </div>
      </div>
      <div className="hero-art">
        <SceneDecor theme="forest" />
        <div className="orbit orbit-a" />
        <div className="orbit orbit-b" />
        <div className="hero-label">
          <span>LINK ESTABLISHED</span>
          <b>同步，始于信任。</b>
        </div>
        <Sprite id="guilmon" size={340} className="hero-guilmon" />
        <Sprite id="renamon" size={330} className="hero-renamon" />
        <Sprite id="terriermon" size={190} className="hero-terriermon" />
        <span className="hero-coordinate">35° 41′ N / DIGITAL FIELD</span>
      </div>
      <section className="partner-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / SELECT PARTNER</span>
            <h2>选择你的搭档</h2>
          </div>
          <p>不同搭档，同样无限的可能。</p>
        </div>
        <div className="partner-grid">
          {PARTNER_IDS.map((id, i) => {
            const locked = id === 'impmon' && (scans.beelzebumon ?? 0) < 100;
            return (
              <button
                className={`partner-pick ${id} ${locked ? 'locked' : ''}`}
                key={id}
                onClick={() => onStart(id)}
                disabled={isActive || locked}
              >
                <div className="partner-number">0{i + 1}</div>
                <Sprite id={id} size={180} />
                <div className="partner-description">
                  <span className="eyebrow">{PARTNERS[id].tag}</span>
                  <h3>{PARTNERS[id].name}</h3>
                  <p>
                    {locked
                      ? '在旅途中击败别西卜兽（扫描率达 100%）后，这位爱恶作剧的搭档才会加入。'
                      : PARTNERS[id].description}
                  </p>
                  <div className="route-mini">
                    {PARTNERS[id].branches.map((key) => (
                      <span key={key}>{BRANCHES[key].name}</span>
                    ))}
                  </div>
                  <span className="pick-link">
                    {locked ? (
                      <>
                        <Lock size={15} />
                        别西卜兽扫描 100% 解锁
                      </>
                    ) : isActive ? (
                      '当前旅途尚未结束'
                    ) : (
                      '与我一起出发'
                    )}
                    <ArrowUpRight size={18} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {isActive && (
          <button className="text-btn" onClick={onAbandon}>
            结束当前旅途，重新选择搭档
          </button>
        )}
      </section>
      <section className="codex-section">
        <button className="codex-entry" onClick={onCodex}>
          <BookMarked size={22} />
          <span className="codex-entry-copy">
            <strong>数码图鉴</strong>
            <small>遇见过的数码兽与全部搭档卡片，随时翻阅</small>
          </span>
          <span className="codex-entry-stats">
            <span>
              数码兽{' '}
              <b>
                {Object.keys(ENEMIES).filter((id) => (scans[id] ?? 0) > 0).length}/
                {Object.keys(ENEMIES).length}
              </b>
            </span>
            <span>
              卡片{' '}
              <b>
                {
                  Object.values(CARDS).filter(
                    (d) =>
                      d.family !== 'status' &&
                      (!d.unlockForm ||
                        ((PARTNER_IDS as string[]).includes(d.unlockForm) &&
                          (d.unlockForm !== 'impmon' || (scans.beelzebumon ?? 0) >= 100)) ||
                        discovered.includes(d.unlockForm)),
                  ).length
                }
                /{Object.values(CARDS).filter((d) => d.family !== 'status').length}
              </b>
            </span>
          </span>
          <ArrowRight size={18} />
        </button>
      </section>
      <footer className="home-footer">
        <span>每一段旅程，都会留下数据与回忆。</span>
        <span>本地试玩版 0.3 · {wins} 次完成旅途</span>
      </footer>
    </main>
  );
}
