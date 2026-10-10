import {
  ArrowRight,
  Backpack,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  GitBranch,
  Heart,
  Layers,
  Play,
  ScanLine,
} from 'lucide-react';
import {
  asset,
  BRANCHES,
  CHAPTERS,
  FORM_NAMES,
  PARTNERS,
  PARTNER_IDS,
  PORTRAIT_FORMS,
} from '../game/data';
import { stageName } from '../game/evolution';
import { AttributeLabel } from './AttributeLabel';
import type { Meta, Partner, Run } from '../game/types';
import { APP_VERSION } from '../version';
import './HomeScreen.css';

export type HomePanel = 'codex' | 'deck' | 'tree' | 'collection' | 'items' | 'help' | 'abandon';

interface HomeScreenProps {
  run: Run | null;
  meta: Meta;
  partner: Partner;
  onSelect: (partner: Partner) => void;
  onStart: (partner: Partner) => void;
  onContinue: () => void;
  onOpen: (panel: HomePanel) => void;
}

const introductions: Record<Partner, { description: string; styles: string }> = {
  guilmon: { description: '叠加灼烧，\n引爆烈焰。', styles: '灼烧 / 守护 / 自损' },
  renamon: { description: '编织符印，\n串联术式。', styles: '符印 / 复制 / 控制' },
  impmon: { description: '积攒噬能，\n释放黑暗。', styles: '噬能 / 连射 / 吸血' },
  terriermon: { description: '连射压制，\n蓄能炮击。', styles: '连射 / 蓄能 / 炮击' },
};

