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
// 2. AUTENTICACIÓN DINÁMICA DE ENTORNO
// ==========================================
window.loginConGoogle = async function() {
    if (!supabase) {
        alert('Error: El cliente de base de datos no está listo.');
        return;
    }
    try {
        // Dirección de producción por defecto
        let urlRedireccion = 'https://jorgeprdz.github.io/CRMAddlife/';
        
        // Si el navegador detecta que ejecutas el servidor local en Acode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            urlRedireccion = window.location.origin + window.location.pathname;
        }

        console.log("Despachando autenticación segura hacia:", urlRedireccion);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: urlRedireccion 
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Error en autenticación:', error.message);
        alert('No se pudo iniciar sesión: ' + error.message);
    }
}

window.cerrarSesion = async function() {
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
}

// ==========================================
// 3. GEMINI IA — Modelo Válido de Producción
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
// 4. PANTALLA DE LOGIN
// ==========================================
function renderLoginScreen() {
    return `
        <div class="login-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center;">
            <div class="card" style="padding: 2.5rem; border-radius: 16px; background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); max-width: 400px; width: 90%; box-shadow: 0 8px 32px 0 rgba(0,0,0,0.37);">
                <h1 style="margin-bottom: 0.5rem; font-size: 2rem; letter-spacing: -0.5px; color: #fff;">CRM Addlife</h1>
                <p style="color: #aaa; margin-bottom: 2rem; font-size: 0.95rem;">Ecosistema Privado de Asesoría de Alto Valor</p>
                <button id="btn-google-login" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 8px; border: none; background: #fff; color: #111; font-weight: 600; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="Google">
                    Continuar con Google
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// 5. NAVEGACIÓN GLOBAL
// ==========================================
window.navigateTo = function(moduleName) {
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-target="${moduleName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    contentArea.innerHTML = '';

    try {
        if (moduleName === 'dashboard' && typeof renderDashboard === 'function') {
            contentArea.innerHTML = renderDashboard();
            setTimeout(() => bindDashboardEvents(), 50);
        } else if (moduleName === 'prospeccion' && typeof renderProspeccion === 'function') {
            contentArea.innerHTML = renderProspeccion();
            setTimeout(() => bindProspeccionEvents(), 50);
        } else if (moduleName === 'referidos' && typeof renderReferidos === 'function') {
            contentArea.innerHTML = renderReferidos();
            setTimeout(() => bindReferidosEvents(), 50);
        } else if (moduleName === 'actividad' && typeof renderActividad === 'function') {
            contentArea.innerHTML = renderActividad();
            setTimeout(() => bindActividadEvents(), 50);
        } else if (moduleName === 'cartera' && typeof renderCartera === 'function') {
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
// 6. ARRANQUE Y CONTROL DE SESIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn) {
            const target = navBtn.getAttribute('data-target');
            if (target) window.navigateTo(target);
        }
    });

    let intentos = 0;
    while (!inicializarSupabase() && intentos < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!supabase) {
        const contentArea = document.getElementById('app-content');
        if (contentArea) {
            contentArea.innerHTML = `<div class="card" style="color:red;"><h2>Error de Conexión</h2><p>El servicio de base de datos tardó demasiado. Revisa tu conexión a internet.</p></div>`;
        }
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        const contentArea = document.getElementById('app-content');
        if (contentArea) {
            contentArea.innerHTML = renderLoginScreen();
            
            const loginBtn = document.getElementById('btn-google-login');
            if (loginBtn) {
                loginBtn.addEventListener('click', window.loginConGoogle);
            }
        }
    } else {
        if (navBar) navBar.style.display = 'flex';
        window.navigateTo('dashboard');
    }
});
