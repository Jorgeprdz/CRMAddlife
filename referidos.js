import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

const State = {
    idEdicion: null,
    datos: [],
    reset() {
        this.idEdicion = null;
        document.getElementById('ref-titulo').innerText = '👥 Registro de Referidos';
        ['ref-nombre', 'ref-telefono', 'ref-origen', 'ref-notas'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('ref-estado').value = 'Nuevo';
        document.getElementById('btn-cancelar-ref').style.display = 'none';
    }
};

const SemaforoColores = {
    'Nuevo': { color: '#007AFF', label: 'Contacto Nuevo (Azul)' },
    'Contactado': { color: '#5856D6', label: 'Contactado (Morado)' },
    'Agendado': { color: '#34C759', label: 'Cita Agendada (Verde)' },
    'En Seguimiento': { color: '#FF9500', label: 'En Seguimiento (Naranja)' },
    'Cerró': { color: '#32D74B', label: 'Póliza Cerrada (Verde)' },
    'Descartado': { color: '#FF3B30', label: 'Descartado (Rojo)' }
};

export function renderReferidos() {
    return `
        <div id="referidos-root">
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

            <div class="card" style="background:transparent; border:none; padding:0;">
                <h2 style="margin-bottom:12px;">Directorio Inteligente</h2>
                <input id="ref-buscador" placeholder="🔍 Buscar por nombre..." style="margin-bottom:16px; width:100%; border-radius:12px; padding:12px; border:1px solid var(--separator);">
                <div id="lista-referidos-container" style="display:flex; flex-direction:column;"></div>
            </div>
        </div>
    `;
}

export async function bindReferidosEvents() {
    const root = document.getElementById('referidos-root');
    if (!root) return;

    root.addEventListener('click', handleReferidosClicks);
    document.getElementById('btn-guardar-ref')?.addEventListener('click', Controller.guardarReferido);
    document.getElementById('btn-cancelar-ref')?.addEventListener('click', () => State.reset());
    document.getElementById('ref-buscador')?.addEventListener('input', (e) => Controller.filtrarUI(e.target.value));

    await Controller.cargarDirectorio();
}

async function handleReferidosClicks(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    switch(action) {
        case 'enrutar-embudo': Controller.enrutarAProspeccion(id); break;
        case 'editar-referido': Controller.cargarEdicion(id); break;
        case 'eliminar-referido': Controller.eliminarReferido(id); break;
    }
}

const Controller = {
    async guardarReferido() {
        const payload = {
            nombre: document.getElementById('ref-nombre').value.trim(),
            telefono: document.getElementById('ref-telefono').value.trim(),
            origen: document.getElementById('ref-origen').value.trim(),
            estado: document.getElementById('ref-estado').value,
            notas: document.getElementById('ref-notas').value.trim()
        };

        if (!payload.nombre) return showToast('El nombre es obligatorio.', 'danger');

        if (State.idEdicion) {
            await DB.actualizar('referidos', State.idEdicion, payload);
        } else {
            payload.id = 'ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            await DB.guardar('referidos', payload);
        }
        
        State.reset();
        await this.cargarDirectorio();
        showToast('Referido procesado con éxito.', 'success');
    },

    async cargarDirectorio() {
        State.datos = await DB.obtenerTodos('referidos');
        this._renderHTML(State.datos);
    },

    filtrarUI(texto) {
        const query = texto.toLowerCase();
        const filtrados = State.datos.filter(r => r.nombre.toLowerCase().includes(query));
        this._renderHTML(filtrados);
    },

    _renderHTML(lista) {
        const container = document.getElementById('lista-referidos-container');
        if (lista.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Directorio vacío.</div>`;
            return;
        }

        container.innerHTML = lista.map(r => {
            const ui = SemaforoColores[r.estado] || { color: '#ccc', label: r.estado };
            return `
                <div class="ios-widget" style="margin-bottom:12px; border-left:4px solid ${ui.color}; box-shadow:-4px 0 16px ${ui.color}22, 0 4px 12px rgba(0,0,0,0.03); padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin:0; font-size:16px; font-weight:700;">${r.nombre}</h3>
                            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-secondary);">👤 COI: ${r.origen || 'No indicado'} | 📞 ${r.telefono || 'N/A'}</p>
                        </div>
                        <span style="background:${ui.color}15; color:${ui.color}; border:1px solid ${ui.color}40; font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px;">${r.estado}</span>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
                        <button data-action="enrutar-embudo" data-id="${r.id}" class="btn-primary" style="background:#007AFF!important; border-radius:10px; font-size:12px; padding:6px 12px!important;">💬 Enviar Mensaje</button>
                        <button data-action="editar-referido" data-id="${r.id}" class="btn-secondary" style="border-radius:10px; font-size:12px; padding:6px 12px!important;">✏️ Editar</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    enrutarAProspeccion(id) {
        const ref = State.datos.find(x => x.id === id);
        if (!ref) return;
        localStorage.setItem('auto_prospecto', JSON.stringify(ref));
        localStorage.setItem('auto_generar_guion', 'true');
        window.navigateTo('prospeccion');
    },

    cargarEdicion(id) {
        const r = State.datos.find(x => x.id === id);
        if (!r) return;
        
        State.idEdicion = id;
        document.getElementById('ref-titulo').innerText = '✏️ Editar Referido';
        document.getElementById('ref-nombre').value = r.nombre || '';
        document.getElementById('ref-telefono').value = r.telefono || '';
        document.getElementById('ref-origen').value = r.origen || '';
        document.getElementById('ref-estado').value = r.estado || 'Nuevo';
        document.getElementById('ref-notas').value = r.notas || '';
        document.getElementById('btn-cancelar-ref').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async eliminarReferido(id) {
        const seguro = await showConfirm('¿Eliminar este referido de la base de datos?', 'Borrar', 'Eliminar', true);
        if (seguro) {
            await DB.eliminar('referidos', id);
            await this.cargarDirectorio();
        }
    }
};
