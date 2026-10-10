import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Plugin } from 'vite';

// 和正式构建一起生成资源清单，用于确认整包已缓存，而非仅首页已打开。
function offlineFiles(): Plugin {
  let publicDir = '';
  let outDir = '';
  return {
    name: 'digimon-offline-files',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_, bundle) {
      const publicFiles = readdirSync(publicDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          relative(publicDir, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/'),
        );
      const files = [...new Set([...Object.keys(bundle), ...publicFiles, 'manifest.webmanifest'])]
        .filter((file) => !file.endsWith('.map'))
        .sort();
      this.emitFile({
        type: 'asset',
        fileName: 'offline-files.json',
        source: JSON.stringify(files),
      });
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        // 等 PWA 插件生成完毕再核对；新资源遗漏或超大小限制时阻止发布残缺离线包。
        const files = JSON.parse(
          readFileSync(resolve(outDir, 'offline-files.json'), 'utf8'),
        ) as string[];
        const worker = readFileSync(resolve(outDir, 'sw.js'), 'utf8');
        const cached = new Set([...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]));
        const missing = [...files, 'offline-files.json'].filter((file) => !cached.has(file));
        if (missing.length)
          this.error(`离线资源未完整缓存，请检查缓存范围和单文件大小限制：${missing.join('、')}`);
      },
    },
  };
}
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: './',
        name: '数码旅途',
        short_name: '数码旅途',
        description: '与数码兽搭档一起探索、构筑卡组和进化的离线冒险。',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#101d23',
        background_color: '#101d23',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'digimon-journey',
        globPatterns: ['**/*.{html,js,css,png,jpg,jpeg,svg,json,txt,webmanifest}'],
        globIgnores: ['**/tests/**', '**/previews/**', '**/*.map'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\.[a-z0-9]+$/i],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: true,
        importScripts: ['pwa-guard.js'],
      },
      devOptions: { enabled: false },
    }),
    offlineFiles(),
  ],
  base: './',
  server: { port: 5177, strictPort: true },
});
