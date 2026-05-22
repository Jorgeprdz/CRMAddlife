// comisiones.js - Motor de Finanzas, Métricas YTD y Cuadernos de Concursos
import { DB } from './db.js';

const TablaComisiones = {
    'Star Temporal': { nn: 0.35, ry: 0.10 },
    'Orvi': { nn: 0.35, ry: 0.10 },
    'Respaldo Educativo': { nn: 0.35, ry: 0.10 },
    'Respaldo Negocio': { nn: 0.35, ry: 0.10 },
    'Mio': { nn: 0.80, ry: 0.20 },
    'Imagina Ser': { nn: 0.35, ry: 0.10 },
    'Plenitud': { nn: 0.30, ry: 0.10 },
    'Alfa Medical': { nn: 0.15, ry: 0.10 },
    'Alfa Medical Flex': { nn: 0.15, ry: 0.10 }
};

export function renderComisiones() {
    return `
        <div class="card" style="background: var(--accent); color: white; border: none;">
            <h2 style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.85);">Acumulado Financiero del Año (YTD)</h2>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px;">
                <div>
                    <span style="font-size: 12px; opacity: 0.9;">Comisiones Proyectadas</span><br>
                    <strong id="fin-ytd-comisiones" style="font-size: 24px; color: white;">$0.00</strong>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 12px; opacity: 0.9;">Bonos Concursados</span><br>
                    <strong id="fin-ytd-bonos" style="font-size: 24px; color: #4CD964;">$0.00</strong>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 class="fw-600" style="font-size:15px;">📊 Rendimiento de Comisiones Mensuales</h2>
            <div id="chart-container" style="display: flex; align-items: flex-end; gap: 10px; height: 130px; margin-top: 20px; padding-bottom: 5px; border-bottom: 1px solid var(--separator);">
                <div style="width: 100%; text-align: center; color: var(--text-tertiary); font-size: 12px;">Analizando histórico de transacciones...</div>
            </div>
            <div id="chart-labels" style="display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; font-size: 10px; color: var(--text-secondary);"></div>
        </div>

        <div class="card" style="border-left: 4px solid var(--warning);">
            <h2 class="fw-600" style="font-size:15px;">🎯 Cuaderno de Concursos (Trimestral)</h2>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Métricas mínimas requeridas para el cobro del bono por nivel de volumen.</p>
            
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                    <span>Prima Emitida</span>
                    <span id="prog-prima-texto">$0 / $150,000</span>
                </div>
                <div style="background: var(--surface-2); border-radius: 10px; height: 8px; overflow: hidden;">
                    <div id="prog-prima-barra" style="background: var(--accent); width: 0%; height: 100%; border-radius: 10px;"></div>
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                    <span>Casos de Éxito (Vidas)</span>
                    <span id="prog-vidas-texto">0 / 12</span>
                </div>
                <div style="background: var(--surface-2); border-radius: 10px; height: 8px; overflow: hidden;">
                    <div id="prog-vidas-barra" style="background: var(--success); width: 0%; height: 100%; border-radius: 10px;"></div>
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                    <span>Conservación de Negocio (LIMRA)</span>
                    <span id="prog-limra-texto">82% / 75.5%</span>
                </div>
                <div style="background: var(--surface-2); border-radius: 10px; height: 8px; overflow: hidden;">
                    <div id="prog-limra-barra" style="background: var(--success); width: 82%; height: 100%; border-radius: 10px;"></div>
                </div>
            </div>
            
            <div id="alerta-bono" class="badge badge-orange mt-8" style="display: block; text-align: center; font-size: 12px; padding: 6px;">
                Evaluando cierre de mes...
            </div>
        </div>

        <div class="card" style="background: var(--surface-2); border: 1px solid var(--separator);">
            <h2 class="fw-600" style="font-size: 13px; text-transform: uppercase; color:var(--text-secondary);">💡 Directriz Estratégica Comercial</h2>
            <p id="tactica-texto" style="font-size: 13px; margin-top: 6px; color: var(--text-primary); line-height: 1.5;"></p>
        </div>
    `;
}

