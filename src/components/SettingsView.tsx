import { Activity, Download, Volume2, VolumeX } from 'lucide-react';
import type { Action, Save } from '../game/types';

export function SettingsView({ state, send }: { state: Save; send: (action: Action) => void }) {
  return (
    <>
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
        <button
          className="option"
          onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob),
              a = document.createElement('a');
            a.href = url;
            a.download = '数码旅途-存档备份.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download />
          <span>
            <strong>下载存档备份</strong>
            <small>保存当前冒险与图鉴数据</small>
          </span>
        </button>
      </div>
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
