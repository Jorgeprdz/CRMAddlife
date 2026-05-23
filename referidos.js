import { DB } from './db.js';

let idEdicionActual = null;

export function renderReferidos() {
    return `
        <div class="card">
            <h2 id="ref-titulo">👥 Alta de Referido</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input id="ref-nombre" placeholder="Nombre completo del referido">
                <input id="ref-telefono" type="tel" placeholder="Teléfono de contacto">
                <input id="ref-origen" placeholder="¿Quién te lo refirió? (Origen)">
                <textarea id="ref-notas" placeholder="Notas estratégicas..."></textarea>
                <button id="btn-guardar-ref" class="btn-primary">💾 Guardar Referido</button>
                <button id="btn-cancelar-ref" class="btn-secondary" style="display:none;">❌ Cancelar Edición</button>
            </div>
        </div>
        <div class="card">
            <h2>Directorio de Referidos</h2>
            <div id="lista-referidos-container" style="display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; color:var(--text-tertiary);">Cargando...</div>
            </div>
        </div>
    `;
}

export async function bindReferidosEvents() {
    const btnGuardar = document.getElementById('btn-guardar-ref');
    const btnCancelar = document.getElementById('btn-cancelar-ref');
    
    if (btnGuardar) btnGuardar.addEventListener('click', guardarReferido);
    if (btnCancelar) btnCancelar.addEventListener('click', limpiarFormulario);

    await cargarListaReferidos();
}

async function guardarReferido() {
    const datos = {
        nombre: document.getElementById('ref-nombre').value.trim(),
        telefono: document.getElementById('ref-telefono').value.trim(),
        origen: document.getElementById('ref-origen').value.trim(),
        notas: document.getElementById('ref-notas').value.trim(),
        estado: 'Nuevo'
    };

    if (!datos.nombre) return alert('El nombre es obligatorio.');

    try {
        if (idEdicionActual) {
            await DB.actualizar('referidos', idEdicionActual, datos);
        } else {
            // CORRECCIÓN: ID Dinámico para evitar colisiones
            datos.id = 'ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            await DB.guardar('referidos', datos);
        }
        limpiarFormulario();
        await cargarListaReferidos();
    } catch (e) { console.error(e); }
}

async function cargarListaReferidos() {
    const container = document.getElementById('lista-referidos-container');
    if (!container) return;
    
    const referidos = await DB.obtenerTodos('referidos');
    if (referidos.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-secondary);">No hay referidos registrados.</div>`;
        return;
    }

    container.innerHTML = referidos.map(r => `
        <div style="background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--separator);">
            <div style="display:flex; justify-content:space-between;">
                <strong>${r.nombre}</strong>
                <span class="badge badge-blue">${r.estado}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                📞 ${r.telefono || 'N/A'} | 👤 Origen: ${r.origen || 'N/A'}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                <button onclick="editarReferido('${r.id}')" class="btn-secondary" style="padding:4px 8px !important; font-size:11px;">✏️ Editar</button>
                <button onclick="eliminarReferido('${r.id}')" class="btn-secondary" style="padding:4px 8px !important; font-size:11px; color:var(--danger)!important;">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.editarReferido = async (id) => {
    const referidos = await DB.obtenerTodos('referidos');
    const r = referidos.find(x => x.id === id);
    if (!r) return;
    idEdicionActual = id;
    document.getElementById('ref-titulo').innerText = '✏️ Editar Referido';
    document.getElementById('ref-nombre').value = r.nombre || '';
    document.getElementById('ref-telefono').value = r.telefono || '';
    document.getElementById('ref-origen').value = r.origen || '';
    document.getElementById('ref-notas').value = r.notas || '';
    document.getElementById('btn-guardar-ref').innerText = '🔄 Actualizar';
    document.getElementById('btn-cancelar-ref').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.eliminarReferido = async (id) => {
    if (confirm('¿Eliminar este referido definitivamente?')) {
        await DB.eliminar('referidos', id);
        await cargarListaReferidos();
    }
};

function limpiarFormulario() {
    idEdicionActual = null;
    document.getElementById('ref-titulo').innerText = '👥 Alta de Referido';
    ['ref-nombre', 'ref-telefono', 'ref-origen', 'ref-notas'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('btn-guardar-ref').innerText = '💾 Guardar Referido';
    document.getElementById('btn-cancelar-ref').style.display = 'none';
}
