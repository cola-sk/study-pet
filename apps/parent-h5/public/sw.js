// 学习宠物助手 - 自定义轻量级 Service Worker
const CACHE_NAME = 'study-pet-pwa-v6';

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico?v=3',
  '/icons/paw-app-icon.svg?v=3',
  '/icons/apple-touch-icon.png?v=3',
  '/icons/icon-192x192.png?v=3',
  '/icons/icon-512x512.png?v=3',
  '/icons/icon-maskable-512x512.png?v=3',
  '/icons/shortcut-task.png?v=3',
  '/icons/shortcut-add.png?v=3',
  '/splash/launch-screen.png?v=3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 对于 API 请求，优先网络请求
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 静态图片和图标走 CacheFirst
  if (/\.(png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // 页面导航走 NetworkFirst (网络优先，离线时降级使用本地缓存)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
