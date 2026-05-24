import { DB } from './db.js';
import { callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

const State = {
    idEdicion: null,
    isProcessingAI: false,
    reset() {
        this.idEdicion = null;
        document.getElementById('pros-titulo').innerText = '🎯 Control de Prospectos';
        ['pros-nombre', 'pros-telefono', 'pros-notas'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('btn-cancelar-pros').style.display = 'none';
    }
};

export function renderProspeccion() {
    return `
        <div id="prospeccion-root">
            <div class="card">
                <h2 id="pros-titulo">🎯 Control de Prospectos</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <input id="pros-nombre" placeholder="Nombre completo del Prospecto">
                    <input id="pros-telefono" type="tel" placeholder="Teléfono celular">
                    
                    <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Producto</label>
                    <select id="pros-producto">
                        <option value="Retiro (PPR)">Retiro (PPR)</option>
                        <option value="Segubeca">Segubeca</option>
                        <option value="Vida Mujer">Vida Mujer</option>
                        <option value="Gastos Médicos Mayores">GMM</option>
                        <option value="Protección Integral">Protección Integral</option>
                    </select>

                    <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Temperatura</label>
                    <select id="pros-temperatura">
                        <option value="Cálido">Cálido (Amigos / Familia)</option>
                        <option value="Tibio">Tibio (Referidos)</option>
                        <option value="Frío">Frío (Bases de datos)</option>
                        <option value="Inbound">Inbound (Redes Sociales)</option>
                    </select>

                    <textarea id="pros-notas" placeholder="Contexto..."></textarea>
                    
                    <button id="btn-guardar-pros" class="btn-primary">💾 Guardar en Embudo</button>
                    <button id="btn-cancelar-pros" class="btn-secondary" style="display:none;">❌ Cancelar</button>
                </div>
            </div>

            <div class="card" style="border-left: 4px solid var(--success);">
                <h3>✨ Generador de Guiones</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                    <button data-action="ia-guion" data-enfoque="Cálido" class="btn-secondary">🔥 Cálido</button>
                    <button data-action="ia-guion" data-enfoque="Directo" class="btn-secondary">🎯 Directo</button>
                    <button data-action="ia-guion" data-enfoque="Casual" class="btn-secondary">🗣️ Casual</button>
                    <button data-action="ia-guion" data-enfoque="Amigable" class="btn-secondary">🤝 Amigable</button>
                </div>
                <div id="out-guion-apertura" style="background:var(--surface-2); padding:12px; border-radius:12px; min-height:40px; font-size:13px; margin-bottom:10px; border:1px solid var(--separator);">Selecciona enfoque...</div>
                <div style="display:flex; gap:8px;">
                    <button data-action="copy-guion" class="btn-secondary" style="flex:1;">📋 Copiar</button>
                    <button data-action="wa-guion" class="btn-primary" style="background:#34C759!important; border-color:#34C759!important; flex:1;">🟢 Enviar WA</button>
                </div>
            </div>

            <div class="card" style="border-left: 4px solid var(--danger);">
                <h3>🛡️ Objeciones</h3>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input id="pros-objecion-txt" placeholder="Ej: Está muy caro">
                    <button data-action="ia-objecion" class="btn-primary" style="background:var(--danger)!important; border-color:var(--danger)!important;">⚡ Romper Objeción</button>
                </div>
                <div id="out-objecion-ia" style="background:var(--surface-2); padding:12px; border-radius:12px; font-size:13px; margin-top:10px; border:1px solid var(--separator);">Esperando objeción...</div>
            </div>

            <div class="card">
                <h2>Embudo Activo</h2>
                <div id="lista-prospectos" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        </div>
    `;
}

export async function bindProspeccionEvents() {
    const root = document.getElementById('prospeccion-root');
    if (!root) return;

    const refTemp = localStorage.getItem('auto_prospecto');
    const autoGen = localStorage.getItem('auto_generar_guion');
    
    if (refTemp) {
        const obj = JSON.parse(refTemp);
        document.getElementById('pros-nombre').value = obj.nombre || '';
        document.getElementById('pros-telefono').value = obj.telefono || '';
        document.getElementById('pros-notas').value = `Origen: ${obj.origen}. Notas: ${obj.notas || ''}`;
        localStorage.removeItem('auto_prospecto');
        
        if (autoGen === 'true') {
            localStorage.removeItem('auto_generar_guion');
            setTimeout(() => Controller.generarGuion('Casual'), 500);
        }
    }

    root.addEventListener('click', handleProspeccionClicks);
    document.getElementById('btn-guardar-pros')?.addEventListener('click', Controller.guardarProspecto);
    document.getElementById('btn-cancelar-pros')?.addEventListener('click', () => State.reset());

    await Controller.cargarPipeline();
}

async function handleProspeccionClicks(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    switch(action) {
        case 'ia-guion': Controller.generarGuion(btn.getAttribute('data-enfoque')); break;
        case 'ia-objecion': Controller.rebatirObjecion(); break;
        case 'copy-guion': Controller.copiarGuion(); break;
        case 'wa-guion': Controller.enviarWA(); break;
        case 'editar-prospecto': Controller.cargarEdicion(id); break;
        case 'eliminar-prospecto': Controller.eliminarProspecto(id); break;
    }
}

const Controller = {
    async guardarProspecto() {
        const payload = {
            nombre: document.getElementById('pros-nombre').value.trim(),
            telefono: document.getElementById('pros-telefono').value.trim(),
            producto: document.getElementById('pros-producto').value,
            temperatura: document.getElementById('pros-temperatura').value,
            notas: document.getElementById('pros-notas').value.trim()
        };

        if (!payload.nombre) return showToast('Nombre obligatorio.', 'danger');

        if (State.idEdicion) await DB.actualizar('prospectos', State.idEdicion, payload);
        else {
            payload.id = 'pros_' + Date.now();
            await DB.guardar('prospectos', payload);
        }
        State.reset();
        await this.cargarPipeline();
        showToast('Guardado en embudo.', 'success');
    },

    async cargarPipeline() {
        const container = document.getElementById('lista-prospectos');
        const items = await DB.obtenerTodos('prospectos');
        
        if (items.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-secondary);">Embudo vacío.</div>`;
            return;
        }

        container.innerHTML = items.map(p => `
            <div class="ios-widget" style="padding:16px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="font-size:15px;">${p.nombre}</strong>
                    <span class="badge badge-blue">${p.temperatura}</span>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:6px;">🎯 ${p.producto} | 📞 ${p.telefono || 'Sin número'}</div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                    <button data-action="editar-prospecto" data-id="${p.id}" class="btn-secondary" style="padding:6px 12px!important; border-radius:10px; font-size:12px;">✏️ Editar</button>
                    <button data-action="eliminar-prospecto" data-id="${p.id}" class="btn-secondary" style="padding:6px 12px!important; border-radius:10px; font-size:12px; color:var(--danger)!important;">🗑️ Borrar</button>
                </div>
            </div>
        `).join('');
    },

    async cargarEdicion(id) {
        const items = await DB.obtenerTodos('prospectos');
        const p = items.find(x => x.id === id);
        if (!p) return;
        
        State.idEdicion = id;
        document.getElementById('pros-titulo').innerText = '✏️ Editar Prospecto';
        document.getElementById('pros-nombre').value = p.nombre || '';
        document.getElementById('pros-telefono').value = p.telefono || '';
        document.getElementById('pros-producto').value = p.producto || 'Segubeca';
        document.getElementById('pros-temperatura').value = p.temperatura || 'Cálido';
        document.getElementById('pros-notas').value = p.notas || '';
        document.getElementById('btn-cancelar-pros').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async eliminarProspecto(id) {
        const seguro = await showConfirm('¿Deseas eliminar este prospecto?', 'Eliminar', 'Eliminar', true);
        if (seguro) {
            await DB.eliminar('prospectos', id);
            await this.cargarPipeline();
        }
    },

    async generarGuion(enfoque) {
        if (State.isProcessingAI) return;
        State.isProcessingAI = true;
        const nombre = document.getElementById('pros-nombre').value || 'Hola';
        const producto = document.getElementById('pros-producto').value;
        const temp = document.getElementById('pros-temperatura').value;

        const prompt = `Escribe un mensaje de WhatsApp para venta de seguros. Prospecto: ${nombre}, Relación: ${temp}, Interés: ${producto}, Tono: ${enfoque}. Reglas: Máximo 3 líneas. Fresco, directo. Solo el texto final.`;
        await callGemini(prompt, 'out-guion-apertura');
        State.isProcessingAI = false;
    },

    async rebatirObjecion() {
        if (State.isProcessingAI) return;
        const objecion = document.getElementById('pros-objecion-txt').value;
        if (!objecion) return showToast('Ingresa objeción.', 'warning');

        State.isProcessingAI = true;
        const prompt = `Objeción: "${objecion}". Estructura en 2 viñetas: 1. Contraargumento WhatsApp (2 líneas). 2. Psicología (1 línea).`;
        await callGemini(prompt, 'out-objecion-ia');
        State.isProcessingAI = false;
    },

    enviarWA() {
        const tel = document.getElementById('pros-telefono').value.replace(/[^0-9]/g, '');
        const txt = document.getElementById('out-guion-apertura').innerText;
        if (!tel) return showToast('Falta número.', 'danger');
        window.open(`https://wa.me/52${tel}?text=${encodeURIComponent(txt)}`, '_blank');
    },

    copiarGuion() {
        navigator.clipboard.writeText(document.getElementById('out-guion-apertura').innerText);
        showToast('Copiado.', 'success');
    }
};
