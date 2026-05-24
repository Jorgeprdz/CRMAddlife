import { DB, processOfflineQueue } from './db.js';
import { showToast } from './utils.js';
import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';
import { renderComisiones, bindComisionesEvents } from './comisiones.js';

const ENV = {
    SUPABASE_URL: 'TU_URL_SUPABASE',
    SUPABASE_KEY: 'TU_ANON_KEY'
};

class AuthService {
    constructor() { this.client = null; }
    init() {
        if (window.supabase) {
            this.client = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
            window.supabaseClient = this.client; 
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
        await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    }
    async logout() {
        await this.client.auth.signOut();
        window.location.reload();
    }
}

class AIService {
    constructor(authClient) {
        this.auth = authClient;
        this.history = [];
    }

    async callApi(prompt, outputId) {
        const outputEl = document.getElementById(outputId);
        try {
            const { data, error } = await this.auth.client.functions.invoke('gemini-proxy', { body: { prompt } });
            if (error) throw error;
            let texto = data?.respuesta || data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (outputEl) outputEl.innerHTML = texto.replace(/\n/g, '<br>');
            return texto;
        } catch (err) {
            if (outputEl) outputEl.innerHTML = `<span style="color:var(--danger);">⚠️ Error: ${err.message}</span>`;
            return null;
        }
    }

    async processChatRequest(userMsg, uiManager) {
        uiManager.addMessage(userMsg, 'user');
        const uniqueId = uiManager.addLoadingBubble();

        const prompt = `
            Eres un Mentor Comercial Profesional.
            Tu objetivo es ayudar al usuario a cerrar más ventas y optimizar su embudo.
            REGLAS: Máximo 2 párrafos, sé directo, profesional y técnico. No menciones marcas ni metas personales.
            Mensaje del usuario: ${userMsg}`;

        const respuesta = await this.callApi(prompt, uniqueId);
        uiManager.scrollToBottom();
    }
}

class AppManager {
    constructor() {
        this.auth = new AuthService();
        this.router = new Router();
        this.ai = new AIService(this.auth);
        this.bindGlobalListeners();
    }

    async init() {
        if (!this.auth.init()) return;
        const user = await this.auth.getUser();
        
        if (!user) {
            document.getElementById('app-content').innerHTML = `
                <div style="padding:40px; text-align:center;">
                    <h1>Addlife CRM</h1>
                    <button class="btn-primary" id="btn-login-core">Ingresar con Google</button>
                </div>`;
        } else {
            document.getElementById('main-sidebar').style.display = 'flex';
            document.getElementById('ai-chat-bubble').style.display = 'flex';
            this.router.navigate('dashboard');
        }
    }

    bindGlobalListeners() {
        document.body.addEventListener('click', (e) => {
            const nav = e.target.closest('.nav-btn');
            if (nav) this.router.navigate(nav.getAttribute('data-target'));
            if (e.target.id === 'btn-login-core') this.auth.login();
        });
    }
}

const App = new AppManager();
document.addEventListener('DOMContentLoaded', () => App.init());
