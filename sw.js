const CACHE_NAME = 'video-motion-cache-v1';

// 1. REORDER THIS ARRAY: Put your two critical initial steps at the very top!
const ASSETS_TO_CACHE = [
    'video/Day/f1.webm',  // First step forward
    'video/Day/r4.webm',  // First step backward (if user goes right initially)
    
    // The rest follow sequentially
    'video/Day/f2.webm', 'video/Day/f3.webm', 'video/Day/f4.webm',
    'video/Day/r1.webm', 'video/Day/r2.webm', 'video/Day/r3.webm',
    'video/Night/f1.webm', 'video/Night/f2.webm', 'video/Night/f3.webm', 'video/Night/f4.webm',
    'video/Night/r1.webm', 'video/Night/r2.webm', 'video/Night/r3.webm', 'video/Night/r4.webm'
];

// 2. MODIFIED Install Event: Allows files to be requested out-of-turn
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('Service Worker: Starting prioritized sequential download...');
            
            for (const url of ASSETS_TO_CACHE) {
                try {
                    // Check if the user already bypassed the queue and forced a download of this file via click
                    const alreadyCached = await cache.match(url);
                    if (alreadyCached) {
                        console.log(`Skipping queue for ${url}, already downloaded via user interaction.`);
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

// 3. UPDATED Fetch Event: Gives VIP treatment to active requests
self.addEventListener('fetch', (event) => {
    // Only intercept your webm files
    if (event.request.url.includes('.webm')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                
                // If it's already in the cache, serve it instantly (0ms)
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // CRITICAL FIX: If it's NOT cached, jump the queue and fetch it from network immediately.
                // We also save it to the cache right here so it's ready for next time.
                console.warn(`User clicked an uncached video! Interrupting network queue for: ${event.request.url}`);
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone()); // Save for offline reuse
                    }
                    return networkResponse;
                } catch (err) {
                    // Fallback to fetch directly if something goes weird
                    return fetch(event.request);
                }
            })
        );
        return; // Exit out of the generic handler below
    }

    // Default fallback handling for index.html, JS, and CSS files
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});