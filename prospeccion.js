import { DB } from './db.js';

let idEdicion = null;

export function renderProspeccion() {
    return `
        <div class="card">
            <h2 id="pros-titulo">🎯 Nuevo Prospecto</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input id="pros-nombre" placeholder="Nombre del Prospecto">
                <input id="pros-telefono" type="tel" placeholder="Teléfono">
                <select id="pros-etapa">
                    <option value="Contacto Inicial">Contacto Inicial</option>
                    <option value="Cita Programada">Cita Programada</option>
                    <option value="Presentación">Presentación</option>
                    <option value="Cierre">Cierre</option>
                </select>
                <textarea id="pros-notas" placeholder="Notas de la oportunidad..."></textarea>
                <button id="btn-guardar-pros" class="btn-primary">💾 Guardar Prospecto</button>
                <button id="btn-cancelar-pros" class="btn-secondary" style="display:none;">❌ Cancelar</button>
            </div>
        </div>
        <div class="card">
            <h2>Embudo de Ventas</h2>
            <div id="lista-prospectos" style="display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; color:var(--text-tertiary);">Cargando...</div>
            </div>
        </div>
    `;
}

export async function bindProspeccionEvents() {
    document.getElementById('btn-guardar-pros')?.addEventListener('click', guardarProspecto);
    document.getElementById('btn-cancelar-pros')?.addEventListener('click', limpiarForm);
    await cargarProspectos();
}

async function guardarProspecto() {
    const datos = {
        nombre: document.getElementById('pros-nombre').value.trim(),
        telefono: document.getElementById('pros-telefono').value.trim(),
        etapa: document.getElementById('pros-etapa').value,
        notas: document.getElementById('pros-notas').value.trim()
    };

    if (!datos.nombre) return alert('Nombre requerido.');

    try {
        if (idEdicion) {
            await DB.actualizar('prospectos', idEdicion, datos);
        } else {
            datos.id = 'pros_' + Date.now();
            await DB.guardar('prospectos', datos);
        }
        limpiarForm();
        await cargarProspectos();
    } catch (e) { console.error(e); }
}

async function cargarProspectos() {
    const container = document.getElementById('lista-prospectos');
    if (!container) return;
    
    const prospectos = await DB.obtenerTodos('prospectos');
    if (prospectos.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-secondary);">No hay prospectos en el embudo.</div>`;
        return;
    }

    container.innerHTML = prospectos.map(p => `
        <div style="background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--separator); color:var(--text-primary);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:14px;">${p.nombre}</strong>
                <span class="badge badge-orange">${p.etapa}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px;">📞 ${p.telefono || 'N/A'}</div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                <button onclick="editarProspecto('${p.id}')" class="btn-secondary" style="padding:4px 8px !important; font-size:11px;">✏️ Editar</button>
                <button onclick="eliminarProspecto('${p.id}')" class="btn-secondary" style="padding:4px 8px !important; font-size:11px; color:var(--danger)!important;">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.editarProspecto = async (id) => {
    const prospectos = await DB.obtenerTodos('prospectos');
    const p = prospectos.find(x => x.id === id);
    if (!p) return;
    
    idEdicion = id;
    document.getElementById('pros-titulo').innerText = '✏️ Editar Prospecto';
    document.getElementById('pros-nombre').value = p.nombre || '';
    document.getElementById('pros-telefono').value = p.telefono || '';
    document.getElementById('pros-etapa').value = p.etapa || 'Contacto Inicial';
    document.getElementById('pros-notas').value = p.notas || '';
    
    document.getElementById('btn-guardar-pros').innerText = '🔄 Actualizar';
    document.getElementById('btn-cancelar-pros').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.eliminarProspecto = async (id) => {
    if (confirm('¿Eliminar este prospecto del embudo?')) {
        await DB.eliminar('prospectos', id);
        await cargarProspectos();
    }
};

function limpiarForm() {
    idEdicion = null;
    document.getElementById('pros-titulo').innerText = '🎯 Nuevo Prospecto';
    ['pros-nombre', 'pros-telefono', 'pros-notas'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pros-etapa').value = 'Contacto Inicial';
    document.getElementById('btn-guardar-pros').innerText = '💾 Guardar Prospecto';
    document.getElementById('btn-cancelar-pros').style.display = 'none';
}
