// ==========================================
// PWA: SERVICE WORKER E INSTALACIÓN
// ==========================================
let deferredPrompt;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.error('Error al registrar SW:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Evita que Chrome muestre el mini-infobar automáticamente
    e.preventDefault();
    // Guarda el evento para usarlo en nuestro botón
    deferredPrompt = e;
    
    // Si el botón ya está en pantalla, lo mostramos
    const installBtn = document.getElementById('btn-install-app');
    if (installBtn) installBtn.style.display = 'flex';
});
