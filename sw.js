const CACHE_NAME = 'family-calendar-v4.5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/lunar-javascript@1.6.12/lunar.js'
];

// 安裝 Service Worker 並快取核心靜態資產
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 啟動並清理舊版本快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clientsClaim();
});

// 攔截網路請求，離線時自動讀取快取
self.addEventListener('fetch', (event) => {
    // 針對 Firestore 資料庫連線維持網路優先，靜態資源採用快取優先
    if (event.request.url.includes('firestore.googleapis.com')) {
        return; 
    }
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                // 如果完全斷線且無快取時的防護
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});