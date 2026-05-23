// actividad.js - Completo con Embudo Actuarial y Sincronización en Nube
import { DB } from './db.js';
import { getSupabase } from './app.js';

export function renderActividad() {
    return `
        <div class="card" style="border-left: 4px solid var(--accent);">
            <h2>📈 Actividad y Conversión de Venta</h2>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Los datos se consolidan de forma mensual y se sincronizan multidispositivo.</p>
            
            <div style="background:var(--accent); color:white; padding:15px; border-radius:16px; text-align:center; margin-bottom:15px;">
                <span style="font-size:11px; text-transform:uppercase; opacity:0.8; font-weight:600;">Puntos Acumulados Hoy</span><br>
                <strong id="act-puntos-hoy" style="font-size:32px;">0</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div class="act-box">
                    <span class="act-lbl">Referidos Obtenidos</span>
                    <strong id="act-referidos">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('referidos', -1)">-</button>
                        <button onclick="modificarContador('referidos', 1)">+</button>
                    </div>
                </div>
                <div class="act-box">
                    <span class="act-lbl">Llamadas Hechas</span>
                    <strong id="act-llamadas">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('llamadas', -1)">-</button>
                        <button onclick="modificarContador('llamadas', 1)">+</button>
                    </div>
                </div>
                <div class="act-box">
                    <span class="act-lbl">Citas Agendadas</span>
                    <strong id="act-citas-agendadas">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('citas_agendadas', -1)">-</button>
                        <button onclick="modificarContador('citas_agendadas', 1)">+</button>
                    </div>
                </div>
                <div class="act-box">
                    <span class="act-lbl">Citas Iniciales Conectadas</span>
                    <strong id="act-citas-conectadas">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('citas_conectadas', -1)">-</button>
                        <button onclick="modificarContador('citas_conectadas', 1)">+</button>
                    </div>
                </div>
                <div class="act-box">
                    <span class="act-lbl">Citas de Cierre</span>
                    <strong id="act-citas-cierre">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('citas_cierre', -1)">-</button>
                        <button onclick="modificarContador('citas_cierre', 1)">+</button>
                    </div>
                </div>
                <div class="act-box">
                    <span class="act-lbl">Solicitudes Firmadas</span>
                    <strong id="act-solicitudes">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('solicitudes', -1)">-</button>
                        <button onclick="modificarContador('solicitudes', 1)">+</button>
                    </div>
                </div>
                <div class="act-box" style="grid-column: span 2;">
                    <span class="act-lbl">Pólizas Pagadas</span>
                    <strong id="act-pagadas">0</strong>
                    <div class="act-btns">
                        <button onclick="modificarContador('pagadas', -1)">-</button>
                        <button onclick="modificarContador('pagadas', 1)">+</button>
                    </div>
                </div>
            </div>

            <div style="background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--separator); margin-bottom:15px;">
                <span class="act-lbl">Referidos de Asesor COI Otorgados</span>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <strong id="act-referidos-coi" style="font-size:18px;">0</strong>
                    <div class="act-btns" style="margin:0;">
                        <button onclick="modificarContador('referidos_coi', -1)">-</button>
                        <button onclick="modificarContador('referidos_coi', 1)">+</button>
                    </div>
                </div>
            </div>

            <button id="btn-guardar-actividad" class="btn-primary" style="width:100%; margin-bottom:10px;">💾 Guardar Actividad en la Nube</button>
            <button onclick="resetearActividadDiaria()" class="btn-secondary" style="color:var(--danger)!important; border-color:var(--danger)!important;">🔄 Forzar Reset Diario</button>
        </div>

        <div class="card">
            <h2>📊 Eficiencia de Conversión (Embudo Comercial)</h2>
            <div id="act-ratios-conversion" style="font-size:13px; display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    `;
}

let actividadEstadoLocal = {
    referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0
};

export async function bindActividadEvents() {
    await cargarActividadNube();
    document.getElementById('btn-guardar-actividad')?.addEventListener('click', guardarActividadNube);
}

