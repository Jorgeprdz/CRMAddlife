// /modules/comisiones.js - Motor Financiero SaaS (Desarrollo y Profesional)
import { DB } from './db.js';
import { getSupabase, callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

// Tablas Actuariales Base (Configuración Universal SaaS)
const CommissionTables = {
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

// Cuaderno: Training Allowance (Mes 1 a 12)
const MetasDesarrollo = {
    1: { comision: 9000, vidas: 3 }, 2: { comision: 15000, vidas: 6 }, 3: { comision: 21000, vidas: 9 },
    4: { comision: 31000, vidas: 12 }, 5: { comision: 39000, vidas: 14 }, 6: { comision: 50000, vidas: 15 },
    7: { comision: 50000, vidas: 15 }, 8: { comision: 50000, vidas: 15 }, 9: { comision: 50000, vidas: 15 },
    10: { comision: 50000, vidas: 15 }, 11: { comision: 50000, vidas: 15 }, 12: { comision: 50000, vidas: 15 }
};

// Cuaderno: Nuevos Profesionales (Mes 13+) - Rangos simplificados de Bono Inicial Vida
const MetasProfesional = [
    { min: 30000, bonoPct: 0.10 },
    { min: 60000, bonoPct: 0.20 },
    { min: 100000, bonoPct: 0.35 }
];

const ActuarialEngine = {
    calculatePortfolio(cartera, perfil) {
        const hoy = new Date();
        const fConexion = perfil?.fecha_conexion ? new Date(perfil.fecha_conexion + 'T12:00:00') : hoy;
        const mesesActivo = Math.max(1, Math.floor((hoy - fConexion) / (1000 * 60 * 60 * 24 * 30.44)) + 1);
        const esquemaActual = mesesActivo <= 12 ? 'Desarrollo' : 'Profesional';

        const results = {
            esquema: esquemaActual,
            mesesConcursoActivo: mesesActivo,
            mesIniciales: 0,
            mesRenovacion: 0,
            mesPuntosConcurso: 0,
            anualTotal: 0,
            anualInicialesConvencion: 0,
            bonoMesCalculado: 0,
            brechaBonoMonto: 0,
            brechaBonoVidas: 0,
            calificaBono: false,
            historicoMeses: [0, 0, 0, 0, 0, 0] // Últimos 6 meses
        };

        cartera.forEach(p => {
            if (!p.emision) return;
            const fechaEmision = new Date(p.emision + 'T12:00:00');
            const fechaCobro = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : fechaEmision;
            
            const planLimpio = (p.plan || '').trim();
            const tabla = CommissionTables[planLimpio] || { nn: 0.10, ry: 0.05, ramo: 'Vida' };
            
            // Ponderación de flujo de caja según forma de pago
            const factorFrecuencia = p.formaPago === 'Mensual' ? 1/12 : p.formaPago === 'Trimestral' ? 1/4 : p.formaPago === 'Semestral' ? 1/2 : 1;
            const primaNeta = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
            
            const mesesVigencia = (fechaCobro.getFullYear() - fechaEmision.getFullYear()) * 12 + (fechaCobro.getMonth() - fechaEmision.getMonth());
            const esPrimerAño = mesesVigencia < 12;

            // Factor 90% para Vida en Desarrollo
            const factorDesarrollo = (esquemaActual === 'Desarrollo' && tabla.ramo === 'Vida') ? 0.90 : 1.0;
            const comisionLiquida = primaNeta * factorFrecuencia * (esPrimerAño ? (tabla.nn * factorDesarrollo) : tabla.ry);

            // Filtro Histórico (Gráfica últimos 6 meses)
            const diffMesesGrafica = (hoy.getFullYear() - fechaCobro.getFullYear()) * 12 + (hoy.getMonth() - fechaCobro.getMonth());
            if (diffMesesGrafica >= 0 && diffMesesGrafica < 6) {
                results.historicoMeses[5 - diffMesesGrafica] += comisionLiquida;
            }

            // Filtro YTD (Año Calendario)
            if (fechaCobro.getFullYear() === hoy.getFullYear()) {
                results.anualTotal += comisionLiquida;
                if (esPrimerAño && !p.esPersonal) results.anualInicialesConvencion += comisionLiquida;
            }

            // Filtro Mes Actual
            if (fechaCobro.getMonth() === hoy.getMonth() && fechaCobro.getFullYear() === hoy.getFullYear()) {
                if (esPrimerAño) {
                    results.mesIniciales += comisionLiquida;
                    if (!p.esPersonal) {
                        results.mesPuntosConcurso += (tabla.ramo === 'GMM' && primaNeta >= 10000) ? 0.5 : (primaNeta >= 65001 ? 2 : 1);
                    }
                } else {
                    results.mesRenovacion += comisionLiquida;
                }
            }
        });

        // Lógica Cuaderno de Concursos
        if (esquemaActual === 'Desarrollo') {
            const regla = MetasDesarrollo[mesesActivo] || { comision: 50000, vidas: 15 };
            results.brechaBonoMonto = Math.max(0, regla.comision - results.mesIniciales);
            results.brechaBonoVidas = Math.max(0, regla.vidas - results.mesPuntosConcurso);
            
            if (results.brechaBonoMonto === 0 && results.brechaBonoVidas === 0) {
                results.calificaBono = true;
                results.bonoMesCalculado = results.mesIniciales * 0.15; // TA base
            }
        } else {
            // Lógica Profesional (Escalones Vida)
            let pctBono = 0;
            for (let escalon of MetasProfesional) {
                if (results.mesIniciales >= escalon.min) pctBono = escalon.bonoPct;
            }
            if (pctBono > 0) {
                results.calificaBono = true;
                results.bonoMesCalculado = results.mesIniciales * pctBono;
            }
            results.brechaBonoMonto = Math.max(0, 30000 - results.mesIniciales); // Meta base para entrar a tabulador
        }

        return results;
    }
};

const FinancialUI = {
    fmt(num) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num); },
    renderSkeleton() { return `<div id="fin-dashboard-container" style="padding:10px;"><div class="skeleton-shimmer" style="height:120px; border-radius:24px; margin-bottom:16px;"></div></div>`; },

    renderConfigForm() {
        return `
            <div id="fin-dashboard-container" class="glass-widget" style="margin:20px 10px;">
                <h2 style="font-size:18px; margin-bottom:16px;">⚙️ Configuración Inicial</h2>
                <p style="font-size:12px; color:var(--text-secondary); margin-bottom:16px;">El sistema detectará automáticamente tu Cuaderno de Concurso basándose en tu fecha de alta.</p>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Fecha de Conexión (Alta en CNSF / Promotoría)</label>
                        <input type="date" id="cfg-fec" class="glass-input" style="width:100%; margin-top:4px;">
                    </div>
                    <button id="btn-save-cfg" class="btn-primary" style="margin-top:10px;">Activar Motor Financiero</button>
                </div>
            </div>`;
    },

    renderChart(datos) {
        const maxVal = Math.max(...datos, 1000); // Mínimo visual
        const meses = ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Mes Actual'];
        
        const barras = datos.map((val, i) => {
            const altura = (val / maxVal) * 100;
            return `
                <div style="display:flex; flex-direction:column; align-items:center; flex:1; gap:4px;">
                    <div style="width:100%; height:100px; background:rgba(150,150,150,0.1); border-radius:6px; display:flex; align-items:flex-end; position:relative;">
                        <div style="width:100%; height:${altura}%; background:var(--accent); border-radius:6px; transition:height 0.5s ease;"></div>
                    </div>
                    <span style="font-size:9px; color:var(--text-secondary); font-weight:600;">${meses[i]}</span>
                </div>
            `;
        }).join('');

        return `<div style="display:flex; gap:6px; width:100%; padding-top:10px;">${barras}</div>`;
    },

    hydrateDashboard(data) {
        const totalMes = data.mesIniciales + data.mesRenovacion + data.bonoMesCalculado;
        const isDesarrollo = data.esquema === 'Desarrollo';
        
        const tituloBono = isDesarrollo ? `Training Allowance (Mes ${data.mesesConcursoActivo})` : `Bono Nuevos Profesionales (Vida)`;
        
        let bonoUI = '';
        if (isDesarrollo) {
            bonoUI = data.calificaBono 
                ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">${this.fmt(data.bonoMesCalculado)}</span><span class="status-badge" style="background:rgba(52,199,89,0.1); border-color:#34C759; color:#34C759;">✅ Logrado</span></div>` 
                : `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">$0.00</span><span class="status-badge" style="background:rgba(255,149,0,0.1); border-color:#FF9500; color:#FF9500;">${data.mesPuntosConcurso} Vidas</span></div>
                   <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Faltan <strong style="color:var(--danger);">${this.fmt(data.brechaBonoMonto)}</strong> y <strong style="color:var(--danger);">${data.brechaBonoVidas} vidas</strong>.</p>`;
        } else {
            bonoUI = data.calificaBono 
                ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">${this.fmt(data.bonoMesCalculado)}</span><span class="status-badge" style="background:rgba(52,199,89,0.1); border-color:#34C759; color:#34C759;">✅ En Rango</span></div>`
                : `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">$0.00</span><span class="status-badge" style="background:rgba(255,149,0,0.1); border-color:#FF9500; color:#FF9500;">No califica</span></div>
                   <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Faltan <strong style="color:var(--danger);">${this.fmt(data.brechaBonoMonto)}</strong> de C.I. para ingresar al primer escalón LIMRA.</p>`;
        }

        return `
            <div id="fin-dashboard-container" style="display:flex; flex-direction:column; gap:16px; padding-bottom:24px;">
                
                <div class="glass-widget" style="background:var(--text-primary); color:var(--surface); border:none; text-align:center; padding:24px;">
                    <span style="font-size:12px; opacity:0.8; font-weight:600; text-transform:uppercase;">Ingreso Estimado Mes Actual</span>
                    <div style="font-size:42px; font-weight:800; margin-top:4px; letter-spacing:-1px;">${this.fmt(totalMes)}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div class="glass-widget" style="padding:16px;">
                        <span style="font-size:11px; opacity:0.6; font-weight:700;">INICIALES (Vida + GMM)</span>
                        <div style="font-size:20px; font-weight:800; margin-top:4px;">${this.fmt(data.mesIniciales)}</div>
                    </div>
                    <div class="glass-widget" style="padding:16px;">
                        <span style="font-size:11px; opacity:0.6; font-weight:700;">RENOVACIÓN / CARTERA</span>
                        <div style="font-size:20px; font-weight:800; margin-top:4px;">${this.fmt(data.mesRenovacion)}</div>
                    </div>
                </div>

                <div class="glass-widget" style="border-left:4px solid var(--warning); padding:16px;">
                    <h2 style="font-size:14px; margin:0; color:var(--text-secondary); font-weight:600;">${tituloBono}</h2>
                    ${bonoUI}
                </div>

                <div class="glass-widget" style="background:rgba(0,122,255,0.05); border-left:4px solid var(--accent); padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:13px;">🧠 Estratega Financiero AI</strong>
                        <button id="btn-ai-finance" class="btn-primary btn-sm">Analizar</button>
                    </div>
                    <div id="ai-finance-tip" style="font-size:13px; margin-top:8px; color:var(--text-secondary); line-height:1.4;">Haz clic en Analizar para obtener un diagnóstico preciso del mes.</div>
                </div>

                <div class="glass-widget" style="padding:16px;">
                    <h3 style="font-size:14px; font-weight:700; margin:0;">Histórico de Ingresos (6 Meses)</h3>
                    ${this.renderChart(data.historicoMeses)}
                </div>

                <h3 style="font-size:14px; font-weight:700; color:var(--text-secondary); margin: 8px 0 0 4px;">Acumulados (YTD)</h3>
                <div class="glass-widget" style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid rgba(150,150,150,0.1);">
                        <span style="font-size:14px; font-weight:600; color:var(--text-secondary);">Ingreso Anual Bruto</span>
                        <span style="font-size:18px; font-weight:800; color:var(--text-primary);">${this.fmt(data.anualTotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px;">
                        <span style="font-size:14px; font-weight:600; color:var(--text-secondary);">Acumulado Convención (Primer Año)</span>
                        <span style="font-size:18px; font-weight:800; color:#34C759;">${this.fmt(data.anualInicialesConvencion)}</span>
                    </div>
                </div>

                <button id="btn-dev-reset" class="btn-secondary btn-sm" style="margin-top:16px; opacity:0.5; width:100%;">⚙️ Modo Desarrollador: Resetear Fecha de Conexión</button>
            </div>
        `;
    }
};

