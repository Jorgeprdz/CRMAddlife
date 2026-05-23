// comisiones.js - Motor Financiero y Reglas del Cuaderno de Concursos
import { DB } from './db.js';
import { callGemini } from './app.js';

const TablaComisiones = {
    'Star Temporal': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Orvi 99': { nn: 0.44, ry: 0.15, ramo: 'Vida' },
    'Respaldo Educativo': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Segubeca': { nn: 0.37, ry: 0.09, ramo: 'Vida' },
    'Respaldo Negocio': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Mio': { nn: 0.80, ry: 0.20, ramo: 'Vida' },
    'Imagina Ser': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Objetivo Vida': { nn: 0.44, ry: 0.05, ramo: 'Vida' },
    'Nuevo Plenitud': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Vida Mujer': { nn: 0.40, ry: 0.15, ramo: 'Vida' },
    'Alfa Medical': { nn: 0.17, ry: 0.15, ramo: 'GMM' },
    'Alfa Medical Flex': { nn: 0.15, ry: 0.15, ramo: 'GMM' },
    'Alfa Medical Internacional': { nn: 0.17, ry: 0.10, ramo: 'GMM' }
};

// Matriz de Metas Acumuladas del Training Allowance (Tabla 2)
const MetasTraining = {
    1: { comision: 9000, vidas: 3 },
    2: { comision: 15000, vidas: 6 },
    3: { comision: 21000, vidas: 9 },
    4: { comision: 27000, vidas: 12 },
    5: { comision: 33000, vidas: 14 },
    6: { comision: 40000, vidas: 15 },
    7: { comision: 9000, vidas: 3 },  // Reset automático en el segundo semestre
    8: { comision: 15000, vidas: 6 },
    9: { comision: 21000, vidas: 9 },
    10: { comision: 27000, vidas: 12 },
    11: { comision: 33000, vidas: 14 },
    12: { comision: 40000, vidas: 15 }
};

export function renderComisiones() {
    const perfilStr = localStorage.getItem('addlife_perfil');
    
    if (!perfilStr) {
        return `
            <div class="card" style="border-left: 4px solid var(--accent);">
                <h2>⚙️ Calibración del Cuaderno de Concursos</h2>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">Selecciona tu esquema actual para activar el motor financiero automatizado.</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <select id="cfg-esquema">
                        <option value="Desarrollo">Asesor en Desarrollo (Mes 1 a 12)</option>
                        <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                    </select>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 11px; color: var(--text-secondary);">Fecha de Conexión Comercial</label>
                        <input type="date" id="cfg-fecha">
                    </div>
                    <button id="btn-guardar-perfil" class="btn-primary" style="margin-top: 10px;">Iniciar Motor Financiero</button>
                </div>
            </div>
        `;
    }

    const perfil = JSON.parse(perfilStr);

    return `
        <div class="widget-grid">
            <div class="widget widget-full" style="padding: 10px 16px; border: 1px dashed var(--danger); background: rgba(255,59,48,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">⚙️ MODO DESARROLLADOR:</span>
                    <button id="btn-reset-conexion" style="width: auto; padding: 4px 10px !important; font-size: 11px; background: var(--danger) !important; color: white !important; border: none;">Resetear Fecha Conexión</button>
                </div>
                <p style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Esquema activo: <strong>${perfil.esquema}</strong> | Conexión: <strong>${perfil.fechaConexion}</strong></p>
            </div>

            <div class="widget widget-full" style="background: var(--accent); color: white; border: none;">
                <span class="widget-title" style="color: rgba(255,255,255,0.85);">Ganancias Netas Globales (YTD)</span>
                <span id="fin-total" class="widget-value" style="color: white; font-size: 26px;">$0.00</span>
                <span style="font-size: 11px; margin-top: 4px; opacity: 0.9;">Iniciales vigentes + Renovaciones acumuladas</span>
            </div>

            <div class="widget">
                <span class="widget-title">Comisiones Iniciales</span>
                <span id="fin-inicial" class="widget-value" style="color: var(--success);">$0.00</span>
            </div>
            <div class="widget">
                <span class="widget-title">Comisiones Renovación</span>
                <span id="fin-renovacion" class="widget-value" style="color: var(--warning);">$0.00</span>
            </div>

            <div class="widget widget-full">
                <span class="widget-title" id="titulo-bono">Bono del Mes</span>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="fin-bono-proyectado" class="widget-value">$0.00</span>
                    <span id="fin-puntos" class="badge badge-blue" style="font-size: 13px; padding: 4px 10px;">0 Puntos</span>
                </div>
                <p id="brecha-bono" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; line-height: 1.4;"></p>
            </div>

            <div class="widget widget-full">
                <span class="widget-title">Histórico de Ingresos (6 Meses)</span>
                <div id="chart-container" style="display: flex; align-items: flex-end; gap: 8px; height: 110px; margin-top: 15px; padding-bottom: 5px; border-bottom: 1px solid var(--separator);"></div>
                <div id="chart-labels" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; color: var(--text-secondary);"></div>
            </div>

            <div class="widget widget-full" style="background: var(--surface-2);">
                <span class="widget-title">💡 Tips y Recomendaciones</span>
                <button id="btn-ia-estrategia" class="btn-secondary" style="font-size: 12px; padding: 8px; border-color: var(--accent); color: var(--accent); margin-bottom: 8px;">✨ Generar Estrategia de Cierre</button>
                <div id="out-estrategia" style="font-size: 13px; color: var(--text-primary); line-height: 1.5; min-height: 20px;"></div>
            </div>
        </div>
    `;
}

