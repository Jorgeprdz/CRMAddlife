// app.js - Núcleo de la aplicación
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';

// ==========================================
// 1. PWA — SERVICE WORKER
// ==========================================
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.error('SW error:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Intentar mostrar el botón si el login ya está renderizado
    mostrarBotonInstalar();
});

function mostrarBotonInstalar() {
    const btn = document.getElementById('btn-install-app');
    if (!btn) return;
    const esAndroid = /android/i.test(navigator.userAgent);
    const yaInstalada = window.matchMedia('(display-mode: standalone)').matches;
    if (esAndroid && !yaInstalada && deferredPrompt) {
        btn.style.display = 'flex';
    }
}

// ==========================================
// 2. SUPABASE — CLIENTE ÚNICO
// ==========================================
const SUPABASE_URL  = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';

let _supabase = null;

// Función exportada — cualquier módulo que necesite Supabase usa esta
export function getSupabase() {
    if (_supabase) return _supabase;
    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        return _supabase;
    }
    return null;
}

async function esperarSupabase() {
    let intentos = 0;
    while (!getSupabase() && intentos < 20) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    return getSupabase();
}

// ==========================================
// 3. GEMINI IA — vía Edge Function de Supabase
// La key NUNCA toca el cliente. Vive en Supabase Secrets.
// ==========================================
export async function callGemini(promptText, outputElementId) {
    const output = document.getElementById(outputElementId);
    if (output) output.innerText = 'Procesando con IA...';

    const sb = getSupabase();
    if (!sb) {
        if (output) output.innerText = 'Error: Supabase no inicializado.';
        return;
    }

    try {
        const { data, error } = await sb.functions.invoke('gemini-proxy', {
            body: { prompt: promptText }
        });

        if (error) throw new Error(error.message);

        // Soporta dos formatos de respuesta posibles de la Edge Function:
        // { candidates: [...] }  → respuesta raw de Gemini
        // { text: "..." }        → respuesta simplificada
        const texto =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            data?.text ||
            'Sin respuesta de la IA.';

        if (output) output.innerText = texto;

    } catch (err) {
        if (output) output.innerText = 'Error IA: ' + err.message;
    }
}
window.callGemini = callGemini;

// ==========================================
// 4. VISTAS: LOGIN vs APP
// ==========================================
let appInicializada = false;

function mostrarApp() {
    document.getElementById('main-nav')?.classList.remove('nav-oculto');
    document.getElementById('main-header')?.classList.remove('nav-oculto');
    iniciarTemporizadorInactividad();
    if (!appInicializada) {
        appInicializada = true;
        window.navigateTo('dashboard');
    }
}

