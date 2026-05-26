// app.js - Núcleo de la aplicación
import { DB, processOfflineQueue } from './db.js';
import { showToast } from './utils.js';
import { renderDashboard,    bindDashboardEvents    } from './dashboard.js';
import { renderProspeccion,  bindProspeccionEvents  } from './prospeccion.js';
import { renderReferidos,    bindReferidosEvents    } from './referidos.js';
import { renderActividad,    bindActividadEvents    } from './actividad.js';
import { renderCartera,      bindCarteraEvents      } from './cartera.js';
import { renderComisiones,   bindComisionesEvents   } from './comisiones.js';

// ── Credenciales Supabase ─────────────────────────────────────────────────
const SUPABASE_URL = 'https://rmlxigxysujsuwzgoimv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';

let _supabase = null;

// ── Exports que usan los módulos ──────────────────────────────────────────
export const getSupabase = () => _supabase;

export async function callGemini(prompt, outputId) {
    const outputEl = document.getElementById(outputId);
    if (outputEl) outputEl.innerHTML = '<span style="opacity:0.5;">✍️ Escribiendo...</span>';
    try {
        if (!_supabase) throw new Error('Sin conexión a Supabase.');
        const { data, error } = await _supabase.functions.invoke('gemini-proxy', { body: { prompt } });
        if (error) throw new Error(error.message || JSON.stringify(error));
        const texto = data?.respuesta || data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!texto) throw new Error('Respuesta vacía del servidor.');
        const html = texto.replace(/\n/g, '<br>');
        if (outputEl) outputEl.innerHTML = html;
        return html;
    } catch (err) {
        const msg = `<span style="color:var(--danger);">⚠️ ${err.message}</span>`;
        if (outputEl) outputEl.innerHTML = msg;
        return null;
    }
}

