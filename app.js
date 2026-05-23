// =========================================================================
// SECCIÓN 1: IMPORTACIONES DE MÓDULOS DEL CRM
// =========================================================================
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

// =========================================================================
// SECCIÓN 2: CONFIGURACIÓN DE LLAVES Y VARIABLES DE ENTORNO GLOBAL
// =========================================================================
const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

// Exportación de la instancia activa para que otros archivos JS puedan consultar la base de datos
export const getSupabase = () => supabase;

// =========================================================================
// SECCIÓN 3: MOTOR DE IA - CONEXIÓN CON SUPABASE PROXY (CON LOG RASTREADOR)
// =========================================================================
export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (outputEl) {
        outputEl.innerHTML = '<span style="color:var(--text-secondary);">Analizando estrategia...</span>';
    }
    
    try {
        if (!supabase) throw new Error("El cliente de Supabase es nulo.");
        
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { prompt }
        });

        // 1. Falla de infraestructura (CORS o Red caída)
        if (error) throw new Error(error.message || JSON.stringify(error));
        
        // 2. Falla de paquete vacío
        if (!data) throw new Error("Supabase respondió con datos vacíos (data = null).");
        
        // 3. Intentar extraer la respuesta de nuestro código original
        let textoRespuesta = data.respuesta || data.text;

        // 4. Intentar extraer si el proxy devolvió el RAW de Google por accidente
        if (!textoRespuesta && data.candidates && data.candidates[0]) {
            textoRespuesta = data.candidates[0].content.parts[0].text;
        }

        // 5. Capturar si Google devolvió un error crudo (Ej. Modelo inexistente o API Key inválida)
        if (!textoRespuesta && data.error) {
            const msgError = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            throw new Error("Rechazo de Google API: " + msgError);
        }

        // 6. Si llegamos aquí, el formato es un misterio. Imprimimos el RAW DATA literal.
        if (!textoRespuesta) {
            throw new Error("Formato desconocido. RAW DATA RECIBIDO: " + JSON.stringify(data));
        }

        const textoFormateado = textoRespuesta.replace(/\n/g, '<br>');
        if (outputEl) outputEl.innerHTML = textoFormateado;
        return textoFormateado;

    } catch (err) {
        console.error("Falla detectada:", err);
        if (outputEl) {
            outputEl.innerHTML = `
                <div style="color:var(--danger); font-size:12px; background: rgba(255,59,48,0.1); padding: 10px; border-radius: 12px; border: 1px solid var(--danger); text-align: left;">
                    <strong>⚠️ Diagnóstico:</strong><br>${err.message || err}
                </div>`;
        }
    }
}
// =========================================================================


// =========================================================================
// SECCIÓN 4: FUNCIONES DE INICIALIZACIÓN Y CONTROL DE SESIÓN (AUTH)
// =========================================================================
function inicializarSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        window.supabaseClient = supabase;
        return true;
    }
    return false;
}

window.cerrarSesion = async () => {
    if (supabase) {
        await supabase.auth.signOut();
    }
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

// =========================================================================
// SECCIÓN 5: INTERRUPTOR DE APARIENCIA VISUAL (MODO OSCURO / CLARO)
// =========================================================================
window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

// =========================================================================
// SECCIÓN 6: ENRUTADOR DINÁMICO DE NAVEGACIÓN (SINGLE PAGE APPLICATION)
// =========================================================================
window.navigateTo = function(moduleName) {
    // Actualizar estados visuales de los botones de la barra flotante
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${moduleName}"]`)?.classList.add('active');
    
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    // Renderizar la vista HTML e inicializar los escuchadores de eventos nativos
    try {
        if (moduleName === 'dashboard') { contentArea.innerHTML = renderDashboard(); setTimeout(bindDashboardEvents, 50); }
        else if (moduleName === 'prospeccion') { contentArea.innerHTML = renderProspeccion(); setTimeout(bindProspeccionEvents, 50); }
        else if (moduleName === 'referidos') { contentArea.innerHTML = renderReferidos(); setTimeout(bindReferidosEvents, 50); }
        else if (moduleName === 'actividad') { contentArea.innerHTML = renderActividad(); setTimeout(bindActividadEvents, 50); }
        else if (moduleName === 'cartera') { contentArea.innerHTML = renderCartera(); setTimeout(bindCarteraEvents, 50); }
        else if (moduleName === 'comisiones') { contentArea.innerHTML = renderComisiones(); setTimeout(bindComisionesEvents, 50); }
    } catch (e) { 
        console.error("Error al enrutar módulo:", e); 
    }
};

// =========================================================================
// SECCIÓN 7: ESCUCHADOR PRINCIPAL DE CARGA DE DOCUMENTO (DOM READY)
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Inicialización del tema guardado
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = (savedTheme === 'dark');
        toggle.addEventListener('change', window.toggleTheme);
    }

    // Cronómetro de seguridad por inactividad comercial (Cierra sesión a los 10 minutos)
    let inactivityTimer;
    const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(window.cerrarSesion, 10 * 60 * 1000);
    };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });

    // Delegación global de clics para la barra flotante inferior y login
    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.classList.contains('nav-btn-logout')) {
            window.navigateTo(navBtn.getAttribute('data-target'));
        }
        if (e.target.closest('#btn-google-login')) {
            window.loginConGoogle();
        }
    });

    // Bucle elástico de conexión con la librería de Supabase (Evita crash por retraso de red)
    let intentos = 0;
    while (!inicializarSupabase() && intentos < 20) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }

    const contentArea = document.getElementById('app-content');
    if (!supabase) {
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Error crítico de sincronización: El SDK de base de datos no respondió. Revisa tu conexión.</div>`;
        return;
    }

    // Validación de sesión activa del usuario
    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');

    if (!user) {
        // Interfaz bloqueada - Pantalla de login obligatoria
        if (navBar) navBar.style.display = 'none';
        contentArea.innerHTML = `
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
        // Acceso autorizado - Desplegar entorno de trabajo comercial
        if (navBar) navBar.style.display = 'flex';
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }
});
