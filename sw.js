const CACHE_NAME = 'video-motion-cache-v1';

// Your array remains exactly the same
const ASSETS_TO_CACHE = [
    'video/Day/f1.webm', 'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm', 'video/Day/r4.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

// 1. Install Event: Force strict step-by-step downloading
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('Service Worker: Starting sequential download...');
            
            // Using a for...of loop with await enforces strict chronological order
            for (const url of ASSETS_TO_CACHE) {
                try {
                    console.log(`Downloading: ${url}`);
                    // cache.add() fetches the file and saves it to cache sequentially
                    await cache.add(url); 
                } catch (error) {
                    console.error(`Failed to cache asset sequential order: ${url}`, error);
                }
            }
            
            console.log('Service Worker: All videos cached sequentially!');
        })
    );
    self.skipWaiting(); 
});

// 2. Fetch Event: Serving videos instantly out of Cache Storage
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});