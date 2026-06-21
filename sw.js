const CACHE_NAME = 'video-motion-cache-v1';

const ASSETS_TO_CACHE = [
    'video/Day/f1.webm',
    'video/Day/r4.webm',
    'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

let isPaused = false;

// Listen for priority interruption messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PRIORITIZE_ASSET') {
        console.log(`[SW] Pausing background sync to prioritize: ${event.data.url}`);
        isPaused = true;
        // Resume background operations after a short delay (e.g., 2.5 seconds)
        setTimeout(() => {
            isPaused = false;
        }, 2500);
    }
});

// Helper function to sleep/yield execution control
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('Service Worker: Starting prioritized sequential download...');
            
            for (const url of ASSETS_TO_CACHE) {
                // If the main thread signaled a priority, wait here until the network is clear
                while (isPaused) {
                    await delay(200); 
                }

                try {
                    const alreadyCached = await cache.match(url);
                    if (alreadyCached) {
                        continue; 
                    }

                    console.log(`Downloading in background loop: ${url}`);
                    await cache.add(url); 
                } catch (error) {
                    console.error(`Failed to cache asset in sequence: ${url}`, error);
                }
            }
            console.log('Service Worker: All videos cached successfully!');
        })
    );
    self.skipWaiting(); 
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('.webm')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                try {
                    // Cache miss: Pull cleanly from network since background download is paused
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (err) {
                    return fetch(event.request);
                }
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
self.addEventListener('activate', (event) => {
    // Forces the waiting service worker to become the active service worker
    event.waitUntil(self.clients.claim());
    console.log('[SW] Claimed clients, active and ready for messages.');
});