export function renderComisiones() {
    return FinancialUI.renderSkeleton();
}

export async function bindComisionesEvents() {
    const container = document.getElementById('fin-dashboard-container');
    const supabase = getSupabase();
    if (!supabase || !container) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) throw new Error("Sesión no detectada.");

        const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
        const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

        if (!perfil || !perfil.fecha_conexion) {
            container.outerHTML = FinancialUI.renderConfigForm();
            document.getElementById('btn-save-cfg').addEventListener('click', async () => {
                const f = document.getElementById('cfg-fec').value;
                if (!f) return showToast('Agrega tu fecha de conexión oficial.', 'danger');
                
                // Actualizar o insertar perfil de manera neutral
                const payload = { user_id: user.id, fecha_conexion: f };
                if (perfil) {
                    await supabase.from('perfil_asesor').update(payload).eq('user_id', user.id);
                } else {
                    await supabase.from('perfil_asesor').insert([payload]);
                }
                window.navigateTo('comisiones');
            });
            return;
        }

        const cartera = await DB.obtenerTodos('cartera');
        const resultados = ActuarialEngine.calculatePortfolio(cartera, perfil);
        
        container.outerHTML = FinancialUI.hydrateDashboard(resultados);

        document.getElementById('btn-ai-finance')?.addEventListener('click', async () => {
            const out = document.getElementById('ai-finance-tip');
            out.innerHTML = '<span class="spinner-mini">⚙️</span> Procesando matemática comercial...';
            
            const prompt = `Actúas como CFO personal del agente. Cuaderno: ${resultados.esquema}.
            Comisiones logradas este mes: $${resultados.mesIniciales} iniciales. 
            Brecha para bono: faltan $${resultados.brechaBonoMonto} en comisiones y ${resultados.brechaBonoVidas} pólizas.
            REGLA: Dame 1 recomendación técnica (máx 2 líneas) sobre a qué nicho de mercado enfocarse (Vida o GMM) para lograr el bono. Sé directo, sin saludos.`;
            
            await callGemini(prompt, 'ai-finance-tip');
        });

        document.getElementById('btn-dev-reset')?.addEventListener('click', async () => {
            const seguro = await showConfirm('Esto borrará tu perfil para recalcular el esquema desde cero. ¿Continuar?', 'Resetear Perfil', 'Resetear', true);
            if (seguro) {
                await supabase.from('perfil_asesor').update({ fecha_conexion: null }).eq('user_id', user.id);
                window.navigateTo('comisiones');
            }
        });

    } catch (e) {
        console.error("Error Finanzas:", e);
        showToast('Error cargando el motor financiero.', 'danger');
    }
}
