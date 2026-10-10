import { registerSW } from 'virtual:pwa-register';
import { useSyncExternalStore } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export interface OfflineState {
  status: 'preparing' | 'ready' | 'error' | 'unavailable';
  needRefresh: boolean;
  dismissed: boolean;
  online: boolean;
  checking: boolean;
  installing: boolean;
  installed: boolean;
  canInstall: boolean;
  message: string;
}
let snapshot: OfflineState = {
  status: 'preparing',
  needRefresh: false,
  dismissed: false,
  online: navigator.onLine,
  checking: false,
  installing: false,
  installed: window.matchMedia('(display-mode: standalone)').matches,
  canInstall: false,
  message: '',
};
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let installPrompt: InstallPrompt | undefined;
let started = false;
let lastCheck = 0;
let retryTimer: number | undefined;
let automaticRetries = 0;

function cancelRetry() {
  window.clearTimeout(retryTimer);
  retryTimer = undefined;
}

function retryPreparation() {
  if (!navigator.onLine || automaticRetries >= 2 || retryTimer !== undefined) return;
  automaticRetries += 1;
  change({
    status: 'preparing',
    message: `资源下载中断，正在自动重试（${automaticRetries}/2）。`,
  });
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    void checkOffline(false);
  }, automaticRetries * 1500);
}

function change(patch: Partial<OfflineState>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}
export function useOffline() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

async function verifyOffline() {
  try {
    const base = new URL(import.meta.env.BASE_URL, location.href);
    const response = await caches.match(new URL('offline-files.json', base), {
      ignoreSearch: true,
    });
    if (!response) {
      change({ status: 'error' });
      return false;
    }
    const files: unknown = await response.json();
    if (
      !Array.isArray(files) ||
      !files.length ||
      !files.every((file) => typeof file === 'string')
    ) {
      change({ status: 'error' });
      return false;
    }
    const cached = await Promise.all(
      files.map((file: string) => caches.match(new URL(file, base), { ignoreSearch: true })),
    );
    const ready = cached.every(Boolean);
    if (ready) {
      cancelRetry();
      automaticRetries = 0;
      change({ status: 'ready', message: '' });
    } else {
      const missing = files.filter((_, index) => !cached[index]);
      change({
        status: 'error',
        message: `还有 ${missing.length} 个资源未缓存（${missing[0]}），请在设置中重试离线准备。`,
      });
    }
    return ready;
  } catch {
    change({ status: 'error', message: '离线资源检查失败，请联网后重试。' });
    return false;
  }
}

function register() {
  registerSW({
    immediate: true,
    onOfflineReady: () => void verifyOffline(),
    onNeedRefresh: () => {
      change({ needRefresh: true, dismissed: false, message: '' });
      void verifyOffline();
    },
    onRegisteredSW: (_, value) => {
      registration = value;
      if (value?.active) void verifyOffline();
      const watchInstall = () => {
        const worker = value?.installing;
        if (!worker) return;
        const stateChanged = () => {
          if (worker.state === 'installed' || worker.state === 'redundant')
            worker.removeEventListener('statechange', stateChanged);
          // 已成功安装的旧 worker 日后被替换也会 redundant，不能误报下载失败。
          if (worker.state === 'redundant' && value === registration) {
            change({
              message:
                snapshot.status === 'ready'
                  ? '离线资源下载未完成，请联网后重试。'
                  : '离线资源下载未完成，请在设置中重试离线准备。',
              ...(snapshot.status === 'ready' ? {} : { status: 'error' }),
            });
            if (snapshot.status !== 'ready') retryPreparation();
          }
        };
        worker.addEventListener('statechange', stateChanged);
        stateChanged();
      };
      watchInstall();
      value?.addEventListener('updatefound', watchInstall);
    },
    onRegisterError: () => {
      change({
        status: snapshot.status === 'ready' ? 'ready' : 'error',
        message: '离线资源尚未准备完成，请联网后重试。',
      });
      if (snapshot.status !== 'ready') retryPreparation();
    },
  });
}

export function startOffline() {
  if (started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    change({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined;
    change({ installed: true, canInstall: false });
  });
  window.addEventListener('offline', () => change({ online: false }));
  window.addEventListener('online', () => {
    change({ online: true });
    void checkOffline();
  });
  if (import.meta.env.DEV || !window.isSecureContext || !('serviceWorker' in navigator)) {
    change({ status: 'unavailable' });
    return;
  }
  register();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60_000)
      void checkOffline(false);
  });
}

export async function checkOffline(resetRetries = true) {
  if (snapshot.checking || snapshot.status === 'unavailable') return;
  if (resetRetries) {
    cancelRetry();
    automaticRetries = 0;
  }
  lastCheck = Date.now();
  change({ checking: true, message: '' });
  try {
    if (registration) {
      const ready = await verifyOffline();
      if (navigator.onLine) {
        // 缓存不完整时重新注册，以便重装当前版本的完整资源。
        if (!ready && !registration.waiting && !registration.installing) {
          await registration.unregister();
          registration = undefined;
          change({ status: 'preparing' });
          register();
        } else await registration.update();
      }
    } else {
      change({ status: 'preparing' });
      register();
    }
  } catch {
    change({
      message:
        snapshot.status === 'ready'
          ? '暂时无法检查更新，当前离线版本仍可使用。'
          : '离线资源尚未准备完成，请联网后重试。',
    });
  } finally {
    change({ checking: false });
  }
}

async function workerMessage(
  worker: ServiceWorker,
  type: string,
): Promise<{ ok: boolean; count: number }> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('暂时无法确认其他窗口状态，请稍后重试。'));
    }, 3000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timer);
      channel.port1.close();
      const value = event.data;
      if (
        typeof value === 'object' &&
        value !== null &&
        'ok' in value &&
        typeof value.ok === 'boolean' &&
        'count' in value &&
        typeof value.count === 'number'
      )
        resolve({ ok: value.ok, count: value.count });
      else reject(new Error('窗口状态无法确认，请稍后重试。'));
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

export async function ensureSingleWindow() {
  if (!registration?.active) return;
  const { count } = await workerMessage(registration.active, 'DIGIMON_CLIENTS');
  if (count > 1) throw new Error('请先关闭其他数码旅途窗口，再执行此操作。');
}

export async function activateUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) throw new Error('新版本尚未准备好，请重新检查更新。');
  const result = await workerMessage(waiting, 'DIGIMON_ACTIVATE');
  if (!result.ok) throw new Error('请先关闭其他数码旅途窗口，再更新。');
  // registerSW 的控制权切换监听负责重载，避免重复重载。
}

export function dismissUpdate() {
  change({ dismissed: true });
}

export async function installOffline() {
  if (!installPrompt || snapshot.installing) return;
  const prompt = installPrompt;
  change({ installing: true });
  try {
    await prompt.prompt();
    await prompt.userChoice;
    installPrompt = undefined;
    change({ canInstall: false });
  } catch {
    change({ message: '未能打开安装窗口，请使用浏览器菜单添加到主屏幕。' });
  } finally {
    change({ installing: false });
  }
}

export async function protectStorage(): Promise<string> {
  if (!navigator.storage?.persist) return '此浏览器未提供存储保护，仍可正常游玩。请保留存档备份。';
  try {
    const granted = await navigator.storage.persist();
    return granted
      ? '已开启存储保护；主动清除站点数据仍会删除进度，请保留备份。'
      : '浏览器暂未授予存储保护，仍可正常游玩。请保留存档备份。';
  } catch {
    return '暂时无法申请存储保护，仍可正常游玩。请保留存档备份。';
  }
}
