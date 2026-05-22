const CACHE_NAME = 'addlife-cache-v3';

const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db.js',
    './utils.js',
    './dashboard.js',
    './prospeccion.js',
    './referidos.js',
    './actividad.js',
    './cartera.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Activa inmediatamente sin esperar
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    // Limpia caches viejos
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim(); // Toma control de todas las pestañas abiertas
});

self.addEventListener('fetch', event => {
    // Las Edge Functions de Supabase siempre van a la red, nunca al cache
    if (event.request.url.includes('supabase.co/functions')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
