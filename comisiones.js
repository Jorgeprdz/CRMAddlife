// /modules/comisiones.js - Motor Actuarial y Tablero Financiero Premium
import { DB } from './db.js';
import { getSupabase } from './app.js';
import { showToast } from './utils.js';

// ============================================================================
// 1. REGLAS DE NEGOCIO (CONFIGURACIÓN ACTUARIAL INMUTABLE)
// ============================================================================
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

// ============================================================================
// 2. MOTOR FINANCIERO (PURE LOGIC - ZERO UI)
// ============================================================================
const ActuarialEngine = {
    calculatePortfolio(cartera, perfil) {
        const hoy = new Date();
        const results = {
            mesIniciales: 0,
            mesRenovacion: 0,
            mesPuntosConcurso: 0,
            anualTotal: 0,
            anualInicialesConvencion: 0,
            bonoMesCalculado: 0,
            brechaBonoMonto: 0,
            brechaBonoVidas: 0,
            mesesConcursoActivo: 1,
            calificaBono: false
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

            // Factor de ajuste para asesores en desarrollo (90% en Vida el primer año)
            const factorDesarrollo = (perfil?.esquema === 'Desarrollo' && tabla.ramo === 'Vida') ? 0.90 : 1.0;
            const comisionLiquida = primaNeta * factorFrecuencia * (esPrimerAño ? (tabla.nn * factorDesarrollo) : tabla.ry);

            // Filtro 1: Todo lo que se cobra en el año calendario en curso (YTD)
            if (fechaCobro.getFullYear() === hoy.getFullYear()) {
                results.anualTotal += comisionLiquida;
                if (esPrimerAño) results.anualInicialesConvencion += comisionLiquida;
            }

            // Filtro 2: Todo lo que se cobra estrictamente este mes
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

        // Cálculo de Bono (Solo para esquema de Desarrollo)
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

// ============================================================================
// 3. CAPA DE PRESENTACIÓN (UI RENDERING)
// ============================================================================
const FinancialUI = {
    fmt(num) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
    },

    renderSkeleton() {
        return `<div id="fin-dashboard-container" style="min-height:60vh; padding:10px;">
                    <div class="skeleton-shimmer" style="height:120px; border-radius:16px; margin-bottom:12px;"></div>
                    <div class="skeleton-shimmer" style="height:200px; border-radius:16px;"></div>
                </div>`;
    },

    renderConfigForm() {
        return `
            <div class="card" style="border-left: 4px solid var(--accent); margin:10px;">
                <h2 style="font-size:16px; margin-bottom:12px;">⚙️ Calibración del Cuaderno de Concursos</h2>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="font-size:11px; font-weight:bold; color:var(--text-secondary);">Esquema Oficial</label>
                    <select id="cfg-esq">
                        <option value="Desarrollo">Asesor en Desarrollo (Mes 1 a 12)</option>
                        <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                    </select>
                    <label style="font-size:11px; font-weight:bold; color:var(--text-secondary);">Fecha de Conexión a Clave</label>
                    <input type="date" id="cfg-fec">
                    <button id="btn-save-cfg" class="btn-primary" style="margin-top:10px;">Iniciar Motor Financiero</button>
                </div>
            </div>`;
    },

    hydrateDashboard(data, perfil) {
        const totalMes = data.mesIniciales + data.mesRenovacion + data.bonoMesCalculado;
        const metaTexto = perfil.esquema === 'Desarrollo' ? `Training Allowance (Mes ${data.mesesConcursoActivo})` : `Bono de Productividad`;
        
        let bonoUI = '';
        if (perfil.esquema === 'Desarrollo') {
            if (data.calificaBono) {
                bonoUI = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:20px; font-weight:bold; color:var(--text-primary);">${this.fmt(data.bonoMesCalculado)}</span>
                        <span class="badge badge-green">✅ Logrado</span>
                    </div>
                    <p style="font-size:12px; color:var(--success); margin-top:6px; font-weight:500;">Meta del cuaderno superada. Bono del 15% asegurado.</p>
                `;
            } else {
                bonoUI = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:20px; font-weight:bold; color:var(--text-primary);">$0.00</span>
                        <span class="badge badge-orange">${data.mesPuntosConcurso} Vidas</span>
                    </div>
                    <p style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Faltan <strong style="color:var(--danger);">${this.fmt(data.brechaBonoMonto)}</strong> y <strong style="color:var(--danger);">${data.brechaBonoVidas} vidas</strong> para calificar.</p>
                `;
            }
        }

        return `
            <div style="padding: 4px; display:flex; flex-direction:column; gap:12px;">
                <div class="card" style="background:var(--accent)!important; color:white!important; border:none; box-shadow:0 8px 24px rgba(0, 122, 255, 0.25);">
                    <span style="font-size:11px; text-transform:uppercase; opacity:0.85; font-weight:600; letter-spacing:0.5px; color:white;">Ingreso Total Estimado (Mes en Curso)</span>
                    <div style="font-size:36px; font-weight:bold; margin-top:4px; letter-spacing:-1px; color:white;">${this.fmt(totalMes)}</div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="background:var(--surface-2); padding:16px; border-radius:16px; border:1px solid var(--separator);">
                        <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Comisiones Iniciales</span>
                        <div style="font-size:20px; font-weight:bold; margin-top:4px; color:var(--text-primary);">${this.fmt(data.mesIniciales)}</div>
                    </div>
                    <div style="background:var(--surface-2); padding:16px; border-radius:16px; border:1px solid var(--separator);">
                        <span style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Renovaciones</span>
                        <div style="font-size:20px; font-weight:bold; margin-top:4px; color:var(--text-primary);">${this.fmt(data.mesRenovacion)}</div>
                    </div>
                </div>

                <div class="card" style="border-left: 4px solid var(--warning);">
                    <h2 style="font-size:14px; margin-bottom:10px; color:var(--text-secondary);">${metaTexto}</h2>
                    ${bonoUI}
                </div>

                <h3 style="font-size:13px; font-weight:bold; color:var(--text-secondary); text-transform:uppercase; margin: 10px 0 0 4px;">Acumulados Año Calendario (YTD)</h3>
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:1px solid var(--separator);">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:14px; font-weight:600; color:var(--text-primary);">Ingreso Anual Bruto</span>
                            <span style="font-size:11px; color:var(--text-secondary);">Todas las comisiones cobradas en el año.</span>
                        </div>
                        <span style="font-size:16px; font-weight:bold; color:var(--text-primary);">${this.fmt(data.anualTotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:14px; font-weight:600; color:var(--text-primary);">Acumulado Convención</span>
                            <span style="font-size:11px; color:var(--text-secondary);">Solo comisiones de primer año.</span>
                        </div>
                        <span style="font-size:16px; font-weight:bold; color:var(--success);">${this.fmt(data.anualInicialesConvencion)}</span>
                    </div>
                </div>
            </div>
        `;
    }
};

// ============================================================================
// 4. CONTROLADOR CENTRAL
// ============================================================================
export function renderComisiones() {
    return FinancialUI.renderSkeleton();
}

export async function bindComisionesEvents() {
    const container = document.getElementById('fin-dashboard-container');
    const supabase = getSupabase();
    if (!supabase || !container) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
        const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

        if (!perfil) {
            container.outerHTML = FinancialUI.renderConfigForm();
            document.getElementById('btn-save-cfg').addEventListener('click', async () => {
                const f = document.getElementById('cfg-fec').value;
                if (!f) return showToast('Agrega la fecha de conexión.', 'danger');
                await supabase.from('perfil_asesor').insert([{ user_id: user.id, esquema: document.getElementById('cfg-esq').value, fecha_conexion: f }]);
                window.navigateTo('comisiones');
            });
            return;
        }

        const cartera = await DB.obtenerTodos('cartera');
        const resultadosFinancieros = ActuarialEngine.calculatePortfolio(cartera, perfil);
        
        // Reemplazo limpio del skeleton por el dashboard hidratado
        container.outerHTML = FinancialUI.hydrateDashboard(resultadosFinancieros, perfil);
        
    } catch (error) {
        console.error("[Finanzas] Error procesando cartera:", error);
        showToast('Error al calcular el motor financiero.', 'danger');
    }
}
