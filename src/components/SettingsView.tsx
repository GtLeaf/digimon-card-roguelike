import { Activity, Download, Upload, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import { FORM_NAMES, PARTNERS } from '../game/data';
import {
  IMPORT_BACKUP_KEY,
  MAX_IMPORT_BYTES,
  downloadSave,
  prepareImport,
} from '../game/saveTransfer';
import { SAVE_KEY } from '../game/storage';
import { OfflineSettings } from './OfflineSettings';
import type { Action, Save } from '../game/types';

export function SettingsView({
  state,
  send,
  locked,
  updating,
  onUpdate,
  onRestore,
}: {
  state: Save;
  send: (action: Action) => void;
  locked: boolean;
  updating: boolean;
  onUpdate: () => void;
  onRestore: (raw: string, expectedRaw: string | null) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{
    raw: string;
    save: Save;
    expected: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasBackup] = useState(() => {
    try {
      return localStorage.getItem(IMPORT_BACKUP_KEY) !== null;
    } catch {
      return false;
    }
  });
  async function chooseFile(file?: File) {
    setPreview(null);
    setError('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error('存档超过 2MB，请选择游戏导出的 JSON 备份。');
      const raw = await file.text();
      setPreview({ raw, save: prepareImport(raw), expected: localStorage.getItem(SAVE_KEY) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取失败，原存档未改动。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <OfflineSettings locked={locked} updating={updating} onUpdate={onUpdate} />
      <h3>声音与进度</h3>
      <div className="option-list">
        <button className="option" onClick={() => send({ type: 'settings', key: 'sound' })}>
          {state.settings.sound ? <Volume2 /> : <VolumeX />}
          <span>
            <strong>操作音效</strong>
            <small>{state.settings.sound ? '已开启' : '已关闭'}</small>
          </span>
        </button>
        <button className="option" onClick={() => send({ type: 'settings', key: 'reducedMotion' })}>
          <Activity />
          <span>
            <strong>减少动态效果</strong>
            <small>{state.settings.reducedMotion ? '已开启' : '已关闭'}</small>
          </span>
        </button>
        <button className="option" onClick={() => downloadSave(state)}>
          <Download />
          <span>
            <strong>下载存档备份</strong>
            <small>保存当前冒险与图鉴数据</small>
          </span>
        </button>
        <button
          className="option"
          disabled={locked || busy || updating}
          onClick={() => fileInput.current?.click()}
        >
          <Upload />
          <span>
            <strong>导入存档备份</strong>
            <small>
              {locked ? '战斗结束后可导入，避免中断行动' : '先预览，再确认替换当前进度'}
            </small>
          </span>
        </button>
        {hasBackup && (
          <button
            className="option"
            onClick={() => {
              try {
                const raw = localStorage.getItem(IMPORT_BACKUP_KEY);
                if (raw) downloadSave(raw, '数码旅途-导入前备份.json');
              } catch {
                setError('无法读取导入前备份。');
              }
            }}
          >
            <Download />
            <span>
              <strong>下载导入前备份</strong>
              <small>保留上次导入前的原始记录</small>
            </span>
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="选择存档备份"
        hidden
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error && (
        <p className="modal-note" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <section aria-label="存档导入预览">
          <h3>确认导入这份进度？</h3>
          <p className="modal-note">
            {preview.save.run
              ? `${PARTNERS[preview.save.run.partner].name} · ${FORM_NAMES[preview.save.run.form]} · 第 ${Math.floor(preview.save.run.row / preview.save.run.chapterRows) + 1} 章 · ${preview.save.run.screen === 'result' ? '旅途已结束' : `第 ${(preview.save.run.row % preview.save.run.chapterRows) + 1} 层`}`
              : '暂无进行中的旅途'}
            <br />
            已记录 {Object.keys(preview.save.meta.scans).length} 种扫描 ·{' '}
            {preview.save.meta.partners.length} 位支援 · {preview.save.meta.wins} 次通关
            <br />
            将替换当前旅途、图鉴和设置；确认时先保存导入前备份。
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              取消导入
            </button>
            <button
              className="primary"
              disabled={locked || busy || updating}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await onRestore(preview.raw, preview.expected);
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : '导入未完成，原记录仍保留。');
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认替换并导入
            </button>
          </div>
        </section>
      )}
      <p className="modal-note">
        本地试玩版。角色像素素材来自已有素材档案，帝厉魔代理体为原创程序造型。部分新分支使用官方图鉴静态立绘，其他角色保留像素动画。
        <a
          href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`}
          target="_blank"
          rel="noreferrer"
        >
          查看素材来源
        </a>
        。
      </p>
    </>
  );
}
