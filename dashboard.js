// /modules/dashboard.js - Dashboard Ejecutivo (Arquitectura Desacoplada)
import { DB } from './db.js';
import { getSupabase } from './app.js';

export function renderDashboard() {
    // UI inicial inmutable con Skeletons. No se destruye, se hidrata.
    return `
        <div id="dashboard-container" style="display: flex; flex-direction: column; gap: 4px;">
            <div class="card" style="background: var(--accent) !important; color: white !important; border: none;">
                <h1 id="dash-saludo" style="margin: 0; font-size: 22px; color: white !important;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 200px; background: rgba(255,255,255,0.2);"></div>
                </h1>
                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px; color: white !important;">Estatus de tu negocio al día de hoy.</p>
            </div>

            <div class="card" style="border-left: 5px solid var(--warning) !important;">
                <h2 class="fw-600" style="font-size:16px;">🎯 Radar de Fidelización</h2>
                <div id="dash-fidelizacion" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 85%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width: 70%;"></div>
                </div>
            </div>

            <div class="card" style="border-left: 5px solid var(--accent) !important;">
                <h2 class="fw-600" style="font-size:16px;">📊 Productividad Semanal</h2>
                <div id="dash-productividad" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 90%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width: 55%; height: 20px; border-radius: 10px;"></div>
                </div>
            </div>

            <div class="card" style="border-left: 5px solid var(--danger) !important;">
                <h2 class="fw-600" style="font-size:16px;">💼 Control de Cartera (Mes Actual)</h2>
                <div id="dash-cartera" style="margin-top:10px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 95%;"></div>
                </div>
            </div>
        </div>
    `;
}

export async function bindDashboardEvents() {
    await DashboardManager.init();
}

