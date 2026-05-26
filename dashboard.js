// /modules/dashboard.js - Dashboard Ejecutivo (Arquitectura Desacoplada)
import { DB } from './db.js';
import { getSupabase } from './app.js';

export function renderDashboard() {
    return `
        <div id="dashboard-container" style="display:flex; flex-direction:column; gap:14px;">

            <!-- Hero Greeting Widget -->
            <div class="card widget-accent" style="padding:24px !important;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p style="font-size:12px; font-weight:600; opacity:0.75; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">CRM Addlife</p>
                        <h1 id="dash-saludo" style="font-size:24px; color:white; font-weight:800; letter-spacing:-0.5px; margin:0;">
                            <div class="skeleton-text skeleton-shimmer" style="width:200px; height:28px; background:rgba(255,255,255,0.20);"></div>
                        </h1>
                        <p style="margin:6px 0 0 0; opacity:0.80; font-size:13px; color:white; font-weight:400;">Estatus de tu negocio hoy.</p>
                    </div>
                    <div style="width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">📊</div>
                </div>
            </div>

            <!-- 2-col KPI Grid -->
            <div class="widget-grid">
                <div id="dash-pts-kpi" class="widget">
                    <span class="widget-title">Puntos semana</span>
                    <span class="widget-value" style="color:var(--color-primary);">—</span>
                </div>
                <div id="dash-meta-kpi" class="widget">
                    <span class="widget-title">Meta semanal</span>
                    <span class="widget-value">125</span>
                </div>
            </div>

            <!-- Productividad -->
            <div class="card" style="border-left:4px solid var(--color-primary) !important;">
                <h2 style="font-size:16px; margin-bottom:14px;">📊 Productividad Semanal</h2>
                <div id="dash-productividad">
                    <div class="skeleton-text skeleton-shimmer" style="width:88%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width:55%; height:20px; border-radius:10px; margin-top:10px;"></div>
                </div>
            </div>

            <!-- Radar de Fidelización -->
            <div class="card" style="border-left:4px solid var(--color-warning) !important;">
                <h2 style="font-size:16px; margin-bottom:14px;">🎯 Radar de Fidelización</h2>
                <div id="dash-fidelizacion" style="display:flex; flex-direction:column; gap:0;">
                    <div class="skeleton-text skeleton-shimmer" style="width:85%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width:70%;"></div>
                </div>
            </div>

            <!-- Control de Cartera -->
            <div class="card" style="border-left:4px solid var(--color-danger) !important;">
                <h2 style="font-size:16px; margin-bottom:14px;">💼 Control de Cartera</h2>
                <div id="dash-cartera">
                    <div class="skeleton-text skeleton-shimmer" style="width:92%;"></div>
                </div>
            </div>

        </div>
    `;
}

export async function bindDashboardEvents() {
    await DashboardManager.init();
}

const DashboardManager = {
    async init() {
        try {
            const [user, historial, cartera] = await Promise.all([
                this._getUserData(),
                DB.obtenerTodos('actividad_diaria'),
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
        document.getElementById('dash-saludo').innerHTML = `${saludo}, ${nombre} 👋`;

        // 2. Productividad
        const kpi = this._calcProductividad(historial);

        // Update KPI tiles
        const ptsEl = document.getElementById('dash-pts-kpi');
        if (ptsEl) {
            ptsEl.querySelector('.widget-value').textContent = kpi.puntos;
        }

        // Progress bar + badge
        const pct = Math.min(100, Math.round((kpi.puntos / kpi.meta) * 100));
        document.getElementById('dash-productividad').innerHTML = `
            <p style="font-size:14px; margin-bottom:10px;">Esta semana llevas <strong>${kpi.puntos}</strong> de ${kpi.meta} puntos. Faltan <strong style="color:var(--color-danger);">${kpi.faltantes}</strong>.</p>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">${pct}% completado</span>
                ${kpi.badge}
            </div>
        `;

        // 3. Fidelización
        const alertasFidelizacion = this._calcFidelizacion(cartera);
        document.getElementById('dash-fidelizacion').innerHTML = alertasFidelizacion.length > 0
            ? alertasFidelizacion.join('')
            : '<p style="font-size:13px; color:var(--text-secondary);">Sin eventos próximos en los siguientes 30 días. ✅</p>';

        // 4. Cobranza
        const alertasCobranza = this._calcCobranza(cartera);
        document.getElementById('dash-cartera').innerHTML = alertasCobranza;
    },

    _calcProductividad(historial) {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
        const viernes = new Date(lunes);
        viernes.setDate(lunes.getDate() + 4);
        viernes.setHours(23,59,59,999);

        let puntosSemana = 0;
        historial.forEach(reg => {
            const fechaReg = new Date(reg.id + 'T12:00:00');
            if (fechaReg >= lunes && fechaReg <= viernes) {
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
        if (faltantes <= 0) badge = `<span class="badge badge-green">🎉 Meta cumplida</span>`;
        else if (diasRestantes > 0) badge = `<span class="badge badge-red">~${Math.ceil(faltantes / diasRestantes)} pts/día</span>`;
        else badge = `<span class="badge badge-orange">Sem. terminada</span>`;

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
                    alertas.push(`<div class="fidelization-row"><span>🎂 <strong>${p.cliente}</strong></span><span class="badge badge-blue">en ${diasCumple}d</span></div>`);
                }
                let proxAct = new Date(proxCumple); proxAct.setMonth(proxAct.getMonth() - 6);
                if (proxAct < hoy) proxAct.setFullYear(proxAct.getFullYear() + 1);
                const diasAct = Math.ceil((proxAct - hoy) / diaEnMs);
                if (diasAct <= 30) {
                    alertas.push(`<div class="fidelization-row"><span>📈 <strong>${p.cliente}</strong> <span style="color:var(--text-tertiary);">edad actuarial</span></span><span class="badge badge-orange">en ${diasAct}d</span></div>`);
                }
            }
            if (p.emision) {
                const fEmi = new Date(p.emision + 'T12:00:00');
                let proxAniv = new Date(hoy.getFullYear(), fEmi.getMonth(), fEmi.getDate());
                if (proxAniv < hoy) proxAniv.setFullYear(hoy.getFullYear() + 1);
                const diasAniv = Math.ceil((proxAniv - hoy) / diaEnMs);
                if (diasAniv <= 30) {
                    alertas.push(`<div class="fidelization-row"><span>🛡️ <strong>${p.poliza}</strong> <span style="color:var(--text-tertiary);">aniversario</span></span><span class="badge badge-purple">en ${diasAniv}d</span></div>`);
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
        if (pendientes.length === 0) return `<p style="color:var(--color-success); font-size:14px; font-weight:600;">✅ Sin pólizas pendientes este mes.</p>`;
        const nombres = pendientes.map(p => `<strong>${p.cliente}</strong>`).join(', ');
        return `<p style="color:var(--color-danger); font-size:14px;">⚠️ Pólizas de ${nombres} pendientes de cobro.</p>`;
    }
};
