// =========================================================================
// SECCIÓN 1: IMPORTACIONES DE MÓDULOS DE NEGOCIO Y BASE DE DATOS
// =========================================================================
import { DB } from './db.js';
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

// =========================================================================
// SECCIÓN 2: PARÁMETROS GLOBALES DE CONEXIÓN A SUPABASE
// =========================================================================
const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

export const getSupabase = () => supabase;

// =========================================================================
// SECCIÓN 3: CONECTOR DE INTELIGENCIA ARTIFICIAL A TRAVÉS DE EDGE FUNCTION
// =========================================================================
export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (outputEl) {
        outputEl.innerHTML = '<span style="opacity:0.5;">Escribiendo...</span>';
    }
    
    try {
        if (!supabase) throw new Error("El cliente de Supabase es nulo.");
        
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { prompt }
        });

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

        if (!textoRespuesta) {
            throw new Error("Formato desconocido de respuesta: " + JSON.stringify(data));
        }

        const textoFormateado = textoRespuesta.replace(/\n/g, '<br>');
        if (outputEl) outputEl.innerHTML = textoFormateado;
        return textoFormateado;

    } catch (err) {
        console.error("Falla detectada en motor central:", err);
        if (outputEl) {
            outputEl.innerHTML = `<div style="color:var(--danger); font-size:12px;"><strong>⚠️ Error:</strong><br>${err.message || err}</div>`;
        }
    }
}

// =========================================================================
// SECCIÓN 4: CONTROLADORES DE ACCESO Y SESIONES AUTOMATIZADAS (AUTH)
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

// =========================================================================
// SECCIÓN 5: INTERRUPTOR DE APARIENCIA VISUAL (THEME CONTROL)
// =========================================================================
window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

// =========================================================================
// SECCIÓN 6: ENRUTADOR DE NAVEGACIÓN DE PANTALLA ÚNICA (SPA)
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
    } catch (e) { 
        console.error("Error al enrutar módulo:", e); 
    }
};

// =========================================================================
// SECCIÓN 7: CARGA INICIAL DE LA APLICACIÓN Y VALIDACIÓN DE PRIVILEGIOS
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
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
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });

    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.classList.contains('nav-btn-logout')) window.navigateTo(navBtn.getAttribute('data-target'));
        if (e.target.closest('#btn-google-login')) window.loginConGoogle();
    });

    let intentos = 0;
    while (!inicializarSupabase() && intentos < 20) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }

    const contentArea = document.getElementById('app-content');
    if (!supabase) {
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Error crítico: Base de datos inaccesible.</div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');
    const chatBubble = document.getElementById('ai-chat-bubble');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        if (chatBubble) chatBubble.style.display = 'none'; // Se mantiene oculta antes del login
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
        if (navBar) navBar.style.display = 'flex';
        if (chatBubble) chatBubble.style.display = 'flex'; // Activación visible tras autenticación
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }

    // =========================================================================
    // SECCIÓN 8: INTEGRACIÓN DE CONTEXTO INVISIBLE Y CONTROLADOR DEL CHATBOT
    // =========================================================================
    const bubble = document.getElementById('ai-chat-bubble');
    const windowChat = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const chatInput = document.getElementById('ai-chat-input');
    const chatSend = document.getElementById('ai-chat-send');
    const msgContainer = document.getElementById('ai-chat-messages');
    
    const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    notificationSound.volume = 0.3;

    const scrollChatToBottom = () => {
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };

    bubble.addEventListener('click', () => {
        windowChat.style.display = windowChat.style.display === 'flex' ? 'none' : 'flex';
        if (windowChat.style.display === 'flex') {
            chatInput.focus();
            scrollChatToBottom();
        }
    });

    closeBtn.addEventListener('click', () => windowChat.style.display = 'none');

    async function procesarMensajeChat() {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;
        chatInput.value = '';

        msgContainer.innerHTML += `
            <div class="msg-row user-row">
                <div class="chat-bubble user-bubble">${userMsg}</div>
            </div>`;
        scrollChatToBottom();

        const uniqueResId = 'ia-res-' + Date.now();
        msgContainer.innerHTML += `
            <div class="msg-row ia-row">
                <div class="chat-bubble ia-bubble" id="${uniqueResId}"></div>
            </div>`;
        scrollChatToBottom();

        // Extracción asíncrona de datos locales para la inyección de contexto en la IA
        const cartera = await DB.obtenerTodos('cartera');
        const resumenCartera = cartera.map(p => `[Cliente: ${p.cliente} | Plan: ${p.plan} | Prima: $${p.prima} ${p.moneda} | Emisión: ${p.emision} | Próximo Pago: ${p.fechaPago} | Frecuencia: ${p.formaPago}]`).join('\n');

        const promptEstructural = `
            Actúas como un coach, mentor y promotor altamente exitoso en el sector de seguros de Seguros Monterrey New York Life.
            Tienes acceso a la base de datos de pólizas de la app del asesor en tiempo real para resolver dudas de cobranza, renovaciones o auditoría:
            ${resumenCartera || 'La cartera actual se encuentra vacía.'}

            Conoces a la perfección las tasas de comisión inicial (Primer Año) de la compañía:
            - Star Temporal: 35% | Orvi 99: 44% | Respaldo Educativo: 35% | Segubeca: 37% | Respaldo Negocio: 35% | Mío: 80% | Imagina Ser: 35% | Objetivo Vida: 44% | Nuevo Plenitud: 35% | Vida Mujer: 40%
            - Alfa Medical (GMM): 17% | Alfa Medical Flex: 15% | Alfa Medical Internacional: 17%

            Regla Operativa Crítica: Si el usuario se encuentra bajo el esquema de Asesor en Desarrollo y pregunta por productos del ramo de Vida, las comisiones emitidas participan al 90% del diseño del producto base por reglas actuariales del cuaderno de concursos (debes multiplicar el resultado por 0.90).
            Evita introducciones largas, saludos informales o motivación vacía. Responde la consulta de forma directa, analítica y concisa: "${userMsg}"`;

        await callGemini(promptEstructural, uniqueResId);
        notificationSound.play().catch(() => {});
        scrollChatToBottom();
    }

    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') procesarMensajeChat(); });
    if (chatSend) chatSend.addEventListener('click', procesarMensajeChat);
});
