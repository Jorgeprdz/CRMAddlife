// referidos.js - Completo con Semáforo de Estatus, Buscador y Ruteador de Ventas
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

let idEdicionActual = null;

const SemaforoColores = {
    'Nuevo': { color: '#007AFF', label: 'Contacto Nuevo (Azul)' },
    'Contactado': { color: '#5856D6', label: 'Contactado (Morado)' },
    'Agendado': { color: '#34C759', label: 'Cita Agendada (Verde)' },
    'En Seguimiento': { color: '#FF9500', label: 'En Seguimiento (Naranja)' },
    'Cerró': { color: '#32D74B', label: 'Póliza Cerrada (Verde Brillant)' },
    'Descartado': { color: '#FF3B30', label: 'Descartado (Rojo)' }
};

export function renderReferidos() {
    return `
        <div class="card">
            <h2 id="ref-titulo">👥 Registro e Historial de Referidos</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input id="ref-nombre" placeholder="Nombre completo del referido">
                <input id="ref-telefono" type="tel" placeholder="Teléfono celular">
                <input id="ref-origen" placeholder="¿Quién es el Centro de Influencia (COI)?">
                
                <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Estatus del Semáforo</label>
                <select id="ref-estado">
                    ${Object.keys(SemaforoColores).map(k => `<option value="${k}">${SemaforoColores[k].label}</option>`).join('')}
                </select>

                <textarea id="ref-notas" placeholder="Contexto familiar, pasatiempos, hijos..."></textarea>
                <button id="btn-guardar-ref" class="btn-primary">💾 Guardar Referido</button>
                <button id="btn-cancelar-ref" class="btn-secondary" style="display:none;">❌ Cancelar Edición</button>
            </div>
        </div>

        <div class="card">
            <h2>Directorio Inteligente</h2>
            <input id="ref-buscador" placeholder="🔍 Buscar referido por nombre..." style="margin-bottom:12px; width:100%;">
            <div id="lista-referidos-container" style="display:flex; flex-direction:column; gap:10px;">
                <div class="skeleton-row skeleton-shimmer" style="opacity: 0.15; height: 60px;"></div>
                <div class="skeleton-row skeleton-shimmer" style="opacity: 0.15; height: 60px;"></div>
            </div>
        </div>
    `;
}

export async function bindReferidosEvents() {
    document.getElementById('btn-guardar-ref')?.addEventListener('click', guardarReferido);
    document.getElementById('btn-cancelar-ref')?.addEventListener('click', limpiarFormulario);
    document.getElementById('ref-buscador')?.addEventListener('input', filtrarReferidos);
    await cargarListaReferidos();
}

async function guardarReferido() {
    const datos = {
        nombre: document.getElementById('ref-nombre').value.trim(),
        telefono: document.getElementById('ref-telefono').value.trim(),
        origen: document.getElementById('ref-origen').value.trim(),
        estado: document.getElementById('ref-estado').value,
        notas: document.getElementById('ref-notas').value.trim()
    };
    if (!datos.nombre) return showToast('El nombre es requerido.', 'warning');

    if (idEdicionActual) {
        await DB.actualizar('referidos', idEdicionActual, datos);
    } else {
        datos.id = 'ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await DB.guardar('referidos', datos);
    }
    limpiarFormulario();
    await cargarListaReferidos();
}

async function cargarListaReferidos(filtro = '') {
    const container = document.getElementById('lista-referidos-container');
    if (!container) return;

    const referidos = await DB.obtenerTodos('referidos');
    const filtrados = referidos.filter(r => r.nombre.toLowerCase().includes(filtro.toLowerCase()));

    if (filtrados.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-secondary);">Sin coincidencias en el directorio.</div>`;
        return;
    }

    container.innerHTML = filtrados.map(r => {
        const configSemaforo = SemaforoColores[r.estado] || { color: '#ccc' };
        return `
            <div style="background:var(--surface-2); padding:14px; border-radius:14px; border:1px solid var(--separator); border-left: 6px solid ${configSemaforo.color};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${r.nombre}</strong>
                    <span style="font-size:10px; font-weight:bold; color:white; background:${configSemaforo.color}; padding:2px 8px; border-radius:10px;">${r.estado}</span>
                </div>
                <p style="font-size:12px; color:var(--text-secondary); margin:4px 0;">
                    👤 COI: ${r.origen || 'No indicado'} | 📞 ${r.telefono || 'Sin celular'}
                </p>
                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px;">
                    <button onclick="enviarReferidoAEmbudo('${r.id}')" class="btn-primary" style="background:#007AFF!important; border-color:#007AFF!important; padding:4px 8px!important; font-size:11px;">🚀 Mandar a Prospectos</button>
                    <button onclick="cargarRefEdicion('${r.id}')" class="btn-secondary" style="padding:4px 8px!important; font-size:11px;">✏️ Editar</button>
                    <button onclick="eliminarReferido('${r.id}')" class="btn-secondary" style="padding:4px 8px!important; font-size:11px; color:var(--danger)!important;">🗑️ Borrar</button>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarReferidos(e) {
    cargarListaReferidos(e.target.value);
}

window.enviarReferidoAEmbudo = async (id) => {
    const referidos = await DB.obtenerTodos('referidos');
    const r = referidos.find(x => x.id === id);
    if (!r) return;
    
    // Dejar empaquetado el objeto en memoria y forzar ruteador nativo
    localStorage.setItem('auto_prospecto', JSON.stringify(r));
    window.navigateTo('prospeccion');
};

window.cargarRefEdicion = async (id) => {
    const referidos = await DB.obtenerTodos('referidos');
    const r = referidos.find(x => x.id === id);
    if (!r) return;

    idEdicionActual = id;
    document.getElementById('ref-titulo').innerText = '✏️ Editar Referido';
    document.getElementById('ref-nombre').value = r.nombre || '';
    document.getElementById('ref-telefono').value = r.telefono || '';
    document.getElementById('ref-origen').value = r.origen || '';
    document.getElementById('ref-estado').value = r.estado || 'Nuevo';
    document.getElementById('ref-notas').value = r.notas || '';
    document.getElementById('btn-cancelar-ref').style.display = 'block';
};

window.eliminarReferido = async (id) => {
    const seguro = await showConfirm('¿Estás seguro de que deseas eliminar este referido de la base de datos?', 'Eliminar Referido', 'Eliminar', true);
    if (seguro) {
        await DB.eliminar('referidos', id);
        await cargarListaReferidos();
    }
};

function limpiarFormulario() {
    idEdicionActual = null;
    document.getElementById('ref-titulo').innerText = '👥 Registro e Historial de Referidos';
    ['ref-nombre', 'ref-telefono', 'ref-origen', 'ref-notas'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ref-estado').value = 'Nuevo';
    document.getElementById('btn-cancelar-ref').style.display = 'none';
}
