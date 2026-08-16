/* 個人工作室 · Service Worker
 *
 * 目的只有一個：讓 App 能「加到主畫面、沒網路也打得開」。
 * 資料本來就全在 localStorage，所以只要頁面載得進來，離線就能用。
 *
 * ⚠ 這裡的快取策略是刻意選的，改動前請先讀完：
 *
 * 1) 頁面本身一律 network-first。
 *    這個專案一天可能部署好幾次。如果用 cache-first，使用者會卡在舊版而且
 *    完全不知道為什麼——那是最難救的一種問題（要教他清網站資料）。
 *    network-first 的代價只是「有網路時多等幾十毫秒」，換來的是永遠不會卡舊版。
 *
 * 2) 只快取「自己網站的靜態檔」。
 *    所有 API（FinMind / Finnhub / CoinGecko / 匯率 / Supabase）一律不碰——
 *    快取報價等於給使用者看假的價格，比抓不到還糟。
 *
 * 3) 換版本只要改 CACHE_VER，activate 時會把舊的整批刪掉。
 */
const CACHE_VER = 'studio-v10-5';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // 預先抓好核心檔案，第一次安裝完就能離線開
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(c => c.addAll(CORE).catch(() => {}))   // 任何一個抓不到都不要讓安裝整個失敗
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只管自己網站的東西；外部 API 與 CDN 一律放行，不快取也不攔截
  if (url.origin !== self.location.origin) return;

  const isDoc = req.mode === 'navigate' || (req.destination === 'document');

  if (isDoc) {
    // 頁面：先連線，失敗才用快取（永遠不會卡在舊版）
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_VER).then(c => c.put('./index.html', copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 靜態小檔（圖示、manifest）：先用快取，背景更新
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_VER).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
