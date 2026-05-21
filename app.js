import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';

const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

function inicializarSupabase() {
    if (window.supabase) { supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey); return true; }
    return false;
}

window.cerrarSesion = async () => { 
    if (supabase) await supabase.auth.signOut(); 
    window.location.reload(); 
};

window.loginConGoogle = async () => { await supabase.auth.signInWithOAuth({ provider: 'google' }); };

window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').checked = (next === 'dark');
};

document.addEventListener('DOMContentLoaded', async () => {
    // Configuración de Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = (savedTheme === 'dark');
        toggle.addEventListener('change', window.toggleTheme);
    }

    // Configuración de Inactividad (10 min)
    let timer;
    const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(window.cerrarSesion, 10 * 60 * 1000);
    };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(e => document.addEventListener(e, resetTimer, true));

    // Inicialización
    while (!inicializarSupabase()) await new Promise(r => setTimeout(r, 100));
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        document.getElementById('app-content').innerHTML = `
            <div class="login-container">
                <div class="card" style="text-align:center;">
                    <h1>CRM Addlife</h1>
                    <p>Ecosistema Privado</p>
                    <button class="btn-primary" onclick="loginConGoogle()" style="display:flex; align-items:center; justify-content:center; gap:10px;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width:20px; height:20px;">
                        Continuar con Google
                    </button>
                </div>
            </div>`;
    } else {
        document.getElementById('main-sidebar').style.display = 'flex';
        window.navigateTo('dashboard');
        resetTimer();
    }
});

window.navigateTo = function(moduleName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${moduleName}"]`)?.classList.add('active');
    const content = document.getElementById('app-content');
    if (moduleName === 'dashboard') { content.innerHTML = renderDashboard(); bindDashboardEvents(); }
    else if (moduleName === 'prospeccion') { content.innerHTML = renderProspeccion(); bindProspeccionEvents(); }
};
