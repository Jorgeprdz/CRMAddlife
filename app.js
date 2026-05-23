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
        // En lugar de sobreescribir con span, si es iMessage inyectamos texto directo.
        outputEl.innerHTML = '<span style="opacity:0.6;">Escribiendo...</span>';
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
// SECCIÓN 7: INICIALIZACIÓN GLOBAL (DOM READY)
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

    if (!user) {
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
        if (navBar) navBar.style.display = 'flex';
        window.navigateTo('dashboard');
        resetInactivityTimer();
    }

    // =========================================================================
    // SECCIÓN 8: CONTROLADOR DEL CHATBOT FLOTANTE (iMESSAGE STYLE)
    // =========================================================================
    const bubble = document.getElementById('ai-chat-bubble');
    const windowChat = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const chatInput = document.getElementById('ai-chat-input');
    const msgContainer = document.getElementById('ai-chat-messages');
    
    // Sonido de notificación "Pop" (URL de archivo público muy ligero)
    const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    notificationSound.volume = 0.4;

    const scrollChatToBottom = () => {
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };

    // Alternar visibilidad de la ventana
    bubble.addEventListener('click', () => {
        windowChat.style.display = windowChat.style.display === 'flex' ? 'none' : 'flex';
        if (windowChat.style.display === 'flex') {
            chatInput.focus();
            scrollChatToBottom();
        }
    });

    closeBtn.addEventListener('click', () => windowChat.style.display = 'none');

    // Procesar mensaje con la tecla Enter
    chatInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            const userMsg = chatInput.value.trim();
            chatInput.value = '';

            // 1. Renderizar burbuja del usuario (Azul)
            msgContainer.innerHTML += `<div class="chat-bubble user-bubble">${userMsg}</div>`;
            scrollChatToBottom();

            // 2. Crear ID dinámico para la respuesta que viene en camino
            const uniqueResId = 'ia-res-' + Date.now();
            
            // 3. Renderizar burbuja de espera de la IA (Gris)
            msgContainer.innerHTML += `<div class="chat-bubble ia-bubble" id="${uniqueResId}"></div>`;
            scrollChatToBottom();

            // 4. Llamar al motor y reproducir sonido al terminar
            await callGemini(userMsg, uniqueResId);
            
            // Reproducir sonido si el navegador lo permite
            notificationSound.play().catch(() => console.log("Auto-play bloqueado temporalmente por el navegador."));
            scrollChatToBottom();
        }
    });
});
