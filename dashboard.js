// dashboard.js
import { DB } from './db.js';
import { getSupabase } from './app.js';

export function renderDashboard() {
    return `<div id=\"dashboard-container\" style=\"display: flex; flex-direction: column; gap: 15px;\">\n                <div style=\"text-align: center; color: #8E8E93; padding: 20px;\">Cargando tu inteligencia de negocio...</div>\n            </div>`;
}

export async function bindDashboardEvents() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // 1. Saludo dinámico según la hora del día
    const hora = new Date().getHours();
    let saludo = 'Buenas noches';
    if (hora >= 5 && hora < 12) saludo = 'Buenos días';
    else if (hora >= 12 && hora < 19) saludo = 'Buenas tardes';

    // 2. Extraer el primer nombre real desde Supabase Auth
    let nombreUsuario = 'Asesor';
    try {
        const client = getSupabase();
        if (client) {
            const { data: { user } } = await client.auth.getUser();
            if (user?.user_metadata?.full_name) {
                nombreUsuario = user.user_metadata.full_name.split(' ')[0];
            }
        }
    } catch (err) {
        console.error("Error al recuperar nombre:", err);
    }

    // 3. Cálculos de actividad (Semana laboral de lunes a viernes)
    let historial = [];
    let cartera = [];
    try {
        historial = (await DB.obtenerTodos('historial_actividad')) || [];
        cartera = (await DB.obtenerTodos('cartera')) || [];
    } catch (dbErr) {
        console.error("Error al leer la base de datos:", dbErr);
    }

    const hoy = new Date();
    const lunes = new Date(hoy);
    const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    lunes.setDate(hoy.getDate() - dia);
    lunes.setHours(0, 0, 0, 0);

    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    viernes.setHours(23, 59, 59, 999);

    // Sumatoria de tus puntos acumulados reales
    let puntosSemana = 0;
    historial.forEach(reg => {
        const f = new Date(reg.fecha);
        if (f >= lunes && f <= viernes) {
            puntosSemana += Number(reg.puntos || 0);
        }
    });

    // 4. Lógica matemática de metas automáticas
    const metaTotal = 125;
    const puntosFaltantes = Math.max(0, metaTotal - puntosSemana);
    
    // Días laborables restantes (contando el actual de lunes a viernes)
    const numDiaSemana = hoy.getDay(); 
    let diasRestantes = 0;
    if (numDiaSemana >= 1 && numDiaSemana <= 5) {
        diasRestantes = 6 - numDiaSemana; 
    }

    // Alerta de cuota adaptativa
    let cuotaDiariaTexto = '';
    if (puntosFaltantes <= 0) {
        cuotaDiariaTexto = `<div class="badge badge-green mt-8" style="background:#34C759; color:white; padding:4px 8px; border-radius:6px; display:inline-block; font-size:12px; font-weight:600;">🎉 ¡Meta semanal cumplida!</div>`;
    } else if (diasRestantes > 0) {
        const cuota = Math.ceil(puntosFaltantes / diasRestantes);
        cuotaDiariaTexto = `<div class="badge badge-red mt-8" style="background:#FF3B30; color:white; padding:4px 8px; border-radius:6px; display:inline-block; font-size:12px; font-weight:600;">Debes hacer ${cuota} puntos diarios</div>`;
    } else {
        cuotaDiariaTexto = `<div class="badge badge-orange mt-8" style="background:#FF9500; color:white; padding:4px 8px; border-radius:6px; display:inline-block; font-size:12px; font-weight:600;">Fin de semana: Faltaron ${puntosFaltantes} puntos</div>`;
    }

    // 5. Control de Cartera (Sincronizado con el mes en curso)
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    const pendientesMes = cartera.filter(p => {
        if (!p.fechaPago) return false;
        const f = new Date(p.fechaPago + 'T12:00:00');
        return f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });

    let textoCartera = '';
    if (pendientesMes.length === 0) {
        textoCartera = `<p style="color: #34C759; font-size: 14px; margin-top: 5px;">Todo en orden. No tienes pólizas pendientes de pago para este mes.</p>`;
    } else {
        const listaNombres = pendientesMes.map(p => `<strong>${p.cliente}</strong>`).join(', ');
        const verbo = pendientesMes.length > 1 ? 'están pendientes' : 'está pendiente';
        const laPoliza = pendientesMes.length > 1 ? 'Las pólizas de' : 'La póliza de';
        textoCartera = `<p style="color: #FF3B30; font-size: 15px; margin-top: 5px;">${laPoliza} ${listaNombres} ${verbo} de pago este mes.</p>`;
    }

    // 6. Inyección de UI con los tokens estilizados
    container.innerHTML = `
        <div class="card" style="background: var(--primary); color: white; padding: 20px; border-radius: 22px; border: none;">
            <h1 style="margin: 0; font-size: 24px; color: white;">${saludo}, ${nombreUsuario}. 👋</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; color: white;">Este es el estatus de tu negocio al día de hoy.</p>
        </div>

        <div class="card" style="border-left: 5px solid var(--primary); padding: 20px; border-radius: 22px; background: var(--surface);">
            <h2 style="margin:0 0 10px 0; font-size:18px;">📊 Productividad</h2>
            <p style="margin:0; font-size:14px;">Esta semana llevas <strong>${puntosSemana}</strong> puntos de ${metaTotal}. Te hacen falta <strong>${puntosFaltantes}</strong> puntos para llegar a la meta.</p>
            <div style="margin-top:10px;">${cuotaDiariaTexto}</div>
        </div>

        <div class="card" style="border-left: 5px solid #FF3B30; padding: 20px; border-radius: 22px; background: var(--surface);">
            <h2 style="margin:0 0 10px 0; font-size:18px;">💼 Control de Cartera</h2>
            ${textoCartera}
        </div>
    `;
}
