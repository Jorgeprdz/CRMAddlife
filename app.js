// app.js - Núcleo unificado de la aplicación
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
        return true;
    }
    return false;
}

// ==========================================
// 2. AUTENTICACIÓN Y TEMAS
// ==========================================
async function loginConGoogle() {
    if (!supabase) return;
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
    } catch (error) {
        alert('Error en login: ' + error.message);
    }
}

async function cerrarSesion() {
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
}

window.loginConGoogle = loginConGoogle;
window.cerrarSesion = cerrarSesion;

// Tema — gestionado desde index.html (toggle iOS).
// Esta función sincroniza el checkbox si la app cambia el tema programáticamente.
function aplicarModo() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (!saved && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = isDark;
}

// Mantener compatibilidad si algún módulo llama toggleTheme()
window.toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = (next === 'dark');
};

// ==========================================
// 3. GEMINI IA — VÍA EDGE FUNCTION
// ==========================================
export async function callGemini(promptText, outputElementId) {
    const output = document.getElementById(outputElementId);
    if (output) output.innerText = 'Procesando con IA...';

    try {
        const functionUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co/functions/v1/gemini-proxy';

        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}` 
            },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await res.json();

        if (data.error) {
            if (output) output.innerText = 'Error de Google/Supabase: ' + JSON.stringify(data.error);
            return;
        }

        if (data.candidates && data.candidates.length > 0) {
            if (output) output.innerText = data.candidates[0].content.parts[0].text;
        } else {
            if (output) output.innerText = 'Respuesta inesperada: ' + JSON.stringify(data);
        }
    } catch (err) {
        if (output) output.innerText = 'Error de conexión: ' + err.message;
    }
}
window.callGemini = callGemini;

// ==========================================
// 4. INTERFAZ Y NAVEGACIÓN
// ==========================================
function renderLoginScreen() {
    return `
        <div class="login-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center;">
            <div class="card" style="max-width: 400px; width: 90%;">
                <h1>CRM Addlife</h1>
                <p>Ecosistema Privado</p>
                <button class="btn-primary" id="btn-google-login">Continuar con Google</button>
            </div>
        </div>
    `;
}

window.navigateTo = function(moduleName) {
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-target="${moduleName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    contentArea.innerHTML = '';
    try {
        if (moduleName === 'dashboard') { contentArea.innerHTML = renderDashboard(); setTimeout(bindDashboardEvents, 50); }
        else if (moduleName === 'prospeccion') { contentArea.innerHTML = renderProspeccion(); setTimeout(bindProspeccionEvents, 50); }
        else if (moduleName === 'referidos') { contentArea.innerHTML = renderReferidos(); setTimeout(bindReferidosEvents, 50); }
        else if (moduleName === 'actividad') { contentArea.innerHTML = renderActividad(); setTimeout(bindActividadEvents, 50); }
        else if (moduleName === 'cartera') { contentArea.innerHTML = renderCartera(); setTimeout(bindCarteraEvents, 50); }
    } catch (e) { console.error(e); }
};

// ==========================================
// 5. ARRANQUE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    aplicarModo(); // Iniciar tema

    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn) window.navigateTo(navBtn.getAttribute('data-target'));
        if (e.target.closest('#btn-google-login')) window.loginConGoogle();
    });

    let intentos = 0;
    while (!inicializarSupabase() && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        document.getElementById('app-content').innerHTML = renderLoginScreen();
    } else {
        if (navBar) navBar.style.display = 'flex';
        window.navigateTo('dashboard');
    }
});
