// prospeccion.js
import { callGemini } from './app.js';
import { agendarCita } from './utils.js';

export function renderProspeccion() {
    return `
        <div class="card">
            <h2>Perfil del Prospecto</h2>
            <input id="p-nombre" placeholder="Nombre">
            <input id="p-telefono" type="tel" placeholder="Teléfono">
            <select id="p-fuente">
                <option value="">Origen...</option>
                <option value="Cálido">Cálido</option>
                <option value="Tibio">Tibio</option>
                <option value="Frío">Frío</option>
                <option value="Referido">Referido</option>
                <option value="Redes Sociales">Redes Sociales</option>
            </select>
            <select id="p-producto">
                <option value="">Producto de interés...</option>
                <option value="Retiro">👴 Retiro</option>
                <option value="Ahorro">🐷 Ahorro</option>
                <option value="Gastos Médicos Mayores">🏥 Gastos Médicos Mayores</option>
                <option value="Protección">🛡️ Protección</option>
            </select>
            <textarea id="p-contexto" placeholder="Contexto (edad, ocupación, estado civil, ingresos...)" rows="3"></textarea>

            <h3 style="margin-top:20px;">Estilo de Acercamiento:</h3>
            <div class="ia-actions" style="grid-template-columns: 1fr 1fr;">
                <button class="btn-secondary" onclick="generarEstilo('Amigable')">😊 Amigable</button>
                <button class="btn-secondary" onclick="generarEstilo('Directo')">🎯 Directo</button>
                <button class="btn-secondary" onclick="generarEstilo('Casual')">☕ Casual</button>
                <button class="btn-secondary" onclick="generarEstilo('Informal')">😎 Informal</button>
            </div>
        </div>

        <div class="card">
            <h2>Guión Sugerido</h2>
            <div id="out-acercamiento" style="background: #F2F2F7; padding: 16px; border-radius: 16px; min-height: 80px; margin-bottom: 10px; white-space: pre-wrap;">Esperando...</div>
            <div class="ia-actions">
                <button onclick="copiarTexto('out-acercamiento')" class="btn-secondary">Copiar</button>
                <button onclick="enviarWA('out-acercamiento')" class="btn-primary">Enviar por WA</button>
            </div>
        </div>

        <div class="card">
            <h2>Manejo de Objeciones</h2>
            <textarea id="p-objecion" placeholder="Respuesta del prospecto (Ej. 'Está muy caro', 'Déjame pensarlo')" rows="2"></textarea>
            <button id="btn-objecion" class="btn-primary">Analizar Objeción</button>

            <h3 style="margin-top: 15px; font-size: 16px;">Mensaje de Respuesta (WhatsApp):</h3>
            <div id="out-objecion-mensaje" style="background: #e6f2ff; padding: 16px; border-radius: 16px; min-height: 60px; margin-bottom: 10px; white-space: pre-wrap;">Esperando objeción...</div>
            <div class="ia-actions">
                <button onclick="copiarTexto('out-objecion-mensaje')" class="btn-secondary">Copiar Mensaje</button>
                <button onclick="enviarWA('out-objecion-mensaje')" class="btn-primary">Enviar por WA</button>
                <button id="btn-agendar-obj" class="btn-secondary" style="background: #28a745;">📅 Agendar Cita</button>
            </div>

            <h3 style="margin-top: 15px; font-size: 16px;">Análisis Psicológico y Estrategia:</h3>
            <div id="out-objecion-analisis" style="background: #F2F2F7; padding: 16px; border-radius: 16px; min-height: 80px; white-space: pre-wrap; font-size: 14px; color: #444;">Esperando análisis...</div>
        </div>
    `;
}

export function bindProspeccionEvents() {
    window.generarEstilo = (estilo) => {
        const nombre = document.getElementById('p-nombre').value || 'Prospecto';
        const fuente = document.getElementById('p-fuente').value || 'Desconocida';
        const producto = document.getElementById('p-producto').value || 'Seguros';
        const contexto = document.getElementById('p-contexto').value || 'Sin contexto';

        const prompt = `Genera UN ÚNICO mensaje de WhatsApp para ${nombre} (Origen: ${fuente}, Interés: ${producto}, Contexto: ${contexto}). El tono debe ser estrictamente: ${estilo}. Objetivo: Conseguir una cita. REGLA INQUEBRANTABLE: Escribe ÚNICAMENTE el texto exacto para enviar. Cero introducciones, cero explicaciones, cero opciones extra, cero despedidas tuyas. Solo el mensaje listo para copiar.`;

        callGemini(prompt, 'out-acercamiento');
    };

    document.getElementById('btn-objecion').addEventListener('click', () => {
        const objecion = document.getElementById('p-objecion').value;
        if (!objecion) return;
        callGemini(`El prospecto respondió: "${objecion}". Genera ÚNICAMENTE la respuesta de WhatsApp para debatir la objeción y buscar la cita. Cero introducciones, explicaciones ni opciones. Solo el texto crudo.`, 'out-objecion-mensaje');
        callGemini(`El prospecto respondió: "${objecion}". Realiza un análisis psicológico rápido y danos viñetas de cómo rebatirlo.`, 'out-objecion-analisis');
    });

    document.getElementById('btn-agendar-obj').addEventListener('click', () => {
        const nombre = document.getElementById('p-nombre').value || 'Prospecto';
        agendarCita(nombre, 'Seguimiento tras objeción');
    });

    window.copiarTexto = (id) => {
        const texto = document.getElementById(id).innerText;
        navigator.clipboard.writeText(texto).then(() => alert('Copiado con éxito'));
    };

    window.enviarWA = (id) => {
        let tel = document.getElementById('p-telefono').value.replace(/\D/g, '');
        if (tel.length < 10) return alert('Número de teléfono inválido');
        window.open(`https://wa.me/52${tel}?text=${encodeURIComponent(document.getElementById(id).innerText)}`, '_blank');
    };
}
