// comisiones.js - Motor Actuarial y Cuadernos de Concursos
import { DB } from './db.js';
import { callGemini } from './app.js';

// Diccionario de Comisiones
const TablaComisiones = {
    'Star Temporal': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Orvi': { nn: 0.44, ry: 0.15, ramo: 'Vida' },
    'Respaldo Educativo': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Respaldo Negocio': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Mio': { nn: 0.80, ry: 0.20, ramo: 'Vida' },
    'Imagina Ser': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Plenitud': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Alfa Medical': { nn: 0.17, ry: 0.15, ramo: 'GMM' },
    'Alfa Medical Flex': { nn: 0.15, ry: 0.15, ramo: 'GMM' }
};

export function renderComisiones() {
    const perfilStr = localStorage.getItem('addlife_perfil');
    
    // 1. Pantalla de Calibración (Onboarding)
    if (!perfilStr) {
        return `
            <div class="card" style="border-left: 4px solid var(--accent);">
                <h2>⚙️ Calibración del Cuaderno de Concursos</h2>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">Para proyectar tus bonos con exactitud matemática, el CRM necesita conocer tu punto de partida.</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <select id="cfg-esquema">
                        <option value="Desarrollo">Asesor en Desarrollo (Mes 1 a 12)</option>
                        <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                    </select>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 11px; color: var(--text-secondary);">Fecha de Conexión / Arranque</label>
                        <input type="date" id="cfg-fecha">
                    </div>
                    <button id="btn-guardar-perfil" class="btn-primary" style="margin-top: 10px;">Iniciar Motor Financiero</button>
                </div>
            </div>
        `;
    }

    // 2. Tablero de Inteligencia Financiera (iOS Widgets)
    return `
        <div class="widget-grid">
            <div class="widget widget-full" style="background: var(--accent); color: white; border: none;">
                <span class="widget-title" style="color: rgba(255,255,255,0.8);">Ganancias Netas (YTD)</span>
                <span id="fin-total" class="widget-value" style="color: white; font-size: 28px;">$0.00</span>
                <span style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Suma de comisiones iniciales + renovaciones</span>
            </div>

            <div class="widget">
                <span class="widget-title">Iniciales (Bono)</span>
                <span id="fin-inicial" class="widget-value" style="color: var(--success);">$0.00</span>
            </div>
            <div class="widget">
                <span class="widget-title">Renovación (RY)</span>
                <span id="fin-renovacion" class="widget-value" style="color: var(--warning);">$0.00</span>
            </div>

            <div class="widget widget-full">
                <span class="widget-title" id="titulo-bono">Bono Semestral (Mes Actual)</span>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="fin-bono-proyectado" class="widget-value">$0.00</span>
                    <span id="fin-puntos" class="badge badge-blue" style="font-size: 14px;">0 Puntos</span>
                </div>
                <p id="brecha-bono" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; line-height: 1.4;">Calculando métricas de concurso...</p>
            </div>

            <div class="widget widget-full">
                <span class="widget-title">Rendimiento Mensual</span>
                <div id="chart-container" style="display: flex; align-items: flex-end; gap: 6px; height: 120px; margin-top: 10px; padding-bottom: 5px; border-bottom: 1px solid var(--separator);"></div>
                <div id="chart-labels" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; color: var(--text-secondary);"></div>
            </div>

            <div class="widget widget-full" style="background: var(--surface-2);">
                <span class="widget-title">💡 Tips y Recomendaciones</span>
                <button id="btn-ia-estrategia" class="btn-secondary" style="font-size: 12px; padding: 8px; border-color: var(--accent); color: var(--accent); margin-bottom: 8px;">✨ Generar Estrategia de Cierre</button>
                <div id="out-estrategia" style="font-size: 13px; color: var(--text-primary); line-height: 1.5;"></div>
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
            if (!fecha) return alert('La fecha de conexión es obligatoria.');
            
            localStorage.setItem('addlife_perfil', JSON.stringify({ esquema, fechaConexion: fecha }));
            window.navigateTo('comisiones');
        });
        return;
    }

    const perfil = JSON.parse(localStorage.getItem('addlife_perfil'));
    const listado = await DB.obtenerTodos('cartera');
    const formatear = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
    const hoy = new Date();
    
    let comisionInicialYTD = 0;
    let comisionRenovacionYTD = 0;
    let puntosSemestre = 0;
    
    const distribucionMensual = Array(6).fill(0);
    const etiquetasMeses = [];
    for (let i = 5; i >= 0; i--) {
        etiquetasMeses.push(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1).toLocaleString('es-MX', { month: 'short' }).toUpperCase());
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

        const primaPagada = (Number(p.prima) || 0) * factorFraccion;
        let comision = 0;
        
        // Separación de Inicial vs Renovación
        if (mesesAntiguedad <= 12) {
            // Regla: Asesor en Desarrollo cobra Vida al 90%
            const multiplicador = (perfil.esquema === 'Desarrollo' && tasa.ramo === 'Vida') ? 0.9 : 1;
            comision = primaPagada * (tasa.nn * multiplicador);
            comisionInicialYTD += comision;

            // Tabulador de Puntos (Solo aplica en 1er año)
            if (tasa.ramo === 'GMM') puntosSemestre += 0.5;
            else if (tasa.ramo === 'Vida' && Number(p.prima) >= 65000) puntosSemestre += 2;
            else if (tasa.ramo === 'Vida') puntosSemestre += 1;

        } else {
            comision = primaPagada * tasa.ry;
            comisionRenovacionYTD += comision;
        }

        // Gráfica (Asignación simulada para UI, requiere tracking de pagos exacto a futuro)
        const mIdx = idx % 6; 
        distribucionMensual[mIdx] += comision;
    });

    const gananciaNeta = comisionInicialYTD + comisionRenovacionYTD;
    
    // Actualizar UI - Valores
    document.getElementById('fin-total').innerText = formatear(gananciaNeta);
    document.getElementById('fin-inicial').innerText = formatear(comisionInicialYTD);
    document.getElementById('fin-renovacion').innerText = formatear(comisionRenovacionYTD);
    document.getElementById('fin-puntos').innerText = `${puntosSemestre} Puntos`;

    // Lógica de Brecha y Bonos según perfil
    const txtBrecha = document.getElementById('brecha-bono');
    const valBono = document.getElementById('fin-bono-proyectado');
    let metaComision = 0;

    if (perfil.esquema === 'Desarrollo') {
        document.getElementById('titulo-bono').innerText = 'Training Allowance (Anticipo Mes)';
        metaComision = 30000; // Meta base ejemplo, ajustable por tabla real
        if (comisionInicialYTD >= metaComision) {
            valBono.innerText = formatear(comisionInicialYTD * 0.15); // 15% bono
            txtBrecha.innerHTML = `<span style="color:var(--success);">✅ Meta de comisión inicial superada. Anticipo liberado.</span>`;
        } else {
            valBono.innerText = '$0.00';
            txtBrecha.innerHTML = `<span style="color:var(--danger);">⚠️ Faltan <strong>${formatear(metaComision - comisionInicialYTD)}</strong> en comisiones iniciales para el bono del mes.</span>`;
        }
    } else {
        document.getElementById('titulo-bono').innerText = 'Bono Inicial Vida (Semestral)';
        metaComision = 150000;
        if (comisionInicialYTD >= metaComision && puntosSemestre >= 12) {
            valBono.innerText = formatear(comisionInicialYTD * 0.10);
            txtBrecha.innerHTML = `<span style="color:var(--success);">✅ Estructura semestral completada. Protege tu LIMRA.</span>`;
        } else {
            valBono.innerText = '$0.00';
            const reqPuntos = Math.max(0, 12 - puntosSemestre);
            txtBrecha.innerHTML = `<span style="color:var(--danger);">⚠️ Faltan <strong>${reqPuntos} puntos</strong> y <strong>${formatear(Math.max(0, metaComision - comisionInicialYTD))}</strong>.</span>`;
        }
    }

    // Actualizar Gráfica
    const maxVal = Math.max(...distribucionMensual, 1);
    document.getElementById('chart-container').innerHTML = distribucionMensual.map(v => {
        const pct = (v / maxVal) * 100;
        return `<div style="flex: 1; background: var(--accent); border-radius: 6px 6px 0 0; height: ${pct}%; position: relative; min-height: 4px;"></div>`;
    }).join('');
    document.getElementById('chart-labels').innerHTML = etiquetasMeses.map(m => `<div style="flex: 1; text-align: center;">${m}</div>`).join('');

    // Disparador de Inteligencia Artificial
    const btnIA = document.getElementById('btn-ia-estrategia');
    if (btnIA) {
        btnIA.addEventListener('click', () => {
            const prompt = `Actúa como coach de ventas de Seguros Monterrey. Soy Asesor en el esquema ${perfil.esquema}. Llevo ${puntosSemestre} puntos y ${comisionInicialYTD} en comisiones iniciales. Mi meta es superar esto antes de fin de mes. Dame 3 pasos tácticos ultra específicos, sin saludos ni rodeos, enfocados en cross-selling y urgencia para lograr cerrar pólizas rápido y asegurar mi bono.`;
            callGemini(prompt, 'out-estrategia');
        });
    }
}
