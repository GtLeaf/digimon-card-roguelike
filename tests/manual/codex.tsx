// 卡片图鉴检索验收页：全部状态驻留内存，不读取或写入玩家存档。
// 地址参数：?q=关键词&run=1&open=filters|search|detail|tree&scroll=像素&mscroll=像素&view=up&lock=1&group=&tag=&cost=
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Codex } from '../../src/components/Codex';
import { EvolutionTree } from '../../src/components/EvolutionTree';
import { Modal } from '../../src/components/Modal';
import { setCodexQuery, setCodexTab } from '../../src/components/cardCodexStore';
import { emptySave, reduceGame } from '../../src/game/engine';
import type { Meta } from '../../src/game/types';
import '../../src/styles.css';

const params = new URLSearchParams(
  (globalThis as { __CODEX_PARAMS__?: string }).__CODEX_PARAMS__ ?? location.search,
);
// 默认：基尔兽到达古拉兽、大古拉兽；lock=1 时只收录基础形态。
const meta: Meta = {
  unlockedRoutes: [],
  scans: {},
  partners: [],
  games: 3,
  wins: 1,
  discovered: params.get('lock') ? [] : ['growlmon', 'wargrowlmon', 'kyubimon'],
};
let save = reduceGame(emptySave(), { type: 'start', partner: 'guilmon', seed: 7 });
save = { ...save, meta };
const run = params.get('run') ? save.run : null;

setCodexTab('card');
setCodexQuery((q) => ({
  ...q,
  text: params.get('q') ?? '',
  upgradedView: params.get('view') === 'up',
  tags: params.get('tag') ? [params.get('tag') as never] : [],
  costs: params.get('cost') ? [Number(params.get('cost'))] : [],
  group: (params.get('group') as never) ?? 'all',
}));

function Page() {
  const [tree, setTree] = useState<string | null>(null);
  return tree ? (
    <Modal title="进化路线与条件" onClose={() => setTree(null)} wide>
      <EvolutionTree run={run} meta={meta} onAction={() => {}} initialForm={tree} />
    </Modal>
  ) : (
    <Modal title="数码图鉴" onClose={() => {}} wide>
      <Codex meta={meta} run={run} onOpenTree={setTree} />
    </Modal>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);

const open = params.get('open');
const click = (selector: string) =>
  setTimeout(() => document.querySelector<HTMLElement>(selector)?.click(), 60);
if (open === 'filters') click('.codex-filter-open');
if (open === 'search') click('.codex-search-open');
if (open === 'detail' || open === 'tree') click('.codex-card-slot .game-card');
// 从详情跳转进化树，检查定位到所属形态。
if (open === 'tree')
  setTimeout(() => document.querySelector<HTMLElement>('.codex-detail-nav .primary')?.click(), 300);
// scroll：滚动筛选／详情面板；mscroll：滚动图鉴弹窗，用于检查吸顶。
const scroll = Number(params.get('scroll') ?? 0),
  modalScroll = Number(params.get('mscroll') ?? 0);
setTimeout(() => {
  if (scroll) document.querySelector('.journey-panel-content')?.scrollTo(0, scroll);
  if (modalScroll) document.querySelector('.modal')?.scrollTo(0, modalScroll);
}, 200);
