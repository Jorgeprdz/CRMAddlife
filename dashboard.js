// dashboard.js - Tablero Automático y Dinámico
import { DB } from './db.js';

export function renderDashboard() {
    return `
        <div id="dashboard-container" style="display: flex; flex-direction: column; gap: 4px;">
            <!-- Skeleton Card 1: Saludo -->
            <div class="skeleton-card skeleton-shimmer" style="height: 90px; border: none; background: var(--separator); opacity: 0.15; border-radius: var(--radius-card); margin: 16px;"></div>
            
            <!-- Skeleton Card 2: Radar de Fidelización -->
            <div class="card" style="border-left: 5px solid var(--warning) !important;">
                <h2 class="fw-600" style="font-size:16px;">🎯 Radar de Fidelización</h2>
                <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 85%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width: 70%;"></div>
                </div>
            </div>
            
            <!-- Skeleton Card 3: Productividad -->
            <div class="card" style="border-left: 5px solid var(--accent) !important;">
                <h2 class="fw-600" style="font-size:16px;">📊 Productividad</h2>
                <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 90%;"></div>
                    <div class="skeleton-text skeleton-shimmer" style="width: 55%; height: 20px; border-radius: 10px;"></div>
                </div>
            </div>
            
            <!-- Skeleton Card 4: Control de Cartera -->
            <div class="card" style="border-left: 5px solid var(--danger) !important;">
                <h2 class="fw-600" style="font-size:16px;">💼 Control de Cartera</h2>
                <div style="margin-top:10px;">
                    <div class="skeleton-text skeleton-shimmer" style="width: 95%;"></div>
                </div>
            </div>
        </div>
    `;
}

