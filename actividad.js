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
let historicoSemanal = [];

export function renderActividad() {
    return `
        <div id="actividad-root" style="padding-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="font-size:22px; font-weight:700; margin:0;">Dashboard Diario</h2>
                <button id="btn-save-actividad" class="btn-primary btn-sm" style="border-radius:20px; padding:6px 16px!important;">Sincronizar</button>
            </div>

            <div class="glass-widget" style="background:linear-gradient(135deg, rgba(0,122,255,0.9) 0%, rgba(0,86,179,0.9) 100%); color:white; padding:20px; text-align:center; margin-bottom:16px; border:none;">
                <span style="font-size:11px; text-transform:uppercase; font-weight:700; opacity:0.8; letter-spacing:1px;">Puntos Oficiales Hoy</span>
                <div id="act-pts-total" style="font-size:48px; font-weight:800; letter-spacing:-2px; line-height:1; margin:8px 0;">0</div>
            </div>

            <div class="glass-widget" style="margin-bottom:16px; border-left:3px solid var(--warning); padding:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="font-size:16px;">🧠</span>
                    <strong style="font-size:13px; letter-spacing:-0.2px;">Coach de Productividad IA</strong>
                </div>
                <div id="ai-activity-tip" style="font-size:13px; color:var(--text-secondary); line-height:1.4;">Haz clic en sincronizar para obtener feedback en tiempo real.</div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:20px;">
                ${Object.keys(BaremoOficial).map(k => `
                    <div class="glass-widget" style="padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:10px; color:var(--text-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                            ${k.replace('_', ' ')} <span style="opacity:0.5;">(${BaremoOficial[k]}pts)</span>
                        </span>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                            <strong id="val-${k}" style="font-size:24px; color:var(--text-primary); font-weight:700;">0</strong>
                            <div style="display:flex; gap:6px;">
                                <button data-act="${k}" data-val="-1" style="width:28px; height:28px; border-radius:50%; border:none; background:rgba(150,150,150,0.1); color:var(--text-secondary); font-size:16px; font-weight:bold; cursor:pointer;">-</button>
                                <button data-act="${k}" data-val="1" style="width:28px; height:28px; border-radius:50%; border:none; background:rgba(0,122,255,0.1); color:#007AFF; font-size:16px; font-weight:bold; cursor:pointer;">+</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <h3 style="font-size:16px; margin-bottom:12px;">📈 Embudo y Bateo (Semanal)</h3>
            <div class="glass-widget" style="padding:16px;">
                <div id="act-kpi-bateo" style="padding:12px; background:rgba(52, 199, 89, 0.1); border-radius:12px; margin-bottom:16px; border:1px solid rgba(52, 199, 89, 0.2);">
                    <span style="font-size:11px; color:#248A3D; font-weight:700; text-transform:uppercase;">Porcentaje de Bateo (Referido a Póliza)</span>
                    <div style="font-size:20px; font-weight:800; color:#248A3D; margin-top:4px;" id="val-bateo">Calculando...</div>
                </div>
                <div id="act-ratios-conversion" style="font-size:12px; display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        </div>
    `;
}

export async function bindActividadEvents() {
    await cargarDatos();
    
    const root = document.getElementById('actividad-root');
    root.removeEventListener('click', handleClicks);
    root.addEventListener('click', handleClicks);
}

function handleClicks(e) {
    if (e.target.id === 'btn-save-actividad') {
        guardarDatos();
        return;
    }
    const btn = e.target.closest('[data-act]');
    if (btn) modificar(btn.getAttribute('data-act'), parseInt(btn.getAttribute('data-val')));
}

async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0];
    const registros = await DB.obtenerTodos('actividad_diaria');
    
    const delDia = registros.find(r => r.id === hoy);
    if (delDia) { estadoLocal = {...estadoLocal, ...delDia}; esRegistroExistente = true; }
    else { estadoLocal = { referidos:0, llamadas:0, citas_agendadas:0, citas_conectadas:0, citas_cierre:0, solicitudes:0, pagadas:0 }; esRegistroExistente = false; }
    
    const dtHoy = new Date();
    const lunes = new Date(dtHoy.setDate(dtHoy.getDate() - dtHoy.getDay() + 1)).toISOString().split('T')[0];
    historicoSemanal = registros.filter(r => r.id >= lunes);
    
    actualizarUI();
    renderizarKPIs();
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

function renderizarKPIs() {
    const sem = { referidos:0, llamadas:0, citas_agendadas:0, citas_conectadas:0, citas_cierre:0, solicitudes:0, pagadas:0 };
    historicoSemanal.forEach(r => {
        if (r.id !== estadoLocal.id) {
            for (let k in sem) sem[k] += (r[k] || 0);
        }
    });
    for (let k in sem) sem[k] += (estadoLocal[k] || 0);

    const div = (a, b) => b > 0 ? ((a / b) * 100).toFixed(0) : 0;
    
    const bateoPct = div(sem.pagadas, sem.referidos);
    const referidosPorVenta = sem.pagadas > 0 ? (sem.referidos / sem.pagadas).toFixed(0) : 'N/A';
    document.getElementById('val-bateo').innerText = sem.referidos > 0 ? `${bateoPct}% (Aprox ${referidosPorVenta} prospectos por cierre)` : 'Sin datos suficientes';

    document.getElementById('act-ratios-conversion').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Ref ➔ Llamadas</span>
            <strong>${div(sem.llamadas, sem.referidos)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Llamadas ➔ Citas Obtenidas</span>
            <strong>${div(sem.citas_agendadas, sem.llamadas)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Obtenidas ➔ Iniciales (Conectadas)</span>
            <strong>${div(sem.citas_conectadas, sem.citas_agendadas)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Iniciales ➔ Cierres</span>
            <strong>${div(sem.citas_cierre, sem.citas_conectadas)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Cierres ➔ Solicitudes</span>
            <strong>${div(sem.solicitudes, sem.citas_cierre)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding-bottom:6px;">
            <span style="color:var(--text-secondary);">Solicitudes ➔ Pagadas</span>
            <strong style="color:var(--success);">${div(sem.pagadas, sem.solicitudes)}%</strong>
        </div>
    `;
}

async function guardarDatos() {
    const hoy = new Date().toISOString().split('T')[0];
    estadoLocal.id = hoy;
    if (esRegistroExistente) await DB.actualizar('actividad_diaria', hoy, estadoLocal);
    else { await DB.guardar('actividad_diaria', estadoLocal); esRegistroExistente = true; }
    
    renderizarKPIs();
    showToast('Actividad sincronizada correctamente.', 'success');
    await generarTipAI();
}

async function generarTipAI() {
    const out = document.getElementById('ai-activity-tip');
    out.innerHTML = '<span class="spinner-mini">⚙️</span> Analizando desempeño...';
    
    const prompt = `
        Eres un Coach de Productividad B2B para profesionales de ventas.
        Actividad de hoy del usuario autenticado: Ref:${estadoLocal.referidos}, Llamadas:${estadoLocal.llamadas}, Citas Obtenidas:${estadoLocal.citas_agendadas}, Citas Cierre:${estadoLocal.citas_cierre}.
        
        REGLA: Dame EXACTAMENTE 1 línea corta y motivadora (máximo 15 palabras).
        Evalúa su ritmo de forma neutral y profesional, indicando si debe apretar en algo específico para lograr sus metas comerciales.
    `;
    
    await callGemini(prompt, 'ai-activity-tip');
}
