// /modules/referidos.js - Directorio Premium y Ruteador de Ventas
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

const State = {
    idEdicion: null,
    datos: [],
    reset() {
        this.idEdicion = null;
        document.getElementById('ref-titulo').innerText = '👥 Registro de Referidos';
        ['ref-nombre', 'ref-telefono', 'ref-origen', 'ref-notas'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        document.getElementById('ref-estado').value = 'Nuevo';
        document.getElementById('btn-cancelar-ref').style.display = 'none';
    }
};

// Paleta de colores para Glow y Badges (Glassmorphism)
const SemaforoColores = {
    'Nuevo': { color: '#007AFF', label: 'Nuevo' },
    'Contactado': { color: '#FFCC00', label: 'Contactado' },
    'Cita': { color: '#34C759', label: 'Cita' },
    'Seguimiento': { color: '#AF52DE', label: 'Seguimiento' },
    'Descartado': { color: '#FF3B30', label: 'Descartado' }
};

export function renderReferidos() {
    return `
        <div id="referidos-root" style="padding-bottom: 24px;">
            <div class="glass-widget" style="margin-bottom: 20px;">
                <h2 id="ref-titulo" style="font-size:18px; margin-bottom:16px;">👥 Registro de Referidos</h2>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <input id="ref-nombre" class="glass-input" placeholder="Nombre completo del referido">
                    <input id="ref-telefono" class="glass-input" type="tel" placeholder="Teléfono celular">
                    <input id="ref-origen" class="glass-input" placeholder="¿Quién es el Centro de Influencia (COI)?">
                    
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-top:4px;">Estatus Inicial</label>
                    <select id="ref-estado" class="glass-input">
                        ${Object.keys(SemaforoColores).map(k => `<option value="${k}">${k}</option>`).join('')}
                    </select>

                    <textarea id="ref-notas" class="glass-input" placeholder="Contexto, hobbies, ocupación..." rows="3"></textarea>
                    
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button id="btn-guardar-ref" class="btn-primary" style="flex:1;">💾 Guardar Referido</button>
                        <button id="btn-cancelar-ref" class="btn-secondary" style="display:none; flex:1;">❌ Cancelar</button>
                    </div>
                </div>
            </div>

            <div style="background:transparent; border:none; padding:0;">
                <h2 style="font-size:18px; margin-bottom:12px; padding-left:4px;">Directorio Inteligente</h2>
                <input id="ref-buscador" class="glass-input" placeholder="🔍 Buscar por nombre o COI..." style="margin-bottom:16px; width:100%;">
                <div id="lista-referidos-container" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
        </div>
    `;
}

export async function bindReferidosEvents() {
    const root = document.getElementById('referidos-root');
    if (!root) return;

    // Remover listeners previos para evitar duplicidad de eventos
    root.removeEventListener('click', handleReferidosClicks);
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
        showToast('Referido guardado con éxito.', 'success');
    },

    async cargarDirectorio() {
        State.datos = await DB.obtenerTodos('referidos');
        this._renderHTML(State.datos);
    },

    filtrarUI(texto) {
        const query = texto.toLowerCase();
        const filtrados = State.datos.filter(r => 
            r.nombre.toLowerCase().includes(query) || 
            (r.origen && r.origen.toLowerCase().includes(query))
        );
        this._renderHTML(filtrados);
    },

    _renderHTML(lista) {
        const container = document.getElementById('lista-referidos-container');
        if (lista.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:14px; background:rgba(0,0,0,0.03); border-radius:16px;">Directorio vacío o sin coincidencias.</div>`;
            return;
        }

        container.innerHTML = lista.map(r => {
            const ui = SemaforoColores[r.estado] || SemaforoColores['Nuevo'];
            return `
                <div class="glass-widget status-card" style="--status-color: ${ui.color};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                            <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--text-primary); letter-spacing:-0.3px;">${r.nombre}</h3>
                            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-secondary);">👤 COI: ${r.origen || 'No indicado'}</p>
                            ${r.telefono ? `<p style="margin:2px 0 0 0; font-size:12px; color:var(--text-secondary);">📞 ${r.telefono}</p>` : ''}
                        </div>
                        <span class="status-badge" style="background:${ui.color}1A; color:${ui.color}; border:1px solid ${ui.color}40;">
                            ${ui.label}
                        </span>
                    </div>
                    ${r.notas ? `<p style="margin:8px 0 0 0; font-size:12px; color:var(--text-secondary); opacity:0.8; line-height:1.4;">📝 ${r.notas}</p>` : ''}
                    
                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; padding-top:12px; border-top:1px solid rgba(150,150,150,0.1);">
                        <button data-action="enrutar-embudo" data-id="${r.id}" class="btn-primary btn-sm" style="background:var(--accent)!important;">💬 Enviar Mensaje</button>
                        <button data-action="editar-referido" data-id="${r.id}" class="btn-secondary btn-sm">✏️ Editar</button>
                        <button data-action="eliminar-referido" data-id="${r.id}" class="btn-secondary btn-sm" style="color:var(--danger)!important;">🗑️</button>
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
        const seguro = await showConfirm('¿Estás seguro de descartar este referido de tu directorio?', 'Eliminar Referido', 'Eliminar', true);
        if (seguro) {
            await DB.eliminar('referidos', id);
            await this.cargarDirectorio();
            showToast('Referido eliminado.', 'success');
        }
    }
};
