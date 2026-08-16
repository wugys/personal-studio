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
const CACHE_VER = 'studio-v10-6';
// 頁面本身固定用這個 key 存，取用時也用它——不要用 './index.html'，
// Vercel 的 clean URL 會把 /index.html 308 轉到 /，快取比對會對不上。
const DOC_KEY = './';
const CORE = [
  DOC_KEY,
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // ⚠ 不要用 cache.addAll()——它是全有全無，**任何一個檔案 404 或被轉址，
  //   整批就全部失敗、快取留成空的，而且 SW 會卡在 installing 永遠不 active**。
  //   （實測就是這樣：線上有一個 404，結果離線完全打不開。）
  //   改成一個一個加、各自 catch，壞掉的那個不會拖垮其他人。
  //   ⚠⚠ 而且整段要包 try/catch。install 的 waitUntil 只要 reject 一次，
  //   SW 就直接變 redundant、**永遠不會 active**，離線功能整個不存在——
  //   而畫面上什麼錯都看不到（實測 CDP 才看到「event.waitUntil Promise rejected」）。
  //   預先快取只是「有更好」，絕對不該讓它有能力擋下安裝。
  e.waitUntil((async () => {
    try {
      const c = await caches.open(CACHE_VER);
      for (const u of CORE) {
        try {
          const r = await fetch(u, { cache: 'reload' });
          if (r && r.ok) await c.put(u, r);
        } catch (err) { /* 這個檔沒抓到就算了，不影響其他檔與安裝 */ }
      }
    } catch (err) { /* 連 caches 都開不了也不要擋安裝 */ }
    try { await self.skipWaiting(); } catch (err) {}
  })());
});

self.addEventListener('activate', e => {
  // 同上：activate 的 waitUntil 也不能 reject
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k).catch(() => {})));
    } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
  })());
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
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VER).then(c => c.put(DOC_KEY, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(DOC_KEY).then(r => r || Response.error()))
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