export async function bindComisionesEvents() {
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', () => {
            const esquema = document.getElementById('cfg-esquema').value;
            const fecha = document.getElementById('cfg-fecha').value;
            if (!fecha) return alert('Debes ingresar tu fecha de conexión.');
            localStorage.setItem('addlife_perfil', JSON.stringify({ esquema, fechaConexion: fecha }));
            window.navigateTo('comisiones');
        });
        return;
    }

    const btnReset = document.getElementById('btn-reset-conexion');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            localStorage.removeItem('addlife_perfil');
            window.navigateTo('comisiones');
        });
    }

    const perfil = JSON.parse(localStorage.getItem('addlife_perfil'));
    const listado = await DB.obtenerTodos('cartera');
    const formatear = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    // Calcular mes de concurso exacto
    const fConexion = new Date(perfil.fechaConexion + 'T12:00:00');
    const diffTiempo = hoy - fConexion;
    let mesConcurso = Math.floor(diffTiempo / (1000 * 60 * 60 * 24 * 30.44)) + 1;
    if (mesConcurso < 1) mesConcurso = 1;

    let comisionInicialMes = 0;
    let comisionRenovacionMes = 0;
    let puntosConcursoValidos = 0;

    const barrasValores = Array(6).fill(0);
    const barrasEtiquetas = [];
    for (let i = 5; i >= 0; i--) {
        barrasEtiquetas.push(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1).toLocaleString('es-MX', { month: 'short' }).toUpperCase());
    }

    listado.forEach((p, idx) => {
        if (!p.emision) return;
        const fEmision = new Date(p.emision + 'T12:00:00');
        const mesesAntiguedad = (hoy - fEmision) / (1000 * 60 * 60 * 24 * 30.44);
        const tasa = TablaComisiones[p.plan] || { nn: 0.10, ry: 0.05, ramo: 'Vida' };
        
        let factorFraccion = 1;
        if (p.formaPago === 'Mensual') factorFraccion = 1/12;
        else if (p.formaPago === 'Trimestral') factorFraccion = 1/4;
        else if (p.formaPago === 'Semestral') factorFraccion = 1/2;

        const primaReciboFraccionada = (Number(p.prima) || 0) * factorFraccion;
        let gananciaCalculada = 0;

        if (mesesAntiguedad <= 12) {
            // Aplicación del factor del 90% para Asesores en Desarrollo en Ramos de Vida
            const factorEsquema = (perfil.esquema === 'Desarrollo' && tasa.ramo === 'Vida') ? 0.90 : 1.0;
            gananciaCalculada = primaReciboFraccionada * (tasa.nn * factorEsquema);
            comisionInicialMes += gananciaCalculada;

            // Conteo de puntos aplicando reglas de exclusión personal
            if (!p.esPersonal) {
                if (tasa.ramo === 'GMM' && Number(p.prima) >= 10000) {
                    puntosConcursoValidos += 0.5;
                } else if (tasa.ramo === 'Vida') {
                    puntosConcursoValidos += (Number(p.prima) >= 65001) ? 2 : 1;
                }
            }
        } else {
            gananciaCalculada = primaReciboFraccionada * tasa.ry;
            comisionRenovacionMes += gananciaCalculada;
        }

        barrasValores[idx % 6] += gananciaCalculada;
    });

    // Inyectar datos en los Widgets
    document.getElementById('fin-total').innerText = formatear(comisionInicialMes + comisionRenovacionMes);
    document.getElementById('fin-inicial').innerText = formatear(comisionInicialMes);
    document.getElementById('fin-renovacion').innerText = formatear(comisionRenovacionMes);
    document.getElementById('fin-puntos').innerText = `${puntosConcursoValidos} Vidas`;

    const txtBrecha = document.getElementById('brecha-bono');
    const valBono = document.getElementById('fin-bono-proyectado');

    if (perfil.esquema === 'Desarrollo') {
        document.getElementById('titulo-bono').innerText = `Training Allowance — Mes ${mesConcurso} de Concurso`;
        const regla = MetasTraining[mesConcurso] || { comision: 40000, vidas: 15 };

        if (comisionInicialMes >= regla.comision && puntosConcursoValidos >= regla.vidas) {
            valBono.innerText = formatear(comisionInicialMes * 0.15);
            txtBrecha.innerHTML = `<span style="color:var(--success); font-weight:600;">✅ Métricas cubiertas. Anticipo del mes asegurado.</span>`;
        } else {
            valBono.innerText = '$0.00';
            const faltaComision = Math.max(0, regla.comision - comisionInicialMes);
            const faltaVidas = Math.max(0, regla.vidas - puntosConcursoValidos);
            txtBrecha.innerHTML = `Para el bono del Mes ${mesConcurso} te hacen falta: <br><strong>${formatear(faltaComision)}</strong> en comisión inicial y <strong>${faltaVidas} puntos/vidas</strong>.`;
        }
    } else {
        document.getElementById('titulo-bono').innerText = 'Bono Inicial Semestral (Nuevo Profesional)';
        const metaMontoNP = 150000;
        if (comisionInicialMes >= metaMontoNP && puntosConcursoValidos >= 12) {
            valBono.innerText = formatear(comisionInicialMes * 0.10);
            txtBrecha.innerHTML = `<span style="color:var(--success); font-weight:600;">✅ Parámetros del cuaderno consolidados.</span>`;
        } else {
            valBono.innerText = '$0.00';
            txtBrecha.innerHTML = `Faltan <strong>${formatear(Math.max(0, metaMontoNP - comisionInicialMes))}</strong> en primas meta y <strong>${Math.max(0, 12 - puntosConcursoValidos)} casos</strong> para calificar al grupo mínimo.`;
        }
    }

    // Dibujar Gráfica de Barras Estilo iOS
    const valorMaximoG = Math.max(...barrasValores, 1);
    document.getElementById('chart-container').innerHTML = barrasValores.map(v => {
        const pctAltura = (v / valorMaximoG) * 100;
        return `<div style="flex: 1; background: var(--accent); border-radius: 6px 6px 0 0; height: ${pctAltura}%; position: relative; min-height: 4px;">
                    <span style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--text-secondary); font-weight:600;">${Math.round(v/1000)}k</span>
                </div>`;
    }).join('');
    document.getElementById('chart-labels').innerHTML = barrasEtiquetas.map(m => `<div style="flex: 1; text-align: center;">${m}</div>`).join('');

    // Disparar Consultas de Estrategia a través de Gemini Proxy
    const btnIA = document.getElementById('btn-ia-estrategia');
    if (btnIA) {
        btnIA.addEventListener('click', () => {
            const prompt = `Actúa como coach comercial experto para un asesor de Seguros Monterrey en el esquema ${perfil.esquema}. Actualmente se encuentra en su mes ${mesConcurso} de concurso, acumulando un volumen de ${puntosConcursoValidos} puntos y ${comisionInicialMes} de comisión inicial comisionable neta. Genera 3 tácticas comerciales agresivas de cross-selling y cierre inmediato para mitigar el déficit financiero, acelerando las ventas con los productos del catálogo de Vida o Alfa Medical. Responde directamente en viñetas, con un lenguaje práctico, omitiendo saludos, introducciones o frases de motivación vacía.`;
            callGemini(prompt, 'out-estrategia');
        });
    }
}
