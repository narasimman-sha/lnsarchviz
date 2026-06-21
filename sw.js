const CACHE_NAME = 'video-motion-cache-v1';

const ASSETS_TO_CACHE = [
    'video/Day/f1.webm', 'video/Day/r4.webm',
    'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

let isPaused = false;
let currentAbortController = null;

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PRIORITIZE_ASSET') {
        console.warn(`[SW] Interruption requested! Aborting current download to prioritize: ${event.data.url}`);
        isPaused = true;
        
        // INSTANTLY KILL the current background download request
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }

        // Resume sequential background downloads automatically after 3.5 seconds
        setTimeout(() => {
            isPaused = false;
        }, 3500);
    }
});

// Helper delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('Service Worker: Starting background download engine...');
            
            for (const url of ASSETS_TO_CACHE) {
                // If paused by a user interaction, sleep here
                while (isPaused) {
                    await delay(250);
                }

                try {
                    const alreadyCached = await cache.match(url);
                    if (alreadyCached) continue;

                    // Set up a cancellable fetch
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
                        // Put the aborted asset back in the loop queue implicitly by not continuing
                    } else {
                        console.error(`Failed to cache asset: ${url}`, error);
                    }
                } finally {
                    currentAbortController = null;
                }
                
                // If it was aborted due to user priority, retry this asset later when unpaused
                if (isPaused) {
                    const index = ASSETS_TO_CACHE.indexOf(url);
                    ASSETS_TO_CACHE.splice(index, 1); 
                    ASSETS_TO_CACHE.push(url); // Push to the back of the queue to retry later
                }
            }
            console.log('Service Worker: Background sync cycle cleared.');
        })
    );
    self.skipWaiting();
});

// Fetch event intercepts priority requests clean and fast
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('.webm')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                try {
                    // With background network connections aborted, this priority request goes through instantly
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
    event.waitUntil(self.clients.claim());
});