// ── Router ────────────────────────────────────────────────────────────────
class Router {
    navigate(moduleName) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-target="${moduleName}"]`)?.classList.add('active');
        const area = document.getElementById('app-content');
        if (!area) return;
        try {
            const map = {
                dashboard:   [renderDashboard,   bindDashboardEvents  ],
                prospeccion: [renderProspeccion,  bindProspeccionEvents ],
                referidos:   [renderReferidos,    bindReferidosEvents  ],
                actividad:   [renderActividad,    bindActividadEvents  ],
                cartera:     [renderCartera,      bindCarteraEvents    ],
                comisiones:  [renderComisiones,   bindComisionesEvents ],
            };
            const [render, bind] = map[moduleName] || [];
            if (render) { area.innerHTML = render(); setTimeout(bind, 50); }
        } catch (e) { console.error('[Router]', e); }
    }
}

// ── Chatbot — Contexto inteligente ────────────────────────────────────────
async function generarContextoIA() {
    try {
        const cartera  = await DB.obtenerTodos('cartera');
        const perfiles = await DB.obtenerTodos('perfil_asesor');
        const historial = await DB.obtenerTodos('historial_actividad');

        const hoy       = new Date();
        const mesActual = hoy.getMonth();
        const anioActual = hoy.getFullYear();

        // Mes anterior
        const mesPasadoDate = new Date(anioActual, mesActual - 1, 1);
        const mesPasado  = mesPasadoDate.getMonth();
        const anioPasado = mesPasadoDate.getFullYear();

        // Perfil del asesor
        let perfilTexto = 'Sin perfil configurado.';
        let mesConcurso = 1;
        let tipoEsquema = 'desarrollo';
        if (perfiles.length > 0) {
            const prf = perfiles[0];
            tipoEsquema = prf.tipo || prf.esquema || 'desarrollo';
            const conexion = new Date((prf.fechaConexion || prf.fecha_conexion) + 'T12:00:00');
            mesConcurso = Math.max(1, Math.floor((hoy - conexion) / (1000*60*60*24*30.44)) + 1);
            perfilTexto = `Tipo: ${tipoEsquema === 'desarrollo' ? 'Asesor en Desarrollo' : 'Nuevo Profesional'}, Mes de concurso: ${mesConcurso}`;
        }

        // Tasas simplificadas para el contexto
        const TASAS_NN = {'Star Temporal':0.35,'Orvi 99':0.44,'Mio':0.80,'Imagina Ser':0.35,'Nuevo Plenitud':0.35,'Respaldo Educativo':0.35,'Respaldo Negocio':0.35,'Vida Mujer':0.40,'Alfa Medical':0.22,'Alfa Medical Flex':0.22,'Alfa Medical Internacional':0.25};
        const TASAS_RY = {'Star Temporal':0.10,'Orvi 99':0.15,'Mio':0.20,'Imagina Ser':0.12,'Nuevo Plenitud':0.12,'Respaldo Educativo':0.10,'Respaldo Negocio':0.10,'Vida Mujer':0.15,'Alfa Medical':0.17,'Alfa Medical Flex':0.17,'Alfa Medical Internacional':0.17};
        const factor = tipoEsquema === 'desarrollo' && mesConcurso <= 12 ? 0.90 : 1.0;

        const calcCom = (p, mesFiltro, anioFiltro) => {
            if (!p.emision) return 0;
            const fE = new Date(p.emision + 'T12:00:00');
            if (fE.getMonth() !== mesFiltro || fE.getFullYear() !== anioFiltro) return 0;
            const prima = Number(String(p.prima||0).replace(/[^0-9.-]/g,''));
            const mesesV = (hoy.getFullYear()-fE.getFullYear())*12+(hoy.getMonth()-fE.getMonth());
            const esRenov = mesesV >= 12;
            const tasa = esRenov ? (TASAS_RY[p.plan]||0.05) : (TASAS_NN[p.plan]||0.10);
            return prima * tasa * (esRenov ? 1 : factor);
        };

        let comMes = 0, comMesPasado = 0, polMes = 0, polMesPasado = 0;
        cartera.forEach(p => {
            const com = calcCom(p, mesActual, anioActual);
            if (com > 0) { comMes += com; polMes++; }
            const comP = calcCom(p, mesPasado, anioPasado);
            if (comP > 0) { comMesPasado += comP; polMesPasado++; }
        });

        // Productividad semanal
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay()===0 ? 6 : hoy.getDay()-1));
        let ptsSemana = 0;
        historial.forEach(r => {
            const f = new Date(r.fecha + 'T12:00:00');
            if (f >= lunes) ptsSemana += Number(r.puntos||0);
        });

        // Metas Training Allowance
        const METAS = {1:{c:9000,p:3},2:{c:15000,p:6},3:{c:21000,p:9},4:{c:31000,p:12},5:{c:39000,p:15},6:{c:51000,p:18},7:{c:13000,p:3},8:{c:21000,p:6},9:{c:32000,p:9},10:{c:43000,p:12},11:{c:55000,p:15},12:{c:70000,p:18}};
        const meta = METAS[Math.min(mesConcurso, 12)] || METAS[12];
        const fmt = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
        const mesNombre = hoy.toLocaleString('es-MX',{month:'long'});
        const mesAnteriorNombre = mesPasadoDate.toLocaleString('es-MX',{month:'long'});

        return `
=== CONTEXTO REAL DEL ASESOR (${hoy.toLocaleDateString('es-MX')}) ===
Perfil: ${perfilTexto}
Factor comisión: ${factor === 0.90 ? '90% (Asesor en Desarrollo)' : '100%'}

COMISIONES ${mesNombre.toUpperCase()}:
- Iniciales + renovación estimadas: ${fmt(comMes)}
- Pólizas con movimiento este mes: ${polMes}

COMISIONES ${mesAnteriorNombre.toUpperCase()} (mes anterior):
- Total estimado: ${fmt(comMesPasado)}
- Pólizas con movimiento: ${polMesPasado}

