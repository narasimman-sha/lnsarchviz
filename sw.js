const CACHE_NAME = 'video-motion-cache-v1';

// CRITICAL files required to get the app functional instantly
const CRITICAL_ASSETS = [
    'video/Day/f1.webm',
    'video/Day/r4.webm'
];

// The remaining assets to download sequentially in the background AFTER activation
const BACKGROUND_ASSETS = [
    'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

let isPaused = false;
let currentAbortController = null;

// Listen for priority interruption messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PRIORITIZE_ASSET') {
        console.warn(`[SW] Interruption requested! Aborting current background sync to prioritize: ${event.data.url}`);
        isPaused = true;
        
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }

        // Resume background sync automatically after 3.5 seconds
        setTimeout(() => {
            isPaused = false;
        }, 3500);
    }
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Install Event: ONLY cache critical startup files so it finishes in a split second
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching critical immediate assets...');
            return cache.addAll(CRITICAL_ASSETS);
        })
    );
    self.skipWaiting(); // Force it to move to activation immediately
});

// 2. Activate Event: Take full page control, THEN fire the background downloader
self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('[SW] Worker active & controlling page. Starting background loop...');
            // Notice we do NOT await this function; we run it asynchronously in the background
            runBackgroundDownloadSync();
        })
    );
});

// Main loop handling asynchronous non-blocking downloads
async function runBackgroundDownloadSync() {
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of BACKGROUND_ASSETS) {
        while (isPaused) {
            await delay(250);
        }

        try {
            const alreadyCached = await cache.match(url);
            if (alreadyCached) continue;

            currentAbortController = new AbortController();
            console.log(`[SW] Downloading in background: ${url}`);
            
            const response = await fetch(url, { signal: currentAbortController.signal });
            if (response.ok) {
                await cache.put(url, response);
                console.log(`[SW] Successfully cached: ${url}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`[SW] Safely aborted background download for: ${url}`);
            } else {
                console.error(`Failed to cache asset: ${url}`, error);
            }
        } finally {
            currentAbortController = null;
        }

        // Re-queue item if it was skipped or aborted mid-download
        if (isPaused) {
            const index = BACKGROUND_ASSETS.indexOf(url);
            if (index !== -1) {
                BACKGROUND_ASSETS.splice(index, 1);
                BACKGROUND_ASSETS.push(url);
            }
        }
    }
    console.log('[SW] All background sync cycles cleared.');
}

// 3. Fetch Event Handler
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('.webm')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                try {
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