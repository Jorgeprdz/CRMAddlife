import { DB } from './db.js';

export function renderActividad() {
    return `
        <div class="card">
            <h2>📈 Registro de Actividad</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div style="background: var(--surface-2); padding: 15px; border-radius: 16px; text-align: center; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Llamadas</span><br>
                    <strong id="act-llamadas" style="font-size: 24px; color: var(--accent);">0</strong>
                    <div style="display:flex; gap:5px; justify-content:center; margin-top:8px;">
                        <button onclick="modificarActividad('llamadas', 1)" class="btn-primary" style="padding:4px 10px!important;">+1</button>
                    </div>
                </div>
                <div style="background: var(--surface-2); padding: 15px; border-radius: 16px; text-align: center; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Citas Iniciales</span><br>
                    <strong id="act-citas" style="font-size: 24px; color: var(--success);">0</strong>
                    <div style="display:flex; gap:5px; justify-content:center; margin-top:8px;">
                        <button onclick="modificarActividad('citas', 1)" class="btn-primary" style="background:var(--success)!important; padding:4px 10px!important;">+1</button>
                    </div>
                </div>
                <div style="background: var(--surface-2); padding: 15px; border-radius: 16px; text-align: center; border: 1px solid var(--separator); grid-column: span 2;">
                    <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Cierres</span><br>
                    <strong id="act-cierres" style="font-size: 24px; color: var(--warning);">0</strong>
                    <div style="display:flex; gap:5px; justify-content:center; margin-top:8px;">
                        <button onclick="modificarActividad('cierres', 1)" class="btn-primary" style="background:var(--warning)!important; padding:4px 10px!important;">+1</button>
                    </div>
                </div>
            </div>
            <button onclick="resetearActividad()" class="btn-secondary" style="color:var(--danger)!important; border-color:var(--danger)!important;">🔄 Reiniciar Contadores Diarios</button>
        </div>
    `;
}

export async function bindActividadEvents() {
    actualizarVistaActividad();
}

function getActividadHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const dataStr = localStorage.getItem(`actividad_${hoy}`);
    return dataStr ? JSON.parse(dataStr) : { llamadas: 0, citas: 0, cierres: 0 };
}

function guardarActividadHoy(data) {
    const hoy = new Date().toISOString().split('T')[0];
    localStorage.setItem(`actividad_${hoy}`, JSON.stringify(data));
}

window.modificarActividad = (tipo, valor) => {
    const data = getActividadHoy();
    data[tipo] = Math.max(0, data[tipo] + valor);
    guardarActividadHoy(data);
    actualizarVistaActividad();
};

window.resetearActividad = () => {
    if (confirm('¿Reiniciar contadores de hoy a cero?')) {
        guardarActividadHoy({ llamadas: 0, citas: 0, cierres: 0 });
        actualizarVistaActividad();
    }
};

function actualizarVistaActividad() {
    const data = getActividadHoy();
    const elLlamadas = document.getElementById('act-llamadas');
    const elCitas = document.getElementById('act-citas');
    const elCierres = document.getElementById('act-cierres');
    
    if(elLlamadas) elLlamadas.innerText = data.llamadas;
    if(elCitas) elCitas.innerText = data.citas;
    if(elCierres) elCierres.innerText = data.cierres;
}