function mostrarLogin() {
    appInicializada = false;
    detenerTemporizadorInactividad();
    document.getElementById('main-nav')?.classList.add('nav-oculto');
    document.getElementById('main-header')?.classList.add('nav-oculto');

    const content = document.getElementById('app-content');
    if (!content) return;

    content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:85vh;text-align:center;">
            <div class="card" style="max-width:380px;width:90%;padding:2.5rem;">
                <h1 style="margin-bottom:0.5rem;font-size:2rem;letter-spacing:-0.5px;">CRM Addlife</h1>
                <p style="color:#8E8E93;margin-bottom:2rem;font-size:0.95rem;">Ecosistema Privado de Asesoría</p>

                <button id="btn-google-login" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:12px;border:none;background:#007AFF;color:white;font-weight:600;font-size:16px;cursor:pointer;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="18" height="18" alt="Google">
                    Continuar con Google
                </button>

                <button id="btn-install-app" style="display:none;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:12px;border:2px dashed #007AFF;background:transparent;color:var(--text-main);font-weight:600;font-size:16px;cursor:pointer;margin-top:15px;">
                    📲 Instalar App
                </button>
            </div>
        </div>
    `;

    // Login con Google
    document.getElementById('btn-google-login').addEventListener('click', async () => {
        const sb = getSupabase();
        if (!sb) return alert('Error de conexión.');
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) alert('Error: ' + error.message);
    });

    // Botón instalar — solo Android
    mostrarBotonInstalar();
    document.getElementById('btn-install-app')?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('btn-install-app').style.display = 'none';
        }
        deferredPrompt = null;
    });
}

// ==========================================
// 5. CIERRE DE SESIÓN
// ==========================================
async function cerrarSesion() {
    localStorage.removeItem('actividad_temporal');
    detenerTemporizadorInactividad();
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    // onAuthStateChange detecta SIGNED_OUT y llama mostrarLogin()
}

// ==========================================
// 6. TEMPORIZADOR DE INACTIVIDAD (10 min)
// ==========================================
const TIEMPO_ADVERTENCIA_MS = 9 * 60 * 1000;
const TIEMPO_CIERRE_MS      = 10 * 60 * 1000;

let timerAdvertencia = null;
let timerCierre      = null;
let toastVisible     = false;

function crearToast() {
    if (document.getElementById('inactivity-toast')) return;
    const t = document.createElement('div');
    t.id = 'inactivity-toast';
    t.innerHTML = `⏳ Sesión inactiva — cierra en <strong id="toast-countdown">60</strong>s.<br>
        <span style="font-size:12px;color:#FF9500;">Toca cualquier parte para continuar.</span>`;
    document.body.appendChild(t);
}

function mostrarToast() {
    crearToast();
    const toast = document.getElementById('inactivity-toast');
    if (!toast) return;
    toast.style.display = 'block';
    toastVisible = true;
    let seg = 60;
    const el = document.getElementById('toast-countdown');
    toast._intervalo = setInterval(() => {
        seg--;
        if (el) el.textContent = seg;
        if (seg <= 0) clearInterval(toast._intervalo);
    }, 1000);
}

function ocultarToast() {
    const toast = document.getElementById('inactivity-toast');
    if (!toast) return;
    if (toast._intervalo) clearInterval(toast._intervalo);
    toast.style.display = 'none';
    toastVisible = false;
}

function reiniciarTimer() {
    if (toastVisible) ocultarToast();
    clearTimeout(timerAdvertencia);
    clearTimeout(timerCierre);
    timerAdvertencia = setTimeout(mostrarToast, TIEMPO_ADVERTENCIA_MS);
    timerCierre      = setTimeout(cerrarSesion, TIEMPO_CIERRE_MS);
}

const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

function iniciarTemporizadorInactividad() {
    crearToast();
    EVENTOS_ACTIVIDAD.forEach(ev => document.addEventListener(ev, reiniciarTimer, { passive: true }));
    reiniciarTimer();
}

function detenerTemporizadorInactividad() {
    clearTimeout(timerAdvertencia);
    clearTimeout(timerCierre);
    ocultarToast();
    EVENTOS_ACTIVIDAD.forEach(ev => document.removeEventListener(ev, reiniciarTimer));
}

// ==========================================
// 7. NAVEGACIÓN
// ==========================================
const TITULOS = {
    dashboard:   '🏠 Inicio',
    prospeccion: '💬 Prospección',
    referidos:   '👥 Referidos',
    actividad:   '📊 Actividad',
    cartera:     '💼 Cartera',
};

window.navigateTo = function(moduleName) {
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    document.querySelectorAll('.nav-btn[data-target]').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-target="${moduleName}"]`)?.classList.add('active');

    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = TITULOS[moduleName] || 'CRM Addlife';

    contentArea.innerHTML = '';

    const modulos = {
        dashboard:   [renderDashboard,   bindDashboardEvents],
        prospeccion: [renderProspeccion, bindProspeccionEvents],
        referidos:   [renderReferidos,   bindReferidosEvents],
        actividad:   [renderActividad,   bindActividadEvents],
        cartera:     [renderCartera,     bindCarteraEvents],
    };

    const mod = modulos[moduleName];
    if (mod) {
        try {
            contentArea.innerHTML = mod[0]();
            setTimeout(() => mod[1](), 50);
        } catch (e) {
            console.error('Error al renderizar módulo:', e);
            contentArea.innerHTML = `<div class="card" style="color:red;"><p>${e.message}</p></div>`;
        }
    } else {
        contentArea.innerHTML = `<div class="card"><h2>${moduleName}</h2><p>Módulo en construcción.</p></div>`;
    }
};

// ==========================================
// 8. SISTEMA DE TEMAS — selector + dark/light
// ==========================================

// Temas que soportan toggle dark/light
const TEMAS_CON_TOGGLE = ['oneui', 'slate'];