export async function bindComisionesEvents() {
    const listado = await DB.obtenerTodos('cartera');
    const hoy = new Date();
    const formatear = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

    let comisionesAnuales = 0;
    let primaTrimestre = 0;
    let vidasTrimestre = listado.length;
    
    const mesesValores = Array(6).fill(0);
    const etiquetasMeses = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        etiquetasMeses.push(d.toLocaleString('es-MX', { month: 'short' }).toUpperCase());
    }

    listado.forEach((p, idx) => {
        let factorFraccion = 1;
        if (p.formaPago === 'Mensual') factorFraccion = 1/12;
        else if (p.formaPago === 'Trimestral') factorFraccion = 1/4;
        else if (p.formaPago === 'Semestral') factorFraccion = 1/2;

        const primaPagada = (Number(p.prima) || 0) * factorFraccion;
        const tasa = TablaComisiones[p.plan] || { nn: 0.10 };
        const comision = primaPagada * tasa.nn;

        comisionesAnuales += comision;
        primaTrimestre += (Number(p.prima) || 0);

        const mIdx = idx % 6; 
        mesesValores[mIdx] += comision;
    });

    document.getElementById('fin-ytd-comisiones').innerText = formatear(comisionesAnuales);
    const maxVal = Math.max(...mesesValores, 1);
    
    document.getElementById('chart-container').innerHTML = mesesValores.map(v => {
        const pct = (v / maxVal) * 100;
        return `<div style="flex: 1; background: var(--accent); border-radius: 4px 4px 0 0; height: ${pct}%; position: relative; min-height: 4px;">
                    <span style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--text-secondary); font-weight:600;">${Math.round(v/1000)}k</span>
                </div>`;
    }).join('');
    
    document.getElementById('chart-labels').innerHTML = etiquetasMeses.map(m => `<div style="flex: 1; text-align: center;">${m}</div>`).join('');

    const metaPrima = 150000;
    const metaVidas = 12;
    const pctPrima = Math.min((primaTrimestre / metaPrima) * 100, 100);
    const pctVidas = Math.min((vidasTrimestre / metaVidas) * 100, 100);

    document.getElementById('prog-prima-texto').innerText = `${formatear(primaTrimestre)} / ${formatear(metaPrima)}`;
    document.getElementById('prog-prima-barra').style.width = `${pctPrima}%`;
    document.getElementById('prog-vidas-texto').innerText = `${vidasTrimestre} / ${metaVidas}`;
    document.getElementById('prog-vidas-barra').style.width = `${pctVidas}%`;

    const alerta = document.getElementById('alerta-bono');
    const tactica = document.getElementById('tactica-texto');

    if (primaTrimestre >= metaPrima && vidasTrimestre >= metaVidas) {
        const bonoEstimado = primaTrimestre * 0.10;
        alerta.className = 'badge badge-green mt-8';
        alerta.innerHTML = `✅ Condición de Bono Cumplida. Estimado: <strong>${formatear(bonoEstimado)}</strong>`;
        tactica.innerText = "Meta trimestral consolidada. Protege el indicador de conservación (LIMRA) supervisando los pagos automáticos con tarjeta de crédito de tus cuentas vigentes.";
    } else {
        const fPrima = Math.max(0, metaPrima - primaTrimestre);
        const fVidas = Math.max(0, metaVidas - vidasTrimestre);
        alerta.className = 'badge badge-red mt-8';
        alerta.innerHTML = `⚠️ Faltan <strong>${fVidas} casos</strong> y <strong>${formatear(fPrima)}</strong> en primas para liberar bono.`;
        tactica.innerText = `Para cerrar la brecha de ${fVidas} pólizas, ejecuta una campaña dirigida a tu base de datos de Gastos Médicos Mayores (Alfa Medical) promoviendo un plan Star Temporal básico como cobertura complementaria de protección familiar.`;
    }
}
