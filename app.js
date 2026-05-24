// /core/app.js - Orquestador Principal y Lógica Base

import { DB, processOfflineQueue } from './db.js';
import { showToast } from './utils.js';
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

const ENV = {
    SUPABASE_URL: 'https://rmlxigxysujsuwzgoimv.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts'
};

// =========================================================================
// 1. SERVICES: AUTH
// =========================================================================
class AuthService {
    constructor() {
        this.client = null;
    }
    init() {
        if (window.supabase) {
            this.client = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
            window.supabaseClient = this.client; // Link para legacy files
            return true;
        }
        return false;
    }
    async getUser() {
        if (!this.client) return null;
        const { data } = await this.client.auth.getUser();
        return data?.user || null;
    }
    async login() {
        const siteUrl = window.location.origin + window.location.pathname;
        await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } });
    }
    async logout() {
        await this.client.auth.signOut();
        window.location.reload();
    }
}

// =========================================================================
// 2. ROUTER: NAVEGACIÓN SPA NATIVA
// =========================================================================
class Router {
    constructor() {
        this.routes = {
            'dashboard': { render: renderDashboard, bind: bindDashboardEvents },
            'prospeccion': { render: renderProspeccion, bind: bindProspeccionEvents },
            'referidos': { render: renderReferidos, bind: bindReferidosEvents },
            'actividad': { render: renderActividad, bind: bindActividadEvents },
            'cartera': { render: renderCartera, bind: bindCarteraEvents },
            'comisiones': { render: renderComisiones, bind: bindComisionesEvents }
        };
        this.contentArea = document.getElementById('app-content');
    }

    navigate(moduleName) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-target="${moduleName}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        if (!this.contentArea || !this.routes[moduleName]) return;

        try {
            this.contentArea.innerHTML = this.routes[moduleName].render();
            setTimeout(() => this.routes[moduleName].bind(), 10);
        } catch (e) {
            console.error(`[Router] Fallo al cargar módulo: ${moduleName}`, e);
        }
    }
}

// =========================================================================
// 3. AI SERVICE: MOTOR CON MEMORIA DE CONTEXTO
// =========================================================================
class AIService {
    constructor(authClient) {
        this.auth = authClient;
        this.history = []; // Historial de conversación
        this.MAX_HISTORY = 6;
    }

    async callApi(prompt, outputId) {
        const outputEl = document.getElementById(outputId);
        if (outputEl) outputEl.innerHTML = '<span style="opacity:0.6; display:flex; align-items:center; gap:5px;"><span class="spinner-mini">⚙️</span> Procesando táctica...</span>';
        
        try {
            if (!this.auth.client) throw new Error("Cliente de BD inactivo.");
            
            const { data, error } = await this.auth.client.functions.invoke('gemini-proxy', { body: { prompt } });
            if (error) throw new Error(error.message);
            
            let texto = data?.respuesta || data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!texto) throw new Error("Respuesta corrompida del modelo.");

            const formatted = texto.replace(/\n/g, '<br>');
            if (outputEl) outputEl.innerHTML = formatted;
            return texto;
        } catch (err) {
            console.error("[AI Service]", err);
            if (outputEl) outputEl.innerHTML = `<span style="color:var(--danger); font-size:12px;">⚠️ Fallo de inferencia: ${err.message}</span>`;
            return null;
        }
    }

    async processChatRequest(userMsg, uiManager) {
        uiManager.addMessage(userMsg, 'user');
        const uniqueId = uiManager.addLoadingBubble();

        const cartera = await DB.obtenerTodos('cartera');
        const metrics = this._calcMetrics(cartera);

        this.history.push(`Asesor: ${userMsg}`);
        if (this.history.length > this.MAX_HISTORY) this.history.shift();

        const prompt = `
            Actúas exclusivamente como el Consultor Senior de Estrategia Comercial de Seguros Monterrey. 
            Métricas del Asesor:
            - Prima mes actual: $${metrics.prodMesActual.toLocaleString('es-MX')} (${metrics.vidasMes} casos).
            - Prima mes anterior: $${metrics.prodMesAnterior.toLocaleString('es-MX')}.

            Historial de esta conversación activa:
            ${this.history.join('\n')}

            Responde directamente a la última intervención. NUNCA inicies con saludos. Sé directo y usa estructura de viñetas si amerita. Si es una objeción, aporta guion, psicología y modulación de voz.`;

        const respuesta = await this.callApi(prompt, uniqueId);
        if (respuesta) this.history.push(`Consultor: ${respuesta}`);
        uiManager.scrollToBottom();
    }

    _calcMetrics(cartera) {
        const hoy = new Date();
        let prodMesActual = 0, prodMesAnterior = 0, vidasMes = 0;
        
        cartera.forEach(p => {
            if (!p.emision) return;
            const fp = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : new Date(p.emision + 'T12:00:00');
            const diff = (hoy.getFullYear() - fp.getFullYear()) * 12 + (hoy.getMonth() - fp.getMonth());
            const primaVal = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
            
            if (diff === 0) { prodMesActual += primaVal; vidasMes++; }
            else if (diff === 1) { prodMesAnterior += primaVal; }
        });
        return { prodMesActual, prodMesAnterior, vidasMes };
    }
}

