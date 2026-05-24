// /modules/actividad.js - Embudo Actuarial y Sincronización (Nube / Offline)
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

// 1. STATE MANAGER & CONFIGURACIÓN ACTUARIAL
const BaremoOficial = {
    referidos: 3,
    llamadas: 1,
    citas_agendadas: 3,
    citas_conectadas: 2,
    citas_cierre: 3,
    solicitudes: 5,
    pagadas: 10,
    referidos_coi: 5 // Mantenido para retrocompatibilidad
};

let actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
let esRegistroExistente = false;

// 2. RENDER UI
export function renderActividad() {
    return `
        <div class="card" style="border-left: 4px solid var(--accent);">
            <h2>📈 Actividad y Conversión de Venta</h2>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Los datos se consolidan y sincronizan sin duplicarse en la nube (Motor Upsert).</p>
            
            <div style="background:var(--accent); color:white; padding:15px; border-radius:16px; text-align:center; margin-bottom:15px; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);">
                <span style="font-size:11px; text-transform:uppercase; opacity:0.8; font-weight:600; letter-spacing: 0.5px;">Puntos Acumulados Hoy</span><br>
                <strong id="act-puntos-hoy" style="font-size:38px; line-height:1.2;">0</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                ${[
                    { id: 'referidos', label: 'Referidos Obtenidos' },
                    { id: 'llamadas', label: 'Llamadas Hechas' },
                    { id: 'citas_agendadas', label: 'Citas Obtenidas' },
                    { id: 'citas_conectadas', label: 'Citas Iniciales' },
                    { id: 'citas_cierre', label: 'Citas de Cierre' },
                    { id: 'solicitudes', label: 'Solicitudes Firmadas' }
                ].map(x => `
                <div class="act-box" style="background:var(--surface-2); padding:10px; border-radius:12px; text-align:center; border:1px solid var(--separator);">
                    <span style="font-size:11px; color:var(--text-secondary); display:block; min-height:26px; font-weight:500;">${x.label}</span>
                    <strong id="act-${x.id}" style="font-size:20px; display:block; margin:5px 0; color:var(--text-primary);">0</strong>
                    <div style="display:flex; justify-content:center; gap:5px;">
                        <button onclick="modificarContador('${x.id}', -1)" class="btn-secondary" style="padding:2px 12px!important; font-size:16px;">-</button>
                        <button onclick="modificarContador('${x.id}', 1)" class="btn-primary" style="padding:2px 12px!important; font-size:16px;">+</button>
                    </div>
                </div>`).join('')}
                
                <div class="act-box" style="background:var(--surface-2); padding:10px; border-radius:12px; text-align:center; border:1px solid var(--separator); grid-column: span 2;">
                    <span style="font-size:11px; color:var(--text-secondary); display:block; font-weight:500;">Pólizas Pagadas</span>
                    <strong id="act-pagadas" style="font-size:24px; display:block; margin:5px 0; color:var(--success);">0</strong>
                    <div style="display:flex; justify-content:center; gap:5px;">
                        <button onclick="modificarContador('pagadas', -1)" class="btn-secondary" style="padding:2px 16px!important; font-size:16px;">-</button>
                        <button onclick="modificarContador('pagadas', 1)" class="btn-primary" style="background:var(--success)!important; border-color:var(--success)!important; padding:2px 16px!important; font-size:16px;">+</button>
                    </div>
                </div>
            </div>

            <button onclick="guardarActividadNube()" class="btn-primary" style="width:100%; margin-bottom:10px; font-weight:600;">💾 Guardar Actividad en la Nube</button>
            <button onclick="resetearActividadDiaria()" class="btn-secondary" style="color:var(--danger)!important; border-color:var(--danger)!important; width:100%;">🔄 Forzar Reset Diario</button>
        </div>

        <div class="card">
            <h2 style="font-size:16px; margin-bottom:12px;">📊 Eficiencia de Conversión</h2>
            <div id="act-ratios-conversion" style="font-size:13px; display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    `;
}

// 3. CONTROLADOR
export async function bindActividadEvents() {
    await cargarActividadNube();
}

async function cargarActividadNube() {
    const hoy = new Date().toISOString().split('T')[0];
    const registros = await DB.obtenerTodos('actividad_diaria');
    const delDia = registros.find(r => r.id === hoy);
    
    if (delDia) {
        actividadEstadoLocal = { ...actividadEstadoLocal, ...delDia };
        esRegistroExistente = true;
    } else {
        actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
        esRegistroExistente = false;
    }
    calcularMetricasYVistas();
}

window.modificarContador = (campo, valor) => {
    actividadEstadoLocal[campo] = Math.max(0, actividadEstadoLocal[campo] + valor);
    calcularMetricasYVistas();
};

function calcularMetricasYVistas() {
    // Motor Matemático basado en el nuevo Baremo
    let puntos = 0;
    for (const key in BaremoOficial) {
        puntos += (actividadEstadoLocal[key] || 0) * BaremoOficial[key];
    }

    document.getElementById('act-puntos-hoy').innerText = puntos.toFixed(0);
    
    for (const key in actividadEstadoLocal) {
        const el = document.getElementById(`act-${key}`);
        if (el) el.innerText = actividadEstadoLocal[key];
    }

    const div = (a, b) => b > 0 ? ((a / b) * 100).toFixed(0) : 0;
    document.getElementById('act-ratios-conversion').innerHTML = `
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--separator);"><span>🎯 <strong>Ref ➔ Llamadas:</strong></span> <span>${div(actividadEstadoLocal.llamadas, actividadEstadoLocal.referidos)}%</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--separator);"><span>📞 <strong>Llamadas ➔ Agendadas:</strong></span> <span>${div(actividadEstadoLocal.citas_agendadas, actividadEstadoLocal.llamadas)}%</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--separator);"><span>🤝 <strong>Agendadas ➔ Conectadas:</strong></span> <span>${div(actividadEstadoLocal.citas_conectadas, actividadEstadoLocal.citas_agendadas)}%</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--separator);"><span>🔄 <strong>Conectadas ➔ Cierre:</strong></span> <span>${div(actividadEstadoLocal.citas_cierre, actividadEstadoLocal.citas_conectadas)}%</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--separator);"><span>✍️ <strong>Cierre ➔ Solicitud:</strong></span> <span>${div(actividadEstadoLocal.solicitudes, actividadEstadoLocal.citas_cierre)}%</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>💰 <strong>Solicitud ➔ Pagada:</strong></span> <span style="color:var(--success); font-weight:bold;">${div(actividadEstadoLocal.pagadas, actividadEstadoLocal.solicitudes)}%</span></div>
    `;
}

window.guardarActividadNube = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    actividadEstadoLocal.id = hoy;
    
    if (esRegistroExistente) await DB.actualizar('actividad_diaria', hoy, actividadEstadoLocal);
    else {
        await DB.guardar('actividad_diaria', actividadEstadoLocal);
        esRegistroExistente = true; 
    }
    showToast('Actividad consolidada con éxito.', 'success');
};

window.resetearActividadDiaria = async () => {
    const seguro = await showConfirm('¿Vaciar contadores locales de hoy?', 'Resetear Contadores', 'Vaciar', true);
    if (seguro) {
        actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
        calcularMetricasYVistas();
    }
};
