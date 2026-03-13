const CACHE = 'rundom-v4';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/privacy.html',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
];

// ── 설치: 앱 셸 캐싱 ─────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── 활성화: 구버전 캐시 삭제 ──────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── 요청 처리 ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase는 캐시하지 않음 (실시간 데이터)
  if (url.includes('firebaseio.com') || url.includes('firebase')) return;

  // CartoDB 지도 타일: 캐시 우선 (오프라인에서도 이미 본 타일 표시)
  if (url.includes('basemaps.cartocdn.com') || url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(resp => {
            if (resp.ok) c.put(e.request, resp.clone());
            return resp;
          })
        )
      )
    );
    return;
  }

  // 앱 셸 및 CDN: 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Background Sync: 오프라인 중 저장된 영토 재전송 ───────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-territories') {
    e.waitUntil(syncPendingTerritories());
  }
});

async function syncPendingTerritories() {
  // IndexedDB에서 pending 항목을 읽어 Firebase로 재전송
  // (앱에서 navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-territories')) 호출)
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TERRITORIES' });
  });
}