// =========================================================================
// 4. UI COMPONENTS: CHATBOT MANAGER
// =========================================================================
class ChatbotManager {
    constructor(aiService) {
        this.ai = aiService;
        this.window = document.getElementById('ai-chat-window');
        this.input = document.getElementById('ai-chat-input');
        this.container = document.getElementById('ai-chat-messages');
        this.sound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        this.sound.volume = 0.2;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('ai-chat-bubble')?.addEventListener('click', () => this.toggle());
        document.getElementById('close-chat')?.addEventListener('click', () => this.toggle(false));
        
        this.input?.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') this.send(); 
        });
        document.getElementById('ai-chat-send')?.addEventListener('click', () => this.send());
    }

    toggle(force = null) {
        const isFlex = this.window.style.display === 'flex';
        this.window.style.display = (force !== null ? force : !isFlex) ? 'flex' : 'none';
        if (this.window.style.display === 'flex') {
            this.input.focus();
            this.scrollToBottom();
        }
    }

    async send() {
        const text = this.input.value.trim();
        if (!text) return;
        this.input.value = '';
        await this.ai.processChatRequest(text, this);
        this.sound.play().catch(()=>{});
    }

    addMessage(text, type) {
        this.container.insertAdjacentHTML('beforeend', `<div class="msg-row ${type}-row"><div class="chat-bubble ${type}-bubble">${text}</div></div>`);
        this.scrollToBottom();
    }

    addLoadingBubble() {
        const id = 'ia-' + Date.now();
        this.container.insertAdjacentHTML('beforeend', `<div class="msg-row ia-row"><div class="chat-bubble ia-bubble" id="${id}"></div></div>`);
        this.scrollToBottom();
        return id;
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }
}

// =========================================================================
// 5. CORE BOOTSTRAP: ORQUESTADOR MAESTRO
// =========================================================================
class AppManager {
    constructor() {
        this.auth = new AuthService();
        this.router = new Router();
        this.ai = new AIService(this.auth);
        
        this.bindGlobalListeners();
    }

    async init() {
        this.initTheme();
        this.setupActivityTimer();

        let attempts = 0;
        while (!this.auth.init() && attempts < 20) { await new Promise(r => setTimeout(r, 100)); attempts++; }

        const content = document.getElementById('app-content');
        if (!this.auth.client) {
            content.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-secondary);">Error: SDK Cloud Inaccesible.</div>`;
            return;
        }

        const user = await this.auth.getUser();
        
        if (!user) {
            document.getElementById('main-sidebar').style.display = 'none';
            document.getElementById('ai-chat-bubble').style.display = 'none';
            content.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; min-height:70vh; padding:20px;">
                    <div class="card" style="text-align:center; width:100%; max-width:340px; box-shadow:var(--shadow-float);">
                        <h1 style="margin-bottom:8px;">CRM Core</h1>
                        <p style="color:var(--text-secondary); margin-bottom:24px; font-size:13px;">Inicia sesión de forma segura.</p>
                        <button class="btn-primary" id="btn-login-core" style="width:100%;">Continuar con Google</button>
                    </div>
                </div>`;
        } else {
            document.getElementById('main-sidebar').style.display = 'flex';
            document.getElementById('ai-chat-bubble').style.display = 'flex';
            
            new ChatbotManager(this.ai);
            this.router.navigate('dashboard');
            processOfflineQueue();
        }
    }

    initTheme() {
        const theme = localStorage.getItem('crm_theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.checked = (theme === 'dark');
            toggle.addEventListener('change', () => {
                const nxt = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nxt);
                localStorage.setItem('crm_theme', nxt);
            });
        }
    }

    setupActivityTimer() {
        let timer;
        const reset = () => { clearTimeout(timer); timer = setTimeout(() => this.auth.logout(), 30 * 60 * 1000); };
        ['mousedown', 'mousemove', 'keypress', 'touchstart'].forEach(e => 
            document.addEventListener(e, reset, { passive: true })
        );
    }

    bindGlobalListeners() {
        document.body.addEventListener('click', (e) => {
            const nav = e.target.closest('.nav-btn');
            if (nav && !nav.classList.contains('nav-btn-logout')) this.router.navigate(nav.getAttribute('data-target'));
            
            if (e.target.closest('#btn-login-core')) this.auth.login();
            if (e.target.closest('.nav-btn-logout')) this.auth.logout();
        });
    }
}

// -------------------------------------------------------------------------
// INICIALIZACIÓN
// -------------------------------------------------------------------------
const App = new AppManager();
document.addEventListener('DOMContentLoaded', () => App.init());

// =========================================================================
// PATRÓN PUENTE (LEGACY SUPPORT)
// =========================================================================
window.navigateTo = (modulo) => App.router.navigate(modulo);
window.loginConGoogle = () => App.auth.login();
window.cerrarSesion = () => App.auth.logout();
export const getSupabase = () => App.auth.client;
export const callGemini = (prompt, targetId) => App.ai.callApi(prompt, targetId);
