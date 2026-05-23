// app.js - Núcleo unificado de la aplicación
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

// FIX #1: Exportar getSupabase para que db.js pueda importarla
export function getSupabase() {
    return supabase;
}

// FIX #2: Exportar callGemini para que prospeccion.js pueda importarla
export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (!outputEl) return;

    outputEl.innerText = 'Generando respuesta...';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            outputEl.innerText = `Error: ${err.error?.message || response.statusText}`;
            return;
        }

        const data = await response.json();
        const text = data.content?.map(b => b.text || '').join('') || 'Sin respuesta.';
        outputEl.innerText = text;
    } catch (e) {
        outputEl.innerText = `Error de red: ${e.message}`;
    }
}

function inicializarSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        window.supabaseClient = supabase;
        return true;
    }
    return false;
}

window.cerrarSesion = async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
};

window.loginConGoogle = async () => {
    if (!supabase) return;
    const siteUrl = window.location.origin + window.location.pathname;
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: siteUrl }
    });
};

window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

window.navigateTo = function(moduleName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${moduleName}"]`)?.classList.add('active');

    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    try {
        if (moduleName === 'dashboard')    { contentArea.innerHTML = renderDashboard();   setTimeout(bindDashboardEvents, 50); }
        else if (moduleName === 'prospeccion') { contentArea.innerHTML = renderProspeccion(); setTimeout(bindProspeccionEvents, 50); }
        else if (moduleName === 'referidos')   { contentArea.innerHTML = renderReferidos();   setTimeout(bindReferidosEvents, 50); }
        else if (moduleName === 'actividad')   { contentArea.innerHTML = renderActividad();   setTimeout(bindActividadEvents, 50); }
        else if (moduleName === 'cartera')     { contentArea.innerHTML = renderCartera();     setTimeout(bindCarteraEvents, 50); }
        else if (moduleName === 'comisiones')  { contentArea.innerHTML = renderComisiones();  setTimeout(bindComisionesEvents, 50); }
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = (savedTheme === 'dark');
        toggle.addEventListener('change', window.toggleTheme);
    }

    // Inactividad: cierre automático a los 10 min
    let inactivityTimer;
    const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(window.cerrarSesion, 10 * 60 * 1000);
    };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });

    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.classList.contains('nav-btn-logout')) {
            window.navigateTo(navBtn.getAttribute('data-target'));
        }
        if (e.target.closest('#btn-google-login')) window.loginConGoogle();
    });

    // Esperar a que el CDN de Supabase cargue
    let intentos = 0;
    while (!inicializarSupabase() && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }

    // FIX #3: Guard si Supabase no pudo inicializarse
    if (!supabase) {
        console.error('Supabase no pudo inicializarse. Verifica tu conexión o el CDN.');
        document.getElementById('app-content').innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; padding:24px;">
                <div class="card" style="text-align:center; width:100%; max-width:360px;">
                    <h2 style="color:#FF3B30;">Error de conexión</h2>
                    <p style="color:#666; font-size:14px;">No se pudo conectar con el servidor. Revisa tu conexión a internet y recarga la página.</p>
                    <button class="btn-primary" onclick="location.reload()" style="margin-top:16px;">🔄 Reintentar</button>
                </div>
            </div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        document.getElementById('app-content').innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; padding:24px;">
                <div class="card" style="text-align:center; width:100%; max-width:360px;">
                    <h1 style="font-size:24px; margin-bottom:8px;">CRM Addlife</h1>
                    <p style="color:var(--text-secondary); margin-bottom:24px; font-size:14px;">Ecosistema de Inteligencia Privada</p>
                    <button class="btn-primary" id="btn-google-login" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width:18px; height:18px;">
                        Continuar con Google
                    </button>
                </div>
            </div>`;
    } else {
        if (navBar) navBar.style.display = 'flex';
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }
});
