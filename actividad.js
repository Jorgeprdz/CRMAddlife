import { DB } from './db.js';
import { callGemini } from './app.js';
import { showToast } from './utils.js';

const BaremoOficial = {
    referidos: 3,
    llamadas: 1,
    citas_agendadas: 3,
    citas_conectadas: 2,
    citas_cierre: 3,
    solicitudes: 5,
    pagadas: 10
};

let estadoLocal = { referidos:0, llamadas:0, citas_agendadas:0, citas_conectadas:0, citas_cierre:0, solicitudes:0, pagadas:0 };
let esRegistroExistente = false;

export function renderActividad() {
    return `
        <div id="actividad-root" style="padding-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="font-size:22px; font-weight:700; margin:0;">Dashboard Diario</h2>
                <button id="btn-save-actividad" class="btn-primary" style="border-radius:20px; font-size:12px; padding:6px 16px!important;">Guardar</button>
            </div>

            <div class="ios-widget" style="background:linear-gradient(135deg, #007AFF 0%, #0056b3 100%); color:white; padding:24px; text-align:center; box-shadow:0 10px 30px rgba(0,122,255,0.3); margin-bottom:16px;">
                <span style="font-size:12px; text-transform:uppercase; font-weight:600; opacity:0.9; letter-spacing:1px;">Productividad Hoy</span>
                <div id="act-pts-total" style="font-size:56px; font-weight:800; letter-spacing:-2px; line-height:1.1; margin:8px 0;">0</div>
                <span style="font-size:13px; opacity:0.8;">Puntos Baremo Oficial</span>
            </div>

            <div class="ios-widget" style="margin-bottom:16px; border-left:4px solid var(--warning); padding:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span style="font-size:16px;">🤖</span>
                    <strong style="font-size:13px;">Coach de Actividad AI</strong>
                </div>
                <div id="ai-activity-tip" style="font-size:13px; color:var(--text-secondary); line-height:1.4;">Analizando tu ritmo de hoy...</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                ${Object.keys(BaremoOficial).map(k => `
                    <div class="ios-widget" style="padding:16px;">
                        <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">${k.replace('_', ' ')}</span>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                            <strong id="val-${k}" style="font-size:24px; color:var(--text-primary);">0</strong>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <button data-act="${k}" data-val="1" style="width:28px; height:28px; border-radius:50%; border:none; background:var(--surface-2); color:var(--text-primary); font-size:16px; font-weight:bold; cursor:pointer;">+</button>
                                <button data-act="${k}" data-val="-1" style="width:28px; height:28px; border-radius:50%; border:none; background:var(--surface-2); color:var(--text-secondary); font-size:16px; font-weight:bold; cursor:pointer;">-</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export async function bindActividadEvents() {
    await cargarDatos();
    document.getElementById('actividad-root').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) modificar(btn.getAttribute('data-act'), parseInt(btn.getAttribute('data-val')));
    });
    document.getElementById('btn-save-actividad').addEventListener('click', guardarDatos);
}

async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0];
    const registros = await DB.obtenerTodos('actividad_diaria');
    const delDia = registros.find(r => r.id === hoy);
    if (delDia) { estadoLocal = {...estadoLocal, ...delDia}; esRegistroExistente = true; }
    actualizarUI();
}

function modificar(key, delta) {
    estadoLocal[key] = Math.max(0, (estadoLocal[key] || 0) + delta);
    actualizarUI();
}

function actualizarUI() {
    let pts = 0;
    for (let k in BaremoOficial) {
        pts += (estadoLocal[k] || 0) * BaremoOficial[k];
        const el = document.getElementById(`val-${k}`);
        if(el) el.innerText = estadoLocal[k] || 0;
    }
    document.getElementById('act-pts-total').innerText = pts;
}

async function guardarDatos() {
    const hoy = new Date().toISOString().split('T')[0];
    estadoLocal.id = hoy;
    if (esRegistroExistente) await DB.actualizar('actividad_diaria', hoy, estadoLocal);
    else { await DB.guardar('actividad_diaria', estadoLocal); esRegistroExistente = true; }
    showToast('Actividad guardada', 'success');
    generarTipAI();
}

async function generarTipAI() {
    const prompt = `Analiza mi actividad de ventas de seguros hoy: Referidos:${estadoLocal.referidos}, Llamadas:${estadoLocal.llamadas}, Citas:${estadoLocal.citas_agendadas}. Dame 1 línea corta y motivadora sobre qué debo hacer para mejorar o si voy excelente. Sin saludos. Estilo fitness dashboard.`;
    await callGemini(prompt, 'ai-activity-tip');
}
