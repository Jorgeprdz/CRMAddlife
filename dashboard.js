// dashboard.js
import { DB } from './db.js';

export function renderDashboard() {
    return `<div id="dashboard-container" style="display: flex; flex-direction: column; gap: 15px;">
                <div style="text-align: center; color: var(--text-tertiary); padding: 20px;">Cargando tu inteligencia de negocio...</div>
            </div>`;
}

export async function bindDashboardEvents() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // 1. Saludo por hora del día
    const hora = new Date().getHours();
    let saludo = 'Buenas noches';
    if (hora >= 5 && hora < 12) saludo = 'Buenos días';
    else if (hora >= 12 && hora < 19) saludo = 'Buenas tardes';

    // 2. Extraer el primer nombre real desde Google Auth de forma segura
    let nombreUsuario = 'Asesor';
    try {
        if (window.supabase) {
            const supabaseUrl = 'https://rmlxigxysujsuwzgoimv.supabase.co';
            const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbHhpZ3h5c3Vqc3V3emdvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk4NjksImV4cCI6MjA5NDkwNTg2OX0.5gzo9OWjsohsfdd5uKuDHAqkgoZ-zJyRy_zpirVm-ts';
            const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
            const { data: { user } } = await client.auth.getUser();
            
            if (user && user.user_metadata && user.user_metadata.full_name) {
                nombreUsuario = user.user_metadata.full_name.split(' ')[0];
            }
        }
    } catch (err) {
        console.error("Error al recuperar el nombre de Google Auth:", err);
    }

    // 3. Cálculos de actividad (semana hábil de lunes a viernes)
    const historial = await DB.obtenerTodos('historial_actividad');
    const hoy = new Date();

    const lunes = new Date(hoy);
    const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    lunes.setDate(hoy.getDate() - dia);
    lunes.setHours(0, 0, 0, 0);

    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    viernes.setHours(23, 59, 59, 999);

    // Sumatoria dinámica de tus puntos reales
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
    
    // Calcular días laborables restantes en la semana (incluyendo el día actual si es de lunes a viernes)
    const numDiaSemana = hoy.getDay(); // 0: Dom, 1: Lun, ..., 6: Sáb
    let diasRestantes = 0;
    if (numDiaSemana >= 1 && numDiaSemana <= 5) {
        diasRestantes = 6 - numDiaSemana; 
    }

    // Generar la alerta de cuota diaria adaptativa
    let cuotaDiariaTexto = '';
    if (puntosFaltantes <= 0) {
        cuotaDiariaTexto = `<div class="badge badge-green mt-8">🎉 ¡Meta semanal cumplida con éxito!</div>`;
    } else if (diasRestantes > 0) {
        const cuota = Math.ceil(puntosFaltantes / diasRestantes);
        cuotaDiariaTexto = `<div class="badge badge-red mt-8">Debes hacer ${cuota} puntos diarios</div>`;
    } else {
        cuotaDiariaTexto = `<div class="badge badge-orange mt-8">Fin de semana: Faltaron ${puntosFaltantes} puntos para la meta</div>`;
    }

    // 5. Control de Cartera (Sincronizado con el mes en curso)
    const cartera = await DB.obtenerTodos('cartera');
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

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
        const laPoliza = pendientesMes.length > 1 ? 'Las pólizas de' : 'La póliza de';
        textoCartera = `<p style="color: var(--danger); font-size: 15px; margin-top: 5px;">${laPoliza} ${listaNombres} ${verbo} de pago este mes.</p>`;
    }

    // 6. Inyección limpia de UI usando tus clases de styles.css
    container.innerHTML = `
        <div class="card" style="background: var(--accent) !important; color: white !important; border: none;">
            <h1 style="margin: 0; font-size: 24px; color: white !important;">${saludo}, ${nombreUsuario}. 👋</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; color: white !important;">Este es el estatus de tu negocio al día de hoy.</p>
        </div>

        <div class="card" style="border-left: 5px solid var(--accent) !important;">
            <h2 class="fw-600">📊 Productividad</h2>
            <p>Esta semana llevas <strong>${puntosSemana}</strong> puntos de ${metaTotal}. Te hacen falta <strong>${puntosFaltantes}</strong> puntos para llegar a la meta.</p>
            ${cuotaDiariaTexto}
        </div>

        <div class="card" style="border-left: 5px solid var(--danger) !important;">
            <h2 class="fw-600">💼 Control de Cartera</h2>
            ${textoCartera}
        </div>
    `;
}
