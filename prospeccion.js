// prospeccion.js - Generador Avanzado de Guiones y Rebatidor de Objeciones
import { DB } from './db.js';
import { callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

let idEdicion = null;

export function renderProspeccion() {
    return `
        <div class="card">
            <h2 id="pros-titulo">🎯 Control de Prospectos y Acercamiento Inteligente</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input id="pros-nombre" placeholder="Nombre completo del Prospecto">
                <input id="pros-telefono" type="tel" placeholder="Teléfono celular (10 dígitos)">
                
                <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Producto de Interés</label>
                <select id="pros-producto">
                    <option value="Retiro (Imagina Ser / Nuevo Plenitud)">Retiro (PPR)</option>
                    <option value="Segubeca">Segubeca (Educación)</option>
                    <option value="Vida Mujer">Vida Mujer</option>
                    <option value="Gastos Médicos Mayores">Gastos Médicos Mayores</option>
                    <option value="Orvi 99 / Protección">Protección Integral</option>
                </select>

                <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Origen / Temperatura del Lead</label>
                <select id="pros-temperatura">
                    <option value="Cálido">Cálido (Amigos / Familiares)</option>
                    <option value="Tibio">Tibio (Conocidos lejanos)</option>
                    <option value="Frío">Frío (Listas / Directorios)</option>
                    <option value="Referido Directo">Referido Directo de Tercero</option>
                    <option value="Redes Sociales">Redes Sociales / Campaña</option>
                </select>

                <textarea id="pros-notas" placeholder="Información adicional del perfil del cliente..."></textarea>
                
                <button id="btn-guardar-pros" class="btn-primary">💾 Guardar en Embudo</button>
                <button id="btn-cancelar-pros" class="btn-secondary" style="display:none;">❌ Cancelar Edición</button>
            </div>
        </div>

        <div class="card" style="border-left: 4px solid var(--success);">
            <h3>✨ Generador de Guiones de Apertura (IA Mentor)</h3>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">Selecciona el enfoque estratégico para armar el mensaje de impacto.</p>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                <button onclick="generarGuionApertura('Cálido')" class="btn-secondary">🔥 Cálido</button>
                <button onclick="generarGuionApertura('Directo')" class="btn-secondary">🎯 Directo</button>
                <button onclick="generarGuionApertura('Casual')" class="btn-secondary">🗣️ Casual</button>
                <button onclick="generarGuionApertura('Amigable')" class="btn-secondary">🤝 Amigable</button>
            </div>

            <div id="out-guion-apertura" style="background:var(--surface-2); padding:12px; border-radius:12px; min-height:40px; font-size:13px; margin-bottom:10px; border:1px solid var(--separator);">Elige un enfoque de arriba...</div>
            
            <div style="display:flex; gap:8px;">
                <button onclick="copiarTexto('out-guion-apertura')" class="btn-secondary" style="flex:1;">📋 Copiar</button>
                <button onclick="enviarWhatsApp('pros-telefono', 'out-guion-apertura')" class="btn-primary" style="background:#34C759!important; border-color:#34C759!important; flex:1;">🟢 Enviar por WhatsApp</button>
            </div>
        </div>

        <div class="card" style="border-left: 4px solid var(--danger);">
            <h3>🛡️ Destructor de Objeciones en Tiempo Real</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <input id="pros-objecion-txt" placeholder="Ej: No tengo dinero / Ya tengo seguro / No me interesa">
                <button onclick="rebatirObjecionIA()" class="btn-primary" style="background:var(--danger)!important; border-color:var(--danger)!important;">⚡ Romper Objeción</button>
            </div>
            
            <div id="out-objecion-ia" style="background:var(--surface-2); padding:12px; border-radius:12px; font-size:13px; margin-top:10px; border:1px solid var(--separator); line-height:1.4;"></div>
            
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button onclick="abrirGoogleCalendarMeet()" class="btn-secondary" style="flex:1;">🗓️ Agendar en Google Calendar (Meet)</button>
            </div>
        </div>

        <div class="card">
            <h2>Embudo Activo de Prospectos</h2>
            <div id="lista-prospectos" style="display:flex; flex-direction:column; gap:10px;">
                <div class="skeleton-row skeleton-shimmer" style="opacity: 0.15; height: 60px;"></div>
                <div class="skeleton-row skeleton-shimmer" style="opacity: 0.15; height: 60px;"></div>
            </div>
        </div>
    `;
}

export async function bindProspeccionEvents() {
    document.getElementById('btn-guardar-pros')?.addEventListener('click', guardarProspecto);
    document.getElementById('btn-cancelar-pros')?.addEventListener('click', limpiarForm);
    
    // Auto-llenado si venimos desde el ruteador de Referidos
    const refTemp = localStorage.getItem('auto_prospecto');
    if (refTemp) {
        const obj = JSON.parse(refTemp);
        document.getElementById('pros-nombre').value = obj.nombre || '';
        document.getElementById('pros-telefono').value = obj.telefono || '';
        document.getElementById('pros-notas').value = `Referido de: ${obj.origen}. Notas del COI: ${obj.notas || 'Sin notas'}`;
        localStorage.removeItem('auto_prospecto');
    }

    await cargarProspectos();
}

async function guardarProspecto() {
    const datos = {
        nombre: document.getElementById('pros-nombre').value.trim(),
        telefono: document.getElementById('pros-telefono').value.trim(),
        producto: document.getElementById('pros-producto').value,
        temperatura: document.getElementById('pros-temperatura').value,
        notas: document.getElementById('pros-notas').value.trim()
    };
    if (!datos.nombre) return showToast('El nombre es obligatorio.', 'warning');

    if (idEdicion) {
        await DB.actualizar('prospectos', idEdicion, datos);
    } else {
        datos.id = 'pros_' + Date.now();
        await DB.guardar('prospectos', datos);
    }
    limpiarForm();
    await cargarProspectos();
}

async function cargarProspectos() {
    const container = document.getElementById('lista-prospectos');
    if (!container) return;
    const items = await DB.obtenerTodos('prospectos');
    
    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-secondary);">Embudo vacío.</div>`;
        return;
    }

    container.innerHTML = items.map(p => `
        <div style="background:var(--surface-2); padding:12px; border-radius:12px; border:1px solid var(--separator);">
            <div style="display:flex; justify-content:space-between;">
                <strong>${p.nombre}</strong>
                <span class="badge badge-blue">${p.temperatura}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                🎯 Interés: ${p.producto || 'No definido'} | 📞 ${p.telefono || 'Sin número'}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                <button onclick="cargarParaEditar('${p.id}')" class="btn-secondary" style="padding:4px 8px!important; font-size:11px;">✏️ Editar</button>
                <button onclick="eliminarProspecto('${p.id}')" class="btn-secondary" style="padding:4px 8px!important; font-size:11px; color:var(--danger)!important;">🗑️ Borrar</button>
            </div>
        </div>
    `).join('');
}

