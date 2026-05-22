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

function inicializarSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('Supabase conectado.');
        return true;
    }
    return false;
}

// ==========================================
// 2. CIERRE DE SESIÓN
// ==========================================
async function cerrarSesion() {
    detenerTemporizadorInactividad();
    if (supabase) await supabase.auth.signOut();
    // Limpiar estado temporal de actividad del día
    localStorage.removeItem('actividad_temporal');
    window.location.reload();
}

// ==========================================
// 3. TEMPORIZADOR DE INACTIVIDAD (10 min)
// ==========================================
const TIEMPO_INACTIVIDAD_MS = 10 * 60 * 1000;   // 10 minutos
const TIEMPO_ADVERTENCIA_MS =  9 * 60 * 1000;   //  9 minutos → avisa 1 min antes

let timerInactividad   = null;
let timerAdvertencia   = null;
let toastVisible       = false;

function crearToast() {
    if (document.getElementById('inactivity-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'inactivity-toast';
    toast.innerHTML = '⏳ Sesión inactiva — cerrará en <strong id="toast-countdown">60</strong>s. <br><span style="font-size:12px; color:#FF9500;">Toca cualquier parte para continuar.</span>';
    document.body.appendChild(toast);
}

function mostrarToast() {
    const toast = document.getElementById('inactivity-toast');
    if (!toast) return;
    toastVisible = true;
    toast.style.display = 'block';

    let segundos = 60;
    const el = document.getElementById('toast-countdown');
    const intervalo = setInterval(() => {
        segundos--;
        if (el) el.textContent = segundos;
        if (segundos <= 0) clearInterval(intervalo);
    }, 1000);

    // Guardar referencia para limpiar si el usuario reactiva
    toast._intervalo = intervalo;
}

function ocultarToast() {
    const toast = document.getElementById('inactivity-toast');
    if (!toast) return;
    if (toast._intervalo) clearInterval(toast._intervalo);
    toast.style.display = 'none';
    toastVisible = false;
}

function reiniciarTemporizador() {
    // Si el toast está visible y el usuario se movió → ocultarlo y reiniciar
    if (toastVisible) ocultarToast();

    clearTimeout(timerAdvertencia);
    clearTimeout(timerInactividad);

    timerAdvertencia = setTimeout(() => {
        mostrarToast();
    }, TIEMPO_ADVERTENCIA_MS);

    timerInactividad = setTimeout(() => {
        cerrarSesion();
    }, TIEMPO_INACTIVIDAD_MS);
}

function iniciarTemporizadorInactividad() {
    crearToast();

    // Eventos que reinician el timer
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizador, { passive: true });
    });

    reiniciarTemporizador(); // Arranca el primer ciclo
}

function detenerTemporizadorInactividad() {
    clearTimeout(timerAdvertencia);
    clearTimeout(timerInactividad);
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evento => {
        document.removeEventListener(evento, reiniciarTemporizador);
    });
}

// ==========================================
// 4. GEMINI IA
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

        if (data.candidates && data.candidates.length > 0) {
            if (output) output.innerText = data.candidates[0].content.parts[0].text;
        } else {
            if (output) output.innerText = 'Error API: ' + (data.error ? data.error.message : 'Respuesta vacía');
        }
    } catch (err) {
        if (output) output.innerText = 'Error de conexión: ' + err.message;
    }
}

// ==========================================
// 5. PANTALLA DE LOGIN
// ==========================================
function renderLoginScreen() {
    return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center;">
            <div class="card" style="padding: 2.5rem; max-width: 400px; width: 90%;">
                <h1 style="margin-bottom: 0.5rem; font-size: 2rem; letter-spacing: -0.5px;">CRM Addlife</h1>
                <p style="color: #8E8E93; margin-bottom: 2rem; font-size: 0.95rem;">Ecosistema Privado de Asesoría de Alto Valor</p>
                <button id="btn-google-login" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 12px; border: none; background: #007AFF; color: white; font-weight: 600; font-size: 16px; cursor: pointer;">
                    <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="Google">
                    Continuar con Google
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// 6. NAVEGACIÓN GLOBAL
// ==========================================
window.navigateTo = function(moduleName) {
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-target="${moduleName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    contentArea.innerHTML = '';

    try {
        if (moduleName === 'dashboard') {
            contentArea.innerHTML = renderDashboard();
            setTimeout(() => bindDashboardEvents(), 50);
        } else if (moduleName === 'prospeccion') {
            contentArea.innerHTML = renderProspeccion();
            setTimeout(() => bindProspeccionEvents(), 50);
        } else if (moduleName === 'referidos') {
            contentArea.innerHTML = renderReferidos();
            setTimeout(() => bindReferidosEvents(), 50);
        } else if (moduleName === 'actividad') {
            contentArea.innerHTML = renderActividad();
            setTimeout(() => bindActividadEvents(), 50);
        } else if (moduleName === 'cartera') {
            contentArea.innerHTML = renderCartera();
            setTimeout(() => bindCarteraEvents(), 50);
        } else {
            contentArea.innerHTML = `<div class="card"><h2>${moduleName.toUpperCase()}</h2><p>Módulo en construcción.</p></div>`;
        }
    } catch (error) {
        contentArea.innerHTML = `<div class="card" style="color:red;"><h2>Error</h2><p>${error.message}</p></div>`;
    }
};

// ==========================================
// 7. ARRANQUE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {

    // Delegación de clics del menú
    document.body.addEventListener('click', (e) => {
        // Botón cerrar sesión
        if (e.target.closest('#btn-cerrar-sesion')) {
            if (confirm('¿Cerrar sesión?')) cerrarSesion();
            return;
        }
        // Botones de navegación
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn) {
            const target = navBtn.getAttribute('data-target');
            if (target) window.navigateTo(target);
        }
    });

    // Esperar SDK Supabase
    let intentos = 0;
    while (!inicializarSupabase() && intentos < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!supabase) {
        document.getElementById('app-content').innerHTML = `
            <div class="card" style="color:red;">
                <h2>Error de Conexión</h2>
                <p>El servicio tardó demasiado. Revisa tu conexión a internet.</p>
            </div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        const contentArea = document.getElementById('app-content');
        if (contentArea) {
            contentArea.innerHTML = renderLoginScreen();
            document.getElementById('btn-google-login').addEventListener('click', async () => {
                const URL_REDIRECCION = window.location.origin + window.location.pathname;
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: URL_REDIRECCION }
                });
                if (error) alert('No se pudo iniciar sesión: ' + error.message);
            });
        }
    } else {
        if (navBar) navBar.style.display = 'flex';
        iniciarTemporizadorInactividad();
        window.navigateTo('dashboard');
    }
});
