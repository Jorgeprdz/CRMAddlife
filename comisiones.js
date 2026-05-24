// /modules/comisiones.js - Motor Financiero Real y Tablero YTD
import { DB } from './db.js';
import { getSupabase, callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

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
    4: { comision: 31000, vidas: 12 }, 5: { comision: 39000, vidas: 14 }, 6: { comision: 50000, vidas: 15 },
    7: { comision: 50000, vidas: 15 }, 8: { comision: 50000, vidas: 15 }, 9: { comision: 50000, vidas: 15 },
    10: { comision: 50000, vidas: 15 }, 11: { comision: 50000, vidas: 15 }, 12: { comision: 50000, vidas: 15 }
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
            // Parse robusto de fechas para evitar NaN
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

            // Filtro 1: YTD (Todo lo de este año calendario)
            if (fechaCobro.getFullYear() === hoy.getFullYear()) {
                results.anualTotal += comisionLiquida;
                if (esPrimerAño && !p.esPersonal) results.anualInicialesConvencion += comisionLiquida;
            }

            // Filtro 2: Estricto este mes y año
            if (fechaCobro.getMonth() === hoy.getMonth() && fechaCobro.getFullYear() === hoy.getFullYear()) {
                if (esPrimerAño) {
                    results.mesIniciales += comisionLiquida;
                    if (!p.esPersonal) results.mesPuntosConcurso += (tabla.ramo === 'GMM' && primaNeta >= 10000) ? 0.5 : (primaNeta >= 65001 ? 2 : 1);
                } else {
                    results.mesRenovacion += comisionLiquida;
                }
            }
        });

        // Aplicación del cuaderno si es Desarrollo
        if (perfil?.esquema === 'Desarrollo') {
            const index = results.mesesConcursoActivo > 12 ? 12 : results.mesesConcursoActivo;
            const regla = BonusRules[index] || { comision: 50000, vidas: 15 };
            
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
    renderSkeleton() { return `<div id="fin-dashboard-container" style="min-height:60vh; padding:10px;"><div class="skeleton-shimmer" style="height:120px; border-radius:24px; margin-bottom:16px;"></div></div>`; },

    renderConfigForm() {
        return `
            <div id="fin-dashboard-container" class="glass-widget" style="margin:20px 10px;">
                <h2 style="font-size:18px; margin-bottom:16px;">⚙️ Perfil Financiero</h2>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Esquema Contractual</label>
                        <select id="cfg-esq" class="glass-input" style="width:100%;">
                            <option value="Desarrollo">Training Allowance (Mes 1 a 12)</option>
                            <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:600; color:var(--text-secondary);">Fecha de Conexión (Clave)</label>
                        <input type="date" id="cfg-fec" class="glass-input" style="width:100%;">
                    </div>
                    <button id="btn-save-cfg" class="btn-primary" style="margin-top:10px;">Iniciar Motor Financiero</button>
                </div>
            </div>`;
    },

    hydrateDashboard(data, perfil) {
        const totalMes = data.mesIniciales + data.mesRenovacion + data.bonoMesCalculado;
        const isPro = perfil.esquema === 'Profesional';
        
        let bonoUI = isPro 
            ? `<div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Esquema Consolidado (Sin Training Allowance)</div>`
            : (data.calificaBono 
                ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">${this.fmt(data.bonoMesCalculado)}</span><span class="status-badge" style="background:rgba(52,199,89,0.1); border-color:#34C759; color:#34C759;">✅ Logrado</span></div>` 
                : `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;"><span style="font-size:24px; font-weight:800; color:var(--text-primary);">$0.00</span><span class="status-badge" style="background:rgba(255,149,0,0.1); border-color:#FF9500; color:#FF9500;">${data.mesPuntosConcurso} Vidas</span></div>
                   <p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Faltan <strong style="color:var(--danger);">${this.fmt(data.brechaBonoMonto)}</strong> y <strong style="color:var(--danger);">${data.brechaBonoVidas} vidas</strong>.</p>`);

        return `
            <div id="fin-dashboard-container" style="display:flex; flex-direction:column; gap:16px; padding-bottom:24px;">
                
                <div class="glass-widget" style="background:var(--text-primary); color:var(--surface); border:none; text-align:center; padding:24px;">
                    <span style="font-size:12px; opacity:0.8; font-weight:600; text-transform:uppercase;">Ingreso Estimado Mes</span>
                    <div style="font-size:42px; font-weight:800; margin-top:4px; letter-spacing:-1px;">${this.fmt(totalMes)}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div class="glass-widget" style="padding:16px;">
                        <span style="font-size:11px; opacity:0.6; font-weight:700;">INICIALES</span>
                        <div style="font-size:20px; font-weight:800; margin-top:4px;">${this.fmt(data.mesIniciales)}</div>
                    </div>
                    <div class="glass-widget" style="padding:16px;">
                        <span style="font-size:11px; opacity:0.6; font-weight:700;">RENOVACIÓN</span>
                        <div style="font-size:20px; font-weight:800; margin-top:4px;">${this.fmt(data.mesRenovacion)}</div>
                    </div>
                </div>

                <div class="glass-widget" style="border-left:4px solid var(--warning); padding:16px;">
                    <h2 style="font-size:14px; margin:0; color:var(--text-secondary); font-weight:600;">${isPro ? 'Bono Productividad' : `Meta Cuaderno (Mes ${data.mesesConcursoActivo})`}</h2>
                    ${bonoUI}
                </div>

                <h3 style="font-size:14px; font-weight:700; color:var(--text-secondary); margin: 8px 0 0 4px;">Acumulados (Año en Curso)</h3>
                <div class="glass-widget" style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid rgba(150,150,150,0.1);">
                        <span style="font-size:14px; font-weight:600; color:var(--text-secondary);">Ingreso Anual Bruto</span>
                        <span style="font-size:18px; font-weight:800; color:var(--text-primary);">${this.fmt(data.anualTotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px;">
                        <span style="font-size:14px; font-weight:600; color:var(--text-secondary);">Acumulado Convención</span>
                        <span style="font-size:18px; font-weight:800; color:#34C759;">${this.fmt(data.anualInicialesConvencion)}</span>
                    </div>
                </div>

                <button id="btn-dev-reset" class="btn-secondary btn-sm" style="margin-top:16px; opacity:0.5;">⚙️ Modo Dev: Resetear Perfil</button>
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
        if(!user) throw new Error("No user");

        const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
        const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

        if (!perfil) {
            container.outerHTML = FinancialUI.renderConfigForm();
            document.getElementById('btn-save-cfg').addEventListener('click', async () => {
                const f = document.getElementById('cfg-fec').value;
                if (!f) return showToast('Agrega fecha de conexión.', 'danger');
                await supabase.from('perfil_asesor').insert([{ user_id: user.id, esquema: document.getElementById('cfg-esq').value, fecha_conexion: f }]);
                window.navigateTo('comisiones');
            });
            return;
        }

        const cartera = await DB.obtenerTodos('cartera');
        const resultados = ActuarialEngine.calculatePortfolio(cartera, perfil);
        
        container.outerHTML = FinancialUI.hydrateDashboard(resultados, perfil);

        // Listener Modo Dev
        document.getElementById('btn-dev-reset')?.addEventListener('click', async () => {
            const c = await showConfirm('Esto borrará tu perfil de comisiones para recalibrarlo. ¿Continuar?', 'Resetear Perfil', 'Resetear', true);
            if (c) {
                await supabase.from('perfil_asesor').delete().eq('user_id', user.id);
                window.navigateTo('comisiones');
            }
        });

    } catch (e) {
        console.error(e);
        showToast('Error cargando finanzas.', 'danger');
    }
}
