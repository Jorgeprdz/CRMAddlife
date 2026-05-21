// referidos.js
import { DB } from './db.js';
import { agendarCita } from './utils.js';

window.agendarCita = agendarCita;

export function renderReferidos() {
    return `
        <div class="card">
            <h2>Nuevo Referido</h2>
            <div style="display: grid; gap: 10px;">
                <input id="ref-nombre" placeholder="Nombre completo">
                <input id="ref-telefono" type="tel" placeholder="Teléfono a 10 dígitos">
                <input id="ref-origen" placeholder="¿Quién lo refirió? (Ej. Cliente Juan Pérez)">
                <textarea id="ref-obs" placeholder="Observaciones o contexto del referido" rows="2"></textarea>
                <button id="btn-guardar-referido" class="btn-primary" style="margin-top: 10px;">💾 Guardar Referido</button>
            </div>
        </div>

        <div class="card">
            <h2>Pipeline de Referidos</h2>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                <input id="filter-nombre" placeholder="🔍 Buscar por nombre..." style="flex: 2; min-width: 180px; padding: 10px; border-radius: 8px; border: 1px solid #E5E5EA; font-size: 14px;">

                <select id="filter-estatus" style="flex: 1; min-width: 130px; padding: 10px; border-radius: 8px; border: 1px solid #E5E5EA; font-size: 14px; font-weight: bold; background: #FFF;">
                    <option value="Todos">🌈 Todos</option>
                    <option value="Nuevo">🔵 Nuevo</option>
                    <option value="Seguimiento">🟠 Seguimiento</option>
                    <option value="Cita">🟢 Cita</option>
                    <option value="Descartado">⚫ Descartado</option>
                </select>

                <button id="btn-limpiar-filtros" class="btn-secondary" style="padding: 10px 15px; font-size: 14px; white-space: nowrap;">🧹 Limpiar</button>
            </div>

            <div id="lista-referidos" style="display: grid; gap: 12px;"></div>
        </div>
    `;
}

export async function bindReferidosEvents() {
    await window.renderPipelineReferidos();

    document.getElementById('filter-nombre').addEventListener('input', () => window.renderPipelineReferidos());
    document.getElementById('filter-estatus').addEventListener('change', () => window.renderPipelineReferidos());

    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
        document.getElementById('filter-nombre').value = '';
        document.getElementById('filter-estatus').value = 'Todos';
        window.renderPipelineReferidos();
    });

    const btnGuardar = document.getElementById('btn-guardar-referido');
    btnGuardar.replaceWith(btnGuardar.cloneNode(true));

    document.getElementById('btn-guardar-referido').addEventListener('click', async () => {
        const nombre = document.getElementById('ref-nombre').value;
        const tel = document.getElementById('ref-telefono').value;

        if (!nombre || !tel) return alert('Nombre y teléfono son obligatorios para prospectar.');

        const nuevoReferido = {
            id: Date.now(),
            nombre,
            tel,
            origen: document.getElementById('ref-origen').value,
            obs: document.getElementById('ref-obs').value,
            estatus: 'Nuevo'
        };

        await DB.guardar('referidos', nuevoReferido);

        document.getElementById('ref-nombre').value = '';
        document.getElementById('ref-telefono').value = '';
        document.getElementById('ref-origen').value = '';
        document.getElementById('ref-obs').value = '';

        await window.renderPipelineReferidos();
    });
}