export function HomeScreen({
  run,
  meta,
  partner,
  onSelect,
  onStart,
  onContinue,
  onOpen,
}: HomeScreenProps) {
  const activeRun = run && run.screen !== 'result' ? run : null;
  const definition = PARTNERS[partner];
  const introduction = introductions[partner];
  const form = activeRun?.form ?? partner;
  const chapter = activeRun
    ? Math.min(CHAPTERS.length - 1, Math.floor(activeRun.row / activeRun.chapterRows))
    : 0;
  const name = FORM_NAMES[form];

  return (
    <main className={`start-home ${activeRun ? 'has-journey' : ''}`}>
      <section className="start-intro">
        <p className="start-kicker">
          <span />
          {activeRun ? '连接仍在，搭档等你' : '与你的搭档，再次连接'}
        </p>
        <h1>
          {activeRun ? '一起走完，' : '新的旅途，'}
          <em>{activeRun ? '这段旅途。' : '由你选择。'}</em>
        </h1>
        <p className="start-desktop-copy">
          跨越现实与数码世界。
          <br />
          抽换你的卡片，寻找属于你们的进化路线。
        </p>
        <div className="start-desktop-tags">
          <span>
            <Layers size={16} />
            卡牌构筑
          </span>
          <span>
            <GitBranch size={16} />
            分支进化
          </span>
          <span>
            <ScanLine size={16} />
            扫描伙伴
          </span>
        </div>
      </section>

      <section
        className="start-launchpad"
        aria-label={activeRun ? '继续当前旅途' : '选择搭档并开始冒险'}
      >
        <div className="start-section-label">
          <h2>{activeRun ? '进行中的冒险' : '选择初始搭档'}</h2>
          <span>{activeRun ? '进度自动保存' : '五章冒险 · 自动保存'}</span>
        </div>
        <div className={`start-stage ${PORTRAIT_FORMS.includes(form) ? 'uses-portrait' : ''}`}>
          <div className="start-scenery" aria-hidden="true">
            <div className="start-moon" />
            <div className="start-mountains" />
            <div className="start-ground" />
          </div>
          <span className="start-link-label">
            {activeRun
              ? `JOURNEY LINK / CHAPTER 0${chapter + 1}`
              : `PARTNER LINK / 0${PARTNER_IDS.indexOf(partner) + 1}`}
          </span>
          <img className="start-character" key={form} src={asset(form)} alt={name} />
          <div className="start-profile" aria-live="polite" aria-atomic="true">
            <span className="start-form-tag">
              <AttributeLabel id={form} compact /> ·{' '}
              {activeRun ? (
                <>
                  {stageName(activeRun.stage)}
                  <span className="start-lineage"> · {PARTNERS[activeRun.partner].name}路线</span>
                </>
              ) : (
                definition.tag
              )}
            </span>
            <h3 className={name.length >= 6 ? 'long-form-name' : undefined}>{name}</h3>
            <p>
              {activeRun
                ? `${CHAPTERS[chapter].name}\n第 ${(activeRun.row % activeRun.chapterRows) + 1} / ${activeRun.chapterRows} 层`
                : introduction.description}
            </p>
            <span className="start-playstyle">
              {activeRun
                ? activeRun.branch
                  ? BRANCHES[activeRun.branch].tag
                  : '与你并肩'
                : introduction.styles}
            </span>
          </div>
          <span className="start-stage-caption">
            {activeRun ? '上次的旅途，仍在继续。' : '同步，始于信任。'}
          </span>
        </div>

        {activeRun ? (
          <div className="start-run-info">
            <span aria-label={`生命 ${activeRun.hp} / ${activeRun.maxHp}`}>
              <Heart size={16} />
              {activeRun.hp}
              <small>/{activeRun.maxHp}</small>
            </span>
            <span aria-label={`金币 ${activeRun.gold}`}>
              <Coins size={16} />
              {activeRun.gold}
            </span>
            <button onClick={() => onOpen('deck')}>
              <Layers size={16} />
              卡组 {activeRun.deck.length}
            </button>
          </div>
        ) : (
          <div className="start-partners" role="group" aria-label="选择初始搭档">
            {PARTNER_IDS.map((id) => (
              <button
                key={id}
                disabled={id === 'impmon' && (meta.scans.beelzebumon ?? 0) < 100}
                title={
                  id === 'impmon' && (meta.scans.beelzebumon ?? 0) < 100
                    ? '别西卜兽扫描100%后解锁'
                    : undefined
                }
                className="start-partner"
                aria-pressed={id === partner}
                onClick={() => onSelect(id)}
              >
                <img src={asset(id)} alt="" />
                <span>
                  {PARTNERS[id].name}
                  {id === 'impmon' && (meta.scans.beelzebumon ?? 0) < 100 ? ' · 未解锁' : ''}
                </span>
                {id === partner && (
                  <Check size={13} className="start-selected-mark" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        )}

        <button className="start-route" onClick={() => onOpen('tree')}>
          <GitBranch size={16} />
          <span>
            {activeRun ? stageName(activeRun.stage) : `${definition.branches.length} 条终点路线`}
          </span>
          <span>查看进化路线</span>
          <ChevronRight size={16} />
        </button>
        <div className="start-action">
          <button
            className="primary start-primary"
            disabled={!activeRun && partner === 'impmon' && (meta.scans.beelzebumon ?? 0) < 100}
            onClick={() => (activeRun ? onContinue() : onStart(partner))}
          >
            <Play size={18} />
            <span>{activeRun ? '继续冒险' : `与${definition.name}出发`}</span>
            <ArrowRight size={18} />
          </button>
          <p>
            {activeRun
              ? `从第 ${chapter + 1} 章 · 第 ${(activeRun.row % activeRun.chapterRows) + 1} 层继续`
              : '选择后出发 · 进度自动保存'}
          </p>
        </div>
        {activeRun && (
          <button className="start-restart" onClick={() => onOpen('abandon')}>
            结束当前旅途，重新选择搭档
          </button>
        )}
      </section>

      <nav className="start-archives" aria-label="旅途档案">
        <button onClick={() => onOpen('codex')}>
          <BookOpen size={19} />
          <span>数码图鉴</span>
        </button>
        <button onClick={() => onOpen('collection')}>
          <span className="start-archive-icon">
            <BookOpen size={19} />
            {meta.partners.length > 0 && <b>{meta.partners.length}</b>}
          </span>
          <span>伙伴图鉴</span>
        </button>
        <button onClick={() => onOpen('items')}>
          <Backpack size={19} />
          <span>道具图鉴</span>
        </button>
        <button onClick={() => onOpen('help')}>
          <CircleHelp size={19} />
          <span>玩法说明</span>
        </button>
      </nav>
      <footer className="start-footer">
        <span>每一段旅程，都会留下数据与回忆。</span>
        <span>
          本地试玩版 {APP_VERSION}
          {meta.wins > 0 && ` · ${meta.wins} 次完成旅途`}
        </span>
      </footer>
    </main>
  );
}
