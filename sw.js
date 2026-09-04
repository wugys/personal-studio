/* 個人工作室 · Service Worker
 *
 * 目的只有一個：讓 App 能「加到主畫面、沒網路也打得開」。
 * 資料本來就全在 localStorage，所以只要頁面載得進來，離線就能用。
 *
 * ⚠ 這裡的快取策略是刻意選的，改動前請先讀完：
 *
 * 1) 頁面本身 network-first，**但只等 DOC_TIMEOUT_MS**（v16.83 補的）。
 *    這個專案一天可能部署好幾次。如果用 cache-first，使用者會卡在舊版而且
 *    完全不知道為什麼——那是最難救的一種問題（要教他清網站資料）。
 *    但純 network-first 有個洞：`.catch()` 只在 fetch **丟錯**時才跑，
 *    而**「慢」不會丟錯**——網路掛住時是無限白畫面，明明快取裡就有一份。
 *    所以改成「先連線，等不到就先用快取，那個 fetch 照樣跑完去更新快取」：
 *    網路正常時仍然拿最新版，網路掛住時立刻能用，且下一次開就會是新的。
 *
 * 2) 只快取「自己網站的靜態檔」。
 *    所有 API（FinMind / Finnhub / CoinGecko / 匯率 / Supabase）一律不碰——
 *    快取報價等於給使用者看假的價格，比抓不到還糟。
 *
 * 3) 換版本只要改 CACHE_VER，activate 時會把舊的整批刪掉。
 */
const CACHE_VER = 'studio-v10-6';
// ⚠ v16.83 只改了 fetch 策略，**故意不動 CACHE_VER**：
//   換了名字 activate 會把舊快取整批刪掉，萬一使用者剛好在爛網路上更新到新 SW，
//   那一刻他手上就變成「沒有快取可用」——正好是這次要救的那個情境。
//
// 頁面等網路的上限。等不到就先把快取端出來（那個 fetch 仍會繼續跑完並更新快取）。
// ⚠ 這是「等**標頭**回來」的上限，不是下載完 2.2MB 的上限。
const DOC_TIMEOUT_MS = 2500;
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
    // 頁面：先連線，但**只等一下下**；等不到就先把快取那份端出來（v16.83）
    //
    // 🔴 以前是 `fetch().then().catch(用快取)`，而那個 `.catch` **只有 fetch 丟錯才會跑**。
    //   「慢」不會丟錯。（v16.55 在 AI 呼叫上踩過一模一樣的：全站 AbortController 是 0 個，
    //   於是「掛住」型故障永遠不會觸發備援，畫面無限轉圈。）
    //   真的會發生的三種：大陸把網址黑洞掉（丟封包但不回 RST，卡到 TCP 逾時可能兩分鐘）／
    //   飯店 wifi 連得上但不通外網／山區訊號一格。**而手機裡就有一份一模一樣的快取。**
    //
    // ⚠ 賽跑輸了**不是取消那個 fetch**——它照樣跑完，上面的 .then 會把新版寫進快取，
    //   所以下一次開就是新的。「永遠不會卡在舊版」這個承諾還在，只是慢的時候晚一輪。
    // ⚠ 手上沒有快取時**不設逾時**：那時候沒有比「繼續等」更好的東西可以給。
    // ⚠ 這道保護擋的是「連不上／不回應」。連得上但頻寬很慢（body 下載很久）擋不住——
    //   fetch 在**收到標頭**時就 resolve 了，2.2MB 的內容還是要慢慢流完。
    e.respondWith((async () => {
      const net = fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_VER).then(c => c.put(DOC_KEY, copy)).catch(() => {});
        }
        return resp;
      });
      // ⚠ 一定要先把 net 的失敗接住，否則會變成 SW 裡的 unhandled rejection
      const netSafe = net.catch(() => null);

      let cached = null;
      try { cached = await caches.match(DOC_KEY); } catch (err) { cached = null; }
      if (!cached) {
        const only = await netSafe;
        return only || Response.error();
      }

      let timer = null;
      const winner = await Promise.race([
        netSafe,
        new Promise(ok => { timer = setTimeout(() => ok(null), DOC_TIMEOUT_MS); })
      ]);
      if (timer) clearTimeout(timer);
      // 網路回了而且是好的 → 用網路的（最新版）
      // 網路逾時、丟錯、或回 4xx/5xx（例如主機掛了）→ 用快取那份還能動的
      return (winner && winner.ok) ? winner : cached;
    })());
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