// Controlador de Lógica de Negocio y Presentación
const DashboardManager = {
    async init() {
        try {
            const [user, historial, cartera] = await Promise.all([
                this._getUserData(),
                DB.obtenerTodos('actividad_diaria'), // Ajustado a la nueva estructura unificada
                DB.obtenerTodos('cartera')
            ]);
            
            this._hydrateUI(user, historial, cartera);
        } catch (error) {
            console.error("[Dashboard] Error al cargar datos:", error);
        }
    },

    async _getUserData() {
        const supabase = getSupabase();
        let nombreUsuario = 'Asesor';
        if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.full_name) {
                nombreUsuario = user.user_metadata.full_name.split(' ')[0];
            }
        }
        return nombreUsuario;
    },

    _hydrateUI(nombre, historial, cartera) {
        // 1. Saludo
        const hora = new Date().getHours();
        const saludo = hora >= 5 && hora < 12 ? 'Buenos días' : hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';
        document.getElementById('dash-saludo').innerHTML = `${saludo}, ${nombre}. 👋`;

        // 2. Productividad
        const kpiProductividad = this._calcProductividad(historial);
        document.getElementById('dash-productividad').innerHTML = `
            <p style="font-size:14px; margin-top:4px;">Esta semana llevas <strong>${kpiProductividad.puntos}</strong> puntos de ${kpiProductividad.meta}. Faltan <strong>${kpiProductividad.faltantes}</strong> puntos.</p>
            ${kpiProductividad.badge}
        `;

        // 3. Fidelización
        const alertasFidelizacion = this._calcFidelizacion(cartera);
        document.getElementById('dash-fidelizacion').innerHTML = alertasFidelizacion.length > 0 
            ? alertasFidelizacion.join('') 
            : '<p style="font-size:13px; color:var(--text-secondary);">Sin eventos próximos en los siguientes 30 días.</p>';

        // 4. Cobranza
        const alertasCobranza = this._calcCobranza(cartera);
        document.getElementById('dash-cartera').innerHTML = alertasCobranza;
    },

    _calcProductividad(historial) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
        const viernes = new Date(lunes);
        viernes.setDate(lunes.getDate() + 4);
        viernes.setHours(23, 59, 59, 999);

        let puntosSemana = 0;
        historial.forEach(reg => {
            const fechaReg = new Date(reg.id + 'T12:00:00'); // ID es la fecha en ISO por el Upsert
            if (fechaReg >= lunes && fechaReg <= viernes) {
                // Cálculo rápido basado en las métricas guardadas
                puntosSemana += (reg.referidos * 1) + (reg.llamadas * 0.5) + (reg.citas_agendadas * 2) + 
                                (reg.citas_conectadas * 5) + (reg.citas_cierre * 5) + 
                                (reg.solicitudes * 10) + (reg.pagadas * 15);
            }
        });

        const metaTotal = 125;
        const faltantes = Math.max(0, metaTotal - puntosSemana);
        const numDia = hoy.getDay();
        const diasRestantes = (numDia >= 1 && numDia <= 5) ? 6 - numDia : 0;

        let badge = '';
        if (faltantes <= 0) badge = `<div class="badge badge-green mt-8">🎉 ¡Meta semanal cumplida!</div>`;
        else if (diasRestantes > 0) badge = `<div class="badge badge-red mt-8">Requiere ${Math.ceil(faltantes / diasRestantes)} puntos diarios</div>`;
        else badge = `<div class="badge badge-orange mt-8">Fin de semana: Faltaron ${faltantes} puntos</div>`;

        return { puntos: puntosSemana, meta: metaTotal, faltantes, badge };
    },

    _calcFidelizacion(cartera) {
        const hoy = new Date();
        const alertas = [];
        const diaEnMs = 86400000;

        cartera.forEach(p => {
            if (p.nacimiento) {
                const fNac = new Date(p.nacimiento + 'T12:00:00');
                let proxCumple = new Date(hoy.getFullYear(), fNac.getMonth(), fNac.getDate());
                if (proxCumple < hoy) proxCumple.setFullYear(hoy.getFullYear() + 1);
                
                const diasCumple = Math.ceil((proxCumple - hoy) / diaEnMs);
                if (diasCumple <= 30) {
                    alertas.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>🎂 <strong>${p.cliente}</strong></span> <span>Faltan ${diasCumple} días</span></div>`);
                }

                let proxAct = new Date(proxCumple);
                proxAct.setMonth(proxAct.getMonth() - 6);
                if (proxAct < hoy) proxAct.setFullYear(proxAct.getFullYear() + 1);
                
                const diasAct = Math.ceil((proxAct - hoy) / diaEnMs);
                if (diasAct <= 30) {
                    alertas.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>📈 <strong>${p.cliente}</strong> (Edad Actuarial)</span> <span style="color:var(--warning);">Cambia en ${diasAct} días</span></div>`);
                }
            }

            if (p.emision) {
                const fEmi = new Date(p.emision + 'T12:00:00');
                let proxAniv = new Date(hoy.getFullYear(), fEmi.getMonth(), fEmi.getDate());
                if (proxAniv < hoy) proxAniv.setFullYear(hoy.getFullYear() + 1);
                
                const diasAniv = Math.ceil((proxAniv - hoy) / diaEnMs);
                if (diasAniv <= 30) {
                    alertas.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>🛡️ <strong>${p.poliza}</strong> (Aniversario)</span> <span>Faltan ${diasAniv} días</span></div>`);
                }
            }
        });
        return alertas;
    },

    _calcCobranza(cartera) {
        const hoy = new Date();
        const pendientes = cartera.filter(p => {
            if (!p.fechaPago) return false;
            const f = new Date(p.fechaPago + 'T12:00:00');
            return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
        });

        if (pendientes.length === 0) return `<p style="color: var(--success); font-size: 14px; margin-top: 5px;">Todo en orden. Sin pólizas pendientes de cobro este mes.</p>`;
        
        const nombres = pendientes.map(p => `<strong>${p.cliente}</strong>`).join(', ');
        return `<p style="color: var(--danger); font-size: 14px; margin-top: 5px;">Pólizas de ${nombres} pendientes de cobro.</p>`;
    }
};
