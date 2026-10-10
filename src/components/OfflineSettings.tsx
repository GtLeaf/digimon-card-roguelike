import { useState } from 'react';
import { Download, RefreshCw, Shield, WifiOff } from 'lucide-react';
import { checkOffline, installOffline, protectStorage, useOffline } from '../pwa/offline';

export function offlineLabel(status: ReturnType<typeof useOffline>['status']) {
  return {
    preparing: '正在准备离线资源',
    ready: '已可离线游玩',
    error: '离线资源尚未准备完成',
    unavailable: '此入口暂不支持离线安装',
  }[status];
}

export function OfflineSettings({
  locked,
  updating,
  onUpdate,
}: {
  locked: boolean;
  updating: boolean;
  onUpdate: () => void;
}) {
  const offline = useOffline();
  const [storageMessage, setStorageMessage] = useState('');
  const [protecting, setProtecting] = useState(false);
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <section aria-label="离线与安装">
      <h3>离线与安装</h3>
      <p className="modal-note" role="status">
        <strong>{offlineLabel(offline.status)}</strong>
        <br />
        {offline.status === 'ready'
          ? '现在可以断网、关闭页面再打开，继续冒险或开始新局。'
          : offline.status === 'unavailable'
            ? '请使用正式 HTTPS 游戏地址。电脑 localhost 可验证生产预览；普通局域网 HTTP 与开发预览不提供离线安装。'
            : '首次需要联网下载完整游戏，请等待准备完成后再离线。'}
        {!offline.online && (
          <>
            <br />
            当前连接已断开。
          </>
        )}
        {offline.message && (
          <>
            <br />
            {offline.message}
          </>
        )}
      </p>
      <div className="option-list">
        <button
          className="option"
          disabled={
            offline.status === 'unavailable' || offline.checking || !offline.online || updating
          }
          onClick={() => void checkOffline()}
        >
          <WifiOff />
          <span>
            <strong>
              {offline.checking
                ? '正在检查'
                : offline.status === 'error'
                  ? '重试离线准备'
                  : '检查离线资源与更新'}
            </strong>
            <small>联网时检查完整资源和新版本</small>
          </span>
        </button>
        {offline.needRefresh && (
          <button className="option" disabled={locked || updating} onClick={onUpdate}>
            <RefreshCw />
            <span>
              <strong>{updating ? '正在保存并更新' : '保存并更新'}</strong>
              <small>
                {locked ? '新版本已准备好，战斗结束后可更新' : '新版本已准备好，保留进度后重新打开'}
              </small>
            </span>
          </button>
        )}
        {offline.canInstall && !offline.installed && (
          <button
            className="option"
            disabled={offline.installing || offline.status !== 'ready'}
            onClick={() => void installOffline()}
          >
            <Download />
            <span>
              <strong>安装数码旅途</strong>
              <small>
                {offline.status === 'ready'
                  ? '添加到主屏幕，以独立窗口打开'
                  : '离线资源准备好后可安装'}
              </small>
            </span>
          </button>
        )}
        <button
          className="option"
          disabled={protecting}
          onClick={async () => {
            setProtecting(true);
            setStorageMessage(await protectStorage());
            setProtecting(false);
          }}
        >
          <Shield />
          <span>
            <strong>保护本地进度</strong>
            <small>申请减少浏览器自动清理，建议同时备份</small>
          </span>
        </button>
      </div>
      <p className="modal-note">
        {offline.installed
          ? '已在独立应用窗口中打开。'
          : ios
            ? 'iPhone / iPad：在 Safari 中打开，点击“分享”，选择“添加到主屏幕”并作为 Web App 打开。'
            : '也可通过浏览器菜单选择“安装应用”或“添加到主屏幕”。'}
        <br />
        清除站点数据会删除资源和存档；更换地址或浏览器时，请通过导出／导入转移进度。
      </p>
      {storageMessage && (
        <p className="modal-note" role="status">
          {storageMessage}
        </p>
      )}
    </section>
  );
}
