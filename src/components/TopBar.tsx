import {
  Backpack,
  BookOpen,
  CircleHelp,
  GitBranch,
  Layers,
  ScanLine,
  Settings,
} from 'lucide-react';

export type ModalKind = 'deck' | 'collection' | 'items' | 'tree' | 'settings' | 'help' | 'abandon';

export function TopBar({
  showDeck,
  partnerCount,
  onHome,
  onOpenDeck,
  onOpenModal,
}: {
  showDeck: boolean;
  partnerCount: number;
  onHome: () => void;
  onOpenDeck: () => void;
  onOpenModal: (modal: ModalKind) => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="返回首页">
        <span className="brand-symbol">
          <ScanLine size={23} />
        </span>
        <span>
          数码旅途<small>DIGITAL ODYSSEY</small>
        </span>
      </button>
      <nav>
        {showDeck && (
          <button className="icon-btn" aria-label="查看卡组" onClick={onOpenDeck}>
            <Layers size={18} />
          </button>
        )}
        <button className="icon-btn" aria-label="查看进化树" onClick={() => onOpenModal('tree')}>
          <GitBranch size={18} />
        </button>
        <button
          className="icon-btn collection-entry"
          title="伙伴图鉴"
          aria-label={`伙伴图鉴，已转化 ${partnerCount} 位伙伴`}
          onClick={() => onOpenModal('collection')}
        >
          <BookOpen size={18} />
          <b aria-hidden="true">{partnerCount}</b>
        </button>
        <button
          className="icon-btn"
          title="道具图鉴"
          aria-label="道具图鉴"
          onClick={() => onOpenModal('items')}
        >
          <Backpack size={19} />
        </button>
        <button className="icon-btn" aria-label="玩法说明" onClick={() => onOpenModal('help')}>
          <CircleHelp size={19} />
        </button>
        <button className="icon-btn" aria-label="设置" onClick={() => onOpenModal('settings')}>
          <Settings size={19} />
        </button>
      </nav>
    </header>
  );
}