window.generarGuionApertura = async (enfoque) => {
    const nombre = document.getElementById('pros-nombre').value || 'Hola';
    const producto = document.getElementById('pros-producto').value;
    const temperatura = document.getElementById('pros-temperatura').value;

    const prompt = `Actúas como el mejor asesor y vendedor de seguros del planeta. Con carisma, gracia y empatía absoluta.
        Escribe un único mensaje introductorio de prospección hiper-persuasivo para WhatsApp.
        - Prospecto: ${nombre}
        - Temperatura/Relación: ${temperatura}
        - Producto que le beneficia: ${producto}
        - Enfoque del mensaje: ${enfoque}
        Restricción estricta: Máximo 4 líneas, con tono humano, fresco y que obligue a responder. No uses lenguaje corporativo aburrido. No incluyas asunto ni introducciones, pon solo el mensaje de WhatsApp listo para mandar.`;

    await callGemini(prompt, 'out-guion-apertura');
};

window.rebatirObjecionIA = async () => {
    const objecion = document.getElementById('pros-objecion-txt').value;
    if (!objecion) return showToast('Ingresa una objeción primero.', 'warning');

    const prompt = `Actúas como el cerrador de seguros más empático, inteligente y hábil del mundo. 
        El cliente me acaba de poner esta objeción: "${objecion}".
        Estructura tu respuesta exactamente en tres secciones separadas por etiquetas HTML <br>:
        1. **Respuesta para enviar por WhatsApp**: Un contra-argumento directo, con gracia y alta psicología que desarme la objeción en menos de 3 líneas.
        2. **Resumen de la Psicología Detrás**: Explica qué tiene el cliente en la mente realmente (miedo, control, ignorancia financiera).
        3. **Tips de Debate**: Tu consejo maestro como mentor de cómo debo modular mi voz o guiar la conversación en la llamada en vivo.`;

    await callGemini(prompt, 'out-objecion-ia');
};

window.enviarWhatsApp = (inputTelId, containerTextoId) => {
    const tel = document.getElementById(inputTelId).value.replace(/[^0-9]/g, '');
    const txt = document.getElementById(containerTextoId).innerText;
    if (!tel) return showToast('Falta el número telefónico.', 'warning');
    window.open(`https://wa.me/52${tel}?text=${encodeURIComponent(txt)}`, '_blank');
};

window.copiarTexto = (containerId) => {
    const txt = document.getElementById(containerId).innerText;
    navigator.clipboard.writeText(txt);
    showToast('Copiado al portapapeles.', 'success');
};

window.abrirGoogleCalendarMeet = () => {
    const nombre = document.getElementById('pros-nombre').value || 'Prospecto';
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Asesoría Financiera Patrimonial - ' + nombre)}&add=`, '_blank');
};

window.cargarParaEditar = async (id) => {
    const items = await DB.obtenerTodos('prospectos');
    const p = items.find(x => x.id === id);
    if (!p) return;
    idEdicion = id;
    document.getElementById('pros-titulo').innerText = '✏️ Editar Prospecto';
    document.getElementById('pros-nombre').value = p.nombre || '';
    document.getElementById('pros-telefono').value = p.telefono || '';
    document.getElementById('pros-producto').value = p.producto || 'Segubeca';
    document.getElementById('pros-temperatura').value = p.temperatura || 'Cálido';
    document.getElementById('pros-notas').value = p.notas || '';
    document.getElementById('btn-cancelar-pros').style.display = 'block';
};

window.eliminarProspecto = async (id) => {
    const seguro = await showConfirm('¿Estás seguro de que deseas eliminar este prospecto de tu pipeline de ventas?', 'Eliminar Prospecto', 'Eliminar', true);
    if (seguro) {
        await DB.eliminar('prospectos', id);
        await cargarProspectos();
    }
};

function limpiarForm() {
    idEdicion = null;
    document.getElementById('pros-titulo').innerText = '🎯 Nuevo Prospecto';
    ['pros-nombre', 'pros-telefono', 'pros-notas'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('btn-cancelar-pros').style.display = 'none';
}
