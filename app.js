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
// SECCIÓN 2: CONFIGURACIÓN DE SUPABASE
// =========================================================================
const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;

export const getSupabase = () => supabase;

// =========================================================================
// SECCIÓN 3: MOTOR DE IA - CONEXIÓN CON SUPABASE PROXY (DIAGNÓSTICO FULL)
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
        if (!data) throw new Error("Supabase respondió con datos vacíos (data = null).");
        
        let textoRespuesta = data.respuesta || data.text;

        if (!textoRespuesta && data.candidates && data.candidates[0]) {
            textoRespuesta = data.candidates[0].content.parts[0].text;
        }

        if (!textoRespuesta && data.error) {
            const msgError = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            throw new Error("Rechazo de Google API: " + msgError);
        }

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
                <div style="color:var(--danger); font-size:12px;">
                    <strong>⚠️ Error:</strong><br>${err.message || err}
                </div>`;
        }
    }
}

// =========================================================================
// SECCIÓN 4: FUNCIONES DE AUTH Y SESIÓN
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
// SECCIÓN 5: INTERFAZ MODO OSCURO / CLARO
// =========================================================================
window.toggleTheme = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

// =========================================================================
// SECCIÓN 6: ENRUTADOR DINÁMICO DE NAVEGACIÓN
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
// SECCIÓN 7: INICIALIZACIÓN GLOBAL (DOM READY Y VISIBILIDAD DE BURBUJA)
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
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Error crítico: Base de datos no cargada.</div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const navBar = document.getElementById('main-sidebar');
    const chatBubble = document.getElementById('ai-chat-bubble');

    if (!user) {
        if (navBar) navBar.style.display = 'none';
        if (chatBubble) chatBubble.style.display = 'none'; // Ocultar si no hay sesión
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
        if (chatBubble) chatBubble.style.display = 'flex'; // Mostrar únicamente tras loguearse
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }

    // =========================================================================
    // SECCIÓN 8: CONTROLADOR DEL CHATBOT CON ALINEACIÓN iMESSAGE Y MODELO DE IA
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

    // Alternar visibilidad de la ventana flotante
    bubble.addEventListener('click', () => {
        windowChat.style.display = windowChat.style.display === 'flex' ? 'none' : 'flex';
        if (windowChat.style.display === 'flex') {
            chatInput.focus();
            scrollChatToBottom();
        }
    });

    closeBtn.addEventListener('click', () => windowChat.style.display = 'none');

    // Procesamiento centralizado del mensaje enviado por el usuario
    async function procesarMensajeChat() {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;
        chatInput.value = '';

        // 1. Renderizar fila y burbuja del usuario (Alineación Derecha)
        msgContainer.innerHTML += `
            <div class="msg-row user-row">
                <div class="chat-bubble user-bubble">${userMsg}</div>
            </div>`;
        scrollChatToBottom();

        // 2. Crear ID dinámico y renderizar fila de la IA (Alineación Izquierda)
        const uniqueResId = 'ia-res-' + Date.now();
        msgContainer.innerHTML += `
            <div class="msg-row ia-row">
                <div class="chat-bubble ia-bubble" id="${uniqueResId}"></div>
            </div>`;
        scrollChatToBottom();

        // 3. Prompt de Mentoria e Inyección de Reglas de Negocio de Seguros Monterrey
        const promptEstructural = `
            Actúas como un coach, mentor y promotor altamente exitoso en el sector de seguros de Seguros Monterrey New York Life. 
            Tu objetivo es dar respuestas claras, prácticas y estratégicas. Conoces a la perfección las tasas de comisión inicial (Primer Año):
            - Star Temporal: 35%
            - Orvi 99: 44%
            - Respaldo Educativo: 35%
            - Segubeca: 37%
            - Respaldo Negocio: 35%
            - Mío: 80%
            - Imagina Ser: 35%
            - Objetivo Vida: 44%
            - Nuevo Plenitud: 35%
            - Vida Mujer: 40%
            - Alfa Medical (GMM): 17%
            - Alfa Medical Flex (GMM): 15%
            - Alfa Medical Internacional (GMM): 17%

            Regla Operativa Crítica: Si el usuario es un Asesor en Desarrollo y pregunta por productos de Vida, recuerda que las pólizas emiten y participan al 90% del diseño del producto base por reglas actuariales del cuaderno (las comisiones se multiplican por 0.90).
            Evita introducciones largas o motivación vacía. Responde directamente la pregunta del asesor de forma concisa: "${userMsg}"`;

        // 4. Invocar el motor centralizado
        await callGemini(promptEstructural, uniqueResId);
        
        // Alerta sonora sutil de fin de proceso
        notificationSound.play().catch(() => {});
        scrollChatToBottom();
    }

    // Escuchadores de eventos para el disparador de envío (Tecla Enter y Botón)
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') procesarMensajeChat(); });
    if (chatSend) chatSend.addEventListener('click', procesarMensajeChat);
});
