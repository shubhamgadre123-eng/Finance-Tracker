/**
 * Finance Tracker - Service Worker
 * Enables offline functionality and caching for PWA
 */

const CACHE_NAME = 'finance-tracker-v1';
const API_CACHE_NAME = 'finance-tracker-api-v1';
const urlsToCache = [
    '/',
    '/Finance%20Tracker.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app assets');
            return cache.addAll(urlsToCache).catch((error) => {
                console.warn('[Service Worker] Error caching assets:', error);
                // Continue even if some assets fail
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // API calls - network first, fallback to cache
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful API responses
                    if (response.status === 200) {
                        const cache = caches.open(API_CACHE_NAME);
                        cache.then((c) => c.put(request, response.clone()));
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached API response if network fails
                    return caches.match(request).then((response) => {
                        if (response) {
                            console.log('[Service Worker] Serving API from cache:', request.url);
                            return response;
                        }
                        // Return offline response
                        return new Response(
                            JSON.stringify({ error: 'Offline - cached data not available' }),
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: new Headers({
                                    'Content-Type': 'application/json'
                                })
                            }
                        );
                    });
                })
        );
        return;
    }

    // Static assets - cache first, fallback to network
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    // Update cache in background
                    fetch(request).then((newResponse) => {
                        if (newResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, newResponse);
                            });
                        }
                    }).catch(() => {
                        // Network error, use cached version
                    });
                    return response;
                }

                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page if available
                        return caches.match('/')
                            .then((response) => response || new Response('Offline'));
                    });
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SYNC_DATA') {
        // Background sync could be triggered here
        console.log('[Service Worker] Data sync requested');
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(API_CACHE_NAME).then(() => {
                console.log('[Service Worker] API cache cleared');
            })
        );
    }
});

// Background sync registration (if available)
if ('sync' in self.registration) {
    self.addEventListener('sync', (event) => {
        if (event.tag === 'sync-data') {
            console.log('[Service Worker] Background sync triggered');
            event.waitUntil(
                // Notify clients to sync their data
                self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({
                            type: 'SYNC_REQUEST',
                            data: null
                        });
                    });
                })
            );
        }
    });
}

console.log('[Service Worker] Loaded successfully');
