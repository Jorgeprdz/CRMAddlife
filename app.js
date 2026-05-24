// app.js - Motor Central y Chatbot de Mentoría
import { DB, processOfflineQueue } from './db.js';
import { showToast } from './utils.js';
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
let supabase = null;
let memoriaChat = []; // Historial de conversación

export const getSupabase = () => supabase;

export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (outputEl) outputEl.innerHTML = '<span style="opacity:0.5;">Analizando estrategia...</span>';
    
    try {
        if (!supabase) throw new Error("Cliente Supabase no inicializado.");
        const { data, error } = await supabase.functions.invoke('gemini-proxy', { body: { prompt } });
        if (error) throw new Error(error.message);
        
        let texto = data.respuesta || data.text;
        if (!texto && data.candidates && data.candidates[0]) {
            texto = data.candidates[0].content.parts[0].text;
        }
        if (!texto) throw new Error("Estructura de respuesta no válida.");

        const formatted = texto.replace(/\n/g, '<br>');
        if (outputEl) outputEl.innerHTML = formatted;
        return texto;
    } catch (err) {
        console.error(err);
        if (outputEl) outputEl.innerHTML = `<span style="color:var(--danger);">Error de conexión: ${err.message}</span>`;
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
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } });
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

    if (moduleName === 'dashboard') { contentArea.innerHTML = renderDashboard(); setTimeout(bindDashboardEvents, 50); }
    else if (moduleName === 'prospeccion') { contentArea.innerHTML = renderProspeccion(); setTimeout(bindProspeccionEvents, 50); }
    else if (moduleName === 'referidos') { contentArea.innerHTML = renderReferidos(); setTimeout(bindReferidosEvents, 50); }
    else if (moduleName === 'actividad') { contentArea.innerHTML = renderActividad(); setTimeout(bindActividadEvents, 50); }
    else if (moduleName === 'cartera') { contentArea.innerHTML = renderCartera(); setTimeout(bindCarteraEvents, 50); }
    else if (moduleName === 'comisiones') { contentArea.innerHTML = renderComisiones(); setTimeout(bindComisionesEvents, 50); }
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    let intentos = 0;
    while (!inicializarSupabase() && intentos < 20) { await new Promise(r => setTimeout(r, 100)); intentos++; }

    const contentArea = document.getElementById('app-content');
    if (!supabase) {
        contentArea.innerHTML = `<div style="padding:40px; text-align:center;">Error de carga de base de datos.</div>`;
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
                    <h1 style="font-size:24px; margin-bottom:12px;">CRM Addlife Core</h1>
                    <button class="btn-primary" id="btn-google-login" style="width:100%;">Ingresar con Google</button>
                </div>
            </div>`;
    } else {
        if (navBar) navBar.style.display = 'flex';
        if (chatBubble) chatBubble.style.display = 'flex';
        window.navigateTo('dashboard');
        processOfflineQueue();
    }

    const bubble = document.getElementById('ai-chat-bubble');
    const windowChat = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const chatInput = document.getElementById('ai-chat-input');
    const chatSend = document.getElementById('ai-chat-send');
    const msgContainer = document.getElementById('ai-chat-messages');
    
    const scrollBottom = () => msgContainer.scrollTop = msgContainer.scrollHeight;

    bubble.addEventListener('click', () => {
        windowChat.style.display = windowChat.style.display === 'flex' ? 'none' : 'flex';
        if (windowChat.style.display === 'flex') { chatInput.focus(); scrollBottom(); }
    });
    closeBtn.addEventListener('click', () => windowChat.style.display = 'none');

    async function ejecutarTransaccionMensaje() {
        const query = chatInput.value.trim();
        if (!query) return;
        chatInput.value = '';

        msgContainer.innerHTML += `<div class="msg-row user-row"><div class="chat-bubble user-bubble">${query}</div></div>`;
        scrollBottom();

        const uniqueId = 'chat-ia-' + Date.now();
        msgContainer.innerHTML += `<div class="msg-row ia-row"><div class="chat-bubble ia-bubble" id="${uniqueId}"></div></div>`;
        scrollBottom();

        const cartera = await DB.obtenerTodos('cartera');
        const hoy = new Date();
        let volumenMesActual = 0, conteoPolizasMes = 0;

        cartera.forEach(p => {
            if (!p.emision) return;
            const fe = new Date(p.emision + 'T12:00:00');
            if (fe.getMonth() === hoy.getMonth() && fe.getFullYear() === hoy.getFullYear()) {
                volumenMesActual += Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
                conteoPolizasMes++;
            }
        });

        memoriaChat.push(`Asesor: ${query}`);
        if (memoriaChat.length > 8) memoriaChat.shift();

        const promptEstructural = `
            Actúas como el consultor y mentor comercial de seguros más brillante del mundo. Eres directo, estratégico y con gran psicología de ventas.
            
            Contexto del negocio en tiempo real del asesor:
            - Prima neta acumulada cobrada este mes: $${volumenMesActual.toLocaleString('es-MX')} MXN.
            - Total de pólizas ingresadas y vigentes este mes: ${conteoPolizasMes} casos.

            Historial de esta conversación:
            ${memoriaChat.join('\n')}

            Reglas:
            1. Responde directamente la duda.
            2. Si es una objeción, usa esta estructura: Guion matador (2 líneas) <br> Psicología del prospecto <br> Tip de modulación de voz.
            3. No uses motivación vacía, teoría sin aplicación ni saludos. Ve directo a la táctica.`;

        const textoRespuestaIA = await callGemini(promptEstructural, uniqueId);
        if (textoRespuestaIA) memoriaChat.push(`Mentor: ${textoRespuestaIA}`);
        scrollBottom();
    }

    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarTransaccionMensaje(); });
    if (chatSend) chatSend.addEventListener('click', ejecutarTransaccionMensaje);
});