async function cargarActividadNube() {
    const hoy = new Date().toISOString().split('T')[0];
    const registros = await DB.obtenerTodos('actividad_diaria');
    const delDia = registros.find(r => r.id === hoy);
    
    if (delDia) {
        actividadEstadoLocal = { ...actividadEstadoLocal, ...delDia };
    } else {
        actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
    }
    calcularMetricasYVistas();
}

window.modificarContador = (campo, valor) => {
    actividadEstadoLocal[campo] = Math.max(0, actividadEstadoLocal[campo] + valor);
    calcularMetricasYVistas();
};

function calcularMetricasYVistas() {
    // Escala actuarial de puntos oficial
    const puntos = (actividadEstadoLocal.referidos * 1) + 
                   (actividadEstadoLocal.llamadas * 0.5) + 
                   (actividadEstadoLocal.citas_agendadas * 2) + 
                   (actividadEstadoLocal.citas_conectadas * 5) + 
                   (actividadEstadoLocal.citas_cierre * 5) + 
                   (actividadEstadoLocal.solicitudes * 10) + 
                   (actividadEstadoLocal.pagadas * 15) + 
                   (actividadEstadoLocal.referidos_coi * 5);

    document.getElementById('act-puntos-hoy').innerText = puntos;
    
    // Inyectar valores en DOM
    for (const key in actividadEstadoLocal) {
        const el = document.getElementById(`act-${key.replace('_','-')}`);
        if (el) el.innerText = actividadEstadoLocal[key];
    }

    // Cálculos de Ratios de Conversión Matemáticos
    const rLlamadas = actividadEstadoLocal.referidos > 0 ? ((actividadEstadoLocal.llamadas / actividadEstadoLocal.referidos) * 100).toFixed(0) : 0;
    const rCitas = actividadEstadoLocal.llamadas > 0 ? ((actividadEstadoLocal.citas_agendadas / actividadEstadoLocal.llamadas) * 100).toFixed(0) : 0;
    const rConex = actividadEstadoLocal.citas_agendadas > 0 ? ((actividadEstadoLocal.citas_conectadas / actividadEstadoLocal.citas_agendadas) * 100).toFixed(0) : 0;
    const rCierre = actividadEstadoLocal.citas_conectadas > 0 ? ((actividadEstadoLocal.citas_cierre / actividadEstadoLocal.citas_conectadas) * 100).toFixed(0) : 0;
    const rFirma = actividadEstadoLocal.citas_cierre > 0 ? ((actividadEstadoLocal.solicitudes / actividadEstadoLocal.citas_cierre) * 100).toFixed(0) : 0;
    const rPago = actividadEstadoLocal.solicitudes > 0 ? ((actividadEstadoLocal.pagadas / actividadEstadoLocal.solicitudes) * 100).toFixed(0) : 0;

    document.getElementById('act-ratios-conversion').innerHTML = `
        <div>🎯 <strong>Referidos ➔ Llamadas:</strong> ${rLlamadas}% (Hiciste ${actividadEstadoLocal.llamadas} de ${actividadEstadoLocal.referidos})</div>
        <div>📞 <strong>Llamadas ➔ Citas Agendadas:</strong> ${rCitas}%</div>
        <div>🤝 <strong>Agendadas ➔ Conectadas:</strong> ${rConex}%</div>
        <div>🔄 <strong>Conectadas ➔ Citas de Cierre:</strong> ${rCierre}%</div>
        <div>✍️ <strong>Cierre ➔ Solicitud Firmada:</strong> ${rFirma}%</div>
        <div>💰 <strong>Solicitud ➔ Póliza Pagada:</strong> ${rPago}%</div>
    `;
}

async function guardarActividadNube() {
    const hoy = new Date().toISOString().split('T')[0];
    actividadEstadoLocal.id = hoy;
    await DB.guardar('actividad_diaria', actividadEstadoLocal);
    alert('Actividad diaria sincronizada con la nube correctamente.');
}

window.resetearActividadDiaria = () => {
    if (confirm('¿Deseas vaciar los contadores locales de hoy?')) {
        actividadEstadoLocal = { referidos: 0, llamadas: 0, citas_agendadas: 0, citas_conectadas: 0, citas_cierre: 0, solicitudes: 0, pagadas: 0, referidos_coi: 0 };
        calcularMetricasYVistas();
    }
};
