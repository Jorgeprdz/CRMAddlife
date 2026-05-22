// app.js - Núcleo de la aplicación
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';

// ==========================================
// 1. CONFIGURACIÓN SUPABASE
// ==========================================
const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';

let supabase = null;
let appInicializada = false; // Control crítico para evitar rebotes cíclicos al Dashboard

function inicializarSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        window.supabaseClient = supabase; // Exposición global indispensable para el motor cloud en db.js
        return true;
    }
    return false;
}

// ==========================================
// 2. VISTAS: LOGIN vs APP
// ==========================================
function mostrarApp() {
    const nav = document.getElementById('main-nav');
    const header = document.getElementById('main-header');
    if (nav) nav.classList.remove('nav-oculto');
    if (header) header.classList.remove('nav-oculto');
    iniciarTemporizadorInactividad();
    
    // Solo fuerza la navegación inicial al dashboard si la aplicación no se ha montado antes
    if (!appInicializada) {
        appInicializada = true;
        window.navigateTo('dashboard');
    }
}

function mostrarLogin() {
    appInicializada = false;
    detenerTemporizadorInactividad();
    const nav = document.getElementById('main-nav');
    const header = document.getElementById('main-header');
    if (nav) nav.classList.add('nav-oculto');
    if (header) header.classList.add('nav-oculto');
    const content = document.getElementById('app-content');
    if (content) {
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:85vh;text-align:center;">
                <div class="card" style="max-width:380px;width:90%;padding:2.5rem;">
                    <h1 style="margin-bottom:0.5rem;font-size:2rem;letter-spacing:-0.5px;">CRM Addlife</h1>
                    <p style="color:#8E8E93;margin-bottom:2rem;font-size:0.95rem;">Ecosistema Privado de Asesoría</p>
                    <button id="btn-google-login" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:12px;border:none;background:#007AFF;color:white;font-weight:600;font-size:16px;cursor:pointer;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="18" height="18" alt="Google">
                        Continuar con Google
                    </button>
                </div>
            </div>
        `;
        document.getElementById('btn-google-login').addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) alert('Error al iniciar sesión: ' + error.message);
        });
    }
}

// ==========================================
// 3. CIERRE DE SESIÓN
// ==========================================
async function cerrarSesion() {
    localStorage.removeItem('actividad_temporal');
    detenerTemporizadorInactividad();
    if (supabase) await supabase.auth.signOut();
}

// ==========================================
// 4. TEMPORIZADOR DE INACTIVIDAD (10 min)
// ==========================================
const TIEMPO_ADVERTENCIA_MS = 9 * 60 * 1000;
const TIEMPO_CIERRE_MS      = 10 * 60 * 1000;

let timerAdvertencia = null;
let timerCierre      = null;
let toastVisible     = false;

function crearToast() {
    if (document.getElementById('inactivity-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'inactivity-toast';
    toast.innerHTML = `⏳ Sesión inactiva — cierra en <strong id="toast-countdown">60</strong>s.<br>
        <span style="font-size:12px;color:#FF9500;">Toca cualquier parte para continuar.</span>`;
    document.body.appendChild(toast);
}

function mostrarToast() {
    crearToast();
    const toast = document.getElementById('inactivity-toast');
    if (toast) {
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
    timerAdvertencia = setTimeout(mostrarToast,  TIEMPO_ADVERTENCIA_MS);
    timerCierre      = setTimeout(cerrarSesion,  TIEMPO_CIERRE_MS);
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
// 5. GEMINI IA
// ==========================================
const GEMINI_API_KEY = 'AIzaSyA6Sus4uIfmN8gTrNl1o1R2BixsmbUZyjg';

export async function callGemini(promptText, outputElementId) {
    const output = document.getElementById(outputElementId);
    if (output) output.innerText = 'Procesando con IA...';
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            }
        );
        const data = await res.json();
        if (data.candidates?.length > 0) {
            if (output) output.innerText = data.candidates[0].content.parts[0].text;
        } else {
            if (output) output.innerText = 'Error API: ' + (data.error?.message || 'Respuesta vacía');
        }
    } catch (err) {
        if (output) output.innerText = 'Error de conexión: ' + err.message;
    }
}
window.callGemini = callGemini;

// ==========================================
// 6. NAVEGACIÓN
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

    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${moduleName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Actualizar título del header
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
            console.error("Error al renderizar el módulo activo:", e);
        }
    } else {
        contentArea.innerHTML = `<div class="card"><h2>${moduleName}</h2><p>Módulo en construcción.</p></div>`;
    }
};

// ==========================================
// 7. DARK MODE TOGGLE
// ==========================================
function iniciarDarkMode() {
    const toggle = document.getElementById('theme-toggle');
    const icon   = document.getElementById('theme-icon');
    const meta   = document.getElementById('meta-theme-color');
    if (!toggle) return;

    const aplicarTema = (dark) => {
        if (dark) {
            document.body.classList.add('dark');
            if (icon) icon.textContent = '🌙';
            if (meta) meta.setAttribute('content', '#0A0A0F');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            if (icon) icon.textContent = '☀️';
            if (meta) meta.setAttribute('content', '#F2F2F7');
            localStorage.setItem('theme', 'light');
        }
    };

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        toggle.checked = true;
        aplicarTema(true);
    }

    toggle.addEventListener('change', () => aplicarTema(toggle.checked));
}

// ==========================================
// 8. ARRANQUE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    iniciarDarkMode();

    // Delegación limpia de eventos de clics
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

    // Esperar inyección asíncrona del SDK
    let intentos = 0;
    while (!inicializarSupabase() && intentos < 20) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }

    if (!supabase) {
        document.getElementById('app-content').innerHTML =
            `<div class="card" style="color:red;"><h2>Error de conexión</h2><p>El SDK de Supabase falló al cargar.</p></div>`;
        return;
    }

    // Determinar la vista inicial de forma lineal y única
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        mostrarApp();
    } else {
        mostrarLogin();
    }

    // Escuchar cambios de autenticación futuros evitando ejecuciones redundantes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            mostrarApp();
        }
        if (event === 'SIGNED_OUT') {
            mostrarLogin();
        }
    });
});
