// actividad.js - Embudo Actuarial y Sincronización en Nube (Upsert)
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

let actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
let esRegistroExistente = false; 

export function renderActividad() {
    return `
        <div class="card" style="border-left: 4px solid var(--accent);">
            <h2>📈 Actividad y Conversión de Venta</h2>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Los datos se consolidan y sincronizan sin duplicarse en la nube.</p>
            
            <div style="background:var(--accent); color:white; padding:15px; border-radius:16px; text-align:center; margin-bottom:15px;">
                <span style="font-size:11px; text-transform:uppercase; opacity:0.8; font-weight:600;">Puntos Acumulados Hoy</span><br>
                <strong id="act-puntos-hoy" style="font-size:32px;">0</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                ${[
                    { id: 'referidos', label: 'Referidos Obtenidos' },
                    { id: 'llamadas', label: 'Llamadas Hechas' },
                    { id: 'citas_agendadas', label: 'Citas Agendadas' },
                    { id: 'citas_conectadas', label: 'Citas Iniciales' },
                    { id: 'citas_cierre', label: 'Citas de Cierre' },
                    { id: 'solicitudes', label: 'Solicitudes Firmadas' }
                ].map(x => `
                <div class="act-box" style="background:var(--surface-2); padding:10px; border-radius:12px; text-align:center; border:1px solid var(--separator);">
                    <span style="font-size:11px; color:var(--text-secondary); display:block; min-height:26px;">${x.label}</span>
                    <strong id="act-${x.id}" style="font-size:20px; display:block; margin:5px 0;">0</strong>
                    <div style="display:flex; justify-content:center; gap:5px;">
                        <button onclick="modificarContador('${x.id}', -1)" class="btn-secondary" style="padding:2px 10px!important; font-size:14px;">-</button>
                        <button onclick="modificarContador('${x.id}', 1)" class="btn-primary" style="padding:2px 10px!important; font-size:14px;">+</button>
                    </div>
                </div>`).join('')}
                
                <div class="act-box" style="background:var(--surface-2); padding:10px; border-radius:12px; text-align:center; border:1px solid var(--separator); grid-column: span 2;">
                    <span style="font-size:11px; color:var(--text-secondary); display:block;">Pólizas Pagadas</span>
                    <strong id="act-pagadas" style="font-size:20px; display:block; margin:5px 0;">0</strong>
                    <div style="display:flex; justify-content:center; gap:5px;">
                        <button onclick="modificarContador('pagadas', -1)" class="btn-secondary" style="padding:2px 10px!important; font-size:14px;">-</button>
                        <button onclick="modificarContador('pagadas', 1)" class="btn-primary" style="padding:2px 10px!important; font-size:14px;">+</button>
                    </div>
                </div>
            </div>

            <button onclick="guardarActividadNube()" class="btn-primary" style="width:100%; margin-bottom:10px;">💾 Guardar Actividad en la Nube</button>
            <button onclick="resetearActividadDiaria()" class="btn-secondary" style="color:var(--danger)!important; border-color:var(--danger)!important;">🔄 Forzar Reset Diario</button>
        </div>

        <div class="card">
            <h2>📊 Eficiencia de Conversión</h2>
            <div id="act-ratios-conversion" style="font-size:13px; display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    `;
}

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
    const puntos = (actividadEstadoLocal.referidos * 1) + 
                   (actividadEstadoLocal.llamadas * 0.5) + 
                   (actividadEstadoLocal.citas_agendadas * 2) + 
                   (actividadEstadoLocal.citas_conectadas * 5) + 
                   (actividadEstadoLocal.citas_cierre * 5) + 
                   (actividadEstadoLocal.solicitudes * 10) + 
                   (actividadEstadoLocal.pagadas * 15);

    document.getElementById('act-puntos-hoy').innerText = puntos.toFixed(1);
    
    for (const key in actividadEstadoLocal) {
        const el = document.getElementById(`act-${key}`);
        if (el) el.innerText = actividadEstadoLocal[key];
    }

    const div = (a, b) => b > 0 ? ((a / b) * 100).toFixed(0) : 0;
    document.getElementById('act-ratios-conversion').innerHTML = `
        <div>🎯 <strong>Referidos ➔ Llamadas:</strong> ${div(actividadEstadoLocal.llamadas, actividadEstadoLocal.referidos)}%</div>
        <div>📞 <strong>Llamadas ➔ Agendadas:</strong> ${div(actividadEstadoLocal.citas_agendadas, actividadEstadoLocal.llamadas)}%</div>
        <div>🤝 <strong>Agendadas ➔ Conectadas:</strong> ${div(actividadEstadoLocal.citas_conectadas, actividadEstadoLocal.citas_agendadas)}%</div>
        <div>🔄 <strong>Conectadas ➔ Cierre:</strong> ${div(actividadEstadoLocal.citas_cierre, actividadEstadoLocal.citas_conectadas)}%</div>
        <div>✍️ <strong>Cierre ➔ Solicitud:</strong> ${div(actividadEstadoLocal.solicitudes, actividadEstadoLocal.citas_cierre)}%</div>
        <div>💰 <strong>Solicitud ➔ Pagada:</strong> ${div(actividadEstadoLocal.pagadas, actividadEstadoLocal.solicitudes)}%</div>
    `;
}

window.guardarActividadNube = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    actividadEstadoLocal.id = hoy;
    
    if (esRegistroExistente) {
        await DB.actualizar('actividad_diaria', hoy, actividadEstadoLocal);
    } else {
        await DB.guardar('actividad_diaria', actividadEstadoLocal);
        esRegistroExistente = true; 
    }
    showToast('Actividad sincronizada y consolidada.', 'success');
};

window.resetearActividadDiaria = async () => {
    const seguro = await showConfirm('¿Vaciar todos los contadores locales de hoy?', 'Resetear', 'Vaciar', true);
    if (seguro) {
        actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
        calcularMetricasYVistas();
    }
};
