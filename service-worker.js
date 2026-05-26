// service-worker.js — CRM AddLife v7
// Arquitectura SPA + Offline First estable
// Compatible con:
// - Supabase
// - Samsung Internet
// - Chrome Android
// - PWA Install
// - Router SPA
// - Módulos dinámicos ESModules

const CACHE_NAME = 'crm-addlife-core-v8';

// ═══════════════════════════════════════════════════════════════
// CORE ASSETS
// ═══════════════════════════════════════════════════════════════

const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles.css',

    // Core
    '/app.js',
    '/db.js',
    '/utils.js',


    // Modules
    '/dashboard.js',
    '/prospeccion.js',
    '/referidos.js',
    '/actividad.js',
    '/cartera.js',
    '/comisiones.js',

    // Assets
    '/icon-192.png',
    '/icon-512.png'
];

// ═══════════════════════════════════════════════════════════════
// INSTALL
// ═══════════════════════════════════════════════════════════════

self.addEventListener('install', event => {
    console.log('[SW] Installing v7 - Forzando actualización de módulos');
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching core assets v7');
                return cache.addAll(CORE_ASSETS);
            })
            .catch(err => {
                console.error('[SW] Install Error', err);
            })
    );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE
// ═══════════════════════════════════════════════════════════════

self.addEventListener('activate', event => {
    console.log('[SW] Activating v7 - Limpiando cachés viejas');

    event.waitUntil(
        (async () => {
            // Eliminar cualquier caché que no sea la v7
            const keys = await caches.keys();
            await Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché obsoleta:', key);
                        return caches.delete(key);
                    }
                })
            );

            // Tomar control de las pestañas abiertas inmediatamente
            await self.clients.claim();

            // Forzar recarga de clientes para aplicar el nuevo JS
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach(client => {
                client.navigate(client.url);
            });
        })()
    );
});

// ═══════════════════════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════════════════════

self.addEventListener('fetch', event => {
    const req = event.request;

    // Solo interceptar peticiones GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // ═══════════════════════════════════════════
    // NEVER CACHE SUPABASE
    // ═══════════════════════════════════════════
    if (
        url.hostname.includes('supabase') ||
        url.pathname.includes('/auth/') ||
        url.pathname.includes('/rest/v1/') ||
        url.pathname.includes('/storage/v1/') ||
        url.pathname.includes('/functions/v1/')
    ) {
        event.respondWith(fetch(req));
        return;
    }

    // ═══════════════════════════════════════════
    // NEVER CACHE GOOGLE AUTH
    // ═══════════════════════════════════════════
    if (url.hostname.includes('google') || url.hostname.includes('gstatic')) {
        event.respondWith(fetch(req));
        return;
    }

    // ═══════════════════════════════════════════
    // JS MODULES → NETWORK FIRST
    // ═══════════════════════════════════════════
    if (req.url.endsWith('.js') || req.url.endsWith('.mjs')) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
                    return res;
                })
                .catch(async () => {
                    const cached = await caches.match(req);
                    return cached;
                })
        );
        return;
    }

    // ═══════════════════════════════════════════
    // HTML → NETWORK FIRST
    // ═══════════════════════════════════════════
    if (req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
                    return res;
                })
                .catch(async () => {
                    return (await caches.match(req)) || caches.match('/index.html');
                })
        );
        return;
    }

    // ═══════════════════════════════════════════
    // STATIC ASSETS → CACHE FIRST
    // ═══════════════════════════════════════════
    event.respondWith(
        caches.match(req).then(async cached => {
            if (cached) return cached;
            try {
                const fresh = await fetch(req);
                const clone = fresh.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
                return fresh;
            } catch (err) {
                console.error('[SW] Fetch Error:', err);
                throw err;
            }
        })
    );
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE CHANNEL
// ═══════════════════════════════════════════════════════════════

self.addEventListener('message', event => {
    if (!event.data) return;

    switch (event.data.type) {
        case 'SKIP_WAITING':
            console.log('[SW] Skip waiting solicitado');
            self.skipWaiting();
            break;

        case 'CLEAR_CACHE':
            console.log('[SW] Limpieza manual de caché solicitada');
            caches.keys().then(keys => {
                return Promise.all(keys.map(key => caches.delete(key)));
            });
            break;
    }
});

// ═══════════════════════════════════════════════════════════════
// ONLINE/OFFLINE
// ═══════════════════════════════════════════════════════════════

self.addEventListener('online', () => console.log('[SW] Back online'));
self.addEventListener('offline', () => console.log('[SW] Offline mode'));

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

self.addEventListener('error', event => console.error('[SW ERROR]', event));
self.addEventListener('unhandledrejection', event => console.error('[SW PROMISE ERROR]', event.reason));
