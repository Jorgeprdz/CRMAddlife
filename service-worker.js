// /service-worker.js - Arquitectura Offline-First (Stale-While-Revalidate)

const CACHE_NAME = 'crm-addlife-core-v4';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/db.js',
    '/utils.js',
    '/dashboard.js',
    '/prospeccion.js',
    '/referidos.js',
    '/actividad.js',
    '/cartera.js',
    '/comisiones.js',
    '/manifest.json'
];

// 1. INSTALACIÓN: Precarga de activos críticos
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Obliga al SW a activarse inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-cacheando arquitectura core');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. ACTIVACIÓN: Limpieza de cachés obsoletos para evitar bloqueos de versión
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Purgando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. INTERCEPTOR DE RED: Estrategia Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // EXCEPCIÓN CRÍTICA: Nunca interceptar llamadas a Supabase o Gemini APIs
    if (url.origin.includes('supabase.co') || url.pathname.includes('/api/')) {
        return; // Deja que el navegador o db.js lo manejen
    }

    // EXCEPCIÓN: Extensiones de Chrome
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                // Si la red responde bien, actualizamos el caché silenciosamente
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Falla de red silenciosa, ya entregamos el caché local
                console.warn('[Service Worker] Red inaccesible, sirviendo desde caché.');
            });

            // Retorna instantáneamente la versión cacheada si existe, si no, espera a la red
            return cachedResponse || fetchPromise;
        })
    );
});
