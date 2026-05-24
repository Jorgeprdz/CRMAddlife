import { DB } from './db.js';
import { getSupabase, callGemini } from './app.js';
import { showToast } from './utils.js';

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

const BonusRules = {
    1: { comision: 9000, vidas: 3 }, 2: { comision: 15000, vidas: 6 }, 3: { comision: 21000, vidas: 9 },
    4: { comision: 31000, vidas: 12 }, 5: { comision: 39000, vidas: 14 }, 6: { comision: 50000, vidas: 15 }
};

const ActuarialEngine = {
    calculatePortfolio(cartera, perfil) {
        const hoy = new Date();
        const results = {
            mesIniciales: 0, mesRenovacion: 0, mesPuntosConcurso: 0,
            anualTotal: 0, anualInicialesConvencion: 0,
            bonoMesCalculado: 0, brechaBonoMonto: 0, brechaBonoVidas: 0,
            mesesConcursoActivo: 1, calificaBono: false
        };

        if (perfil?.fecha_conexion) {
            const fConexion = new Date(perfil.fecha_conexion + 'T12:00:00');
            results.mesesConcursoActivo = Math.max(1, Math.floor((hoy - fConexion) / (1000 * 60 * 60 * 24 * 30.44)) + 1);
        }

        cartera.forEach(p => {
            if (!p.emision) return;
            const fechaEmision = new Date(p.emision + 'T12:00:00');
            const fechaCobro = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : fechaEmision;
            const mesesVigencia = (fechaCobro.getFullYear() - fechaEmision.getFullYear()) * 12 + (fechaCobro.getMonth() - fechaEmision.getMonth());
            
            const planLimpio = (p.plan || '').trim();
            const tabla = CommissionTables[planLimpio] || { nn: 0.10, ry: 0.05, ramo: 'Vida' };
            const factorFrecuencia = p.formaPago === 'Mensual' ? 1/12 : p.formaPago === 'Trimestral' ? 1/4 : p.formaPago === 'Semestral' ? 1/2 : 1;
            const primaNeta = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
            const esPrimerAño = mesesVigencia < 12;

            const factorDesarrollo = (perfil?.esquema === 'Desarrollo' && tabla.ramo === 'Vida') ? 0.90 : 1.0;
            const comisionLiquida = primaNeta * factorFrecuencia * (esPrimerAño ? (tabla.nn * factorDesarrollo) : tabla.ry);

            if (fechaCobro.getFullYear() === hoy.getFullYear()) {
                results.anualTotal += comisionLiquida;
                if (esPrimerAño) results.anualInicialesConvencion += comisionLiquida;
            }

            if (fechaCobro.getMonth() === hoy.getMonth() && fechaCobro.getFullYear() === hoy.getFullYear()) {
                if (esPrimerAño) {
                    results.mesIniciales += comisionLiquida;
                    if (!p.esPersonal) results.mesPuntosConcurso += (tabla.ramo === 'GMM' && primaNeta >= 10000) ? 0.5 : (primaNeta >= 65001 ? 2 : 1);
                } else {
                    results.mesRenovacion += comisionLiquida;
                }
            }
        });

        if (perfil?.esquema === 'Desarrollo') {
            const regla = BonusRules[results.mesesConcursoActivo] || { comision: 50000, vidas: 15 };
            results.brechaBonoMonto = Math.max(0, regla.comision - results.mesIniciales);
            results.brechaBonoVidas = Math.max(0, regla.vidas - results.mesPuntosConcurso);
            if (results.brechaBonoMonto === 0 && results.brechaBonoVidas === 0) {
                results.calificaBono = true;
                results.bonoMesCalculado = results.mesIniciales * 0.15;
            }
        }
        return results;
    }
};

