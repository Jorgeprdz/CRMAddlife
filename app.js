console.log('APP VERSION V6');

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

// ═══════════════════════════════════════════════════════════════
// AUTH SERVICE
// ═══════════════════════════════════════════════════════════════

class AuthService {

    constructor() {
        this.client = null;
    }

    init() {

        if (!window.supabase) {
            console.error('Supabase no encontrado');
            return false;
        }

        this.client = window.supabase.createClient(
            ENV.SUPABASE_URL,
            ENV.SUPABASE_KEY
        );

        window.supabaseClient = this.client;

        return true;
    }

    async getUser() {

        if (!this.client) return null;

        try {

            const {
                data,
                error
            } = await this.client.auth.getUser();

            if (error) {
                console.error(error);
                return null;
            }

            return data?.user || null;

        } catch (err) {

            console.error(err);
            return null;
        }
    }

    async login() {

        await this.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    }

    async logout() {

        await this.client.auth.signOut();

        localStorage.clear();

        window.location.reload();
    }
}

// ═══════════════════════════════════════════════════════════════
// AI SERVICE
// ═══════════════════════════════════════════════════════════════

class AIService {

    constructor(authClient) {

        this.auth = authClient;
        this.history = [];
    }

    async callApi(prompt, outputId) {

        const outputEl =
            document.getElementById(outputId);

        try {

            const {
                data,
                error
            } = await this.auth.client
                .functions
                .invoke('gemini-proxy', {
                    body: { prompt }
                });

            if (error) throw error;

            let texto =
                data?.respuesta ||
                data?.text ||
                data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (outputEl) {
                outputEl.innerHTML =
                    texto.replace(/\n/g, '<br>');
            }

            return texto;

        } catch (err) {

            console.error(err);

            if (outputEl) {

                outputEl.innerHTML =
                    `<span style="color:var(--danger);">
                        ⚠️ Error: ${err.message}
                    </span>`;
            }

            return null;
        }
    }

    async processChatRequest(userMsg, uiManager) {

        uiManager.addMessage(userMsg, 'user');

        const uniqueId =
            uiManager.addLoadingBubble();

        const prompt = `
            Eres un Mentor Comercial Profesional.
            Ayuda al usuario a cerrar más ventas.
            Máximo 2 párrafos.
            Sé directo y técnico.

            Mensaje:
            ${userMsg}
        `;

        await this.callApi(prompt, uniqueId);

        uiManager.scrollToBottom();
    }
}

// ═══════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════

class Router {

    async navigate(route) {

        const content =
            document.getElementById('app-content');

        if (!content) return;

        switch (route) {

            case 'dashboard':

                content.innerHTML =
                    renderDashboard();

                await bindDashboardEvents();

                break;

            case 'prospeccion':

                content.innerHTML =
                    renderProspeccion();

                await bindProspeccionEvents();

                break;

            case 'referidos':

                content.innerHTML =
                    renderReferidos();

                await bindReferidosEvents();

                break;

            case 'actividad':

                content.innerHTML =
                    renderActividad();

                await bindActividadEvents();

                break;

            case 'cartera':

                content.innerHTML =
                    renderCartera();

                await bindCarteraEvents();

                break;

            case 'comisiones':

                content.innerHTML =
                    renderComisiones();

                await bindComisionesEvents();

                break;

            default:

                content.innerHTML =
                    renderDashboard();

                await bindDashboardEvents();
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// APP MANAGER
// ═══════════════════════════════════════════════════════════════

class AppManager {

    constructor() {

        this.auth = new AuthService();
        this.router = new Router();
        this.ai = new AIService(this.auth);

        this.bindGlobalListeners();
    }

    async init() {

        if (!this.auth.init()) return;

        try {

            const user =
                await this.auth.getUser();

            if (!user) {

                document.getElementById(
                    'app-content'
                ).innerHTML = `
                    <div style="
                        padding:40px;
                        text-align:center;
                    ">
                        <h1>Addlife CRM</h1>

                        <button
                            class="btn-primary"
                            id="btn-login-core"
                        >
                            Ingresar con Google
                        </button>
                    </div>
                `;

                return;
            }

            document.getElementById(
                'main-sidebar'
            ).style.display = 'flex';

            document.getElementById(
                'ai-chat-bubble'
            ).style.display = 'flex';

            processOfflineQueue();

            this.router.navigate('dashboard');

        } catch (err) {

            console.error(err);

            showToast(
                'Error inicializando app',
                'danger'
            );
        }
    }

    bindGlobalListeners() {

        document.body.addEventListener(
            'click',
            (e) => {

                const nav =
                    e.target.closest('.nav-btn');

                if (nav) {

                    const target =
                        nav.getAttribute(
                            'data-target'
                        );

                    this.router.navigate(target);
                }

                if (
                    e.target.id ===
                    'btn-login-core'
                ) {
                    this.auth.login();
                }
            }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL APP
// ═══════════════════════════════════════════════════════════════

window.App = new AppManager();

document.addEventListener(
    'DOMContentLoaded',
    () => window.App.init()
);