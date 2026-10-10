import { useCallback, useEffect, useReducer, useState } from 'react';
import { Coins, Heart, Layers } from 'lucide-react';
import { CHAPTERS } from './game/data';
import { reduceGame } from './game/engine';
import { loadSave, SAVE_KEY, writeSave } from './game/storage';
import type { Action, Partner } from './game/types';
import type { Pile } from './components/DeckViewer';
import { DeckViewer } from './components/DeckViewer';
import { EvolutionTree, EvolutionTracker } from './components/EvolutionTree';
import { ExplorationMap } from './components/ExplorationMap';
import { ItemCodex } from './components/ItemCodex';
import { Modal } from './components/Modal';
import { TopBar } from './components/TopBar';
import type { ModalKind } from './components/TopBar';
import { JourneySidebar } from './components/JourneySidebar';
import { PartnerSidebar } from './components/PartnerSidebar';
import { CollectionView } from './components/CollectionView';
import { Codex } from './components/Codex';
import { HelpView } from './components/HelpView';
import { SettingsView } from './components/SettingsView';
import { AbandonView } from './components/AbandonView';
import { useBattleQueue } from './hooks/useBattleQueue';
import { HomeScreen } from './components/HomeScreen';
import { CampView, ShopView, RewardView } from './components/JourneyScreens';
import { StoryEventView } from './components/StoryEvent';
import { BattleScreen } from './screens/BattleScreen';
import { BlessingScreen } from './screens/BlessingScreen';
import { RestScreen } from './screens/CampScreen';
import { TreasureScreen } from './screens/TreasureScreen';
import { EvolutionScreen } from './screens/EvolutionScreen';
import { ResultScreen } from './screens/ResultScreen';
import { activateUpdate, dismissUpdate, ensureSingleWindow, useOffline } from './pwa/offline';
import { offlineLabel } from './components/OfflineSettings';
import { commitImport } from './game/saveTransfer';

export default function App() {
  const [generation, setGeneration] = useState(0);
  return <GameApp key={generation} onRestored={() => setGeneration((value) => value + 1)} />;
}