const FinancialUI = {
    fmt(num) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num); },
    renderSkeleton() { return `<div id="fin-dashboard-container" style="min-height:60vh; padding:10px;"><div class="skeleton-shimmer" style="height:120px; border-radius:16px; margin-bottom:12px;"></div></div>`; },

    renderConfigForm() {
        return `
            <div class="ios-widget" style="margin:20px 0;">
                <h2 style="font-size:18px; margin-bottom:16px;">⚙️ Configuración del Asesor</h2>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <select id="cfg-esq" style="padding:12px; border-radius:12px; border:1px solid var(--separator);">
                        <option value="Desarrollo">Training Allowance (Mes 1 a 12)</option>
                        <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                    </select>
                    <input type="date" id="cfg-fec" style="padding:12px; border-radius:12px; border:1px solid var(--separator);">
                    <button id="btn-save-cfg" class="btn-primary" style="margin-top:10px;">Iniciar Motor Financiero</button>
                </div>
            </div>`;
    },

    hydrateDashboard(data, perfil) {
        const totalMes = data.mesIniciales + data.mesRenovacion + data.bonoMesCalculado;
        const isPro = perfil.esquema === 'Profesional';
        
        let bonoUI = isPro 
            ? `<div style="font-size:14px; color:var(--text-secondary);">Esquema Consolidado (Sin TA)</div>`
            : (data.calificaBono 
                ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:20px; font-weight:bold;">${this.fmt(data.bonoMesCalculado)}</span><span class="badge badge-green">✅ Logrado</span></div>` 
                : `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:20px; font-weight:bold;">$0.00</span><span class="badge badge-orange">${data.mesPuntosConcurso} Vidas</span></div><p style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Faltan <strong style="color:var(--danger);">${this.fmt(data.brechaBonoMonto)}</strong> y <strong style="color:var(--danger);">${data.brechaBonoVidas} vidas</strong>.</p>`);

        return `
            <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
                
                <div class="ios-widget" style="background:#000; color:#fff;">
                    <span style="font-size:12px; opacity:0.7;">Ingreso Estimado Mes</span>
                    <div style="font-size:40px; font-weight:800; margin-top:4px;">${this.fmt(totalMes)}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="ios-widget">
                        <span style="font-size:11px; opacity:0.6;">INICIALES</span>
                        <div style="font-size:18px; font-weight:700;">${this.fmt(data.mesIniciales)}</div>
                    </div>
                    <div class="ios-widget">
                        <span style="font-size:11px; opacity:0.6;">RENOVACIÓN</span>
                        <div style="font-size:18px; font-weight:700;">${this.fmt(data.mesRenovacion)}</div>
                    </div>
                </div>

                <div class="ios-widget" style="border-left:4px solid var(--warning);">
                    <h2 style="font-size:14px; margin-bottom:10px; color:var(--text-secondary);">${isPro ? 'Productividad' : 'Bono Cuaderno'}</h2>
                    ${bonoUI}
                </div>

                <div class="ios-widget" style="background:var(--surface-2); border-left:4px solid var(--accent);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:13px;">🧠 Estratega Financiero AI</strong>
                        <button id="btn-ai-finance" class="btn-secondary" style="padding:4px 10px!important; font-size:11px;">Analizar</button>
                    </div>
                    <div id="ai-finance-tip" style="font-size:13px; margin-top:8px; color:var(--text-secondary);">Haz clic en Analizar para obtener proyección.</div>
                </div>

                <h3 style="font-size:13px; font-weight:bold; color:var(--text-secondary); text-transform:uppercase; margin-top:10px;">Acumulados (YTD)</h3>
                <div class="ios-widget" style="gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:1px solid var(--separator);">
                        <span style="font-size:14px; font-weight:600;">Ingreso Anual Bruto</span>
                        <span style="font-size:16px; font-weight:bold;">${this.fmt(data.anualTotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:14px; font-weight:600;">Para Convención</span>
                        <span style="font-size:16px; font-weight:bold; color:var(--success);">${this.fmt(data.anualInicialesConvencion)}</span>
                    </div>
                </div>
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

    const { data: { user } } = await supabase.auth.getUser();
    const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
    const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

    if (!perfil) {
        container.outerHTML = FinancialUI.renderConfigForm();
        document.getElementById('btn-save-cfg').addEventListener('click', async () => {
            const f = document.getElementById('cfg-fec').value;
            if (!f) return showToast('Agrega fecha.', 'danger');
            await supabase.from('perfil_asesor').insert([{ user_id: user.id, esquema: document.getElementById('cfg-esq').value, fecha_conexion: f }]);
            window.navigateTo('comisiones');
        });
        return;
    }

    const cartera = await DB.obtenerTodos('cartera');
    const resultados = ActuarialEngine.calculatePortfolio(cartera, perfil);
    container.outerHTML = FinancialUI.hydrateDashboard(resultados, perfil);

    document.getElementById('btn-ai-finance')?.addEventListener('click', async () => {
        const p = `Actúas como CFO personal. Mis comisiones este mes son $${resultados.mesIniciales} iniciales y $${resultados.mesRenovacion} renovación. Faltan ${resultados.brechaBonoVidas} pólizas para el bono. Dame 1 línea accionable sobre qué perfil prospectar para lograrlo. Cero saludos.`;
        await callGemini(p, 'ai-finance-tip');
    });
}