${tipoEsquema === 'desarrollo' ? `TRAINING ALLOWANCE MES ${Math.min(mesConcurso,12)}:
- Meta comisión acumulada semestre: ${fmt(meta.c)}
- Meta vidas/pólizas semestre: ${meta.p}
- Comisiones iniciales este mes: ${fmt(comMes)}` : ''}

PRODUCTIVIDAD:
- Puntos esta semana: ${ptsSemana} / 125 meta semanal

CARTERA:
- Total pólizas registradas: ${cartera.length}
- Productos en cartera: ${[...new Set(cartera.map(p=>p.plan).filter(Boolean))].join(', ') || 'Sin registros'}
=== FIN CONTEXTO ===`;
    } catch(e) {
        return 'Contexto no disponible temporalmente.';
    }
}

// ── Inicialización ────────────────────────────────────────────────────────
// ── DEBUG: captura errores globales — QUITAR ANTES DE PRODUCCIÓN ─────────
window.onerror = (msg, src, line, col, err) => {
    console.error('[GlobalError]', msg, src, line);
    alert(`⚠️ Error: ${msg}\nArchivo: ${src}\nLínea: ${line}`);
};
window.addEventListener('unhandledrejection', e => {
    console.error('[UnhandledPromise]', e.reason);
    alert(`⚠️ Promise sin manejar: ${e.reason}`);
});

document.addEventListener('DOMContentLoaded', async () => {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = savedTheme === 'dark';
        toggle.addEventListener('change', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    // Inactividad: 10 min
    let inactivityTimer;
    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => { if (_supabase) { _supabase.auth.signOut(); window.location.reload(); } }, 10 * 60 * 1000);
    };
    ['mousedown','mousemove','keypress','scroll','touchstart'].forEach(e => document.addEventListener(e, resetTimer, true));

    // Inicializar Supabase
    const contentArea = document.getElementById('app-content');

    // Mostrar pantalla de carga mientras espera el SDK
    if (contentArea) {
        contentArea.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
            <p style="color:var(--text-secondary);font-size:14px;">⏳ Conectando...</p>
        </div>`;
    }

    let intentos = 0;
    console.log('[Debug] Esperando window.supabase...');
    while (!window.supabase && intentos < 50) {   // 5 segundos máximo
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    console.log(`[Debug] window.supabase disponible: ${!!window.supabase} (intentos: ${intentos})`);

    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseClient = _supabase;
        console.log('[Debug] Supabase client creado correctamente.');
    } else {
        console.error('[Debug] SDK de Supabase no cargó después de 5s.');
    }

    const router = new Router();
    window.navigateTo = (m) => router.navigate(m);

    // Logout global
    window.cerrarSesion = async () => {
        if (_supabase) await _supabase.auth.signOut();
        window.location.reload();
    };

    const navBar      = document.getElementById('main-sidebar');
    const chatBubble  = document.getElementById('ai-chat-bubble');

    if (!_supabase) {
        console.error('[Debug] _supabase es null — mostrando pantalla de error.');
        contentArea.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;padding:24px;"><div class="card" style="text-align:center;max-width:360px;width:100%;"><h2 style="color:var(--danger);">Sin conexión</h2><p style="color:var(--text-secondary);font-size:14px;">No se pudo conectar con el servidor. Revisa tu conexión.</p><button class="btn-primary" onclick="location.reload()" style="margin-top:16px;width:100%;">🔄 Reintentar</button></div></div>`;
        return;
    }

    console.log('[Debug] Verificando sesión de usuario...');
    const { data: { user }, error: authError } = await _supabase.auth.getUser();
    console.log(`[Debug] Usuario: ${user ? user.email : 'null'} | Error: ${authError?.message || 'ninguno'}`);

    if (!user) {
        if (navBar)     navBar.style.display    = 'none';
        if (chatBubble) chatBubble.style.display = 'none';
        contentArea.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:24px;">
                <div class="card" style="text-align:center;width:100%;max-width:360px;">
                    <div style="font-size:48px;margin-bottom:16px;">🧩</div>
                    <h1 style="font-size:24px;margin-bottom:8px;">CRM Addlife</h1>
                    <p style="color:var(--text-secondary);margin-bottom:28px;font-size:14px;line-height:1.5;">Ecosistema de Inteligencia Privada para Asesores SMNYL</p>
                    <button id="btn-google-login" class="btn-primary" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width:18px;height:18px;">
                        Continuar con Google
                    </button>
                </div>
            </div>`;
        document.getElementById('btn-google-login').addEventListener('click', () => {
            _supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
        });
    } else {
        // Actualizar header con avatar y nombre
        const avatar = document.getElementById('header-avatar');
        const greeting = document.getElementById('header-greeting');
        const headerName = document.getElementById('header-name');
        if (avatar && user.user_metadata?.avatar_url) {
            avatar.src = user.user_metadata.avatar_url;
            avatar.style.display = 'block';
        }
        if (greeting) greeting.innerText = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
        if (headerName) headerName.innerText = user.user_metadata?.full_name?.split(' ')[0] || user.email;

        if (navBar)     navBar.style.display    = 'flex';
        if (chatBubble) chatBubble.style.display = 'flex';
        router.navigate('dashboard');
        resetTimer();
        processOfflineQueue();
    }

    // ── Chatbot ───────────────────────────────────────────────────────────
    const bubble      = document.getElementById('ai-chat-bubble');
    const chatWindow  = document.getElementById('ai-chat-window');
    const closeBtn    = document.getElementById('close-chat');
    const chatInput   = document.getElementById('ai-chat-input');
    const chatSend    = document.getElementById('ai-chat-send');
    const msgContainer = document.getElementById('ai-chat-messages');

    if (!bubble || !chatWindow || !msgContainer) return;

    const scrollBottom = () => { msgContainer.scrollTop = msgContainer.scrollHeight; };

    bubble.addEventListener('click', () => {
        const isOpen = chatWindow.style.display === 'flex';
        chatWindow.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) { chatInput?.focus(); scrollBottom(); }
    });
    closeBtn?.addEventListener('click', () => { chatWindow.style.display = 'none'; });

    async function enviarMensaje() {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;
        chatInput.value = '';

        // Burbuja usuario
        msgContainer.innerHTML += `<div class="msg-row user-row"><div class="chat-bubble user-bubble">${userMsg}</div></div>`;
        scrollBottom();

        // ID único para la respuesta
        const resId = 'chat-res-' + Date.now();
        msgContainer.innerHTML += `<div class="msg-row ia-row"><div class="chat-bubble ia-bubble" id="${resId}"></div></div>`;
        scrollBottom();

        // Construir prompt con contexto real calculado
        const contexto = await generarContextoIA();

        const prompt = `Eres un mentor comercial experto en Seguros Monterrey New York Life (SMNYL).
Responde de forma directa, concisa y práctica. Máximo 3 párrafos cortos o una lista de puntos.
No inventes datos — usa SOLO los números del contexto para responder preguntas sobre comisiones, pólizas o metas.
Si la pregunta es sobre estrategia de ventas o prospectos, responde con tácticas concretas de SMNYL.

${contexto}

Pregunta del asesor: "${userMsg}"`;

        await callGemini(prompt, resId);

        // Sonido sutil
        try { new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play(); } catch(e) {}
        scrollBottom();
    }

    chatInput?.addEventListener('keypress', e => { if (e.key === 'Enter') enviarMensaje(); });
    chatSend?.addEventListener('click', enviarMensaje);

    // Clicks globales del nav
    document.body.addEventListener('click', e => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.classList.contains('nav-btn-logout')) {
            router.navigate(navBtn.getAttribute('data-target'));
        }
        if (e.target.closest('#btn-cerrar-sesion')) window.cerrarSesion();
    });
});
