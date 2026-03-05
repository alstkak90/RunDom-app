const CACHE = 'running-game-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
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

  // 지도 타일: 캐시 우선 (오프라인에서도 이미 본 타일 표시)
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(resp => {
            c.put(e.request, resp.clone());
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
        // 성공 응답은 캐시에도 저장
        if (resp.ok) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
