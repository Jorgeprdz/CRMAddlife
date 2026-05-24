// /modules/prospeccion.js - Embudo y Autogenerador IA
import { DB } from './db.js';
import { callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

const State = {
    idEdicion: null,
    isProcessingAI: false,
    reset() {
        this.idEdicion = null;
        document.getElementById('pros-titulo').innerText = '🎯 Control de Prospectos';
        ['pros-nombre', 'pros-telefono', 'pros-notas', 'pros-objecion-txt'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        document.getElementById('btn-cancelar-pros').style.display = 'none';
        document.getElementById('out-guion-apertura').innerHTML = 'Selecciona un enfoque...';
        document.getElementById('out-objecion-ia').innerHTML = 'Esperando objeción...';
    }
};

export function renderProspeccion() {
    return `
        <div id="prospeccion-root" style="padding-bottom: 24px;">
            <div class="glass-widget" style="margin-bottom: 16px;">
                <h2 id="pros-titulo" style="font-size:18px; margin-bottom:16px;">🎯 Control de Prospectos</h2>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <input id="pros-nombre" class="glass-input" placeholder="Nombre completo del Prospecto">
                    <input id="pros-telefono" class="glass-input" type="tel" placeholder="Teléfono celular">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Producto</label>
                            <select id="pros-producto" class="glass-input" style="width:100%;">
                                <option value="Retiro (PPR)">Retiro (PPR)</option>
                                <option value="Segubeca">Segubeca</option>
                                <option value="Vida Mujer">Vida Mujer</option>
                                <option value="Gastos Médicos Mayores">GMM</option>
                                <option value="Protección Integral">Protección Integral</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Temperatura</label>
                            <select id="pros-temperatura" class="glass-input" style="width:100%;">
                                <option value="Cálido">Cálido (Amigos/Familia)</option>
                                <option value="Tibio">Tibio (Referidos)</option>
                                <option value="Frío">Frío (Bases de datos)</option>
                                <option value="Inbound">Inbound (Redes)</option>
                            </select>
                        </div>
                    </div>

                    <textarea id="pros-notas" class="glass-input" placeholder="Contexto y necesidades..." rows="2"></textarea>
                    
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button id="btn-guardar-pros" class="btn-primary" style="flex:1;">💾 Guardar en Embudo</button>
                        <button id="btn-cancelar-pros" class="btn-secondary" style="display:none; flex:1;">❌ Cancelar</button>
                    </div>
                </div>
            </div>

            <div class="glass-widget" style="margin-bottom: 16px; border-left: 4px solid #34C759;">
                <h3 style="font-size:15px; margin-bottom:12px;">✨ Generador de Guiones</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                    <button data-action="ia-guion" data-enfoque="Cálido" class="btn-secondary btn-sm">🔥 Cálido</button>
                    <button data-action="ia-guion" data-enfoque="Directo" class="btn-secondary btn-sm">🎯 Directo</button>
                    <button data-action="ia-guion" data-enfoque="Casual" class="btn-secondary btn-sm">🗣️ Casual</button>
                    <button data-action="ia-guion" data-enfoque="Amigable" class="btn-secondary btn-sm">🤝 Amigable</button>
                </div>
                <div id="out-guion-apertura" class="glass-output">Selecciona enfoque...</div>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <button data-action="copy-guion" class="btn-secondary" style="flex:1;">📋 Copiar</button>
                    <button data-action="wa-guion" class="btn-primary" style="background:#34C759!important; border-color:#34C759!important; flex:2;">🟢 Enviar WhatsApp</button>
                </div>
            </div>

            <div class="glass-widget" style="margin-bottom: 24px; border-left: 4px solid #FF3B30;">
                <h3 style="font-size:15px; margin-bottom:12px;">🛡️ Romper Objeciones</h3>
                <div style="display:flex; gap:8px;">
                    <input id="pros-objecion-txt" class="glass-input" placeholder="Ej: Está muy caro" style="flex:1;">
                    <button data-action="ia-objecion" class="btn-primary" style="background:#FF3B30!important; border-color:#FF3B30!important; padding:0 16px;">⚡</button>
                </div>
                <div id="out-objecion-ia" class="glass-output" style="margin-top:12px;">Esperando objeción...</div>
            </div>

            <div>
                <h2 style="font-size:18px; margin-bottom:12px; padding-left:4px;">Embudo Activo</h2>
                <div id="lista-prospectos" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
        </div>
    `;
}

export async function bindProspeccionEvents() {
    const root = document.getElementById('prospeccion-root');
    if (!root) return;

    root.removeEventListener('click', handleProspeccionClicks);
    root.addEventListener('click', handleProspeccionClicks);
    
    document.getElementById('btn-guardar-pros')?.addEventListener('click', Controller.guardarProspecto);
    document.getElementById('btn-cancelar-pros')?.addEventListener('click', () => State.reset());

    // Hidratación y Auto-Generación desde Referidos
    const refTemp = localStorage.getItem('auto_prospecto');
    const autoGen = localStorage.getItem('auto_generar_guion');
    
    if (refTemp) {
        try {
            const obj = JSON.parse(refTemp);
            document.getElementById('pros-nombre').value = obj.nombre || '';
            document.getElementById('pros-telefono').value = obj.telefono || '';
            document.getElementById('pros-notas').value = `COI: ${obj.origen || 'N/A'}. Notas: ${obj.notas || ''}`;
            
            // Forzamos selección a Tibio al venir de referidos
            document.getElementById('pros-temperatura').value = 'Tibio'; 
            
            localStorage.removeItem('auto_prospecto');
            
            if (autoGen === 'true') {
                localStorage.removeItem('auto_generar_guion');
                // Auto-disparo fluido del generador
                setTimeout(() => Controller.generarGuion('Casual'), 300);
            }
        } catch(e) { console.error(e); }
    }

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
            container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); background:rgba(0,0,0,0.03); border-radius:16px;">Embudo vacío.</div>`;
            return;
        }

        container.innerHTML = items.map(p => `
            <div class="glass-widget" style="padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:16px; letter-spacing:-0.3px;">${p.nombre}</strong>
                    <span class="status-badge" style="background:rgba(0,122,255,0.1); color:#007AFF; border:1px solid rgba(0,122,255,0.2);">${p.temperatura}</span>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:8px;">🎯 ${p.producto} &nbsp;|&nbsp; 📞 ${p.telefono || 'Sin número'}</div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid rgba(150,150,150,0.1); padding-top:12px;">
                    <button data-action="editar-prospecto" data-id="${p.id}" class="btn-secondary btn-sm">✏️ Editar</button>
                    <button data-action="eliminar-prospecto" data-id="${p.id}" class="btn-secondary btn-sm" style="color:var(--danger)!important;">🗑️</button>
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
        const seguro = await showConfirm('¿Deseas eliminar este prospecto del embudo?', 'Eliminar Prospecto', 'Eliminar', true);
        if (seguro) {
            await DB.eliminar('prospectos', id);
            await this.cargarPipeline();
            showToast('Prospecto eliminado.', 'success');
        }
    },

    async generarGuion(enfoque) {
        if (State.isProcessingAI) return;
        State.isProcessingAI = true;
        const nombre = document.getElementById('pros-nombre').value || 'Hola';
        const producto = document.getElementById('pros-producto').value;
        const temp = document.getElementById('pros-temperatura').value;

        const out = document.getElementById('out-guion-apertura');
        out.innerHTML = '<span class="spinner-mini">⚙️</span> Creando mensaje...';

        const prompt = `Escribe un mensaje de WhatsApp para venta de seguros. Prospecto: ${nombre}, Relación: ${temp}, Interés: ${producto}, Tono: ${enfoque}. Reglas: Máximo 3 líneas. Fresco, directo. Sin comillas. Solo el texto final para copiar y pegar.`;
        
        await callGemini(prompt, 'out-guion-apertura');
        State.isProcessingAI = false;
    },

    async rebatirObjecion() {
        if (State.isProcessingAI) return;
        const objecion = document.getElementById('pros-objecion-txt').value;
        if (!objecion) return showToast('Escribe una objeción primero.', 'warning');

        State.isProcessingAI = true;
        const out = document.getElementById('out-objecion-ia');
        out.innerHTML = '<span class="spinner-mini">⚙️</span> Analizando objeción...';

        const prompt = `Objeción del cliente: "${objecion}". Estructura la respuesta exacta en 2 viñetas: 1. Contraargumento WhatsApp (2 líneas máximo). 2. Psicología oculta (1 línea). Cero relleno.`;
        await callGemini(prompt, 'out-objecion-ia');
        State.isProcessingAI = false;
    },

    enviarWA() {
        const tel = document.getElementById('pros-telefono').value.replace(/[^0-9]/g, '');
        const txt = document.getElementById('out-guion-apertura').innerText;
        if (!tel) return showToast('Agrega el número de teléfono.', 'danger');
        window.open(`https://wa.me/52${tel}?text=${encodeURIComponent(txt)}`, '_blank');
    },

    copiarGuion() {
        const txt = document.getElementById('out-guion-apertura').innerText;
        if (txt && !txt.includes('Selecciona')) {
            navigator.clipboard.writeText(txt);
            showToast('Guion copiado al portapapeles.', 'success');
        }
    }
};