export async function bindDashboardEvents() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    const hora = new Date().getHours();
    let saludo = hora >= 5 && hora < 12 ? 'Buenos días' : hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';

    let nombreUsuario = 'Asesor';
    if (window.supabaseClient) {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user && user.user_metadata && user.user_metadata.full_name) {
            nombreUsuario = user.user_metadata.full_name.split(' ')[0];
        }
    }

    const historial = await DB.obtenerTodos('historial_actividad');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const lunes = new Date(hoy);
    const diaDiferencia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    lunes.setDate(hoy.getDate() - diaDiferencia);
    
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    viernes.setHours(23, 59, 59, 999);

    let puntosSemana = 0;
    historial.forEach(reg => {
        const fechaReg = new Date(reg.fecha);
        if (fechaReg >= lunes && fechaReg <= viernes) {
            puntosSemana += Number(reg.puntos || 0);
        }
    });

    const metaTotal = 125;
    const puntosFaltantes = Math.max(0, metaTotal - puntosSemana);
    
    const numDiaSemana = new Date().getDay();
    let diasRestantes = (numDiaSemana >= 1 && numDiaSemana <= 5) ? 6 - numDiaSemana : 0;

    let cuotaDiariaTexto = '';
    if (puntosFaltantes <= 0) cuotaDiariaTexto = `<div class="badge badge-green mt-8">🎉 ¡Meta semanal cumplida con éxito!</div>`;
    else if (diasRestantes > 0) cuotaDiariaTexto = `<div class="badge badge-red mt-8">Debes hacer ${Math.ceil(puntosFaltantes / diasRestantes)} puntos diarios</div>`;
    else cuotaDiariaTexto = `<div class="badge badge-orange mt-8">Fin de semana: Faltaron ${puntosFaltantes} puntos para la meta</div>`;

    const cartera = await DB.obtenerTodos('cartera');
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    // ---- LÓGICA: RADAR DE FIDELIZACIÓN ----
    const alertasFidelizacion = [];

    cartera.forEach(p => {
        if (p.nacimiento) {
            const fNac = new Date(p.nacimiento + 'T12:00:00');
            
            // 1. Próximo Cumpleaños
            let proxCumple = new Date(hoy.getFullYear(), fNac.getMonth(), fNac.getDate());
            if (proxCumple < hoy) proxCumple.setFullYear(hoy.getFullYear() + 1);
            const diasCumple = Math.ceil((proxCumple - hoy) / 86400000);
            
            if (diasCumple <= 30) {
                alertasFidelizacion.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>🎂 <strong>${p.cliente}</strong> (Cumpleaños)</span> <span>Faltan ${diasCumple} días</span></div>`);
            }

            // 2. Cambio de Edad Actuarial (6 meses desde el cumple)
            let proxActuarial = new Date(proxCumple);
            proxActuarial.setMonth(proxActuarial.getMonth() - 6);
            if (proxActuarial < hoy) proxActuarial.setFullYear(proxActuarial.getFullYear() + 1);
            const diasActuarial = Math.ceil((proxActuarial - hoy) / 86400000);

            if (diasActuarial <= 30) {
                alertasFidelizacion.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>📈 <strong>${p.cliente}</strong> (Sube Prima por Edad)</span> <span style="color:var(--warning);">Aumenta en ${diasActuarial} días</span></div>`);
            }
        }

        if (p.emision) {
            // 3. Aniversario de Póliza
            const fEmision = new Date(p.emision + 'T12:00:00');
            let proxAniv = new Date(hoy.getFullYear(), fEmision.getMonth(), fEmision.getDate());
            if (proxAniv < hoy) proxAniv.setFullYear(hoy.getFullYear() + 1);
            const diasAniv = Math.ceil((proxAniv - hoy) / 86400000);
            
            if (diasAniv <= 30) {
                alertasFidelizacion.push(`<div style="display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid var(--separator); padding-bottom:6px; margin-bottom:6px;"><span>🛡️ <strong>${p.poliza}</strong> (Aniversario Póliza)</span> <span>Faltan ${diasAniv} días</span></div>`);
            }
        }
    });

    let textoFidelizacion = alertasFidelizacion.length > 0 
        ? alertasFidelizacion.join('') 
        : '<p style="font-size:13px; color:var(--text-secondary);">No hay cumpleaños, aniversarios ni cambios de edad en los próximos 30 días.</p>';

    // ---- LÓGICA: COBRANZA ----
    const pendientesMes = cartera.filter(p => {
        if (!p.fechaPago) return false;
        const f = new Date(p.fechaPago + 'T12:00:00');
        return f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });

    let textoCartera = '';
    if (pendientesMes.length === 0) {
        textoCartera = `<p style="color: var(--success); font-size: 14px; margin-top: 5px;">Todo en orden. No tienes pólizas pendientes de pago para este mes.</p>`;
    } else {
        const listaNombres = pendientesMes.map(p => `<strong>${p.cliente}</strong>`).join(', ');
        const verbo = pendientesMes.length > 1 ? 'están pendientes' : 'está pendiente';
        textoCartera = `<p style="color: var(--danger); font-size: 14px; margin-top: 5px;">Las pólizas de ${listaNombres} ${verbo} de pago este mes.</p>`;
    }

    container.innerHTML = `
        <div class="card" style="background: var(--accent) !important; color: white !important; border: none;">
            <h1 style="margin: 0; font-size: 22px; color: white !important;">${saludo}, ${nombreUsuario}. 👋</h1>
            <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px; color: white !important;">Estatus de tu negocio al día de hoy.</p>
        </div>

        <div class="card" style="border-left: 5px solid var(--warning) !important;">
            <h2 class="fw-600" style="font-size:16px;">🎯 Radar de Fidelización</h2>
            <div style="margin-top:10px;">
                ${textoFidelizacion}
            </div>
        </div>

        <div class="card" style="border-left: 5px solid var(--accent) !important;">
            <h2 class="fw-600" style="font-size:16px;">📊 Productividad</h2>
            <p style="font-size:14px; margin-top:4px;">Esta semana llevas <strong>${puntosSemana}</strong> puntos de ${metaTotal}. Te hacen falta <strong>${puntosFaltantes}</strong> puntos para llegar a la meta.</p>
            ${cuotaDiariaTexto}
        </div>

        <div class="card" style="border-left: 5px solid var(--danger) !important;">
            <h2 class="fw-600" style="font-size:16px;">💼 Control de Cartera</h2>
            ${textoCartera}
        </div>
    `;
}