// Clases CSS que cada tema aplica al body
const TEMA_CLASES = {
    oneui:    [],
    material: ['theme-material'],
    slate:    ['theme-slate'],
    aurora:   ['theme-aurora'],
};

function aplicarTema(tema, dark) {
    // 1. Limpiar todas las clases de tema anteriores
    document.body.classList.remove('theme-material', 'theme-slate', 'theme-aurora', 'dark');

    // 2. Aplicar clases del nuevo tema
    TEMA_CLASES[tema]?.forEach(cls => document.body.classList.add(cls));

    // 3. Dark mode solo en temas que lo soportan
    const toggle        = document.getElementById('theme-toggle');
    const toggleWrapper = document.getElementById('toggle-wrapper');
    const icon          = document.getElementById('theme-icon');
    const meta          = document.getElementById('meta-theme-color');

    const soportaDark = TEMAS_CON_TOGGLE.includes(tema);

    if (toggleWrapper) {
        toggleWrapper.classList.toggle('toggle-hidden', !soportaDark);
    }

    if (tema === 'aurora') {
        // Aurora: siempre oscuro
        document.body.classList.add('dark');
        if (meta) meta.setAttribute('content', '#080C14');
    } else if (tema === 'material') {
        // Material: siempre claro
        if (meta) meta.setAttribute('content', '#FFFBFE');
    } else if (soportaDark) {
        const isDark = dark ?? (localStorage.getItem('dark') === 'true');
        document.body.classList.toggle('dark', isDark);
        if (toggle) toggle.checked = isDark;
        if (icon)   icon.textContent = isDark ? '🌙' : '☀️';
        if (meta)   meta.setAttribute('content', isDark ? '#0A0A0F' : tema === 'slate' ? '#F8F9FA' : '#F2F2F7');
    }

    // 4. Marcar dot activo
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.theme === tema);
    });

    // 5. Persistir
    localStorage.setItem('tema', tema);
}

function iniciarDarkMode() {
    const toggle = document.getElementById('theme-toggle');
    const icon   = document.getElementById('theme-icon');
    const meta   = document.getElementById('meta-theme-color');

    // Recuperar preferencias guardadas
    const temaGuardado = localStorage.getItem('tema') || 'oneui';
    const darkGuardado = localStorage.getItem('dark') === 'true';

    // Aplicar tema inicial
    aplicarTema(temaGuardado, darkGuardado);

    // Toggle dark/light
    toggle?.addEventListener('change', () => {
        const isDark = toggle.checked;
        localStorage.setItem('dark', isDark);
        document.body.classList.toggle('dark', isDark);
        if (icon) icon.textContent = isDark ? '🌙' : '☀️';

        const temaActual = localStorage.getItem('tema') || 'oneui';
        if (meta) {
            meta.setAttribute('content',
                isDark
                    ? '#0A0A0F'
                    : temaActual === 'slate' ? '#F8F9FA' : '#F2F2F7'
            );
        }
    });

    // Selector de temas — dots
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const tema = dot.dataset.theme;
            const isDark = localStorage.getItem('dark') === 'true';
            aplicarTema(tema, isDark);
        });
    });
}

// ==========================================
// 9. ARRANQUE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {

    // Dark mode primero para evitar flash blanco
    iniciarDarkMode();

    // Delegación de eventos del nav
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#btn-cerrar-sesion')) {
            if (confirm('¿Cerrar sesión?')) cerrarSesion();
            return;
        }
        const navBtn = e.target.closest('.nav-btn[data-target]');
        if (navBtn) {
            e.preventDefault();
            window.navigateTo(navBtn.getAttribute('data-target'));
        }
    });

    // Esperar SDK de Supabase (carga desde CDN)
    const sb = await esperarSupabase();
    if (!sb) {
        document.getElementById('app-content').innerHTML =
            `<div class="card" style="color:red;"><h2>Error de conexión</h2><p>El SDK de Supabase no cargó. Revisa tu internet.</p></div>`;
        return;
    }

    // Estado inicial de sesión
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        mostrarApp();
    } else {
        mostrarLogin();
    }

    // Escuchar cambios futuros (login / logout)
    sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN')  mostrarApp();
        if (event === 'SIGNED_OUT') mostrarLogin();
    });
});
