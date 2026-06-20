const CACHE_NAME = 'video-motion-cache-v1';

// List every video file you want to cache permanently
const ASSETS_TO_CACHE = [
    'video/Day/f1.webm', 'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm', 'video/Day/r4.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

// 1. Install Event: Save all videos to persistent cache immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Permanent caching video assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); 
});

// 2. Fetch Event: Intercept fetch requests and serve videos from Cache instantly
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached file if found; otherwise pull from network
            return cachedResponse || fetch(event.request);
        })
    );
});