function GameApp({ onRestored }: { onRestored: () => void }) {
  const [initial] = useState(loadSave);
  const [state, dispatch] = useReducer(reduceGame, initial.save);
  const [saveError, setSaveError] = useState(initial.error);
  const [screen, setScreen] = useState<'home' | 'game'>(() =>
    initial.save.run && initial.save.run.screen !== 'result' ? 'game' : 'home',
  );
  const [homePartner, setHomePartner] = useState<Partner>(initial.save.run?.partner ?? 'guilmon');
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [deckPile, setDeckPile] = useState<Pile>('deck');
  const [audio] = useState<{ current: AudioContext | null }>(() => ({ current: null }));
  const r = state.run,
    b = r?.battle;
  const isActive = !!r && r.screen !== 'result';
  const offline = useOffline();
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (initial.error && state === initial.save) return;
    setSaveError(writeSave(state));
  }, [state, initial]);
  useEffect(() => {
    document.body.classList.toggle('reduce-motion', state.settings.reducedMotion);
  }, [state.settings.reducedMotion]);

  const send = useCallback(
    (action: Action) => {
      if (updating) return;
      if (state.settings.sound) {
        try {
          audio.current ??= new AudioContext();
          void audio.current.resume();
          const osc = audio.current.createOscillator(),
            gain = audio.current.createGain();
          osc.connect(gain);
          gain.connect(audio.current.destination);
          osc.type = 'sine';
          osc.frequency.value = action.type === 'play' ? 440 : 620;
          gain.gain.setValueAtTime(0.035, audio.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audio.current.currentTime + 0.12);
          osc.start();
          osc.stop(audio.current.currentTime + 0.13);
        } catch {
          setSaveError('声音无法播放，游戏仍可继续。');
        }
      }
      dispatch(action);
      if (action.type === 'start') setScreen('game');
    },
    [state.settings.sound, audio, updating],
  );
  const { motion, floatingNumber, battleBusy, queueAction } = useBattleQueue(state, dispatch, send);
  const transferLocked = r?.screen === 'battle' || battleBusy;
  async function updateGame() {
    if (transferLocked || updating) return;
    setUpdating(true);
    setUpdateError('');
    try {
      await ensureSingleWindow();
      if (initial.error && state === initial.save)
        throw new Error('当前存档未能读取，请先备份原记录或导入有效存档，再更新。');
      const error = writeSave(state);
      if (error) throw new Error(error);
      await activateUpdate();
    } catch (reason) {
      setUpdateError(reason instanceof Error ? reason.message : '暂时无法更新，当前旅途仍可继续。');
      setUpdating(false);
    }
  }
  async function restoreGame(raw: string, expectedRaw: string | null) {
    if (transferLocked || updating) throw new Error('请在战斗结束后导入存档。');
    await ensureSingleWindow();
    commitImport(raw, expectedRaw);
    // 整个对局组件重新挂载，清理原行动队列并从新存档初始化。
    onRestored();
  }

  function start(partner: Partner) {
    if (initial.error) {
      try {
        const original = localStorage.getItem(SAVE_KEY);
        if (original) localStorage.setItem(`${SAVE_KEY}-recovery-${Date.now()}`, original);
      } catch {
        setSaveError('旧存档备份失败。');
        return;
      }
    }
    send({ type: 'start', partner });
  }
  const chapter = r ? CHAPTERS[Math.floor(r.row / r.chapterRows)] : CHAPTERS[0];
  const closeModal = useCallback(() => setModal(null), []);
  function openDeck(pile: Pile = 'deck') {
    setDeckPile(pile);
    setModal('deck');
  }

  return (
    <div className="app-shell">
      <TopBar
        showDeck={screen === 'home' && !!r}
        partnerCount={state.meta.partners.length}
        onHome={() => setScreen('home')}
        onOpenDeck={() => openDeck()}
        onOpenModal={setModal}
      />
      {floatingNumber && (
        <output
          key={floatingNumber.key}
          className={`battle-number ${floatingNumber.kind} ${floatingNumber.amount === 0 ? 'blocked' : ''}`}
          style={{ left: floatingNumber.left, top: floatingNumber.top }}
          aria-live="assertive"
        >
          {floatingNumber.kind === 'heal' ? '+' : '−'}
          {floatingNumber.amount}
        </output>
      )}
      {saveError && (
        <div className="save-warning" role="alert">
          {saveError}
        </div>
      )}
      {updateError && (
        <div className="save-warning" role="alert">
          {updateError}
        </div>
      )}
      {screen === 'home' && offline.status !== 'unavailable' && (
        <div className="save-warning" role="status">
          {offlineLabel(offline.status)}
          {offline.status === 'ready' ? ' · 断网后也能重新打开' : ' · 请保持联网'}
          {offline.message && ` · ${offline.message}`}
        </div>
      )}
      {offline.needRefresh && !offline.dismissed && (
        <div className="save-warning" role="status">
          <p>
            新版本已准备好。{transferLocked ? '战斗结束后可保存并更新。' : '可保存进度后更新。'}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={dismissUpdate}>
              稍后
            </button>
            <button
              className="primary"
              disabled={transferLocked || updating}
              onClick={() => void updateGame()}
            >
              {updating ? '正在保存并更新' : '保存并更新'}
            </button>
          </div>
        </div>
      )}
      {screen === 'home' ? (
        <HomeScreen
          run={r}
          meta={state.meta}
          partner={homePartner}
          onSelect={setHomePartner}
          onStart={start}
          onContinue={() => setScreen('game')}
          onOpen={(panel) => (panel === 'deck' ? openDeck() : setModal(panel))}
        />
      ) : (
        r && (
          <main className="game-layout">
            <JourneySidebar
              run={r}
              onTree={() => setModal('tree')}
              onHome={() => setScreen('home')}
            />
            <section className={`game-main ${r.screen === 'battle' ? 'is-battle' : ''}`}>
              <div className="run-status">
                <div className="status-chapter">
                  <span className="eyebrow">CHAPTER 0{Math.floor(r.row / r.chapterRows) + 1}</span>
                  <b>{r.screen === 'battle' ? `第 ${b?.turn ?? 1} 回合` : chapter.name}</b>
                </div>
                <div className="run-resources">
                  <span title="生命">
                    <Heart size={16} />
                    {r.hp}
                    <small>/{r.maxHp}</small>
                  </span>
                  <span title="金币">
                    <Coins size={16} />
                    {r.gold}
                  </span>
                  <button aria-label="查看牌组" onClick={() => openDeck()}>
                    <Layers size={17} />
                    <span>卡组</span> {r.deck.length}
                  </button>
                </div>
              </div>
              <EvolutionTracker run={r} meta={state.meta} onOpen={() => setModal('tree')} />
              {r.screen === 'map' && (
                <ExplorationMap
                  run={r}
                  onEnter={(id) => send({ type: 'node', id })}
                  onTree={() => setModal('tree')}
                />
              )}
              {r.screen === 'battle' && b && (
                <BattleScreen
                  run={r}
                  battle={b}
                  theme={chapter.theme}
                  motion={motion}
                  battleBusy={battleBusy}
                  queueAction={queueAction}
                  send={send}
                  openDeck={openDeck}
                  onHelp={() => setModal('help')}
                />
              )}
              {r.screen === 'reward' && r.reward && (
                <RewardView key={r.currentNode?.id} run={r} meta={state.meta} onAction={send} />
              )}
              {r.screen === 'blessing' && <BlessingScreen run={r} send={send} />}
              {r.screen === 'camp' && <CampView key={r.currentNode?.id} run={r} onAction={send} />}
              {r.screen === 'rest' && <RestScreen run={r} send={send} />}
              {r.screen === 'shop' && <ShopView key={r.currentNode?.id} run={r} onAction={send} />}
              {r.screen === 'event' && (
                <StoryEventView key={r.currentNode?.id} run={r} meta={state.meta} onAction={send} />
              )}
              {r.screen === 'treasure' && <TreasureScreen run={r} send={send} />}
              {r.screen === 'evolution' && (
                <EvolutionScreen run={r} meta={state.meta} send={send} onDeck={() => openDeck()} />
              )}
              {r.screen === 'result' && (
                <ResultScreen
                  run={r}
                  onHome={() => setScreen('home')}
                  onCollection={() => setModal('collection')}
                />
              )}
            </section>
            <PartnerSidebar
              run={r}
              saveError={saveError}
              onCollection={() => setModal('collection')}
            />
          </main>
        )
      )}
      {modal === 'deck' && r && (
        <Modal title={`卡组与牌堆 · ${r.deck.length} 张`} onClose={closeModal} wide>
          <DeckViewer key={deckPile} run={r} initialPile={deckPile} />
        </Modal>
      )}
      {modal === 'collection' && (
        <Modal title="扫描与伙伴图鉴" onClose={closeModal}>
          <CollectionView run={r} meta={state.meta} send={send} onTree={() => setModal('tree')} />
        </Modal>
      )}
      {modal === 'items' && (
        <Modal title="道具图鉴" onClose={closeModal} wide>
          <ItemCodex run={isActive ? r : null} />
        </Modal>
      )}
      {modal === 'codex' && (
        <Modal title="数码图鉴" onClose={closeModal} wide>
          <Codex meta={state.meta} />
        </Modal>
      )}
      {modal === 'tree' && (
        <Modal title="进化路线与条件" onClose={closeModal} wide>
          <EvolutionTree
            run={isActive ? r : null}
            initialPartner={homePartner}
            meta={state.meta}
            onAction={send}
          />
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="驯兽师手册" onClose={closeModal}>
          <HelpView />
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal title="旅途设置" onClose={closeModal}>
          <SettingsView
            state={state}
            send={send}
            locked={transferLocked}
            updating={updating}
            onUpdate={() => void updateGame()}
            onRestore={restoreGame}
          />
        </Modal>
      )}
      {modal === 'abandon' && (
        <Modal title="结束这段旅途？" onClose={closeModal}>
          <AbandonView
            onCancel={closeModal}
            onConfirm={() => {
              send({ type: 'abandon' });
              setModal(null);
              setScreen('home');
            }}
          />
        </Modal>
      )}
    </div>
  );
}
