// =========================================================================
// SECCIÓN 1: IMPORTACIONES DE NÚCLEO
// =========================================================================
import { DB, processOfflineQueue } from './db.js';
import { showToast } from './utils.js';
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

// =========================================================================
// SECCIÓN 2: PARÁMETROS SUPABASE
// =========================================================================
const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

export const getSupabase = () => supabase;

// =========================================================================
// SECCIÓN 3: MOTOR DE IA (SUPABASE PROXY)
// =========================================================================
export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (outputEl) outputEl.innerHTML = '<span style="opacity:0.5;">Escribiendo...</span>';
    
    try {
        if (!supabase) throw new Error("El cliente de Supabase es nulo.");
        
        const { data, error } = await supabase.functions.invoke('gemini-proxy', { body: { prompt } });

        if (error) throw new Error(error.message || JSON.stringify(error));
        if (!data) throw new Error("Supabase respondió con datos vacíos.");
        
        let textoRespuesta = data.respuesta || data.text;

        if (!textoRespuesta && data.candidates && data.candidates[0]) {
            textoRespuesta = data.candidates[0].content.parts[0].text;
        }

        if (!textoRespuesta && data.error) {
            const msgError = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            throw new Error("Rechazo de Google API: " + msgError);
        }

        if (!textoRespuesta) throw new Error("Formato desconocido: " + JSON.stringify(data));

        const textoFormateado = textoRespuesta.replace(/\n/g, '<br>');
        if (outputEl) outputEl.innerHTML = textoFormateado;
        return textoFormateado;

    } catch (err) {
        console.error("Falla detectada:", err);
        if (outputEl) outputEl.innerHTML = `<div style="color:var(--danger); font-size:12px;"><strong>⚠️ Error:</strong><br>${err.message || err}</div>`;
    }
}

// =========================================================================
// SECCIÓN 4: AUTH Y THEME
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
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
};

window.loginConGoogle = async () => {
    if (!supabase) return;
    const siteUrl = window.location.origin + window.location.pathname;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } });
};

window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

// =========================================================================
// SECCIÓN 5: ENRUTADOR
// =========================================================================
window.navigateTo = function(moduleName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${moduleName}"]`)?.classList.add('active');
    
    const contentArea = document.getElementById('app-content');
    if (!contentArea) return;

    try {
        if (moduleName === 'dashboard') { contentArea.innerHTML = renderDashboard(); setTimeout(bindDashboardEvents, 50); }
        else if (moduleName === 'prospeccion') { contentArea.innerHTML = renderProspeccion(); setTimeout(bindProspeccionEvents, 50); }
        else if (moduleName === 'referidos') { contentArea.innerHTML = renderReferidos(); setTimeout(bindReferidosEvents, 50); }
        else if (moduleName === 'actividad') { contentArea.innerHTML = renderActividad(); setTimeout(bindActividadEvents, 50); }
        else if (moduleName === 'cartera') { contentArea.innerHTML = renderCartera(); setTimeout(bindCarteraEvents, 50); }
        else if (moduleName === 'comisiones') { contentArea.innerHTML = renderComisiones(); setTimeout(bindComisionesEvents, 50); }
    } catch (e) { console.error("Error al enrutar:", e); }
};

// =========================================================================
// SECCIÓN 6: INICIALIZACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Sincronización automática de cambios acumulados offline
    window.addEventListener('online', () => {
        showToast('Conexión a internet detectada. Sincronizando datos...', 'info');
        processOfflineQueue();
    });

    if (navigator.onLine) {
        processOfflineQueue();
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = (savedTheme === 'dark');
        toggle.addEventListener('change', window.toggleTheme);
    }

    let inactivityTimer;
    const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(window.cerrarSesion, 10 * 60 * 1000);
    };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => document.addEventListener(evt, resetInactivityTimer, true));

    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.classList.contains('nav-btn-logout')) window.navigateTo(navBtn.getAttribute('data-target'));
        if (e.target.closest('#btn-google-login')) window.loginConGoogle();
    });

    let intentos = 0;
    while (!inicializarSupabase() && intentos < 20) { await new Promise(r => setTimeout(r, 100)); intentos++; }

    const contentArea = document.getElementById('app-content');
    if (!supabase) {
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Error crítico: BD inaccesible.</div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');
    const chatBubble = document.getElementById('ai-chat-bubble');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        if (chatBubble) chatBubble.style.display = 'none';
        contentArea.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; padding:24px;">
                <div class="card" style="text-align:center; width:100%; max-width:360px;">
                    <h1 style="font-size:24px; margin-bottom:8px;">CRM Addlife</h1>
                    <button class="btn-primary" id="btn-google-login" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%;">
                        Continuar con Google
                    </button>
                </div>
            </div>`;
    } else {
        if (navBar) navBar.style.display = 'flex';
        if (chatBubble) chatBubble.style.display = 'flex';
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }

    // =========================================================================
    // SECCIÓN 7: CHATBOT (CON INYECCIÓN DE CONTEXTO)
    // =========================================================================
    const bubble = document.getElementById('ai-chat-bubble');
    const windowChat = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const chatInput = document.getElementById('ai-chat-input');
    const chatSend = document.getElementById('ai-chat-send');
    const msgContainer = document.getElementById('ai-chat-messages');
    
    const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    notificationSound.volume = 0.3;

    const scrollChatToBottom = () => msgContainer.scrollTop = msgContainer.scrollHeight;

    bubble.addEventListener('click', () => {
        windowChat.style.display = windowChat.style.display === 'flex' ? 'none' : 'flex';
        if (windowChat.style.display === 'flex') { chatInput.focus(); scrollChatToBottom(); }
    });

    closeBtn.addEventListener('click', () => windowChat.style.display = 'none');

    async function procesarMensajeChat() {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;
        chatInput.value = '';

        msgContainer.innerHTML += `<div class="msg-row user-row"><div class="chat-bubble user-bubble">${userMsg}</div></div>`;
        scrollChatToBottom();

        const uniqueResId = 'ia-res-' + Date.now();
        msgContainer.innerHTML += `<div class="msg-row ia-row"><div class="chat-bubble ia-bubble" id="${uniqueResId}"></div></div>`;
        scrollChatToBottom();

        const cartera = await DB.obtenerTodos('cartera');
        const hoy = new Date();
        let prodMesActual = 0, prodMesAnterior = 0, vidasMes = 0;

        cartera.forEach(p => {
            if (!p.emision) return;
            const fp = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : new Date(p.emision + 'T12:00:00');
            const diffMeses = (hoy.getFullYear() - fp.getFullYear()) * 12 + (hoy.getMonth() - fp.getMonth());
            const primaVal = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
            
            if (diffMeses === 0) { prodMesActual += primaVal; vidasMes++; }
            else if (diffMeses === 1) { prodMesAnterior += primaVal; }
        });

        const promptEstructural = `
            Actúas como mentor comercial de Seguros Monterrey. Eres directo.
            Métrica del asesor (Objetivo: Zeekr X Dic 2026):
            - Prima Pagada Mes Actual: $${prodMesActual.toLocaleString()} (${vidasMes} pólizas).
            - Prima Pagada Mes Anterior: $${prodMesAnterior.toLocaleString()}.
            Responde de manera ejecutiva: "${userMsg}"`;

        await callGemini(promptEstructural, uniqueResId);
        notificationSound.play().catch(() => {});
        scrollChatToBottom();
    }

    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') procesarMensajeChat(); });
    if (chatSend) chatSend.addEventListener('click', procesarMensajeChat);
});
