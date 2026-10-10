// 只统计本游戏作用域内的窗口，切换前再次检查，防止刷新另一个窗口的战斗。
self.addEventListener('message', (event) => {
  if (!['DIGIMON_CLIENTS', 'DIGIMON_ACTIVATE'].includes(event.data?.type)) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const count = windows.filter((client) => client.url.startsWith(self.registration.scope)).length;
      const activate = event.data.type === 'DIGIMON_ACTIVATE';
      const ok = !activate || count === 1;
      event.ports[0]?.postMessage({ ok, count });
      if (activate && ok) await self.skipWaiting();
    })(),
  );
});