window.renderPipelineReferidos = async () => {
    const contenedor = document.getElementById('lista-referidos');
    if (!contenedor) return;

    const db = await DB.obtenerTodos('referidos');

    const filtroNombre = document.getElementById('filter-nombre')?.value.toLowerCase() || '';
    const filtroEstatus = document.getElementById('filter-estatus')?.value || 'Todos';

    let dbFiltrada = db;
    if (filtroNombre) {
        dbFiltrada = dbFiltrada.filter(r => r.nombre.toLowerCase().includes(filtroNombre));
    }
    if (filtroEstatus !== 'Todos') {
        dbFiltrada = dbFiltrada.filter(r => r.estatus === filtroEstatus);
    }

    if (dbFiltrada.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; color:gray; padding: 20px;">No se encontraron registros.</p>`;
        return;
    }

    contenedor.innerHTML = dbFiltrada.reverse().map(r => `
        <div style="background: #F9F9FB; border: 1px solid #E5E5EA; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border-left: 5px solid ${getColorBorde(r.estatus)};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="margin: 0; font-size: 16px; color: #1C1C1E;">${r.nombre}</h3>
                    <span style="font-size: 13px; color: #8E8E93;">Refiere: ${r.origen || 'N/A'} | 📱 ${r.tel}</span>
                </div>
                <select onchange="cambiarEstatusReferido(${r.id}, this.value)" style="font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 6px; background: ${getColorFondo(r.estatus)}; color: ${getColorTexto(r.estatus)}; border: none; outline: none; cursor: pointer;">
                    <option value="Nuevo" ${r.estatus === 'Nuevo' ? 'selected' : ''}>🔵 Nuevo</option>
                    <option value="Seguimiento" ${r.estatus === 'Seguimiento' ? 'selected' : ''}>🟠 Seguimiento</option>
                    <option value="Cita" ${r.estatus === 'Cita' ? 'selected' : ''}>🟢 Cita</option>
                    <option value="Descartado" ${r.estatus === 'Descartado' ? 'selected' : ''}>⚫ Descartado</option>
                </select>
            </div>

            ${r.obs ? `<p style="font-size: 13px; color: #48484A; margin: 5px 0;">💬 ${r.obs}</p>` : ''}

            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <button onclick="llamarReferido('${r.tel}')" class="btn-primary" style="flex: 1; min-width: 45%; padding: 8px; font-size: 13px; background: #34C759; border-color: #34C759;">📞 Llamar</button>
                <button onclick="prospectarReferido('${r.nombre}', '${r.tel}', '${r.origen}', '${r.obs}')" class="btn-primary" style="flex: 1; min-width: 45%; padding: 8px; font-size: 13px; background: #007AFF; border-color: #007AFF;">💬 Crear WA</button>
                <button onclick="agendarCita('${r.nombre}', 'Cita con Referido: ${r.origen}')" class="btn-secondary" style="flex: 1; min-width: 45%; padding: 8px; font-size: 13px;">📅 Cita</button>
                <button onclick="recordatorioManana('${r.nombre}')" class="btn-secondary" style="flex: 1; min-width: 45%; padding: 8px; font-size: 13px;">⏰ Recordar</button>
                <button onclick="eliminarReferido(${r.id})" style="background: #FF3B30; color: white; border: none; border-radius: 8px; padding: 8px 12px; font-weight: bold; flex-grow: 0;">🗑️</button>
            </div>
        </div>
    `).join('');
};

function getColorBorde(estatus) {
    if (estatus === 'Nuevo') return '#007AFF';
    if (estatus === 'Seguimiento') return '#FF9500';
    if (estatus === 'Cita') return '#34C759';
    return '#8E8E93';
}

function getColorFondo(estatus) {
    if (estatus === 'Nuevo') return '#E5F0FF';
    if (estatus === 'Seguimiento') return '#FFF5E5';
    if (estatus === 'Cita') return '#E5FDEB';
    return '#F2F2F7';
}

function getColorTexto(estatus) {
    if (estatus === 'Nuevo') return '#007AFF';
    if (estatus === 'Seguimiento') return '#FF9500';
    if (estatus === 'Cita') return '#34C759';
    return '#8E8E93';
}

window.cambiarEstatusReferido = async (id, nuevoEstatus) => {
    await DB.actualizar('referidos', id, { estatus: nuevoEstatus });
    await window.renderPipelineReferidos();
};

window.llamarReferido = (tel) => {
    window.open(`tel:${tel}`, '_self');
};

window.prospectarReferido = (nombre, tel, origen, obs) => {
    window.navigateTo('prospeccion');
    setTimeout(() => {
        document.getElementById('p-nombre').value = nombre;
        document.getElementById('p-telefono').value = tel;
        document.getElementById('p-fuente').value = 'Referido';
        document.getElementById('p-contexto').value = `Viene referido por: ${origen || 'No especificado'}. Notas extras: ${obs || 'Ninguna'}`;
    }, 150);
};

window.recordatorioManana = (nombre) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1);
    const dateStr = fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Llamar+a:+${nombre}&details=Seguimiento+de+referido&dates=${dateStr}/${dateStr}`, '_blank');
};

window.eliminarReferido = async (id) => {
    if (confirm('¿Estás seguro de eliminar este prospecto?')) {
        await DB.eliminar('referidos', id);
        await window.renderPipelineReferidos();
    }
};
