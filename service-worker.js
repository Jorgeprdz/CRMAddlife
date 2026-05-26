// service-worker.js — CRM AddLife v5
// Cache inteligente + auto refresh + invalidación segura
// Optimizado para Android, Samsung Internet y PWAs

const CACHE_NAME = 'crm-addlife-core-v5';

const CORE_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',

    // Core
    '/app.js',
    '/db.js',
    '/utils.js',
    '/sync.js',

    // Módulos
    '/cartera.js',
    '/clientes.js',
    '/comisiones.js',
    '/agenda.js',
    '/pipeline.js',

    // Assets
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// ═══════════════════════════════════════════════════════════════
// INSTALL
// ═══════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {

    console.log('[SW] Installing...');

    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {

                console.log('[SW] Caching core assets');

                return cache.addAll(CORE_ASSETS);

            })
            .catch(err => {
                console.error('[SW] Install error:', err);
            })
    );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE
// ═══════════════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {

    console.log('[SW] Activating...');

    event.waitUntil(

        caches.keys().then(async keys => {

            await Promise.all(

                keys.map(key => {

                    if (key !== CACHE_NAME) {

                        console.log('[SW] Removing old cache:', key);

                        return caches.delete(key);
                    }
                })
            );

            // Fuerza refresh de TODOS los clientes
            const clients = await self.clients.matchAll();

            clients.forEach(client => {
                client.navigate(client.url);
            });

            return self.clients.claim();

        })
    );
});

// ═══════════════════════════════════════════════════════════════
// FETCH STRATEGY
// ═══════════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {

    const req = event.request;

    // Solo GET
    if (req.method !== 'GET') return;

    // Ignorar Supabase/Auth/API
    if (
        req.url.includes('/auth/') ||
        req.url.includes('/rest/v1/') ||
        req.url.includes('supabase') ||
        req.url.includes('googleapis')
    ) {
        return;
    }

    // JS MODULES → Network First
    if (
        req.url.endsWith('.js') ||
        req.url.endsWith('.mjs')
    ) {

        event.respondWith(

            fetch(req)
                .then(res => {

                    const clone = res.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(req, clone);
                        });

                    return res;

                })
                .catch(() => caches.match(req))
        );

        return;
    }

    // HTML → Network First
    if (
        req.headers.get('accept')?.includes('text/html')
    ) {

        event.respondWith(

            fetch(req)
                .then(res => {

                    const clone = res.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(req, clone);
                        });

                    return res;

                })
                .catch(async () => {

                    return (
                        await caches.match(req)
                    ) || caches.match('/index.html');

                })
        );

        return;
    }

    // STATIC → Cache First
    event.respondWith(

        caches.match(req)
            .then(cached => {

                if (cached) return cached;

                return fetch(req)
                    .then(res => {

                        const clone = res.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(req, clone);
                            });

                        return res;

                    });

            })
    );
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE CHANNEL
// ═══════════════════════════════════════════════════════════════

self.addEventListener('message', (event) => {

    if (!event.data) return;

    switch (event.data.type) {

        case 'SKIP_WAITING':

            console.log('[SW] Skip waiting');

            self.skipWaiting();

            break;

        case 'CLEAR_CACHE':

            console.log('[SW] Clearing cache');

            caches.keys().then(keys => {

                keys.forEach(key => {
                    caches.delete(key);
                });

            });

            break;
    }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

self.addEventListener('error', (event) => {

    console.error('[SW ERROR]', event);

});

self.addEventListener('unhandledrejection', (event) => {

    console.error('[SW PROMISE ERROR]', event.reason);

});